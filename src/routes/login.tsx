import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchSessionMember } from "@/fn/auth";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: search,
  beforeLoad: async () => {
    const member = await fetchSessionMember();
    if (member) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // set once the password step succeeds on an account that has two-factor
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Those credentials didn't match. Check the address and password.");
      setBusy(false);
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp[0];
      if (!totp) {
        await supabase.auth.signOut();
        setError("Couldn't start two-factor verification. Try again.");
        setBusy(false);
        return;
      }
      setFactorId(totp.id);
      setBusy(false);
      return;
    }
    await router.invalidate();
    router.navigate({ to: redirectTo ?? "/" });
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !factorId) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (mfaError) {
      setError("That code didn't work. Check your authenticator app and try again.");
      setCode("");
      setBusy(false);
      return;
    }
    await router.invalidate();
    router.navigate({ to: redirectTo ?? "/" });
  }

  async function cancelVerify() {
    await getSupabaseBrowserClient().auth.signOut();
    setFactorId(null);
    setCode("");
    setPassword("");
    setError(null);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-sm border border-border-strong bg-surface p-8">
        <div className="text-mono-label">4First / Admin</div>
        <h1 className="text-display mt-4 text-4xl">
          Sign <em className="text-signal not-italic">in</em>.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access is invite-only. Ask an admin if you need an account.
        </p>

        {factorId ? (
          <form onSubmit={onVerify} className="mt-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div>
              <label className="text-mono-label mb-2 block">Authentication code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/D/g, ""))}
                className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm tracking-[0.4em] focus:border-signal focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full border border-border-strong bg-signal px-5 py-3 text-sm font-medium text-signal-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify →"}
            </button>
            <button
              type="button"
              onClick={cancelVerify}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Use a different account
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-mono-label mb-2 block">Email</label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="text-mono-label mb-2 block">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full border border-border-strong bg-signal px-5 py-3 text-sm font-medium text-signal-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
