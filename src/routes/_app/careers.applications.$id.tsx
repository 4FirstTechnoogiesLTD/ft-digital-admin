import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Download, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import {
  getApplication,
  getDocumentUrl,
  retryNotification,
  updateApplication,
  type ApplicationStatus,
} from "@/fn/careers";
import { PageHeader } from "@/components/page-header";
import { TextArea } from "@/components/content/fields";
import { APPLICATION_STATUSES, StatusBadge } from "@/components/careers/status-badge";

export const Route = createFileRoute("/_app/careers/applications/$id")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m?.canRecruit) throw redirect({ to: "/" });
  },
  loader: ({ params }) => getApplication({ data: { id: params.id } }),
  component: ApplicationPage,
});

function ApplicationPage() {
  const { app, documents, notifications } = Route.useLoaderData();
  const router = useRouter();
  const [notes, setNotes] = useState(app.internal_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function setStatus(status: ApplicationStatus) {
    try {
      await updateApplication({ data: { id: app.id, status } });
      toast.success(`Status: ${status.replace("_", " ")}`);
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await updateApplication({ data: { id: app.id, internal_notes: notes || null } });
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function open(documentId: string) {
    try {
      const { url } = await getDocumentUrl({ data: { documentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the document");
    }
  }

  async function retry(notificationId: string) {
    try {
      await retryNotification({ data: { notificationId } });
      toast.success("Notification sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      router.invalidate();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/careers/applications" search={{}} className="hover:text-foreground">
            ← Applications
          </Link>
        }
        title={`${app.first_name} ${app.last_name}`}
        description={
          <>
            Applied for <span className="text-foreground">{app.job_title}</span> ·{" "}
            <span className="font-mono">{app.application_reference}</span> ·{" "}
            {format(new Date(app.submitted_at), "d MMM yyyy, HH:mm")}
          </>
        }
        actions={
          <label className="flex items-center gap-2 text-sm">
            <StatusBadge status={app.status} />
            <select
              value={app.status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              aria-label="Application status"
              className="border border-border bg-background px-2 py-1.5 text-sm"
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <section>
          <h2 className="text-mono-label mb-3">Applicant</h2>
          <dl className="grid gap-x-8 gap-y-3 border border-border p-4 text-sm sm:grid-cols-2">
            <Row label="Email" value={<a className="break-all hover:underline" href={`mailto:${app.email}`}>{app.email}</a>} />
            <Row label="Phone" value={<a className="hover:underline" href={`tel:${app.phone.replace(/[^+\d]/g, "")}`}>{app.phone}</a>} />
            <Row label="Location" value={app.location} />
            <Row label="Job reference" value={app.job_reference} />
            {app.linkedin_url && <Row label="LinkedIn" value={<ExternalLink href={app.linkedin_url} />} />}
            {app.portfolio_url && <Row label="Portfolio" value={<ExternalLink href={app.portfolio_url} />} />}
            <Row
              label="Privacy notice"
              value={`v${app.privacy_notice_version} · acknowledged ${format(new Date(app.privacy_notice_acknowledged_at), "d MMM yyyy, HH:mm")}`}
            />
          </dl>
        </section>

        <section>
          <h2 className="text-mono-label mb-3">Documents</h2>
          <ul className="divide-y divide-border border border-border text-sm">
            {documents.length === 0 && <li className="px-4 py-3 text-muted-foreground">No documents.</li>}
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="break-all">{d.original_filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.kind === "cv" ? "CV" : "Supporting"} · {d.verified_file_type.toUpperCase()} ·{" "}
                    {(d.file_size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  onClick={() => open(d.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 border border-border px-3 py-1.5 hover:bg-surface-2"
                >
                  <Download className="size-3.5" /> Open
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Links are private and expire after one minute. Each access is logged.
          </p>
        </section>

        {app.cover_letter && (
          <section>
            <h2 className="text-mono-label mb-3">Cover letter</h2>
            <p className="whitespace-pre-wrap border border-border p-4 text-sm leading-relaxed">
              {app.cover_letter}
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-mono-label">Internal notes</h2>
          <TextArea label="Visible to the recruitment team only" value={notes} onChange={setNotes} rows={4} />
          <button
            onClick={saveNotes}
            disabled={saving || notes === (app.internal_notes ?? "")}
            className="border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </section>

        <section>
          <h2 className="text-mono-label mb-3">Recruitment notification</h2>
          <ul className="divide-y divide-border border border-border text-sm">
            {notifications.length === 0 && <li className="px-4 py-3 text-muted-foreground">None recorded.</li>}
            {notifications.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  {n.delivery_status === "sent" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-signal" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <div>
                      {n.delivery_status} → {n.recipient || "no recipient"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {n.attempts} attempt{n.attempts === 1 ? "" : "s"}
                      {n.last_error ? ` · ${n.last_error}` : ""}
                    </div>
                  </div>
                </div>
                {n.delivery_status !== "sent" && (
                  <button
                    onClick={() => retry(n.id)}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 hover:bg-surface-2"
                  >
                    <RefreshCw className="size-3.5" /> Retry
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-mono-label">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all hover:underline">
      {href}
    </a>
  );
}
