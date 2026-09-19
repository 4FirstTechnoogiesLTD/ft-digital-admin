import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/resend";
import { normalizeSubject, replySubject, snippetFromText, type Addr } from "@/lib/mail-utils";
import type { MailFolder } from "@/lib/database.types";

// ── helpers ────────────────────────────────────────────────────────────────

async function requireMailbox() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let { data: mailbox } = await supabase
    .from("mailboxes")
    .select("id, address, display_name, signature_rich, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mailbox) {
    // auto-provision from the member's login email localpart
    const local = (user.email ?? user.id)
      .split("@")[0]
      .replace(/[^a-z0-9._-]/gi, "")
      .toLowerCase();
    const address = `${local || user.id.slice(0, 8)}@${serverEnv().MAIL_DOMAIN}`;
    const { data: created, error } = await supabase
      .from("mailboxes")
      .insert({ user_id: user.id, address, display_name: user.email ?? "" })
      .select("id, address, display_name, signature_rich, user_id")
      .single();
    if (error) throw error;
    mailbox = created;
  }
  return { supabase, user, mailbox };
}

function asAddrArray(v: unknown): Addr[] {
  if (!Array.isArray(v)) return [];
  return v as Addr[];
}

// ── queries ────────────────────────────────────────────────────────────────

export const getMailboxOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, mailbox } = await requireMailbox();

  const folders: MailFolder[] = ["inbox", "sent", "drafts", "archive", "spam", "trash"];
  const counts: Record<string, { total: number; unread: number }> = {};
  await Promise.all(
    folders.map(async (f) => {
      const [{ count: total }, { count: unread }] = await Promise.all([
        supabase
          .from("threads")
          .select("id", { count: "exact", head: true })
          .eq("mailbox_id", mailbox.id)
          .eq("folder", f),
        supabase
          .from("threads")
          .select("id", { count: "exact", head: true })
          .eq("mailbox_id", mailbox.id)
          .eq("folder", f)
          .gt("unread_count", 0),
      ]);
      counts[f] = { total: total ?? 0, unread: unread ?? 0 };
    }),
  );

  const { data: labels } = await supabase
    .from("labels")
    .select("id, name, color")
    .eq("mailbox_id", mailbox.id)
    .order("name");

  return {
    mailbox: {
      id: mailbox.id,
      address: mailbox.address,
      displayName: mailbox.display_name,
      signature: mailbox.signature_rich,
    },
    counts,
    labels: labels ?? [],
  };
});

export const listThreads = createServerFn({ method: "GET" })
  .validator(
    z.object({
      folder: z.enum(["inbox", "sent", "drafts", "archive", "spam", "trash"]).default("inbox"),
      label: z.string().optional(),
      search: z.string().trim().optional(),
      limit: z.number().min(1).max(100).default(40),
      offset: z.number().min(0).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();
    let q = supabase
      .from("threads")
      .select(
        "id, subject, snippet, last_message_at, message_count, unread_count, is_starred, labels, folder",
      )
      .eq("mailbox_id", mailbox.id)
      .eq("folder", data.folder)
      .order("last_message_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.label) q = q.contains("labels", [data.label]);
    if (data.search) q = q.or(`subject.ilike.%${data.search}%,snippet.ilike.%${data.search}%`);

    const { data: threads, error } = await q;
    if (error) throw error;
    return { threads: threads ?? [] };
  });

export const getThread = createServerFn({ method: "GET" })
  .validator(z.object({ threadId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();

    const { data: thread } = await supabase
      .from("threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("mailbox_id", mailbox.id)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .eq("folder", thread.folder)
      .order("created_at", { ascending: true });

    const ids = (messages ?? []).map((m) => m.id);
    const { data: attachments } = ids.length
      ? await supabase.from("attachments").select("*").in("message_id", ids)
      : { data: [] as any[] };

    // sign attachment URLs (private bucket)
    const signed: Record<string, string> = {};
    await Promise.all(
      (attachments ?? [])
        .filter((a) => a.storage_path)
        .map(async (a) => {
          const { data: s } = await supabase.storage
            .from("mail-attachments")
            .createSignedUrl(a.storage_path as string, 60 * 30);
          if (s?.signedUrl) signed[a.id] = s.signedUrl;
        }),
    );

    const avatars = await avatarsForAddresses((messages ?? []).map((m) => m.from_addr as string));

    return {
      thread,
      messages: (messages ?? []).map((m) => ({
        ...m,
        fromAvatarUrl: avatars[String(m.from_addr).toLowerCase()] ?? null,
        attachments: (attachments ?? [])
          .filter((a) => a.message_id === m.id)
          .map((a) => ({ ...a, signedUrl: signed[a.id] ?? null })),
      })),
    };
  });

// ── mutations ──────────────────────────────────────────────────────────────

const addrSchema = z.object({ name: z.string().optional(), email: z.string().email() });

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      threadId: z.string().uuid().optional(),
      inReplyToMessageId: z.string().uuid().optional(),
      to: z.array(addrSchema).min(1),
      cc: z.array(addrSchema).default([]),
      bcc: z.array(addrSchema).default([]),
      subject: z.string().max(500).default("(no subject)"),
      html: z.string().default(""),
      text: z.string().default(""),
      attachmentPaths: z.array(z.string()).max(10).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user, mailbox } = await requireMailbox();
    const env = serverEnv();

    // gather threading headers
    let inReplyTo: string | null = null;
    let references: string[] = [];
    if (data.inReplyToMessageId) {
      const { data: parent } = await supabase
        .from("messages")
        .select("message_id, references")
        .eq("id", data.inReplyToMessageId)
        .maybeSingle();
      if (parent?.message_id) {
        inReplyTo = parent.message_id;
        references = [...(parent.references ?? []), parent.message_id];
      }
    }

    const ourMessageId = `<${crypto.randomUUID()}@${env.MAIL_DOMAIN}>`;
    const fromName = mailbox.display_name || undefined;
    const from = fromName ? `${fromName} <${mailbox.address}>` : mailbox.address;

    // pull attachments from storage → base64
    const attachments: { filename: string; content: string }[] = [];
    for (const path of data.attachmentPaths) {
      const { data: blob, error } = await supabase.storage.from("mail-attachments").download(path);
      if (error || !blob) continue;
      const buf = Buffer.from(await blob.arrayBuffer());
      attachments.push({
        filename: path.split("/").pop() ?? "attachment",
        content: buf.toString("base64"),
      });
    }

    const headers: Record<string, string> = { "Message-ID": ourMessageId };
    if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
    if (references.length) headers["References"] = references.join(" ");

    const sent = await sendEmail({
      from,
      to: data.to.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)),
      cc: data.cc.map((a) => a.email),
      bcc: data.bcc.map((a) => a.email),
      subject: data.subject,
      html: data.html || undefined,
      text: data.text || undefined,
      headers,
      attachments: attachments.length ? attachments : undefined,
    });

    // resolve / create thread
    let threadId = data.threadId ?? null;
    const now = new Date().toISOString();
    const snippet = snippetFromText(data.text, data.html);

    if (threadId) {
      await supabase
        .from("threads")
        .update({ last_message_at: now, snippet })
        .eq("id", threadId)
        .eq("mailbox_id", mailbox.id);
    } else {
      const { data: t } = await supabase
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
      threadId = t!.id;
    }

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId!,
        mailbox_id: mailbox.id,
        direction: "outbound",
        resend_email_id: sent.id,
        message_id: ourMessageId,
        in_reply_to: inReplyTo,
        references,
        from_addr: mailbox.address,
        from_name: mailbox.display_name || null,
        to_addrs: data.to,
        cc_addrs: data.cc,
        bcc_addrs: data.bcc,
        subject: data.subject,
        html: data.html || null,
        text: data.text || null,
        folder: "sent",
        is_read: true,
        has_attachments: attachments.length > 0,
        sent_at: now,
      })
      .select("id")
      .single();

    // bump thread counters
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId!);
    await supabase
      .from("threads")
      .update({ message_count: count ?? 1, last_message_at: now, snippet })
      .eq("id", threadId!);

    // link uploaded attachments to the outbound message
    for (const path of data.attachmentPaths) {
      await supabase.from("attachments").insert({
        message_id: msg!.id,
        filename: path.split("/").pop() ?? "attachment",
        storage_path: path,
      });
    }

    // address book
    for (const a of [...data.to, ...data.cc]) {
      await supabase
        .from("contacts")
        .upsert(
          { mailbox_id: mailbox.id, email: a.email, name: a.name ?? null, last_contacted_at: now },
          { onConflict: "mailbox_id,email" },
        );
    }

    return { threadId, messageId: msg!.id, resendId: sent.id };
  });

export const setThreadFlags = createServerFn({ method: "POST" })
  .validator(
    z.object({
      threadId: z.string().uuid(),
      folder: z.enum(["inbox", "sent", "drafts", "archive", "spam", "trash"]).optional(),
      isStarred: z.boolean().optional(),
      labels: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();
    const patch: Record<string, unknown> = {};
    if (data.folder) patch.folder = data.folder;
    if (typeof data.isStarred === "boolean") patch.is_starred = data.isStarred;
    if (data.labels) patch.labels = data.labels;

    await supabase
      .from("threads")
      .update(patch)
      .eq("id", data.threadId)
      .eq("mailbox_id", mailbox.id);
    if (data.folder) {
      await supabase
        .from("messages")
        .update({ folder: data.folder })
        .eq("thread_id", data.threadId)
        .eq("mailbox_id", mailbox.id);
    }
    return { ok: true };
  });

export const setThreadRead = createServerFn({ method: "POST" })
  .validator(z.object({ threadId: z.string().uuid(), isRead: z.boolean() }))
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();
    await supabase
      .from("messages")
      .update({ is_read: data.isRead })
      .eq("thread_id", data.threadId)
      .eq("mailbox_id", mailbox.id);
    await supabase
      .from("threads")
      .update({ unread_count: data.isRead ? 0 : 1 })
      .eq("id", data.threadId)
      .eq("mailbox_id", mailbox.id);
    return { ok: true };
  });

export const saveMailboxSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      displayName: z.string().max(120),
      signature: z.any().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();
    await supabase
      .from("mailboxes")
      .update({ display_name: data.displayName, signature_rich: data.signature })
      .eq("id", mailbox.id);
    return { ok: true };
  });

export const createLabel = createServerFn({ method: "POST" })
  .validator(
    z.object({ name: z.string().trim().min(1).max(40), color: z.string().default("#c0562a") }),
  )
  .handler(async ({ data }) => {
    const { supabase, mailbox } = await requireMailbox();
    const { data: label, error } = await supabase
      .from("labels")
      .insert({ mailbox_id: mailbox.id, name: data.name, color: data.color })
      .select("id, name, color")
      .single();
    if (error) throw error;
    return label;
  });

export { normalizeSubject, replySubject, asAddrArray };

/**
 * Maps sender addresses to team profile images. Runs with the service role
 * because `mailboxes` is owner-only under RLS — it reads nothing but the
 * address → avatar pairing, and only for addresses already in the thread.
 */
async function avatarsForAddresses(addresses: string[]): Promise<Record<string, string>> {
  const wanted = [...new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean))];
  if (!wanted.length) return {};
  const admin = getSupabaseAdminClient();
  const { data: boxes } = await admin
    .from("mailboxes")
    .select("address, user_id")
    .in("address", wanted);
  if (!boxes?.length) return {};
  const { data: members } = await admin
    .from("members")
    .select("user_id, avatar_url")
    .in(
      "user_id",
      boxes.map((b) => b.user_id),
    );
  const byUser = new Map((members ?? []).map((m) => [m.user_id, m.avatar_url]));
  const out: Record<string, string> = {};
  for (const b of boxes) {
    const url = byUser.get(b.user_id);
    if (url) out[b.address.toLowerCase()] = url;
  }
  return out;
}
