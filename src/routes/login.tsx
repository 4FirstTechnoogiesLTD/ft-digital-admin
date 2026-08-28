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
    await router.invalidate();
    router.navigate({ to: redirectTo ?? "/" });
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
      </div>
    </div>
  );
}
