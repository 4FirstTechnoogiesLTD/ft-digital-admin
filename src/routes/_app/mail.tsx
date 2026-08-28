import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import {
  Inbox,
  Send,
  FileEdit,
  Archive,
  ShieldAlert,
  Trash2,
  Star,
  Pencil,
  Search,
  Settings2,
  RefreshCw,
} from "lucide-react";
import { getMailboxOverview, listThreads } from "@/fn/mail";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "@/components/mail/compose-dialog";

const FOLDERS = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "sent", label: "Sent", icon: Send },
  { key: "drafts", label: "Drafts", icon: FileEdit },
  { key: "archive", label: "Archive", icon: Archive },
  { key: "spam", label: "Spam", icon: ShieldAlert },
  { key: "trash", label: "Trash", icon: Trash2 },
] as const;

const searchSchema = z.object({
  folder: z.enum(["inbox", "sent", "drafts", "archive", "spam", "trash"]).catch("inbox"),
  q: z.string().optional(),
});

export const Route = createFileRoute("/_app/mail")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ folder: search.folder, q: search.q }),
  loader: async ({ deps }) => {
    const [overview, threads] = await Promise.all([
      getMailboxOverview(),
      listThreads({ data: { folder: deps.folder, search: deps.q } }),
    ]);
    return { overview, threads: threads.threads };
  },
  component: MailLayout,
});

function MailLayout() {
  const initial = Route.useLoaderData();
  const { folder, q } = useSearch({ from: "/_app/mail" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchText, setSearchText] = useState(q ?? "");

  const { data: overview } = useQuery({
    queryKey: ["mail", "overview"],
    queryFn: () => getMailboxOverview(),
    initialData: initial.overview,
    refetchInterval: 45_000,
  });

  const { data: threadsData, refetch: refetchThreads } = useQuery({
    queryKey: ["mail", "threads", folder, q ?? ""],
    queryFn: () => listThreads({ data: { folder, search: q } }),
    initialData: { threads: initial.threads },
  });

  // realtime: refresh on any message/thread change for this mailbox
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("mail-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        refetchThreads();
        qc.invalidateQueries({ queryKey: ["mail", "overview"] });
        if (params.threadId)
          qc.invalidateQueries({ queryKey: ["mail", "thread", params.threadId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, () => {
        refetchThreads();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, refetchThreads, params.threadId]);

  const threads = threadsData?.threads ?? [];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/mail", search: { folder, q: searchText || undefined } });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* folder rail */}
      <div className="hidden w-48 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="p-4">
          <button
            onClick={() => setComposeOpen(true)}
            className="flex w-full items-center justify-center gap-2 border border-border-strong bg-signal px-3 py-2.5 text-sm font-medium text-signal-foreground transition hover:brightness-110"
          >
            <Pencil className="size-3.5" /> Compose
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {FOLDERS.map((f) => {
            const c = overview?.counts?.[f.key];
            const active = folder === f.key;
            const Icon = f.icon;
            return (
              <Link
                key={f.key}
                to="/mail"
                search={{ folder: f.key, q: undefined }}
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4" />
                  {f.label}
                </span>
                {c && c.unread > 0 && (
                  <span className="rounded-full bg-signal px-1.5 text-[11px] font-medium text-signal-foreground">
                    {c.unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="text-mono-label truncate" title={overview?.mailbox.address}>
            {overview?.mailbox.address}
          </div>
          <Link
            to="/mail/settings"
            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-3.5" /> Mailbox settings
          </Link>
        </div>
      </div>

      {/* thread list */}
      <div className="flex w-full shrink-0 flex-col border-r border-border md:w-80 lg:w-96">
        <form
          onSubmit={submitSearch}
          className="flex items-center gap-2 border-b border-border px-3 py-2.5"
        >
          <Search className="size-4 text-muted-foreground" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={`Search ${folder}`}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button type="button" onClick={() => refetchThreads()} aria-label="Refresh">
            <RefreshCw className="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </form>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            <ul>
              {threads.map((t) => {
                const active = params.threadId === t.id;
                const unread = t.unread_count > 0;
                return (
                  <li key={t.id}>
                    <Link
                      to="/mail/$threadId"
                      params={{ threadId: t.id }}
                      search={{ folder, q }}
                      className={cn(
                        "block border-b border-border px-4 py-3 transition-colors",
                        active ? "bg-surface-2" : "hover:bg-surface",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            unread ? "font-semibold text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {t.subject || "(no subject)"}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {t.is_starred && <Star className="size-3 fill-signal text-signal" />}
                        <p className="truncate text-xs text-muted-foreground">{t.snippet}</p>
                      </div>
                      {t.labels?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {t.labels.map((l: string) => (
                            <span
                              key={l}
                              className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* reading pane */}
      <div className="hidden flex-1 md:block">
        <Outlet />
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        mailbox={overview?.mailbox ?? null}
        onSent={(threadId) => {
          refetchThreads();
          qc.invalidateQueries({ queryKey: ["mail", "overview"] });
          navigate({ to: "/mail/$threadId", params: { threadId }, search: { folder, q } });
        }}
      />
    </div>
  );
}
