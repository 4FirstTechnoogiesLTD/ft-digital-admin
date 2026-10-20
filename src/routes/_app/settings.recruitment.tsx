import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { getRecruitmentSettings, saveRecruitmentSettings } from "@/fn/careers";
import { PageHeader } from "@/components/page-header";
import { Field, ListField } from "@/components/content/fields";

export const Route = createFileRoute("/_app/settings/recruitment")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m || m.role !== "admin") throw redirect({ to: "/" });
  },
  loader: () => getRecruitmentSettings(),
  component: RecruitmentSettings,
});

function RecruitmentSettings() {
  const { settings: s, resendConfigured } = Route.useLoaderData();
  const router = useRouter();
  const [email, setEmail] = useState(s.notification_email);
  const [maxMb, setMaxMb] = useState(String(s.max_cv_mb));
  const [allowWord, setAllowWord] = useState(s.allow_word_docs);
  const [types, setTypes] = useState(s.employment_types);
  const [arrangements, setArrangements] = useState(s.work_arrangements);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveRecruitmentSettings({
        data: {
          notification_email: email.trim(),
          max_cv_mb: Number(maxMb),
          allow_word_docs: allowWord,
          employment_types: types.map((t) => t.trim()).filter(Boolean),
          work_arrangements: arrangements.map((t) => t.trim()).filter(Boolean),
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

  return (
    <>
      <PageHeader
        eyebrow="§ Settings"
        title="Recruitment"
        description="Where new-application alerts go, upload limits, and the choices offered when writing a vacancy."
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
          <h2 className="text-mono-label">Notifications</h2>
          <Field
            label="Recruitment inbox"
            value={email}
            onChange={setEmail}
            placeholder="recruitment@4firsttechnologies.com"
          />
          <p className="text-xs text-muted-foreground">
            Every new application emails this address (without the CV attached). Applies to
            applications submitted after you save; failed sends can be retried from the
            application page.
            {!resendConfigured && " RESEND_API_KEY is not configured on this admin, so retries from here will fail."}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-mono-label">CV uploads</h2>
          <label className="block">
            <span className="text-mono-label mb-1.5 block">Maximum file size (MB, 1–25)</span>
            <input
              type="number"
              min={1}
              max={25}
              value={maxMb}
              onChange={(e) => setMaxMb(e.target.value)}
              className="w-32 border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowWord}
              onChange={(e) => setAllowWord(e.target.checked)}
              className="size-4 accent-[var(--color-signal)]"
            />
            Also accept Word documents (DOC / DOCX) — PDF is always accepted
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-mono-label">Vacancy options</h2>
          <ListField label="Employment types" values={types} onChange={setTypes} />
          <ListField label="Work arrangements" values={arrangements} onChange={setArrangements} />
        </section>
      </div>
    </>
  );
}
