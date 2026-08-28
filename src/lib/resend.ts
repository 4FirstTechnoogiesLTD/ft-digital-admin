/**
 * Thin typed wrapper over the Resend REST API.
 * Server-only — imported exclusively from `*.server` modules / `src/fn/*`.
 */
import { serverEnv } from "@/lib/env";

const BASE = "https://api.resend.com";

function authHeaders() {
  return {
    Authorization: `Bearer ${serverEnv().RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface SendEmailInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: string }[]; // content = base64
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/emails`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      cc: input.cc?.length ? input.cc : undefined,
      bcc: input.bcc?.length ? input.bcc : undefined,
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: input.headers,
      attachments: input.attachments,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
  return (await res.json()) as { id: string };
}

export interface ReceivedEmail {
  id: string;
  to: string[];
  from: string;
  cc: string[];
  bcc: string[];
  reply_to: string[];
  created_at: string;
  subject: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string>;
  message_id: string;
  received_for: string[];
  attachments: {
    id: string;
    filename: string;
    content_type: string | null;
    content_id: string | null;
    size: number | null;
  }[];
  raw?: { download_url: string; expires_at: string };
}

export async function getReceivedEmail(id: string): Promise<ReceivedEmail> {
  const res = await fetch(`${BASE}/emails/receiving/${id}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend getReceivedEmail failed (${res.status}): ${body}`);
  }
  return (await res.json()) as ReceivedEmail;
}

/** Returns the attachment bytes for a received email. */
export async function downloadReceivedAttachment(
  emailId: string,
  attachmentId: string,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const res = await fetch(`${BASE}/emails/receiving/${emailId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${serverEnv().RESEND_API_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend attachment download failed (${res.status}): ${body}`);
  }
  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  // Some responses wrap the payload as JSON { download_url }.
  if (ct.includes("application/json")) {
    const j = (await res.json()) as { download_url?: string; url?: string };
    const url = j.download_url ?? j.url;
    if (!url) throw new Error("Resend attachment: no download_url in JSON response");
    const file = await fetch(url);
    return {
      bytes: await file.arrayBuffer(),
      contentType: file.headers.get("content-type") ?? "application/octet-stream",
    };
  }
  return { bytes: await res.arrayBuffer(), contentType: ct };
}
