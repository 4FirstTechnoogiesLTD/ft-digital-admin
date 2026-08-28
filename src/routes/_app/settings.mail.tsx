import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { getMailDomainStatus } from "@/fn/mailadmin";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/settings/mail")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m || m.role !== "admin") throw redirect({ to: "/" });
  },
  loader: () => getMailDomainStatus(),
  component: MailDomainPage,
});

function MailDomainPage() {
  const s = Route.useLoaderData();
  return (
    <>
      <PageHeader
        eyebrow="§ Settings"
        title="Mail domain"
        description="Inbound + outbound team mail runs through Resend on this subdomain."
      />
      <div className="max-w-2xl space-y-8 px-6 py-8 md:px-10">
        <div className="space-y-3">
          <Row label="Mail domain" value={s.mailDomain} />
          <Row label="Inbound webhook URL" value={s.webhookUrl} copyable />
          <Row label="Shared-inbox owner" value={s.sharedOwner || "— not set —"} />
        </div>

        <div className="space-y-2">
          <h2 className="text-mono-label">Checks</h2>
          <Check ok={s.resendKeyConfigured} label="RESEND_API_KEY configured" />
          <Check
            ok={s.webhookSecretConfigured}
            label="RESEND_WEBHOOK_SECRET configured (signature verification)"
          />
        </div>

        <div className="space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <h2 className="text-mono-label text-foreground">DNS checklist (one-time)</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              In Resend → Domains, add <span className="text-foreground">{s.mailDomain}</span> and
              add the SPF / DKIM / DMARC records it shows.
            </li>
            <li>
              In Resend → Emails → Receiving, copy the inbound address and add an{" "}
              <span className="text-foreground">MX</span> record on{" "}
              <span className="text-foreground">{s.mailDomain}</span> with the lowest priority.
            </li>
            <li>
              In Resend → Webhooks, add a webhook for{" "}
              <span className="text-foreground">email.received</span> pointing at{" "}
              <span className="text-foreground">{s.webhookUrl}</span>, then set its signing secret
              as <span className="text-foreground">RESEND_WEBHOOK_SECRET</span>.
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-mono-label mb-2">Provisioned mailboxes</h2>
          <ul className="divide-y divide-border border border-border text-sm">
            {s.mailboxes.length === 0 ? (
              <li className="px-4 py-3 text-muted-foreground">None yet.</li>
            ) : (
              s.mailboxes.map((m) => (
                <li key={m.address} className="flex justify-between px-4 py-2.5">
                  <span>{m.address}</span>
                  <span className="text-muted-foreground">{m.display_name}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between border border-border bg-surface px-3 py-2.5 text-sm">
      <span className="text-mono-label">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs">{value}</span>
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Copied");
            }}
          >
            <Copy className="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </span>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 text-signal" />
      ) : (
        <XCircle className="size-4 text-destructive" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
