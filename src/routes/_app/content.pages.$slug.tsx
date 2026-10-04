import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getPage, savePage, setPagePublished } from "@/fn/content";
import { PageHeader } from "@/components/page-header";
import { Field, TextArea } from "@/components/content/fields";

export const Route = createFileRoute("/_app/content/pages/$slug")({
  loader: ({ params }) => getPage({ data: { slug: params.slug } }),
  component: PageEditor,
});

const SITE_URL = "https://4firsttechnologies.com";

function PageEditor() {
  const { slug } = Route.useParams();
  const { page, audit } = Route.useLoaderData();
  const router = useRouter();

  const [form, setForm] = useState({
    meta_title: page.meta_title ?? "",
    meta_description: page.meta_description ?? "",
    og_title: page.og_title ?? "",
    og_description: page.og_description ?? "",
    canonical: page.canonical ?? "",
  });
  const hero = (page.hero ?? {}) as {
    eyebrow?: string;
    heading?: string;
    intro?: string[];
  };
  const [eyebrow, setEyebrow] = useState(hero.eyebrow ?? "");
  const [heading, setHeading] = useState(hero.heading ?? "");
  const [intro, setIntro] = useState((hero.intro ?? []).join("\n\n"));
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(page.is_published);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      await savePage({
        data: {
          slug,
          meta_title: form.meta_title || null,
          meta_description: form.meta_description || null,
          og_title: form.og_title || null,
          og_description: form.og_description || null,
          canonical: form.canonical || null,
          hero: {
            eyebrow: eyebrow || undefined,
            heading: heading || undefined,
            intro: intro
              .split(/\n{2,}/)
              .map((s) => s.trim())
              .filter(Boolean),
          },
        },
      });
      toast.success("Saved");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    const next = !published;
    setPublished(next);
    try {
      await setPagePublished({ data: { slug, isPublished: next } });
      toast.success(next ? "Published — live on the site" : "Unpublished");
      router.invalidate();
    } catch {
      setPublished(!next);
      toast.error("Could not change publish state");
    }
  }

  const path = slug === "home" ? "/" : `/${slug}`;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/content" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="size-3" /> Content
          </Link>
        }
        title={slug[0].toUpperCase() + slug.slice(1)}
        description={
          <a
            href={`${SITE_URL}${path}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-signal"
          >
            {SITE_URL}
            {path} <ExternalLink className="size-3" />
          </a>
        }
        actions={
          <>
            <button
              onClick={togglePublish}
              className={
                published
                  ? "border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  : "border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110"
              }
            >
              {published ? "Unpublish" : "Publish"}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="border border-border-strong bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      />

      <div className="grid gap-10 px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:grid-cols-[1fr_260px]">
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-mono-label">Hero</h2>
            <Field label="Eyebrow" value={eyebrow} onChange={setEyebrow} />
            <Field label="Heading" value={heading} onChange={setHeading} />
            <TextArea
              label="Intro paragraphs (blank line between each)"
              value={intro}
              onChange={setIntro}
              rows={6}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-mono-label">SEO & meta</h2>
            <Field
              label="Meta title"
              value={form.meta_title}
              onChange={(v) => set("meta_title", v)}
            />
            <TextArea
              label="Meta description"
              value={form.meta_description}
              onChange={(v) => set("meta_description", v)}
              rows={3}
            />
            <Field label="OG title" value={form.og_title} onChange={(v) => set("og_title", v)} />
            <TextArea
              label="OG description"
              value={form.og_description}
              onChange={(v) => set("og_description", v)}
              rows={2}
            />
            <Field
              label="Canonical path"
              value={form.canonical}
              onChange={(v) => set("canonical", v)}
            />
          </section>
        </div>

        <aside className="space-y-3">
          <h2 className="text-mono-label">History</h2>
          {audit.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {audit.map((a) => (
                <li key={a.id} className="border-l border-border pl-3">
                  <div className="text-foreground">{a.action}</div>
                  <div className="text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Section content (cards, lists, cases) lives in{" "}
            <Link to="/content" className="text-signal">
              Collections
            </Link>
            .
          </p>
        </aside>
      </div>
    </>
  );
}
