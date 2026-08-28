import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "svix";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { getReceivedEmail, downloadReceivedAttachment } from "@/lib/resend";
import { normalizeSubject, parseAddress, snippetFromText } from "@/lib/mail-utils";

export const Route = createFileRoute("/api/resend/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = serverEnv();
        const raw = await request.text();

        // ── verify signature ────────────────────────────────────────────
        if (env.RESEND_WEBHOOK_SECRET) {
          try {
            const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
            wh.verify(raw, {
              "svix-id": request.headers.get("svix-id") ?? "",
              "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
              "svix-signature": request.headers.get("svix-signature") ?? "",
            });
          } catch (err) {
            console.error("[inbound] signature verification failed", err);
            return new Response("invalid signature", { status: 401 });
          }
        }

        let payload: { type?: string; data?: { email_id?: string } };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        if (payload.type !== "email.received" || !payload.data?.email_id) {
          return new Response("ignored", { status: 200 });
        }

        try {
          await ingest(payload.data.email_id);
        } catch (err) {
          console.error("[inbound] ingest failed", err);
          // 200 so Resend does not hammer retries on a poison message; logged above.
          return new Response("logged", { status: 200 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function ingest(emailId: string) {
  const env = serverEnv();
  const supabase = getSupabaseAdminClient();
  const email = await getReceivedEmail(emailId);

  // idempotency — already stored?
  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  if (existing) return;

  // ── resolve target mailbox ────────────────────────────────────────────
  const candidates = [...(email.received_for ?? []), ...(email.to ?? [])]
    .map((a) => parseAddress(a).email)
    .filter(Boolean);
  if (env.SHARED_MAILBOX_OWNER) candidates.push(env.SHARED_MAILBOX_OWNER.toLowerCase());

  let mailbox: { id: string; user_id: string; address: string } | null = null;
  for (const addr of candidates) {
    const { data } = await supabase
      .from("mailboxes")
      .select("id, user_id, address")
      .ilike("address", addr)
      .maybeSingle();
    if (data) {
      mailbox = data;
      break;
    }
  }
  if (!mailbox) {
    console.warn("[inbound] no mailbox for", candidates);
    return;
  }

  const headers = email.headers ?? {};
  const inReplyTo = headers["in-reply-to"] ?? headers["In-Reply-To"] ?? null;
  const refsHeader = headers["references"] ?? headers["References"] ?? "";
  const refs = refsHeader.split(/\s+/).filter(Boolean);
  const fromAddr = parseAddress(email.from);
  const now = new Date().toISOString();
  const snippet = snippetFromText(email.text, email.html);

  // ── resolve thread ────────────────────────────────────────────────────
  let threadId: string | null = null;
  const refIds = [inReplyTo, ...refs].filter(Boolean) as string[];
  if (refIds.length) {
    const { data: parent } = await supabase
      .from("messages")
      .select("thread_id")
      .eq("mailbox_id", mailbox.id)
      .in("message_id", refIds)
      .limit(1)
      .maybeSingle();
    if (parent) threadId = parent.thread_id;
  }
  if (!threadId) {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 864e5).toISOString();
    const { data: bySubject } = await supabase
      .from("threads")
      .select("id, subject")
      .eq("mailbox_id", mailbox.id)
      .gte("last_message_at", sixtyDaysAgo)
      .order("last_message_at", { ascending: false })
      .limit(50);
    const norm = normalizeSubject(email.subject ?? "");
    const hit = (bySubject ?? []).find(
      (t) => normalizeSubject(t.subject) === norm && norm.length > 0,
    );
    if (hit) threadId = hit.id;
  }
  if (!threadId) {
    const { data: t } = await supabase
      .from("threads")
      .insert({
        mailbox_id: mailbox.id,
        subject: email.subject || "(no subject)",
        snippet,
        folder: "inbox",
        last_message_at: now,
      })
      .select("id")
      .single();
    threadId = t!.id;
  } else {
    await supabase
      .from("threads")
      .update({ folder: "inbox", last_message_at: now, snippet })
      .eq("id", threadId);
  }

  // ── insert message ────────────────────────────────────────────────────
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      mailbox_id: mailbox.id,
      direction: "inbound",
      resend_email_id: emailId,
      message_id: email.message_id ?? null,
      in_reply_to: inReplyTo,
      references: refs,
      from_addr: fromAddr.email,
      from_name: fromAddr.name ?? null,
      to_addrs: (email.to ?? []).map((a) => parseAddress(a)),
      cc_addrs: (email.cc ?? []).map((a) => parseAddress(a)),
      subject: email.subject || "(no subject)",
      html: email.html,
      text: email.text,
      headers: headers as Record<string, string>,
      folder: "inbox",
      is_read: false,
      has_attachments: (email.attachments?.length ?? 0) > 0,
      received_at: email.created_at ?? now,
      raw_download_url: email.raw?.download_url ?? null,
    })
    .select("id")
    .single();

  // ── counters ──────────────────────────────────────────────────────────
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);
  const { count: unread } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .eq("is_read", false);
  await supabase
    .from("threads")
    .update({ message_count: count ?? 1, unread_count: unread ?? 1 })
    .eq("id", threadId);

  // ── attachments ───────────────────────────────────────────────────────
  for (const att of email.attachments ?? []) {
    try {
      const { bytes, contentType } = await downloadReceivedAttachment(emailId, att.id);
      const safeName = (att.filename || "attachment").replace(/[^\w.\- ]+/g, "_");
      const path = `${mailbox.user_id}/${emailId}/${att.id}-${safeName}`;
      const up = await supabase.storage
        .from("mail-attachments")
        .upload(path, bytes, { contentType: att.content_type ?? contentType, upsert: true });
      await supabase.from("attachments").insert({
        message_id: msg!.id,
        resend_attachment_id: att.id,
        filename: att.filename || "attachment",
        content_type: att.content_type ?? contentType,
        size: att.size ?? bytes.byteLength,
        storage_path: up.error ? null : path,
        content_id: att.content_id,
      });
    } catch (err) {
      console.error("[inbound] attachment failed", att.id, err);
    }
  }

  // address book
  await supabase.from("contacts").upsert(
    {
      mailbox_id: mailbox.id,
      email: fromAddr.email,
      name: fromAddr.name ?? null,
      last_contacted_at: now,
    },
    { onConflict: "mailbox_id,email" },
  );
}
