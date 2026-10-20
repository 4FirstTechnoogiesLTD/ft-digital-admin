import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { fetchSessionMember } from "@/fn/auth";
import { listApplications } from "@/fn/careers";
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
            onKeyDown={(e) => e.key === "Enter" && apply({ q: e.currentTarget.value.trim() || undefined })}
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
        </div>

        {rows.length === 0 ? (
          <p className="border border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No applications found.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  to="/careers/applications/$id"
                  params={{ id: a.id }}
                  className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm hover:bg-surface"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="font-medium">
                      {a.first_name} {a.last_name}
                    </div>
                    <div className="break-all text-xs text-muted-foreground">
                      {a.email} · {a.phone}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
                    {a.job_title}
                    <div className="font-mono">{a.application_reference}</div>
                  </div>
                  <StatusBadge status={a.status} />
                  <div className="w-36 text-xs text-muted-foreground">
                    {format(new Date(a.submitted_at), "d MMM yyyy, HH:mm")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              disabled={page <= 1}
              onClick={() => navigate({ search: (p: Search) => ({ ...p, page: page - 1 || undefined }) })}
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
    </>
  );
}
