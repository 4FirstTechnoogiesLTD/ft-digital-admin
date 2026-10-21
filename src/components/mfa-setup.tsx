import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Enrolment {
  factorId: string;
  qr: string;
  secret: string;
}

/** Authenticator-app (TOTP) enrolment for the signed-in member. */
export function MfaSetup({ enrolled }: { enrolled: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Pending (unverified) factor id; dropped on unmount so abandoned attempts don't pile up.
  const pendingRef = useRef<string | null>(null);
  useEffect(() => {
    pendingRef.current = enrolment?.factorId ?? null;
  }, [enrolment]);
  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        void getSupabaseBrowserClient().auth.mfa.unenroll({ factorId: pendingRef.current });
      }
    };
  }, []);

  async function start() {
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      // clear unverified leftovers from an abandoned attempt
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "4First Admin",
      });
      if (error) throw error;
      setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      console.error(err);
      const reason = err instanceof Error && err.message ? `: ${err.message}` : "";
      toast.error(`Could not start two-factor setup${reason}`);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!enrolment) return;
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolment.factorId,
        code: code.trim(),
      });
      if (error) throw error;
      pendingRef.current = null;
      setEnrolment(null);
      setCode("");
      toast.success("Two-factor authentication is on");
      await qc.invalidateQueries({ queryKey: ["session", "member"] });
      await router.invalidate();
    } catch (err) {
      console.error(err);
      const reason = err instanceof Error && err.message ? ` (${err.message})` : "";
      toast.error(`That code didn't work. Try the next one.${reason}`);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 sm:p-6 mb-8">
      <h2 className="text-lg font-medium mb-2">Two-factor authentication</h2>

      {enrolled ? (
        <p className="flex items-center gap-2 text-sm text-signal">
          <ShieldCheck className="size-4" />
          Enabled. You'll be asked for a code from your authenticator app each time you sign in.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-5">
            Required for all accounts. Set up an authenticator app (Google Authenticator, 1Password,
            Authy…) to continue using the admin center.
          </p>

          {!enrolment ? (
            <button
              onClick={start}
              disabled={busy}
              className="px-4 py-2 bg-signal text-signal-foreground rounded-md text-sm font-medium transition hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Set up two-factor
            </button>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-2">1. Scan this QR code</p>
                <img
                  src={enrolment.qr}
                  alt="QR code for your authenticator app"
                  className="size-44 rounded-md border border-border bg-white p-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Can't scan? Enter this key manually:{" "}
                  <code className="select-all break-all">{enrolment.secret}</code>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  2. Enter the 6-digit code it shows
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-40 px-3 py-2 rounded-md border border-border bg-background text-sm tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-signal"
                />
              </div>
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="px-4 py-2 bg-signal text-signal-foreground rounded-md text-sm font-medium transition hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Verify and turn on
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
