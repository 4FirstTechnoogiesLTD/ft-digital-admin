import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "svix";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { getReceivedEmail, downloadReceivedAttachment } from "@/lib/resend";
import { normalizeSubject, parseAddress, snippetFromText } from "@/lib/mail-utils";

export const Route = createFileRoute("/api/resend/inbound")({
  server: {
    handlers: {
      GET: async () => {
        // Health check endpoint for webhook accessibility
        return new Response(
          JSON.stringify({
            status: "ok",
            message: "Webhook endpoint is accessible",
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      POST: async ({ request }) => {
        const env = serverEnv();
        const raw = await request.text();

        console.log("[inbound] webhook received", {
          hasSecret: Boolean(env.RESEND_WEBHOOK_SECRET),
          contentType: request.headers.get("content-type"),
          svixId: request.headers.get("svix-id"),
          svixTimestamp: request.headers.get("svix-timestamp"),
          svixSignature: request.headers.get("svix-signature"),
          rawLength: raw.length,
        });

        // ── verify signature ────────────────────────────────────────────
        if (env.RESEND_WEBHOOK_SECRET) {
          try {
            const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
            wh.verify(raw, {
              "svix-id": request.headers.get("svix-id") ?? "",
              "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
              "svix-signature": request.headers.get("svix-signature") ?? "",
            });
            console.log("[inbound] signature verified successfully");
          } catch (err) {
            console.error("[inbound] signature verification failed", err);
            // For debugging, log the raw payload (be careful with sensitive data)
            console.log("[inbound] raw payload preview", raw.substring(0, 200));
            return new Response("invalid signature", { status: 401 });
          }
        } else {
          console.warn("[inbound] RESEND_WEBHOOK_SECRET not configured - skipping signature verification");
        }

        let payload: { type?: string; data?: { email_id?: string } };
        try {
          payload = JSON.parse(raw);
          console.log("[inbound] parsed payload", { type: payload.type, hasEmailId: Boolean(payload.data?.email_id) });
        } catch (err) {
          console.error("[inbound] JSON parse failed", err);
          return new Response("bad json", { status: 400 });
        }

        // Handle different webhook event types
        if (payload.type === "email.received" && payload.data?.email_id) {
          console.log("[inbound] processing email.received", payload.data.email_id);
          try {
            await ingest(payload.data.email_id);
            console.log("[inbound] email.received processed successfully");
          } catch (err) {
            console.error("[inbound] ingest failed", err);
            // 200 so Resend does not hammer retries on a poison message; logged above.
            return new Response("logged", { status: 200 });
          }
          return new Response("ok", { status: 200 });
        }

        // Handle sent/delivered events to update message status
        if ((payload.type === "email.sent" || payload.type === "email.delivered") && payload.data?.email_id) {
          console.log("[inbound] processing", payload.type, payload.data.email_id);
          try {
            await updateSentMessageStatus(payload.data.email_id, payload.type);
            console.log("[inbound]", payload.type, "processed successfully");
          } catch (err) {
            console.error("[inbound] status update failed", err);
            return new Response("logged", { status: 200 });
          }
          return new Response("ok", { status: 200 });
        }

        console.log("[inbound] ignoring event type", payload.type);
        return new Response("ignored", { status: 200 });
      },
    },
  },
});

async function ingest(emailId: string) {
  const env = serverEnv();
  const supabase = getSupabaseAdminClient();
  console.log("[inbound] fetching email from Resend", emailId);
  const email = await getReceivedEmail(emailId);
  console.log("[inbound] email fetched", {
    from: email.from,
    to: email.to,
    subject: email.subject,
    receivedFor: email.received_for,
  });

  // idempotency — already stored?
  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  if (existing) {
    console.log("[inbound] email already exists, skipping", emailId);
    return;
  }

  // ── resolve target mailbox ────────────────────────────────────────────
  const candidates = [...(email.received_for ?? []), ...(email.to ?? [])]
    .map((a) => parseAddress(a).email)
    .filter(Boolean);
  if (env.SHARED_MAILBOX_OWNER) candidates.push(env.SHARED_MAILBOX_OWNER.toLowerCase());

  console.log("[inbound] mailbox candidates", candidates);
  let mailbox: { id: string; user_id: string; address: string } | null = null;
  for (const addr of candidates) {
    const { data } = await supabase
      .from("mailboxes")
      .select("id, user_id, address")
      .ilike("address", addr)
      .maybeSingle();
    if (data) {
      mailbox = data;
      console.log("[inbound] found mailbox", data.address);
      break;
    }
  }
  if (!mailbox) {
    console.warn("[inbound] no mailbox for candidates", candidates);
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

async function updateSentMessageStatus(emailId: string, eventType: string) {
  const supabase = getSupabaseAdminClient();

  // Find the message by resend_email_id
  const { data: message } = await supabase
    .from("messages")
    .select("id, thread_id, mailbox_id")
    .eq("resend_email_id", emailId)
    .maybeSingle();

  if (!message) {
    console.warn("[inbound] no message found for resend_email_id", emailId);
    return;
  }

  // Update message status based on event type
  // For now, we just log the event - you can extend this to track delivery status
  if (eventType === "email.delivered") {
    console.log("[inbound] email delivered", emailId, "message_id", message.id);
    // You could add a delivered_at timestamp or status field to the messages table
  } else if (eventType === "email.sent") {
    console.log("[inbound] email sent confirmed", emailId, "message_id", message.id);
  }
}
