import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/rich-editor";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { docToHtml } from "@/lib/tiptap";
import { plainTextFromHtml, parseAddressList, sanitizeEmailHtml } from "@/lib/mail-utils";
import { sendMessage } from "@/fn/mail";
import { EMPTY_DOC } from "@/lib/tiptap";
import { cn } from "@/lib/utils";

/** White "paper" styling for email content, so senders' dark text stays readable. */
export const EMAIL_LIGHT_SURFACE =
  "bg-white text-neutral-900 [color-scheme:light] [&_.tiptap]:text-neutral-900 [&_strong]:text-neutral-900 [&_blockquote]:text-neutral-600 [&_a]:text-blue-700 [&_a]:underline";

export interface ComposerDefaults {
  to?: string;
  cc?: string;
  subject?: string;
  threadId?: string;
  inReplyToMessageId?: string;
  quotedHtml?: string;
  body?: JSONContent;
}

interface Props {
  mailbox: { address: string; displayName: string; signature?: JSONContent | null } | null;
  defaults?: ComposerDefaults;
  compact?: boolean;
  /** Render the message body, signature and quoted text on a white background. */
  lightBody?: boolean;
  onSent: (threadId: string) => void;
  onCancel?: () => void;
}

interface PendingAttachment {
  name: string;
  size: number;
  path: string;
  uploading: boolean;
}

export function MessageComposer({
  mailbox,
  defaults,
  compact,
  lightBody,
  onSent,
  onCancel,
}: Props) {
  const [to, setTo] = useState(defaults?.to ?? "");
  const [cc, setCc] = useState(defaults?.cc ?? "");
  const [showCc, setShowCc] = useState(Boolean(defaults?.cc));
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState<JSONContent>(defaults?.body ?? EMPTY_DOC);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [showQuoted, setShowQuoted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    for (const file of Array.from(files)) {
      if (file.size > 24 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 24 MB`);
        continue;
      }
      const path = `${user.id}/outbox/${crypto.randomUUID()}-${file.name.replace(/[^\w.\- ]+/g, "_")}`;
      const pending: PendingAttachment = {
        name: file.name,
        size: file.size,
        path,
        uploading: true,
      };
      setAttachments((a) => [...a, pending]);
      const { error } = await supabase.storage.from("mail-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      setAttachments((a) =>
        a.map((x) => (x.path === path ? { ...x, uploading: false } : x)).filter(Boolean),
      );
      if (error) {
        toast.error(`Upload failed: ${file.name}`);
        setAttachments((a) => a.filter((x) => x.path !== path));
      }
    }
  }

  async function submit() {
    const toList = parseAddressList(to);
    if (!toList.length) {
      toast.error("Add at least one recipient");
      return;
    }
    if (attachments.some((a) => a.uploading)) {
      toast.error("Attachments still uploading");
      return;
    }
    setSending(true);
    try {
      let html = docToHtml(body);
      if (defaults?.quotedHtml) {
        html += `<br><blockquote>${defaults.quotedHtml}</blockquote>`;
      }
      if (mailbox?.signature && includeSignature) {
        html += `<br>--<br>${docToHtml(mailbox.signature)}`;
      }
      const res = await sendMessage({
        data: {
          threadId: defaults?.threadId,
          inReplyToMessageId: defaults?.inReplyToMessageId,
          to: toList.map((a) => ({ name: a.name, email: a.email })),
          cc: parseAddressList(cc).map((a) => ({ name: a.name, email: a.email })),
          bcc: [],
          subject: subject || "(no subject)",
          html,
          text: plainTextFromHtml(html),
          attachmentPaths: attachments.map((a) => a.path),
        },
      });
      toast.success("Message sent");
      onSent(res.threadId as string);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send. Check the address domain is verified in Resend.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div className="text-mono-label">
          From {mailbox?.displayName ? `${mailbox.displayName} · ` : ""}
          {mailbox?.address}
        </div>
      )}

      <Row label="To">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="name@example.com, another@example.com"
          className="w-full min-w-0 bg-transparent text-base focus:outline-none md:text-sm"
        />
        {!showCc && (
          <button
            type="button"
            onClick={() => setShowCc(true)}
            className="text-mono-label shrink-0 hover:text-foreground"
          >
            Cc
          </button>
        )}
      </Row>
      {showCc && (
        <Row label="Cc">
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            className="w-full min-w-0 bg-transparent text-base focus:outline-none md:text-sm"
          />
        </Row>
      )}
      {!compact && (
        <Row label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full min-w-0 bg-transparent text-base focus:outline-none md:text-sm"
          />
        </Row>
      )}

      <RichEditor
        value={body}
        onChange={setBody}
        placeholder="Write your message…"
        minHeight={compact ? 120 : 200}
        contentClassName={cn(lightBody && EMAIL_LIGHT_SURFACE)}
      />

      {defaults?.quotedHtml && (
        <div>
          <button
            type="button"
            onClick={() => setShowQuoted((v) => !v)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {showQuoted ? "Hide quoted message" : "Show quoted message"}
          </button>
          {showQuoted && (
            <div
              className={cn(
                "mt-2 max-h-80 max-w-none overflow-y-auto border border-border p-3 text-xs [&_img]:max-w-full",
                lightBody ? EMAIL_LIGHT_SURFACE : "prose-editorial [&_a]:text-signal",
              )}
              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(defaults.quotedHtml) }}
            />
          )}
        </div>
      )}

      {mailbox?.signature ? (
        <div className="border border-dashed border-border bg-surface/40 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeSignature}
                onChange={(e) => setIncludeSignature(e.target.checked)}
                className="accent-signal"
              />
              Append my signature
            </label>
            <Link
              to="/mail/settings"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Edit
            </Link>
          </div>
          {includeSignature && (
            <div
              className={cn(
                "mt-2 max-w-none border-t border-border pt-2 text-xs",
                lightBody
                  ? cn(EMAIL_LIGHT_SURFACE, "px-2 pb-2")
                  : "prose-editorial text-muted-foreground [&_a]:text-signal",
              )}
              dangerouslySetInnerHTML={{
                __html: sanitizeEmailHtml(docToHtml(mailbox.signature)),
              }}
            />
          )}
        </div>
      ) : (
        <Link
          to="/mail/settings"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          + Add an email signature
        </Link>
      )}

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li
              key={a.path}
              className="flex items-center gap-2 border border-border bg-surface px-2 py-1 text-xs"
            >
              {a.uploading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Paperclip className="size-3" />
              )}
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((x) => x.filter((y) => y.path !== a.path))}
              >
                <X className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Paperclip className="size-3.5" /> Attach
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="border border-border-strong bg-signal px-4 py-2 text-sm font-medium text-signal-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2 sm:gap-3">
      <span className="text-mono-label w-12 shrink-0 sm:w-14">{label}</span>
      {children}
    </div>
  );
}
