import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface DashboardData {
  unreadMail: number;
  newSubmissions: number;
  publishedPages: number;
  draftPages: number;
  lastPublishAt: string | null;
  submissionsByWeek: { week: string; count: number }[];
  mailByDay: { day: string; inbound: number; outbound: number }[];
  recentSubmissions: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    brief: string;
    status: string;
    created_at: string;
  }[];
  activity: {
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    created_at: string;
  }[];
}

function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = (c.getUTCDay() + 6) % 7; // Monday = 0
  c.setUTCDate(c.getUTCDate() - day);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

export const fetchDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const supabase = getSupabaseServerClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 56);
    const sinceIso = since.toISOString();

    const [mailboxRes, submissionsCountRes, pagesRes, submissionRowsRes, activityRes, recentRes] =
      await Promise.all([
        supabase.from("mailboxes").select("id").maybeSingle(),
        supabase
          .from("contact_submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase.from("pages").select("slug, is_published, published_at"),
        supabase.from("contact_submissions").select("created_at").gte("created_at", sinceIso),
        supabase
          .from("audit_log")
          .select("id, action, entity, entity_id, created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("contact_submissions")
          .select("id, name, email, company, brief, status, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

    let unreadMail = 0;
    let mailByDay: DashboardData["mailByDay"] = [];
    if (mailboxRes.data?.id) {
      const mbId = mailboxRes.data.id;
      const [unreadRes, msgRes] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("mailbox_id", mbId)
          .eq("folder", "inbox")
          .eq("is_read", false),
        supabase
          .from("messages")
          .select("direction, created_at")
          .eq("mailbox_id", mbId)
          .gte("created_at", sinceIso),
      ]);
      unreadMail = unreadRes.count ?? 0;
      const byDay = new Map<string, { inbound: number; outbound: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        byDay.set(d.toISOString().slice(0, 10), { inbound: 0, outbound: 0 });
      }
      for (const m of msgRes.data ?? []) {
        const key = (m.created_at as string).slice(0, 10);
        const bucket = byDay.get(key);
        if (bucket) bucket[(m.direction as "inbound" | "outbound") ?? "inbound"] += 1;
      }
      mailByDay = [...byDay.entries()].map(([day, v]) => ({ day: day.slice(5), ...v }));
    }

    const pages = pagesRes.data ?? [];
    const publishedPages = pages.filter((p) => p.is_published).length;
    const draftPages = pages.length - publishedPages;
    const lastPublishAt =
      pages
        .map((p) => p.published_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null;

    const weeks = new Map<string, number>();
    for (let i = 7; i >= 0; i--) {
      const d = startOfWeek(new Date());
      d.setUTCDate(d.getUTCDate() - i * 7);
      weeks.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of submissionRowsRes.data ?? []) {
      const wk = startOfWeek(new Date(row.created_at as string))
        .toISOString()
        .slice(0, 10);
      if (weeks.has(wk)) weeks.set(wk, (weeks.get(wk) ?? 0) + 1);
    }

    return {
      unreadMail,
      newSubmissions: submissionsCountRes.count ?? 0,
      publishedPages,
      draftPages,
      lastPublishAt,
      submissionsByWeek: [...weeks.entries()].map(([week, count]) => ({
        week: week.slice(5),
        count,
      })),
      mailByDay,
      recentSubmissions: recentRes.data ?? [],
      activity: activityRes.data ?? [],
    };
  },
);
