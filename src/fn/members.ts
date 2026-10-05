import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/resend";

async function requireAdmin() {
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
  return { supabase, admin: getSupabaseAdminClient(), user };
}

/**
 * Builds a set-password link that lands on our own /reset-password page.
 * We pass the hashed token rather than Supabase's action_link so the page can
 * verify it itself (verifyOtp) — no dependence on the auth flow type or on the
 * Supabase redirect allow-list, and the token is only spent when they submit.
 */
async function recoveryLink(admin: ReturnType<typeof getSupabaseAdminClient>, email: string) {
  const env = serverEnv();
  const link = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (!tokenHash) return null;
  return `${env.APP_URL}/reset-password?token_hash=${encodeURIComponent(tokenHash)}`;
}

function localPart(email: string) {
  return email
    .split("@")[0]
    .replace(/[^a-z0-9._-]/gi, "")
    .toLowerCase();
}

export const listMembers = createServerFn({ method: "GET" }).handler(async () => {
  const { admin } = await requireAdmin();
  const [{ data: members }, { data: mailboxes }, usersRes] = await Promise.all([
    admin.from("members").select("*").order("created_at", { ascending: true }),
    admin.from("mailboxes").select("user_id, address"),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const emailByUser = new Map(usersRes.data.users.map((u) => [u.id, u.email ?? ""]));
  const addrByUser = new Map((mailboxes ?? []).map((m) => [m.user_id, m.address]));

  return (members ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    fullName: m.full_name,
    role: m.role,
    isActive: m.is_active,
    createdAt: m.created_at,
    email: emailByUser.get(m.user_id) ?? "",
    mailbox: addrByUser.get(m.user_id) ?? null,
  }));
});

export const inviteMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      fullName: z.string().trim().min(1).max(120),
      role: z.enum(["admin", "editor", "member"]).default("member"),
    }),
  )
  .handler(async ({ data }) => {
    const { admin, user } = await requireAdmin();
    const env = serverEnv();

    // create (or fetch) the auth user
    const created = await admin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    let userId = created.data.user?.id;
    if (created.error && !userId) {
      // maybe already exists
      const list = await admin.auth.admin.listUsers({ perPage: 200 });
      userId = list.data.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase())?.id;
    }
    if (!userId) throw new Error(created.error?.message ?? "Could not create user");

    await admin
      .from("members")
      .upsert(
        { user_id: userId, full_name: data.fullName, role: data.role, is_active: true },
        { onConflict: "user_id" },
      );

    const address = `${localPart(data.email)}@${env.MAIL_DOMAIN}`;
    await admin
      .from("mailboxes")
      .upsert({ user_id: userId, address, display_name: data.fullName }, { onConflict: "user_id" });

    // send a set-password link
    const actionUrl = await recoveryLink(admin, data.email);
    if (actionUrl) {
      try {
        await sendEmail({
          from: `4First Admin <no-reply@${env.MAIL_DOMAIN}>`,
          to: [data.email],
          subject: "Your 4First Admin account",
          html: `<p>Hi ${data.fullName.split(" ")[0]},</p>
<p>An account has been created for you on the 4First admin center.</p>
<p>Your team mailbox address is <strong>${address}</strong>.</p>
<p><a href="${actionUrl}">Set your password</a> to sign in.</p>`,
          text: `An account was created for you on the 4First admin center. Mailbox: ${address}. Set your password: ${actionUrl}`,
        });
      } catch (err) {
        console.error("[invite] email send failed", err);
      }
    }

    return { userId, address, inviteSent: Boolean(actionUrl) };
  });

export const updateMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      role: z.enum(["admin", "editor", "member"]).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { admin, supabase, user } = await requireAdmin();
    // guard: don't let an admin strip their own admin/active
    const { data: target } = await admin
      .from("members")
      .select("user_id, role")
      .eq("id", data.id)
      .maybeSingle();
    if (target?.user_id === user.id && (data.role === "member" || data.isActive === false)) {
      throw new Error("You can't demote or deactivate yourself.");
    }
    const patch: Record<string, unknown> = {};
    if (data.role) patch.role = data.role;
    if (typeof data.isActive === "boolean") patch.is_active = data.isActive;
    await admin.from("members").update(patch).eq("id", data.id);
    await supabase.from("audit_log").insert({
      actor_user_id: user.id,
      action: "updated member",
      entity: "member",
      entity_id: data.id,
      diff: patch as never,
    });
    return { ok: true };
  });

/** Admin sets a member's password directly. The password itself never reaches the audit log. */
export const setMemberPassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      password: z.string().min(8).max(72),
    }),
  )
  .handler(async ({ data }) => {
    const { admin, supabase, user } = await requireAdmin();
    const { data: target } = await admin
      .from("members")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!target) throw new Error("Member not found");

    const { error } = await admin.auth.admin.updateUserById(target.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      actor_user_id: user.id,
      action: "set member password",
      entity: "member",
      entity_id: data.id,
      diff: {} as never,
    });
    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin();
    const env = serverEnv();
    const actionUrl = await recoveryLink(admin, data.email);
    if (!actionUrl) throw new Error("Could not generate link");
    await sendEmail({
      from: `4First Admin <no-reply@${env.MAIL_DOMAIN}>`,
      to: [data.email],
      subject: "Set your 4First Admin password",
      html: `<p><a href="${actionUrl}">Set your password</a> to sign in to the 4First admin center.</p>`,
      text: `Set your password: ${actionUrl}`,
    });
    return { ok: true };
  });
