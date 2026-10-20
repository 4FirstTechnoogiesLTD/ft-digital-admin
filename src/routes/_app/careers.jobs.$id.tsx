import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { getJob, getJobOptions, saveJob, setJobStatus } from "@/fn/careers";
import { PageHeader } from "@/components/page-header";
import { Field, TextArea } from "@/components/content/fields";
import { StatusBadge } from "@/components/careers/status-badge";

export const Route = createFileRoute("/_app/careers/jobs/$id")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m?.canRecruit) throw redirect({ to: "/" });
  },
  loader: async ({ params }) =>
    params.id === "new"
      ? { job: null, options: await getJobOptions() }
      : getJob({ data: { id: params.id } }),
  component: JobEditor,
});

// Deadlines are entered and shown in West Africa Time (UTC+1, no DST), the server-side policy.
const WAT_MS = 3600_000;
const toInput = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + WAT_MS).toISOString().slice(0, 16) : "";
const fromInput = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : null);
const toLines = (a: string[] | undefined) => (a ?? []).join("\n");
const fromLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function JobEditor() {
  const { job, options } = Route.useLoaderData();
  const router = useRouter();
  const [f, setF] = useState({
    title: job?.title ?? "",
    department: job?.department ?? "",
    employment_type: job?.employment_type ?? options.employmentTypes[0] ?? "",
    work_arrangement: job?.work_arrangement ?? options.workArrangements[0] ?? "",
    location: job?.location ?? "",
    summary: job?.summary ?? "",
    description: job?.description ?? "",
    responsibilities: toLines(job?.responsibilities),
    qualifications: toLines(job?.qualifications),
    skills: toLines(job?.skills),
    preferred: toLines(job?.preferred),
    benefits: toLines(job?.benefits),
    salary_range: job?.salary_range ?? "",
    application_instructions: job?.application_instructions ?? "",
    recruitment_contact: job?.recruitment_contact ?? "",
    allow_supporting_doc: job?.allow_supporting_doc ?? false,
    deadline: toInput(job?.application_deadline ?? null),
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function persist(): Promise<string | null> {
    if (!f.title.trim()) {
      toast.error("Add a job title first");
      return null;
    }
    const { id } = await saveJob({
      data: {
        id: job?.id,
        title: f.title,
        department: f.department,
        employment_type: f.employment_type,
        work_arrangement: f.work_arrangement,
        location: f.location,
        summary: f.summary,
        description: f.description,
        responsibilities: fromLines(f.responsibilities),
        qualifications: fromLines(f.qualifications),
        skills: fromLines(f.skills),
        preferred: fromLines(f.preferred),
        benefits: fromLines(f.benefits),
        salary_range: f.salary_range || null,
        application_instructions: f.application_instructions || null,
        recruitment_contact: f.recruitment_contact || null,
        allow_supporting_doc: f.allow_supporting_doc,
        application_deadline: fromInput(f.deadline),
      },
    });
    return id;
  }

  async function run(action: "save" | "publish") {
    setBusy(true);
    try {
      const id = await persist();
      if (!id) return;
      if (action === "publish") {
        await setJobStatus({ data: { id, status: "published" } });
        toast.success("Published — live on the Careers page");
      } else {
        toast.success("Saved");
      }
      if (!job) router.navigate({ to: "/careers/jobs/$id", params: { id }, replace: true });
      else router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const isLive = job?.status === "published";

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-3">
            <Link to="/careers" className="hover:text-foreground">
              ← Vacancies
            </Link>
            {job && (
              <>
                <span>{job.reference}</span>
                <StatusBadge status={job.status} />
              </>
            )}
          </span>
        }
        title={job ? job.title : "New vacancy"}
        description={
          job
            ? isLive
              ? `Live at /careers/${job.slug}. Edits here go live when you save.`
              : "Not visible on the website until published."
            : "Save as a draft any time; publishing checks that the required fields are complete."
        }
        actions={
          <>
            <button
              onClick={() => run("save")}
              disabled={busy}
              className="border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-60"
            >
              {busy ? "Saving…" : isLive ? "Save changes" : "Save draft"}
            </button>
            {!isLive && (
              <button
                onClick={() => run("publish")}
                disabled={busy}
                className="border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110 disabled:opacity-60"
              >
                Publish
              </button>
            )}
          </>
        }
      />

      <div className="max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <section className="space-y-4">
          <h2 className="text-mono-label">Basics</h2>
          <Field label="Job title *" value={f.title} onChange={set("title")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department or team *" value={f.department} onChange={set("department")} />
            <Field label="Location *" value={f.location} onChange={set("location")} placeholder="Owerri, Nigeria" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Employment type *" value={f.employment_type} options={options.employmentTypes} onChange={set("employment_type")} />
            <Select label="Work arrangement *" value={f.work_arrangement} options={options.workArrangements} onChange={set("work_arrangement")} />
          </div>
          <label className="block">
            <span className="text-mono-label mb-1.5 block">Application deadline (WAT)</span>
            <input
              type="datetime-local"
              value={f.deadline}
              onChange={(e) => set("deadline")(e.target.value)}
              className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none sm:w-72"
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Applications close automatically at this moment (West Africa Time), even for forms
              already open. Leave empty for no deadline.
            </span>
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-mono-label">Description</h2>
          <TextArea label="Short summary * (shown on the listing)" value={f.summary} onChange={set("summary")} rows={2} />
          <TextArea label="Full job description *" value={f.description} onChange={set("description")} rows={8} placeholder="Separate paragraphs with a blank line." />
          <TextArea label="Key responsibilities * (one per line)" value={f.responsibilities} onChange={set("responsibilities")} rows={6} />
          <TextArea label="Required qualifications (one per line)" value={f.qualifications} onChange={set("qualifications")} rows={5} />
          <TextArea label="Required skills and experience (one per line)" value={f.skills} onChange={set("skills")} rows={5} />
          <TextArea label="Preferred qualifications (one per line)" value={f.preferred} onChange={set("preferred")} rows={4} />
        </section>

        <section className="space-y-4">
          <h2 className="text-mono-label">Offer & applying</h2>
          <Field label="Salary range" value={f.salary_range} onChange={set("salary_range")} />
          <TextArea label="Benefits (one per line)" value={f.benefits} onChange={set("benefits")} rows={4} />
          <TextArea label="Application instructions" value={f.application_instructions} onChange={set("application_instructions")} rows={3} />
          <Field label="Public recruitment contact" value={f.recruitment_contact} onChange={set("recruitment_contact")} placeholder="careers@… — only add a public address" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.allow_supporting_doc}
              onChange={(e) => set("allow_supporting_doc")(e.target.checked)}
              className="size-4 accent-[var(--color-signal)]"
            />
            Allow one optional supporting document
          </label>
        </section>

        {job && (
          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-mono-label">Status</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {job.status === "published" && (
                <StatusButton id={job.id} to="closed" label="Close vacancy" />
              )}
              {job.status === "closed" && <StatusButton id={job.id} to="published" label="Reopen" />}
              {job.status === "published" && <StatusButton id={job.id} to="draft" label="Unpublish to draft" />}
              {job.status !== "archived" && <StatusButton id={job.id} to="archived" label="Archive" />}
              {job.status === "archived" && <StatusButton id={job.id} to="draft" label="Restore as draft" />}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function StatusButton({ id, to, label }: { id: string; to: "draft" | "published" | "closed" | "archived"; label: string }) {
  const router = useRouter();
  return (
    <button
      className="border border-border px-3 py-1.5 hover:bg-surface-2"
      onClick={async () => {
        try {
          await setJobStatus({ data: { id, status: to } });
          toast.success(label);
          router.invalidate();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed");
        }
      }}
    >
      {label}
    </button>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  // keep a legacy value selectable if the configured list changed since it was saved
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="block">
      <span className="text-mono-label mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-background px-3 py-2.5 text-sm"
      >
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
