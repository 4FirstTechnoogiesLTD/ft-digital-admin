import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Plus, Inbox } from "lucide-react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { listJobs, setJobStatus, type JobStatus } from "@/fn/careers";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/careers/status-badge";

export const Route = createFileRoute("/_app/careers/")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m?.canRecruit) throw redirect({ to: "/" });
  },
  loader: () => listJobs(),
  component: VacanciesPage,
});

const FILTERS: { key: JobStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Open" },
  { key: "draft", label: "Drafts" },
  { key: "closed", label: "Closed" },
  { key: "archived", label: "Archived" },
];

function VacanciesPage() {
  const jobs = Route.useLoaderData();
  const router = useRouter();
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const visible = jobs.filter((j) =>
    filter === "all" ? j.status !== "archived" : j.status === filter,
  );

  async function change(id: string, status: JobStatus) {
    setBusy(id);
    try {
      await setJobStatus({ data: { id, status } });
      toast.success(
        status === "published" ? "Published — live on the Careers page" : `Marked ${status}`,
      );
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="§ Recruitment"
        title="Vacancies"
        description="Create and publish job listings. Published vacancies appear on the Careers page immediately; deadlines close them automatically."
        actions={
          <>
            <Link
              to="/careers/applications"
              search={{}}
              className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-sm hover:bg-surface-2"
            >
              <Inbox className="size-3.5" /> Applications
            </Link>
            <Link
              to="/careers/jobs/$id"
              params={{ id: "new" }}
              className="inline-flex items-center gap-1.5 border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110"
            >
              <Plus className="size-3.5" /> New vacancy
            </Link>
          </>
        }
      />

      <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter vacancies">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "border border-border px-3 py-1.5 text-xs",
                filter === f.key ? "bg-surface-2 text-foreground" : "text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="border border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No vacancies here yet.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {visible.map((j) => {
              const expired =
                j.status === "published" &&
                j.application_deadline !== null &&
                new Date(j.application_deadline) <= new Date();
              return (
                <li key={j.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1 basis-64">
                    <Link
                      to="/careers/jobs/$id"
                      params={{ id: j.id }}
                      className="font-medium hover:underline"
                    >
                      {j.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {j.reference} · {j.department} · {j.location}
                    </div>
                  </div>
                  <StatusBadge status={j.status} expired={expired} />
                  <div className="w-36 text-xs text-muted-foreground">
                    {j.application_deadline
                      ? `Deadline ${format(new Date(j.application_deadline), "d MMM yyyy, HH:mm")}`
                      : "No deadline"}
                  </div>
                  <Link
                    to="/careers/applications"
                    search={{ jobId: j.id }}
                    className="w-28 text-xs hover:underline"
                  >
                    {j.applications.total} application{j.applications.total === 1 ? "" : "s"}
                    {j.applications.fresh > 0 && (
                      <span className="text-signal"> · {j.applications.fresh} new</span>
                    )}
                  </Link>
                  <div className="flex gap-3 text-xs">
                    {(j.status === "draft" || j.status === "closed") && (
                      <button disabled={busy === j.id} onClick={() => change(j.id, "published")} className="text-signal hover:underline">
                        {j.status === "closed" ? "Reopen" : "Publish"}
                      </button>
                    )}
                    {j.status === "published" && (
                      <button disabled={busy === j.id} onClick={() => change(j.id, "closed")} className="hover:underline">
                        Close
                      </button>
                    )}
                    {j.status !== "archived" ? (
                      <button disabled={busy === j.id} onClick={() => change(j.id, "archived")} className="text-muted-foreground hover:underline">
                        Archive
                      </button>
                    ) : (
                      <button disabled={busy === j.id} onClick={() => change(j.id, "draft")} className="hover:underline">
                        Restore
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
