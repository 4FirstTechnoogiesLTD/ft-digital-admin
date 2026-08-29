/**
 * Central env access.
 *
 * Server code reads `process.env` directly (see `serverEnv()`).
 *
 * The browser has no `process.env`, and we deliberately do NOT bake config into
 * the bundle with `VITE_*` (that would force a rebuild per environment / per
 * Docker deploy). Instead the server injects `window.__ENV__` into the page head
 * at render time — see `injectPublicEnvScript()` used by `__root.tsx`.
 */

declare global {
  interface Window {
    __ENV__?: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
  }
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ── Browser-safe (SUPABASE url + anon key only) ─────────────────────────────
export const PUBLIC_ENV = {
  get SUPABASE_URL(): string {
    if (typeof window !== "undefined") return window.__ENV__?.SUPABASE_URL ?? "";
    return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  },
  get SUPABASE_ANON_KEY(): string {
    if (typeof window !== "undefined") return window.__ENV__?.SUPABASE_ANON_KEY ?? "";
    return process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
  },
};

/** The `<script>` body injected into the document head so the browser client
 *  can read the public Supabase config. Isomorphic-stable: on the server it
 *  reads `process.env`; on the client it echoes the already-injected values so
 *  React hydration sees identical markup. */
export function publicEnvScript(): string {
  const fromProcess = (k: string) =>
    typeof process !== "undefined" ? (process.env[k] ?? process.env[`VITE_${k}`]) : undefined;
  const current = typeof window !== "undefined" ? window.__ENV__ : undefined;
  const payload = JSON.stringify({
    SUPABASE_URL: current?.SUPABASE_URL ?? fromProcess("SUPABASE_URL") ?? "",
    SUPABASE_ANON_KEY: current?.SUPABASE_ANON_KEY ?? fromProcess("SUPABASE_ANON_KEY") ?? "",
  });
  return `window.__ENV__=Object.assign(window.__ENV__||{},${payload});`;
}

// ── Server-only ────────────────────────────────────────────────────────────
export function serverEnv() {
  return {
    SUPABASE_URL: required("SUPABASE_URL", process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    RESEND_API_KEY: required("RESEND_API_KEY", process.env.RESEND_API_KEY),
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET ?? "",
    MAIL_DOMAIN: process.env.MAIL_DOMAIN ?? "4firsttechnologies.com",
    SHARED_MAILBOX_OWNER: process.env.SHARED_MAILBOX_OWNER ?? "",
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  };
}
