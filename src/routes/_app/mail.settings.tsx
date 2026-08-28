import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { toast } from "sonner";
import { getMailboxOverview, saveMailboxSettings } from "@/fn/mail";
import { PageHeader } from "@/components/page-header";
import { RichEditor } from "@/components/rich-editor";
import { EMPTY_DOC } from "@/lib/tiptap";

export const Route = createFileRoute("/_app/mail/settings")({
  loader: () => getMailboxOverview(),
  component: MailSettings,
});

function MailSettings() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(data.mailbox.displayName);
  const [signature, setSignature] = useState<JSONContent>(
    (data.mailbox.signature as JSONContent) ?? EMPTY_DOC,
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveMailboxSettings({ data: { displayName, signature } });
      toast.success("Mailbox settings saved");
      router.invalidate();
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="§ Mailbox" title="Mailbox settings" />
      <div className="max-w-2xl space-y-6 px-6 py-8 md:px-10">
        <div>
          <label className="text-mono-label mb-2 block">Sending address</label>
          <div className="border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
            {data.mailbox.address}
          </div>
        </div>
        <div>
          <label className="text-mono-label mb-2 block">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label className="text-mono-label mb-2 block">Signature</label>
          <RichEditor value={signature} onChange={setSignature} placeholder="Your signature…" />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="border border-border-strong bg-signal px-4 py-2 text-sm font-medium text-signal-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </>
  );
}
