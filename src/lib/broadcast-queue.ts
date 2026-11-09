/**
 * Rate-limited drain loop for the `mail_outbox` table.
 * Server-only. One loop per process, shared by all broadcasts, so the Resend
 * rate limit (2 req/s by default) is respected no matter how many are queued.
 * State lives in the database, so a restart loses nothing: stale claims are
 * recovered and the next `kickOutbox()` resumes the drain.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/resend";

const MIN_INTERVAL_MS = Number(process.env.MAIL_SEND_INTERVAL_MS ?? 600); // < 2 req/s
const MAX_ATTEMPTS = 4;
const STALE_CLAIM_MS = 2 * 60_000;

let running = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Attachment = { filename: string; content: string };
const attachmentCache = new Map<string, Attachment[]>();

/** Start draining if not already running. Safe to call as often as you like. */
export function kickOutbox() {
  if (running) return;
  running = true;
  void drain()
    .catch((err) => console.error("[outbox] drain crashed", err))
    .finally(() => {
      running = false;
    });
}

async function drain() {
  const db = getSupabaseAdminClient();

  // recover rows claimed by a process that died mid-send
  await db
    .from("mail_outbox")
    .update({ status: "pending", claimed_at: null })
    .eq("status", "sending")
    .lt("claimed_at", new Date(Date.now() - STALE_CLAIM_MS).toISOString());

  for (;;) {
    const started = Date.now();
    const row = await claimNext(db);
    if (!row) {
      // nothing due; if rows are merely waiting on a backoff, wait for them
      const { data: waiting } = await db
        .from("mail_outbox")
        .select("send_after")
        .eq("status", "pending")
        .order("send_after", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!waiting) return;
      await sleep(
        Math.min(Math.max(new Date(waiting.send_after).getTime() - Date.now(), 250), 30_000),
      );
      continue;
    }

    const retryAfterMs = await sendRow(db, row);
    await auditIfFinished(db, row.broadcast_id).catch((e) =>
      console.error("[outbox] audit failed", e),
    );
    const elapsed = Date.now() - started;
    await sleep(Math.max(retryAfterMs ?? 0, MIN_INTERVAL_MS - elapsed, 0));
  }
}

/** Atomically move the oldest due pending row to "sending". */
async function claimNext(db: ReturnType<typeof getSupabaseAdminClient>) {
  for (let i = 0; i < 5; i++) {
    const { data: candidate } = await db
      .from("mail_outbox")
      .select("id")
      .eq("status", "pending")
      .lte("send_after", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!candidate) return null;
    const { data: claimed } = await db
      .from("mail_outbox")
      .update({ status: "sending", claimed_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select("id, broadcast_id, mailbox_id, to_email, to_name, attempts")
      .maybeSingle();
    if (claimed) return claimed; // lost the race otherwise: try the next one
  }
  return null;
}

/** Returns a retry-after delay (ms) when Resend throttled us. */
async function sendRow(
  db: ReturnType<typeof getSupabaseAdminClient>,
  row: {
    id: string;
    broadcast_id: string;
    mailbox_id: string;
    to_email: string;
    to_name: string | null;
    attempts: number;
  },
): Promise<number | undefined> {
  try {
    const { data: b } = await db
      .from("mail_broadcasts")
      .select("subject, html, text_body, attachment_paths")
      .eq("id", row.broadcast_id)
      .single();
    const { data: mb } = await db
      .from("mailboxes")
      .select("address, display_name")
      .eq("id", row.mailbox_id)
      .single();
    if (!b || !mb) throw new Error("broadcast or mailbox missing");

    const attachments = await loadAttachments(db, row.broadcast_id, b.attachment_paths ?? []);
    const sent = await sendEmail({
      from: mb.display_name ? `${mb.display_name} <${mb.address}>` : mb.address,
      to: [row.to_name ? `${row.to_name} <${row.to_email}>` : row.to_email],
      subject: b.subject,
      html: b.html ?? undefined,
      text: b.text_body ?? undefined,
      headers: { "Message-ID": `<${crypto.randomUUID()}@${serverEnv().MAIL_DOMAIN}>` },
      attachments: attachments.length ? attachments : undefined,
    });
    await db
      .from("mail_outbox")
      .update({
        status: "sent",
        resend_email_id: sent.id,
        sent_at: new Date().toISOString(),
        attempts: row.attempts + 1,
        error: null,
      })
      .eq("id", row.id);
    return undefined;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const throttled = /\((429)\)/.test(msg);
    const attempts = row.attempts + (throttled ? 0 : 1); // throttling isn't the row's fault
    const giveUp = attempts >= MAX_ATTEMPTS || /\((400|401|403|422)\)/.test(msg);
    const backoff = throttled ? 5_000 : 2 ** attempts * 2_000;
    await db
      .from("mail_outbox")
      .update({
        status: giveUp ? "failed" : "pending",
        attempts,
        error: msg.slice(0, 500),
        claimed_at: null,
        send_after: new Date(Date.now() + backoff).toISOString(),
      })
      .eq("id", row.id);
    return throttled ? backoff : undefined;
  }
}

/** Writes one "broadcast finished" audit entry when no rows remain in flight. */
async function auditIfFinished(db: ReturnType<typeof getSupabaseAdminClient>, broadcastId: string) {
  const count = async (statuses: string[]) => {
    const { count } = await db
      .from("mail_outbox")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .in("status", statuses);
    return count ?? 0;
  };
  if ((await count(["pending", "sending"])) > 0) return;

  // already logged (e.g. the process restarted after the last send)?
  const { data: existing } = await db
    .from("audit_log")
    .select("id")
    .eq("entity", "mail_broadcast")
    .eq("entity_id", broadcastId)
    .eq("action", "finished broadcast")
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const [sent, failed] = await Promise.all([count(["sent"]), count(["failed"])]);
  const { data: b } = await db
    .from("mail_broadcasts")
    .select("created_by, subject, total")
    .eq("id", broadcastId)
    .maybeSingle();
  await db.from("audit_log").insert({
    actor_user_id: b?.created_by ?? null,
    action: "finished broadcast",
    entity: "mail_broadcast",
    entity_id: broadcastId,
    diff: { subject: b?.subject, total: b?.total, sent, failed },
  });
}

async function loadAttachments(
  db: ReturnType<typeof getSupabaseAdminClient>,
  broadcastId: string,
  paths: string[],
): Promise<Attachment[]> {
  if (!paths.length) return [];
  const cached = attachmentCache.get(broadcastId);
  if (cached) return cached;
  const out: Attachment[] = [];
  for (const path of paths) {
    const { data: blob, error } = await db.storage.from("mail-attachments").download(path);
    if (error || !blob) continue;
    out.push({
      filename: path.split("/").pop() ?? "attachment",
      content: Buffer.from(await blob.arrayBuffer()).toString("base64"),
    });
  }
  attachmentCache.set(broadcastId, out);
  if (attachmentCache.size > 5) attachmentCache.delete(attachmentCache.keys().next().value!);
  return out;
}
