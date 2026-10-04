import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { UserPlus, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchSessionMember } from "@/fn/auth";
import { listMembers, inviteMember, updateMember, resendInvite } from "@/fn/members";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/content/fields";

export const Route = createFileRoute("/_app/settings/members")({
  beforeLoad: async () => {
    const m = await fetchSessionMember();
    if (!m || m.role !== "admin") throw redirect({ to: "/" });
  },
  loader: () => listMembers(),
  component: MembersPage,
});

const ROLES = ["admin", "editor", "member"] as const;

function MembersPage() {
  const members = Route.useLoaderData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!email || !fullName) return;
    setBusy(true);
    try {
      const res = await inviteMember({ data: { email, fullName, role } });
      toast.success(
        res.inviteSent
          ? `Invited ${email} · mailbox ${res.address}`
          : `Created ${email} — invite email failed, resend it`,
      );
      setOpen(false);
      setEmail("");
      setFullName("");
      setRole("member");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  type Member = (typeof members)[number];

  async function changeRole(m: Member, next: (typeof ROLES)[number]) {
    try {
      await updateMember({ data: { id: m.id, role: next } });
      toast.success("Role updated");
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function toggleActive(m: Member) {
    try {
      await updateMember({ data: { id: m.id, isActive: !m.isActive } });
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function resend(m: Member) {
    try {
      await resendInvite({ data: { email: m.email } });
      toast.success("Invite email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  // Shared by the mobile cards and the desktop table.
  const roleSelect = (m: Member) => (
    <select
      value={m.role}
      onChange={(e) => changeRole(m, e.target.value as (typeof ROLES)[number])}
      aria-label={`Role for ${m.email}`}
      className="border border-border bg-background px-2 py-1 text-xs"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
  const statusToggle = (m: Member) => (
    <button
      onClick={() => toggleActive(m)}
      className={
        m.isActive
          ? "text-signal"
          : "text-muted-foreground line-through decoration-muted-foreground"
      }
    >
      {m.isActive ? "active" : "disabled"}
    </button>
  );
  const resendButton = (m: Member) => (
    <button
      onClick={() => resend(m)}
      title="Resend set-password email"
      aria-label="Resend set-password email"
      className="text-muted-foreground hover:text-foreground"
    >
      <Mail className="size-4" />
    </button>
  );

  return (
    <>
      <PageHeader
        eyebrow="§ Settings"
        title="Members"
        description="Who can sign in. Each member gets a personal team mailbox on invite."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110"
          >
            <UserPlus className="size-3.5" /> Invite
          </button>
        }
      />

      <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        {/* phones: one card per member */}
        <ul className="divide-y divide-border border border-border md:hidden">
          {members.map((m) => (
            <li key={m.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{m.fullName || "—"}</div>
                  <div className="break-all text-xs text-muted-foreground">{m.email}</div>
                  {m.mailbox && (
                    <div className="break-all text-xs text-muted-foreground">
                      Mailbox: {m.mailbox}
                    </div>
                  )}
                </div>
                {resendButton(m)}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {roleSelect(m)}
                {statusToggle(m)}
                <span className="text-muted-foreground">
                  Joined {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto border border-border md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-mono-label">
                <th className="px-4 py-3 text-left font-normal">Name</th>
                <th className="px-4 py-3 text-left font-normal">Email</th>
                <th className="px-4 py-3 text-left font-normal">Mailbox</th>
                <th className="px-4 py-3 text-left font-normal">Role</th>
                <th className="px-4 py-3 text-left font-normal">Status</th>
                <th className="px-4 py-3 text-left font-normal">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{m.fullName || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.mailbox ?? "—"}</td>
                  <td className="px-4 py-3">{roleSelect(m)}</td>
                  <td className="px-4 py-3">{statusToggle(m)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">{resendButton(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-display text-2xl">Invite a member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Full name" value={fullName} onChange={setFullName} />
            <Field label="Email" value={email} onChange={setEmail} placeholder="name@company.com" />
            <label className="block">
              <span className="text-mono-label mb-1.5 block">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
                className="w-full border border-border bg-background px-3 py-2.5 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              They&apos;ll get an email to set a password. A mailbox at{" "}
              <span className="text-foreground">
                {email ? email.split("@")[0] : "name"}@4firsttechnologies.com
              </span>{" "}
              is provisioned automatically.
            </p>
            <button
              onClick={invite}
              disabled={busy}
              className="w-full border border-border-strong bg-signal px-4 py-2.5 text-sm font-medium text-signal-foreground hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
