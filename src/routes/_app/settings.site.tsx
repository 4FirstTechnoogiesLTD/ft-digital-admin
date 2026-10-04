import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { getSiteSettings, saveSiteSettings } from "@/fn/content";
import { PageHeader } from "@/components/page-header";
import { Field, ListField } from "@/components/content/fields";

export const Route = createFileRoute("/_app/settings/site")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (m && m.role === "member") throw redirect({ to: "/" });
  },
  loader: () => getSiteSettings(),
  component: SiteSettings,
});

type Metric = { n: string; l: string };
type Social = { label: string; href: string };

function SiteSettings() {
  const s = Route.useLoaderData();
  const router = useRouter();

  const [form, setForm] = useState({
    contact_email: s?.contact_email ?? "",
    contact_phone: s?.contact_phone ?? "",
    linkedin_url: s?.linkedin_url ?? "",
    studio_address: s?.studio_address ?? "",
    hours: s?.hours ?? "",
    footer_tagline: s?.footer_tagline ?? "",
    og_image_url: s?.og_image_url ?? "",
  });
  const [metrics, setMetrics] = useState<Metric[]>(
    Array.isArray(s?.metrics) ? (s!.metrics as Metric[]) : [],
  );
  const [ticker, setTicker] = useState<string[]>(
    Array.isArray(s?.ticker) ? (s!.ticker as string[]) : [],
  );
  const [socials, setSocials] = useState<Social[]>(
    Array.isArray(s?.socials) ? (s!.socials as Social[]) : [],
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveSiteSettings({
        data: {
          id: s?.id,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          linkedin_url: form.linkedin_url || null,
          studio_address: form.studio_address || null,
          hours: form.hours || null,
          footer_tagline: form.footer_tagline || null,
          og_image_url: form.og_image_url || null,
          metrics: metrics.filter((m) => m.n || m.l),
          ticker: ticker.filter(Boolean),
          socials: socials.filter((x) => x.label || x.href),
        },
      });
      toast.success("Saved — live on the site");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="§ Settings"
        title="Site settings"
        description="Global values used across the header, footer, contact page, and metadata."
        actions={
          <button
            onClick={save}
            disabled={saving}
            className="border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />

      <div className="max-w-2xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <section className="space-y-4">
          <h2 className="text-mono-label">Contact</h2>
          <Field
            label="Email"
            value={form.contact_email}
            onChange={(v) => set("contact_email", v)}
          />
          <Field
            label="Phone"
            value={form.contact_phone}
            onChange={(v) => set("contact_phone", v)}
          />
          <Field
            label="LinkedIn URL"
            value={form.linkedin_url}
            onChange={(v) => set("linkedin_url", v)}
          />
          <Field
            label="Studio address"
            value={form.studio_address}
            onChange={(v) => set("studio_address", v)}
          />
          <Field label="Hours" value={form.hours} onChange={(v) => set("hours", v)} />
        </section>

        <section className="space-y-4">
          <h2 className="text-mono-label">Brand</h2>
          <Field
            label="Footer tagline"
            value={form.footer_tagline}
            onChange={(v) => set("footer_tagline", v)}
          />
          <Field
            label="OG image URL"
            value={form.og_image_url}
            onChange={(v) => set("og_image_url", v)}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-mono-label">Home metrics strip</h2>
          {metrics.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={m.n}
                onChange={(e) =>
                  setMetrics((xs) => xs.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))
                }
                placeholder="04"
                className="w-16 shrink-0 border border-border sm:w-24 bg-background/50 px-3 py-2 text-sm focus:border-signal focus:outline-none"
              />
              <input
                value={m.l}
                onChange={(e) =>
                  setMetrics((xs) => xs.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)))
                }
                placeholder="Practice areas"
                className="min-w-0 flex-1 border border-border bg-background/50 px-3 py-2 text-sm focus:border-signal focus:outline-none"
              />
              <button
                onClick={() => setMetrics((xs) => xs.filter((_, j) => j !== i))}
                className="shrink-0 border border-border px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => setMetrics((xs) => [...xs, { n: "", l: "" }])}
            className="text-mono-label hover:text-foreground"
          >
            + Add metric
          </button>
        </section>

        <section className="space-y-3">
          <ListField label="Home ticker phrases" values={ticker} onChange={setTicker} />
        </section>

        <section className="space-y-3">
          <h2 className="text-mono-label">Social links</h2>
          {socials.map((x, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={x.label}
                onChange={(e) =>
                  setSocials((xs) =>
                    xs.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)),
                  )
                }
                placeholder="LinkedIn"
                className="w-24 shrink-0 border border-border sm:w-32 bg-background/50 px-3 py-2 text-sm focus:border-signal focus:outline-none"
              />
              <input
                value={x.href}
                onChange={(e) =>
                  setSocials((xs) =>
                    xs.map((y, j) => (j === i ? { ...y, href: e.target.value } : y)),
                  )
                }
                placeholder="https://…"
                className="min-w-0 flex-1 border border-border bg-background/50 px-3 py-2 text-sm focus:border-signal focus:outline-none"
              />
              <button
                onClick={() => setSocials((xs) => xs.filter((_, j) => j !== i))}
                className="shrink-0 border border-border px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => setSocials((xs) => [...xs, { label: "", href: "" }])}
            className="text-mono-label hover:text-foreground"
          >
            + Add link
          </button>
        </section>
      </div>
    </>
  );
}
