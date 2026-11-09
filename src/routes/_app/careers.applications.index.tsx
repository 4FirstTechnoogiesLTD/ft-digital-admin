import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { listApplications, getApplicantContacts } from "@/fn/careers";
import { getMailboxOverview } from "@/fn/mail";
import { ComposeDialog } from "@/components/mail/compose-dialog";
import { BroadcastProgress } from "@/components/mail/broadcast-progress";
import type { ComposerDefaults } from "@/components/mail/message-composer";
import { exportCsv, exportPdf } from "@/lib/export-applications";
import { PageHeader } from "@/components/page-header";
import { APPLICATION_STATUSES, StatusBadge } from "@/components/careers/status-badge";

type Search = { jobId?: string; status?: string; q?: string; page?: number };

export const Route = createFileRoute("/_app/careers/applications/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["jobId"] === "string" && s["jobId"] ? { jobId: s["jobId"] } : {}),
    ...(typeof s["status"] === "string" && s["status"] ? { status: s["status"] } : {}),
    ...(typeof s["q"] === "string" && s["q"] ? { q: s["q"] } : {}),
    ...(Number(s["page"]) > 1 ? { page: Math.floor(Number(s["page"])) } : {}),
  }),
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m?.canRecruit) throw redirect({ to: "/" });
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listApplications({
      data: {
        ...(deps.jobId ? { jobId: deps.jobId } : {}),
        ...(deps.status ? { status: deps.status } : {}),
        ...(deps.q ? { q: deps.q } : {}),
        page: deps.page ?? 1,
      },
    }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { rows, total, pageSize, jobs } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const apply = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch, page: undefined }) });

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + rows.length;
  const filtered = Boolean(search.jobId || search.status || search.q);

  // ── selection (current page, or everything matching the filters) ─────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [busy, setBusy] = useState<null | "csv" | "pdf" | "send">(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<ComposerDefaults | undefined>();
  const [broadcastId, setBroadcastId] = useState<string | null>(null);

  const { data: overview } = useQuery({
    queryKey: ["mail", "overview"],
    queryFn: () => getMailboxOverview(),
  });

  // a new page or filter starts a fresh selection
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [search.jobId, search.status, search.q, page]);

  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const canSelectAllPages = pageAllSelected && !allMatching && total > rows.length;
  const hasSelection = selected.size > 0 || allMatching;
  const selectionCount = allMatching ? total : selected.size;
  const filters = {
    ...(search.jobId ? { jobId: search.jobId } : {}),
    ...(search.status ? { status: search.status } : {}),
    ...(search.q ? { q: search.q } : {}),
  };

  function toggleOne(id: string) {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function togglePage() {
    setAllMatching(false);
    setSelected(pageAllSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function clearSelection() {
    setSelected(new Set());
    setAllMatching(false);
  }

  /** The ticked rows if any, otherwise everything matching the current filters. */
  const target = () => (hasSelection && !allMatching ? { ids: [...selected] } : { filters });

  async function runExport(kind: "csv" | "pdf") {
    if (total === 0) return;
    setBusy(kind);
    try {
      const { rows: contacts } = await getApplicantContacts({
        data: { purpose: kind === "csv" ? "export_csv" : "export_pdf", target: target() },
      });
      if (!contacts.length) return toast.error("Nothing to export");
      if (kind === "csv") exportCsv(contacts);
      else await exportPdf(contacts);
      toast.success(`Exported ${contacts.length} contact${contacts.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendToSelected() {
    setBusy("send");
    try {
      const { rows: contacts } = await getApplicantContacts({
        data: { purpose: "broadcast", target: target() },
      });
      const emails = [
        ...new Set(contacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean)),
      ];
      if (!emails.length) return toast.error("No applicant email addresses found");
      setComposeDefaults({ to: emails.join(", "), broadcast: true });
      setComposeOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't collect the applicant addresses");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/careers" className="hover:text-foreground">
            ← Vacancies
          </Link>
        }
        title="Applications"
        description={`${total} application${total === 1 ? "" : "s"}${search.jobId || search.status || search.q ? " match these filters" : " received"}.`}
      />

      <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="search"
            defaultValue={search.q ?? ""}
            placeholder="Search name, email or reference"
            aria-label="Search applications"
            onKeyDown={(e) =>
              e.key === "Enter" && apply({ q: e.currentTarget.value.trim() || undefined })
            }
            className="w-full border border-border bg-background/50 px-3 py-2 text-sm focus:border-signal focus:outline-none sm:w-72"
          />
          <select
            value={search.jobId ?? ""}
            onChange={(e) => apply({ jobId: e.target.value || undefined })}
            aria-label="Filter by vacancy"
            className="border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All vacancies</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <select
            value={search.status ?? ""}
            onChange={(e) => apply({ status: e.target.value || undefined })}
            aria-label="Filter by status"
            className="border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy !== null || total === 0}
              onClick={() => runExport("csv")}
              className="flex items-center gap-1.5 border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
            >
              <Download className="size-3.5" /> {busy === "csv" ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={busy !== null || total === 0}
              onClick={() => runExport("pdf")}
              className="flex items-center gap-1.5 border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
            >
              <Download className="size-3.5" /> {busy === "pdf" ? "Exporting…" : "Export PDF"}
            </button>
          </div>
        </div>

        {broadcastId && (
          <BroadcastProgress broadcastId={broadcastId} onDismiss={() => setBroadcastId(null)} />
        )}

        {hasSelection && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border border-border bg-surface px-4 py-2 text-xs">
            <span className="text-muted-foreground">{selectionCount} selected</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={sendToSelected}
              className="flex items-center gap-1.5 border border-border-strong bg-signal px-2.5 py-1 font-medium text-signal-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              <Send className="size-3" /> {busy === "send" ? "Collecting…" : "Send to Selected"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <span className="ml-auto text-muted-foreground">Exports use the selection</span>
          </div>
        )}
        {canSelectAllPages && (
          <button
            type="button"
            onClick={() => setAllMatching(true)}
            className="mb-3 text-xs text-signal underline-offset-2 hover:underline"
          >
            Select all {total} applications{filtered ? " matching these filters" : ""}
          </button>
        )}
        {allMatching && (
          <p className="mb-3 text-xs text-muted-foreground">
            All {total} applications selected across every page.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="border border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No applications found.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-border bg-surface text-mono-label">
                  <tr>
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={pageAllSelected || allMatching}
                        onChange={togglePage}
                        className="accent-signal"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-normal">Name</th>
                    <th className="px-3 py-2.5 font-normal">Email</th>
                    <th className="px-3 py-2.5 font-normal">Phone</th>
                    <th className="px-3 py-2.5 font-normal">Vacancy</th>
                    <th className="px-3 py-2.5 font-normal">Reference</th>
                    <th className="px-3 py-2.5 font-normal">Status</th>
                    <th className="px-3 py-2.5 font-normal">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-surface">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${a.first_name} ${a.last_name}`}
                          checked={allMatching || selected.has(a.id)}
                          onChange={() => toggleOne(a.id)}
                          className="accent-signal"
                        />
                      </td>
                      <td className="px-3 py-3 font-medium">
                        <Link
                          to="/careers/applications/$id"
                          params={{ id: a.id }}
                          className="hover:text-signal hover:underline"
                        >
                          {a.first_name} {a.last_name}
                        </Link>
                      </td>
                      <td className="break-all px-3 py-3 text-xs text-muted-foreground">
                        {a.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                        {a.phone}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{a.job_title}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-muted-foreground">
                        {a.application_reference}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                        {format(new Date(a.submitted_at), "d MMM yyyy, HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {first}–{last} of {total} result{total === 1 ? "" : "s"}
            </p>
          </>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              disabled={page <= 1}
              onClick={() =>
                navigate({ search: (p: Search) => ({ ...p, page: page - 1 || undefined }) })
              }
              className="border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => navigate({ search: (p: Search) => ({ ...p, page: page + 1 }) })}
              className="border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={(v) => {
          setComposeOpen(v);
          if (!v) setComposeDefaults(undefined);
        }}
        mailbox={overview?.mailbox ?? null}
        defaults={composeDefaults}
        onSent={(_threadId, extra) => {
          if (extra?.broadcastId) setBroadcastId(extra.broadcastId);
          clearSelection();
        }}
      />
    </>
  );
}
