import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Request-scoped Supabase client. Reads/writes the auth session from cookies so
 * RLS runs as the signed-in member. Use this inside server functions / loaders.
 *
 * Untyped for now — regenerate a typed schema with `supabase gen types typescript`
 * once the project is linked and swap it in.
 */
export function getSupabaseServerClient() {
  const env = serverEnv();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const jar = getCookies() ?? {};
        return Object.entries(jar).map(([name, value]) => ({ name, value: value ?? "" }));
      },
      setAll(cookies: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value, options } of cookies) {
          setCookie(name, value, options as CookieOptions);
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely — only for the inbound-mail webhook
 * and admin/invite flows. NEVER import this into a browser bundle.
 */
export function getSupabaseAdminClient() {
  const env = serverEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Authenticated user for server functions. Unlike a bare `auth.getUser()`, this
 * refuses a password-only (aal1) session once the account has an MFA factor, so
 * the second step can't be skipped by calling a server function directly.
 */
export async function getVerifiedUser(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    throw new Error("Two-factor verification required");
  }
  return user;
}
