import { createBrowserClient } from "@supabase/ssr";
import { PUBLIC_ENV } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Singleton browser Supabase client (uses the anon key + cookie-stored session). */
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(PUBLIC_ENV.SUPABASE_URL, PUBLIC_ENV.SUPABASE_ANON_KEY);
  }
  return client;
}
