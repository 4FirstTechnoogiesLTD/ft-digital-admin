import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Star,
  Archive,
  Trash2,
  ShieldAlert,
  Inbox,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { getThread, setThreadFlags, setThreadRead } from "@/fn/mail";
import { getMailboxOverview } from "@/fn/mail";
import { MessageComposer, type ComposerDefaults } from "@/components/mail/message-composer";
import { sanitizeEmailHtml, formatAddr, replySubject, forwardSubject } from "@/lib/mail-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/mail/$threadId")({
  loader: ({ params }) => getThread({ data: { threadId: params.threadId } }),
  component: ThreadView,
});

type Mode = { kind: "reply" | "replyAll" | "forward"; messageId: string } | null;

function ThreadView() {
  const { threadId } = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);

  const { data } = useQuery({
    queryKey: ["mail", "thread", threadId],
    queryFn: () => getThread({ data: { threadId } }),
    initialData: initial,
  });

  const { data: overview } = useQuery({
    queryKey: ["mail", "overview"],
    queryFn: () => getMailboxOverview(),
  });

  const thread = data.thread;
  const messages = data.messages;
  const last = messages[messages.length - 1];

  // mark read on open
  useEffect(() => {
    if (thread.unread_count > 0) {
      setThreadRead({ data: { threadId, isRead: true } }).then(() => {
        qc.invalidateQueries({ queryKey: ["mail", "overview"] });
        qc.invalidateQueries({ queryKey: ["mail", "threads"] });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function move(folder: "inbox" | "archive" | "spam" | "trash") {
    await setThreadFlags({ data: { threadId, folder } });
    toast.success(`Moved to ${folder}`);
    qc.invalidateQueries({ queryKey: ["mail"] });
    navigate({ to: "/mail", search: (s) => s });
  }
  async function toggleStar() {
    await setThreadFlags({ data: { threadId, isStarred: !thread.is_starred } });
    qc.invalidateQueries({ queryKey: ["mail", "thread", threadId] });
    qc.invalidateQueries({ queryKey: ["mail", "threads"] });
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName))
        return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      if (e.key === "r" && last) setMode({ kind: "reply", messageId: last.id });
      if (e.key === "a" && last) setMode({ kind: "replyAll", messageId: last.id });
      if (e.key === "f" && last) setMode({ kind: "forward", messageId: last.id });
      if (e.key === "e") move("archive");
      if (e.key === "#") move("trash");
      if (e.key === "Escape") setMode(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  const composerDefaults = useMemo<ComposerDefaults | null>(() => {
    if (!mode) return null;
    const m = messages.find((x) => x.id === mode.messageId) ?? last;
    if (!m) return null;
    const others = [
      ...(Array.isArray(m.to_addrs) ? (m.to_addrs as any[]) : []),
      ...(Array.isArray(m.cc_addrs) ? (m.cc_addrs as any[]) : []),
    ];
    const quoted = `On ${format(new Date(m.created_at), "PP p")}, ${m.from_name ?? m.from_addr} wrote:<br>${sanitizeEmailHtml(m.html ?? m.text ?? "")}`;
    if (mode.kind === "forward") {
      return {
        subject: forwardSubject(thread.subject),
        quotedHtml: quoted,
        threadId,
      };
    }
    return {
      to: mode.kind === "replyAll" ? `${m.from_addr}` : m.from_addr,
      cc:
        mode.kind === "replyAll"
          ? others
              .map((a) => a.email)
              .filter((e) => e && e !== overview?.mailbox.address)
              .join(", ")
          : undefined,
      subject: replySubject(thread.subject),
      threadId,
      inReplyToMessageId: m.id,
      quotedHtml: quoted,
    };
  }, [mode, messages, last, thread.subject, threadId, overview?.mailbox.address]);

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2.5">
        <button
          className="mr-1 md:hidden"
          onClick={() => navigate({ to: "/mail", search: (s) => s })}
        >
          <ChevronLeft className="size-4" />
        </button>
        <ToolbarBtn onClick={toggleStar} title="Star">
          <Star className={cn("size-4", thread.is_starred && "fill-signal text-signal")} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => move("archive")} title="Archive (e)">
          <Archive className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => move("spam")} title="Mark spam">
          <ShieldAlert className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => move("trash")} title="Trash (#)">
          <Trash2 className="size-4" />
        </ToolbarBtn>
        {thread.folder !== "inbox" && (
          <ToolbarBtn onClick={() => move("inbox")} title="Move to inbox">
            <Inbox className="size-4" />
          </ToolbarBtn>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ToolbarBtn
            onClick={() => last && setMode({ kind: "reply", messageId: last.id })}
            title="Reply (r)"
          >
            <Reply className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => last && setMode({ kind: "replyAll", messageId: last.id })}
            title="Reply all (a)"
          >
            <ReplyAll className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => last && setMode({ kind: "forward", messageId: last.id })}
            title="Forward (f)"
          >
            <Forward className="size-4" />
          </ToolbarBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border px-6 py-5">
          <h1 className="text-display text-2xl">{thread.subject || "(no subject)"}</h1>
        </div>

        <ul className="divide-y divide-border">
          {messages.map((m) => (
            <li key={m.id} className="px-6 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-medium">{m.from_name ?? m.from_addr}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{m.from_addr}</span>
                  {m.direction === "outbound" && (
                    <span className="text-mono-label ml-2 text-signal">sent</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(m.created_at), "PP p")}
                </span>
              </div>
              <div className="text-mono-label mt-0.5">
                to{" "}
                {(Array.isArray(m.to_addrs) ? (m.to_addrs as any[]) : [])
                  .map((a) => a.email)
                  .join(", ")}
              </div>

              <div
                className="prose-editorial mt-4 max-w-none text-sm [&_a]:text-signal [&_img]:max-w-full"
                dangerouslySetInnerHTML={{
                  __html: sanitizeEmailHtml(
                    m.html ?? (m.text ? m.text.replace(/\n/g, "<br>") : "<em>No content</em>"),
                  ),
                }}
              />

              {m.attachments.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {m.attachments.map((a: any) => (
                    <li key={a.id}>
                      <a
                        href={a.signedUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "flex items-center gap-2 border border-border bg-surface px-3 py-2 text-xs transition hover:border-signal",
                          !a.signedUrl && "pointer-events-none opacity-50",
                        )}
                      >
                        <Paperclip className="size-3.5" />
                        <span className="max-w-[200px] truncate">{a.filename}</span>
                        {a.size ? (
                          <span className="text-muted-foreground">
                            {Math.round((a.size / 1024) * 10) / 10} KB
                          </span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {mode && composerDefaults && (
          <div className="border-t border-border bg-surface px-6 py-5">
            <div className="text-mono-label mb-3">
              {mode.kind === "forward"
                ? "Forward"
                : mode.kind === "replyAll"
                  ? "Reply all"
                  : "Reply"}
            </div>
            <MessageComposer
              mailbox={
                overview?.mailbox
                  ? {
                      address: overview.mailbox.address,
                      displayName: overview.mailbox.displayName,
                      signature: overview.mailbox.signature as any,
                    }
                  : null
              }
              defaults={composerDefaults}
              compact
              onCancel={() => setMode(null)}
              onSent={() => {
                setMode(null);
                router.invalidate();
                qc.invalidateQueries({ queryKey: ["mail"] });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid size-8 place-items-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}
