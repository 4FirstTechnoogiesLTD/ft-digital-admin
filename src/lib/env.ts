/**
 * Central env access. Browser-safe values must be prefixed `VITE_` and are read
 * from `import.meta.env`. Server-only secrets are read from `process.env` and
 * must never be imported into a client component.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ── Browser-safe ────────────────────────────────────────────────
export const PUBLIC_ENV = {
  SUPABASE_URL:
    import.meta.env.VITE_SUPABASE_URL ??
    (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ??
    "",
  SUPABASE_ANON_KEY:
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    (typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined) ??
    "",
};

// ── Server-only ─────────────────────────────────────────────────
export function serverEnv() {
  return {
    SUPABASE_URL: required("SUPABASE_URL", process.env.SUPABASE_URL ?? PUBLIC_ENV.SUPABASE_URL),
    SUPABASE_ANON_KEY: required(
      "SUPABASE_ANON_KEY",
      process.env.SUPABASE_ANON_KEY ?? PUBLIC_ENV.SUPABASE_ANON_KEY,
    ),
    SUPABASE_SERVICE_ROLE_KEY: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    RESEND_API_KEY: required("RESEND_API_KEY", process.env.RESEND_API_KEY),
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET ?? "",
    MAIL_DOMAIN: process.env.MAIL_DOMAIN ?? "mail.4firsttech.com",
    SHARED_MAILBOX_OWNER: process.env.SHARED_MAILBOX_OWNER ?? "",
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  };
}
