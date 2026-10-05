import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const search = z.object({ token_hash: z.string().optional() });

/**
 * Landing page for invite / set-password emails. The token is only verified
 * when they submit, so a mail scanner prefetching the link can't burn it.
 */
export const Route = createFileRoute("/reset-password")({
  validateSearch: search,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { token_hash: tokenHash } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // once the token is spent we hold a session; a retry (e.g. rejected password) skips re-verifying
  const [verified, setVerified] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !tokenHash) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    if (!verified) {
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (otpError) {
        setError("This link has expired or was already used. Ask an admin to send a new one.");
        setBusy(false);
        return;
      }
      setVerified(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    await router.invalidate();
    router.navigate({ to: "/" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-sm border border-border-strong bg-surface p-8">
        <div className="text-mono-label">4First / Admin</div>
        <h1 className="text-display mt-4 text-4xl">
          Set your <em className="text-signal not-italic">password</em>.
        </h1>

        {!tokenHash ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This link is missing its token. Open the link from your email again, or ask an admin to
            send a new one.{" "}
            <Link to="/login" className="text-signal hover:underline">
              Back to sign in
            </Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-mono-label mb-2 block">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="text-mono-label mb-2 block">Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full border border-border-strong bg-signal px-5 py-3 text-sm font-medium text-signal-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Set password →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
