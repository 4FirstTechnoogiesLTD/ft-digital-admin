import { useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/rich-editor";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { docToHtml } from "@/lib/tiptap";
import { plainTextFromHtml, parseAddressList } from "@/lib/mail-utils";
import { sendMessage } from "@/fn/mail";
import { EMPTY_DOC } from "@/lib/tiptap";

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
  onSent: (threadId: string) => void;
  onCancel?: () => void;
}

interface PendingAttachment {
  name: string;
  size: number;
  path: string;
  uploading: boolean;
}

export function MessageComposer({ mailbox, defaults, compact, onSent, onCancel }: Props) {
  const [to, setTo] = useState(defaults?.to ?? "");
  const [cc, setCc] = useState(defaults?.cc ?? "");
  const [showCc, setShowCc] = useState(Boolean(defaults?.cc));
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState<JSONContent>(defaults?.body ?? EMPTY_DOC);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
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
      if (mailbox?.signature) {
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
          className="w-full bg-transparent text-sm focus:outline-none"
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
            className="w-full bg-transparent text-sm focus:outline-none"
          />
        </Row>
      )}
      {!compact && (
        <Row label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none"
          />
        </Row>
      )}

      <RichEditor
        value={body}
        onChange={setBody}
        placeholder="Write your message…"
        minHeight={compact ? 120 : 200}
      />

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

      <div className="flex items-center justify-between">
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
    <div className="flex items-center gap-3 border-b border-border pb-2">
      <span className="text-mono-label w-14 shrink-0">{label}</span>
      {children}
    </div>
  );
}
