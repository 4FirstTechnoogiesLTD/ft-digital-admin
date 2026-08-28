import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Mail, Inbox, FileCheck2, PencilRuler, ArrowRight } from "lucide-react";
import { fetchDashboard, type DashboardData } from "@/fn/dashboard";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/")({
  loader: () => fetchDashboard(),
  component: Dashboard,
});

function Dashboard() {
  const initial = Route.useLoaderData();
  const { data } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    initialData: initial,
    refetchInterval: 60_000,
  });

  const d = data;

  return (
    <>
      <PageHeader
        eyebrow="§ Overview"
        title="Dashboard"
        description="Live signal across the mailbox, the site content, and inbound project intake."
      />

      <div className="space-y-8 px-6 py-8 md:px-10">
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Unread mail"
            value={d.unreadMail}
            icon={<Inbox className="size-4" />}
            to="/mail"
          />
          <Stat
            label="New intake"
            value={d.newSubmissions}
            icon={<Mail className="size-4" />}
            hint="Contact submissions"
          />
          <Stat
            label="Published pages"
            value={d.publishedPages}
            icon={<FileCheck2 className="size-4" />}
            to="/content"
          />
          <Stat
            label="Pages with drafts"
            value={d.draftPages}
            icon={<PencilRuler className="size-4" />}
            hint={
              d.lastPublishAt
                ? `Last publish ${formatDistanceToNow(new Date(d.lastPublishAt), { addSuffix: true })}`
                : "Nothing published yet"
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Project intake" subtitle="Submissions per week · last 8 weeks">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={d.submissionsByWeek}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <XAxis
                  dataKey="week"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                />
                <Bar dataKey="count" fill="var(--color-signal)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Mail volume" subtitle="Inbound vs outbound · last 14 days">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={d.mailByDay} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="in" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-signal)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-signal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="inbound"
                  stroke="var(--color-chart-2)"
                  fill="url(#in)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="outbound"
                  stroke="var(--color-signal)"
                  fill="url(#out)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Recent project intake"
            action={
              <Link to="/mail" className="text-mono-label hover:text-signal">
                Open mail →
              </Link>
            }
          >
            {d.recentSubmissions.length === 0 ? (
              <Empty>No submissions yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentSubmissions.map((s) => (
                  <li key={s.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-mono-label">
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.email}
                      {s.company ? ` · ${s.company}` : ""}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.brief}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Activity">
            {d.activity.length === 0 ? (
              <Empty>Nothing logged yet.</Empty>
            ) : (
              <ul className="space-y-3">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-signal" />
                    <div>
                      <span className="text-foreground">{a.action}</span>{" "}
                      <span className="text-muted-foreground">{a.entity}</span>
                      <div className="text-mono-label">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 4,
  fontSize: 12,
} as const;

function Stat({
  label,
  value,
  icon,
  hint,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  hint?: string;
  to?: string;
}) {
  const body = (
    <div className="bg-background p-5 transition hover:bg-surface">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-mono-label">{label}</span>
        {icon}
      </div>
      <div className="text-display mt-3 text-4xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {subtitle && <p className="text-mono-label mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
