import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const getMailDomainStatus = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: me } = await supabase
    .from("members")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me?.is_active || me.role !== "admin") throw new Error("Admin access required");

  const env = serverEnv();
  const admin = getSupabaseAdminClient();
  const { data: mailboxes } = await admin
    .from("mailboxes")
    .select("address, display_name, created_at")
    .order("created_at", { ascending: true });

  return {
    mailDomain: env.MAIL_DOMAIN,
    sharedOwner: env.SHARED_MAILBOX_OWNER,
    webhookUrl: `${env.APP_URL}/api/resend/inbound`,
    webhookSecretConfigured: Boolean(env.RESEND_WEBHOOK_SECRET),
    resendKeyConfigured: Boolean(env.RESEND_API_KEY),
    mailboxes: mailboxes ?? [],
  };
});
