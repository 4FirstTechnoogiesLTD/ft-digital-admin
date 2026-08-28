import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { FileText, Layers, ArrowUpRight, CheckCircle2, CircleDashed } from "lucide-react";
import { fetchSessionMember } from "@/fn/auth";
import { getContentIndex } from "@/fn/content";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/content/")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (m && m.role === "member") throw redirect({ to: "/" });
  },
  loader: () => getContentIndex(),
  component: ContentIndex,
});

const PAGE_LABEL: Record<string, string> = {
  home: "Home",
  about: "About",
  services: "Services",
  work: "Work",
  contact: "Contact",
};

function ContentIndex() {
  const initial = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["content", "index"],
    queryFn: () => getContentIndex(),
    initialData: initial,
  });

  return (
    <>
      <PageHeader
        eyebrow="§ Content"
        title="Pages & Collections"
        description="Everything the marketing site renders. Publishing here updates 4firsttech.com."
      />

      <div className="space-y-10 px-6 py-8 md:px-10">
        <section>
          <div className="text-mono-label mb-3 flex items-center gap-2">
            <FileText className="size-3.5" /> Pages
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {data.pages.map((p) => (
              <Link
                key={p.slug}
                to="/content/pages/$slug"
                params={{ slug: p.slug }}
                className="group bg-background p-5 transition hover:bg-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="text-display text-2xl">{PAGE_LABEL[p.slug] ?? p.slug}</span>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-signal" />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs">
                  {p.is_published ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-signal" />
                      <span className="text-muted-foreground">Published</span>
                    </>
                  ) : (
                    <>
                      <CircleDashed className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Draft</span>
                    </>
                  )}
                </div>
                <div className="text-mono-label mt-1">
                  edited {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="text-mono-label mb-3 flex items-center gap-2">
            <Layers className="size-3.5" /> Collections
          </div>
          <div className="divide-y divide-border border-y border-border">
            {data.collections.map((c) => (
              <Link
                key={c.key}
                to="/content/collections/$key"
                params={{ key: c.key }}
                className="group flex items-center justify-between gap-4 py-4 transition hover:bg-surface/50 -mx-6 px-6 md:-mx-10 md:px-10"
              >
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-mono-label mt-0.5">{c.key}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "text-xs",
                      c.count.published === c.count.total ? "text-muted-foreground" : "text-signal",
                    )}
                  >
                    {c.count.published}/{c.count.total} live
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-signal" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
