import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/database.types";

export interface SessionMember {
  userId: string;
  email: string;
  memberId: string;
  fullName: string;
  role: MemberRole;
  avatarUrl: string | null;
  /** admins always; other members only when granted recruitment access */
  canRecruit: boolean;
  /** true once the account has a verified authenticator-app factor */
  mfaEnrolled: boolean;
  mailbox: { id: string; address: string; displayName: string } | null;
}

/**
 * Resolves the signed-in user + their `members` row + mailbox. Returns null when
 * not authenticated or not an active member. Safe to call from `beforeLoad`.
 */
export const fetchSessionMember = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionMember | null> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // A password-only session on an MFA account isn't signed in until the code is entered.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return null;

    const { data: member } = await supabase
      .from("members")
      .select("id, full_name, role, avatar_url, is_active, can_recruit")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member || !member.is_active) return null;

    const { data: mailbox } = await supabase
      .from("mailboxes")
      .select("id, address, display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      email: user.email ?? "",
      memberId: member.id,
      fullName: member.full_name,
      role: member.role,
      avatarUrl: member.avatar_url,
      mfaEnrolled: aal?.currentLevel === "aal2",
      canRecruit: member.role === "admin" || Boolean(member.can_recruit),
      mailbox: mailbox
        ? { id: mailbox.id, address: mailbox.address, displayName: mailbox.display_name }
        : null,
    };
  },
);

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  return { ok: true };
});
