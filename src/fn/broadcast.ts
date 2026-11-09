import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getSupabaseServerClient,
  getSupabaseAdminClient,
  getVerifiedUser,
} from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { kickOutbox } from "@/lib/broadcast-queue";
import { snippetFromText, type Addr } from "@/lib/mail-utils";

const FOLDERS = ["inbox", "sent", "drafts", "archive", "spam", "trash"] as const;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

async function requireMailbox() {
  const supabase = getSupabaseServerClient();
  const user = await getVerifiedUser(supabase);
  const { data: mailbox } = await supabase
    .from("mailboxes")
    .select("id, address, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mailbox) throw new Error("No mailbox");
  return { supabase, mailbox };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Distinct sender addresses for a set of threads: either explicit thread ids
 * (current-page selection) or every thread in a folder/search (select-all
 * across pages). Own address is excluded.
 */
export const getThreadSenders = createServerFn({ method: "POST" })
  .validator(
    z.union([
      z.object({ threadIds: z.array(z.string().uuid()).min(1).max(5000) }),
      z.object({
        allInFolder: z.object({
          folder: z.enum(FOLDERS),
          search: z.string().trim().optional(),
        }),
      }),
    ]),
  )
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();

    let threadIds: string[];
    if ("threadIds" in data) {
      threadIds = data.threadIds;
    } else {
      threadIds = [];
      for (let from = 0; ; from += 1000) {
        let q = supabase
          .from("threads")
          .select("id")
          .eq("mailbox_id", mailbox.id)
          .eq("folder", data.allInFolder.folder)
          .order("last_message_at", { ascending: false })
          .range(from, from + 999);
        const s = data.allInFolder.search;
        if (s) q = q.or(`subject.ilike.%${s}%,snippet.ilike.%${s}%`);
        const { data: page, error } = await q;
        if (error) throw error;
        threadIds.push(...(page ?? []).map((t) => t.id));
        if ((page?.length ?? 0) < 1000) break;
      }
    }

    const senders = new Map<string, Addr>();
    for (const ids of chunk(threadIds, 150)) {
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("from_addr, from_name, created_at")
        .eq("mailbox_id", mailbox.id)
        .eq("direction", "inbound")
        .in("thread_id", ids)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      for (const m of msgs ?? []) {
        const email = String(m.from_addr ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email === mailbox.address.toLowerCase()) continue;
        if (!senders.has(email)) senders.set(email, { email, name: m.from_name ?? undefined });
      }
    }

    return { senders: [...senders.values()], threadCount: threadIds.length };
  });

const addrSchema = z.object({ name: z.string().optional(), email: z.string().email() });

/**
 * Queue one individual email per recipient (no cap). The drain loop sends them
 * at the Resend rate limit; the call returns as soon as they are queued.
 */
export const enqueueBroadcast = createServerFn({ method: "POST" })
  .validator(
    z.object({
      to: z.array(addrSchema).min(1),
      subject: z.string().max(500).default("(no subject)"),
      html: z.string().default(""),
      text: z.string().default(""),
      attachmentPaths: z.array(z.string()).max(10).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();
    const db = getSupabaseAdminClient();

    // dedupe case-insensitively
    const recipients = new Map<string, Addr>();
    for (const a of data.to) recipients.set(a.email.toLowerCase(), { ...a, email: a.email.toLowerCase() });
    const list = [...recipients.values()];

    const now = new Date().toISOString();
    const snippet = snippetFromText(data.text, data.html);

    // internal record so the broadcast shows in Sent
    const { data: thread, error: tErr } = await supabase
      .from("threads")
      .insert({
        mailbox_id: mailbox.id,
        subject: data.subject,
        snippet,
        folder: "sent",
        last_message_at: now,
        message_count: 1,
      })
      .select("id")
      .single();
    if (tErr) throw tErr;

    await supabase.from("messages").insert({
      thread_id: thread.id,
      mailbox_id: mailbox.id,
      direction: "outbound",
      message_id: `<${crypto.randomUUID()}@${serverEnv().MAIL_DOMAIN}>`,
      from_addr: mailbox.address,
      from_name: mailbox.display_name || null,
      to_addrs: list,
      subject: data.subject,
      html: data.html || null,
      text: data.text || null,
      folder: "sent",
      is_read: true,
      has_attachments: data.attachmentPaths.length > 0,
      sent_at: now,
    });

    const { data: broadcast, error: bErr } = await db
      .from("mail_broadcasts")
      .insert({
        mailbox_id: mailbox.id,
        thread_id: thread.id,
        subject: data.subject,
        html: data.html || null,
        text_body: data.text || null,
        attachment_paths: data.attachmentPaths,
        total: list.length,
      })
      .select("id")
      .single();
    if (bErr) throw bErr;

    for (const part of chunk(list, 500)) {
      const { error } = await db.from("mail_outbox").insert(
        part.map((a) => ({
          broadcast_id: broadcast.id,
          mailbox_id: mailbox.id,
          to_email: a.email,
          to_name: a.name ?? null,
        })),
      );
      if (error) throw error;
    }

    kickOutbox();
    return { broadcastId: broadcast.id as string, threadId: thread.id as string, total: list.length };
  });

/** Progress of one broadcast. Polling this also restarts a drain that died. */
export const getBroadcastProgress = createServerFn({ method: "GET" })
  .validator(z.object({ broadcastId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { mailbox } = await requireMailbox();
    const db = getSupabaseAdminClient();

    const { data: b } = await db
      .from("mail_broadcasts")
      .select("id, total, subject")
      .eq("id", data.broadcastId)
      .eq("mailbox_id", mailbox.id)
      .maybeSingle();
    if (!b) throw new Error("Broadcast not found");

    const count = async (status: string) => {
      const { count } = await db
        .from("mail_outbox")
        .select("id", { count: "exact", head: true })
        .eq("broadcast_id", b.id)
        .eq("status", status);
      return count ?? 0;
    };
    const [sent, failed, pending, sending] = await Promise.all([
      count("sent"),
      count("failed"),
      count("pending"),
      count("sending"),
    ]);

    if (pending + sending > 0) kickOutbox();
    return { total: b.total as number, sent, failed, queued: pending + sending, subject: b.subject as string };
  });
