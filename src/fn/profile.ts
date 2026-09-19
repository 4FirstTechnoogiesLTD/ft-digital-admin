import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Self-service profile edits. `members` is admin-write under RLS, so this runs
 * with the service role but is hard-scoped to the caller's own row and never
 * touches `role` or `is_active` — a member can't escalate through it.
 */
export const updateMyProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fullName: z.string().trim().min(1).max(120).optional(),
      avatarUrl: z.string().url().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const admin = getSupabaseAdminClient();
    const { data: me } = await admin
      .from("members")
      .select("id, is_active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me?.is_active) throw new Error("Not an active member");

    const patch: Record<string, unknown> = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await admin.from("members").update(patch).eq("user_id", user.id);
    if (error) throw new Error(error.message);

    // keep the mailbox display name in step with the member name
    if (data.fullName !== undefined) {
      await admin.from("mailboxes").update({ display_name: data.fullName }).eq("user_id", user.id);
    }

    return { ok: true };
  });
