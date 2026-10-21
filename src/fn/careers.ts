import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getSupabaseServerClient,
  getSupabaseAdminClient,
  getVerifiedUser,
} from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/resend";

/**
 * Recruitment admin: vacancies, applications, CV access, notification retries.
 * Every handler re-checks authorization on the server — the UI gating is cosmetic.
 */

async function requireRecruiter(opts: { adminOnly?: boolean } = {}) {
  const supabase = getSupabaseServerClient();
  const user = await getVerifiedUser(supabase);
  const { data: me } = await supabase
    .from("members")
    .select("role, is_active, can_recruit")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = me?.role === "admin";
  const allowed = opts.adminOnly ? isAdmin : isAdmin || me?.can_recruit;
  if (!me?.is_active || !allowed) {
    throw new Error(opts.adminOnly ? "Admin access required" : "Recruitment access required");
  }
  return { supabase, admin: getSupabaseAdminClient(), user };
}

async function audit(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  diff?: unknown,
) {
  // never let a logging failure break the action it describes
  await admin
    .from("audit_log")
    .insert({
      actor_user_id: userId,
      action,
      entity,
      entity_id: entityId,
      diff: (diff ?? null) as never,
    })
    .then(
      () => {},
      () => {},
    );
}

export type JobStatus = "draft" | "published" | "closed" | "archived";
export type ApplicationStatus =
  "received" | "under_review" | "shortlisted" | "interview" | "rejected" | "hired" | "withdrawn";

// ── Settings ────────────────────────────────────────────────────────────────

export const getRecruitmentSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await requireRecruiter();
  const { data } = await supabase.from("recruitment_settings").select("*").maybeSingle();
  const env = serverEnv();
  return {
    settings: {
      notification_email: data?.notification_email ?? "",
      max_cv_mb: data?.max_cv_mb ?? 5,
      allow_word_docs: data?.allow_word_docs ?? true,
      privacy_notice_version: data?.privacy_notice_version ?? "2026-10",
      employment_types: (data?.employment_types as string[] | undefined) ?? [],
      work_arrangements: (data?.work_arrangements as string[] | undefined) ?? [],
    },
    resendConfigured: Boolean(env.RESEND_API_KEY),
  };
});

export const saveRecruitmentSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      notification_email: z.string().trim().email().or(z.literal("")),
      max_cv_mb: z.number().int().min(1).max(25),
      allow_word_docs: z.boolean(),
      employment_types: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
      work_arrangements: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
    }),
  )
  .handler(async ({ data }) => {
    const { admin, user } = await requireRecruiter({ adminOnly: true });
    const { error } = await admin
      .from("recruitment_settings")
      .update({ ...data, notification_email: data.notification_email || null, updated_by: user.id })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await audit(admin, user.id, "updated recruitment settings", "recruitment_settings", null, {
      notification_email: data.notification_email,
      max_cv_mb: data.max_cv_mb,
    });
    return { ok: true };
  });

// ── Vacancies ───────────────────────────────────────────────────────────────

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await requireRecruiter();
  const [{ data: jobs }, { data: apps }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, reference, slug, title, department, location, employment_type, status, published_at, application_deadline, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase.from("job_applications").select("job_id, status"),
  ]);
  const counts = new Map<string, { total: number; fresh: number }>();
  for (const a of apps ?? []) {
    const c = counts.get(a.job_id) ?? { total: 0, fresh: 0 };
    c.total += 1;
    if (a.status === "received") c.fresh += 1;
    counts.set(a.job_id, c);
  }
  return (jobs ?? []).map((j) => ({
    ...j,
    applications: counts.get(j.id) ?? { total: 0, fresh: 0 },
  }));
});

export const getJob = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabase } = await requireRecruiter();
    const [{ data: job }, { data: settings }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("recruitment_settings")
        .select("employment_types, work_arrangements")
        .maybeSingle(),
    ]);
    if (!job) throw new Error("Vacancy not found");
    return { job, options: optionsFrom(settings) };
  });

export const getJobOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await requireRecruiter();
  const { data } = await supabase
    .from("recruitment_settings")
    .select("employment_types, work_arrangements")
    .maybeSingle();
  return optionsFrom(data);
});

function optionsFrom(s: { employment_types?: unknown; work_arrangements?: unknown } | null) {
  return {
    employmentTypes: (s?.employment_types as string[] | undefined) ?? ["Full-time"],
    workArrangements: (s?.work_arrangements as string[] | undefined) ?? ["On-site"],
  };
}

const lines = z.array(z.string().trim().max(500)).max(40);

const jobSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(150),
  department: z.string().trim().max(100),
  employment_type: z.string().trim().max(60),
  work_arrangement: z.string().trim().max(60),
  location: z.string().trim().max(150),
  summary: z.string().trim().max(500),
  description: z.string().trim().max(20000),
  responsibilities: lines,
  qualifications: lines,
  skills: lines,
  preferred: lines,
  benefits: lines,
  salary_range: z.string().trim().max(100).nullable(),
  application_instructions: z.string().trim().max(2000).nullable(),
  recruitment_contact: z.string().trim().max(200).nullable(),
  allow_supporting_doc: z.boolean(),
  application_deadline: z.string().datetime().nullable(),
});

/** Fields that must be complete before a vacancy can go live. */
function publishProblems(j: z.infer<typeof jobSchema>) {
  const missing: string[] = [];
  if (!j.title) missing.push("title");
  if (!j.department) missing.push("department");
  if (!j.employment_type) missing.push("employment type");
  if (!j.work_arrangement) missing.push("work arrangement");
  if (!j.location) missing.push("location");
  if (!j.summary) missing.push("summary");
  if (!j.description) missing.push("description");
  if (!j.responsibilities.filter(Boolean).length) missing.push("responsibilities");
  if (!j.qualifications.filter(Boolean).length && !j.skills.filter(Boolean).length) {
    missing.push("required qualifications or skills");
  }
  if (j.application_deadline && new Date(j.application_deadline) <= new Date()) {
    missing.push("a deadline in the future");
  }
  return missing;
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "role"}-${Math.random().toString(36).slice(2, 6)}`;
}

const clean = (a: string[]) => a.map((s) => s.trim()).filter(Boolean);

export const saveJob = createServerFn({ method: "POST" })
  .validator(jobSchema)
  .handler(async ({ data }) => {
    const { supabase, admin, user } = await requireRecruiter();
    const row = {
      title: data.title,
      department: data.department,
      employment_type: data.employment_type,
      work_arrangement: data.work_arrangement,
      location: data.location,
      summary: data.summary,
      description: data.description,
      responsibilities: clean(data.responsibilities),
      qualifications: clean(data.qualifications),
      skills: clean(data.skills),
      preferred: clean(data.preferred),
      benefits: clean(data.benefits),
      salary_range: data.salary_range || null,
      application_instructions: data.application_instructions || null,
      recruitment_contact: data.recruitment_contact || null,
      allow_supporting_doc: data.allow_supporting_doc,
      application_deadline: data.application_deadline,
    };

    if (data.id) {
      // reference + slug are deliberately never touched: URLs and IDs stay stable
      const { error } = await supabase.from("jobs").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(admin, user.id, "updated vacancy", "job", data.id);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("jobs")
      .insert({ ...row, slug: slugify(data.title), status: "draft", created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(admin, user.id, "created vacancy", "job", created.id);
    return { id: created.id };
  });

export const setJobStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "published", "closed", "archived"]),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, admin, user } = await requireRecruiter();
    const { data: job } = await supabase.from("jobs").select("*").eq("id", data.id).maybeSingle();
    if (!job) throw new Error("Vacancy not found");

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "published") {
      const missing = publishProblems({ ...job, allow_supporting_doc: job.allow_supporting_doc });
      if (missing.length) throw new Error(`Complete before publishing: ${missing.join(", ")}`);
      patch.published_at = job.published_at ?? new Date().toISOString();
      patch.closed_at = null;
    }
    if (data.status === "closed") patch.closed_at = new Date().toISOString();

    const { error } = await supabase.from("jobs").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(admin, user.id, `set vacancy ${data.status}`, "job", data.id);
    return { ok: true };
  });

// ── Applications ────────────────────────────────────────────────────────────

const PAGE = 25;

export const listApplications = createServerFn({ method: "GET" })
  .validator(
    z.object({
      jobId: z.string().uuid().optional(),
      status: z.string().optional(),
      q: z.string().trim().max(100).optional(),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireRecruiter();
    let q = supabase
      .from("job_applications")
      .select(
        "id, application_reference, job_id, job_title, first_name, last_name, email, phone, status, submitted_at",
        { count: "exact" },
      )
      .order("submitted_at", { ascending: false })
      .range((data.page - 1) * PAGE, data.page * PAGE - 1);
    if (data.jobId) q = q.eq("job_id", data.jobId);
    if (data.status) q = q.eq("status", data.status);
    if (data.q) {
      // strip characters that carry meaning inside a PostgREST filter expression
      const term = data.q.replace(/[,()%*\\]/g, " ").trim();
      if (term) {
        q = q.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,application_reference.ilike.%${term}%`,
        );
      }
    }
    const [{ data: rows, count, error }, { data: jobs }] = await Promise.all([
      q,
      supabase.from("jobs").select("id, title").order("title"),
    ]);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, pageSize: PAGE, jobs: jobs ?? [] };
  });

export const getApplication = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabase } = await requireRecruiter();
    const [{ data: app }, { data: documents }, { data: notifications }] = await Promise.all([
      supabase.from("job_applications").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("application_documents")
        .select("id, kind, original_filename, verified_file_type, file_size, created_at")
        .eq("application_id", data.id)
        .order("created_at"),
      supabase.from("application_notifications").select("*").eq("application_id", data.id),
    ]);
    if (!app) throw new Error("Application not found");
    return { app, documents: documents ?? [], notifications: notifications ?? [] };
  });

export const updateApplication = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z
        .enum([
          "received",
          "under_review",
          "shortlisted",
          "interview",
          "rejected",
          "hired",
          "withdrawn",
        ])
        .optional(),
      internal_notes: z.string().max(5000).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, admin, user } = await requireRecruiter();
    const { id, ...patch } = data;
    const { error } = await supabase.from("job_applications").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(admin, user.id, "updated application", "application", id, {
      status: patch.status,
      notes_changed: patch.internal_notes !== undefined,
    });
    return { ok: true };
  });

/**
 * Short-lived signed URL for one document. Authorization is checked here (and the
 * bucket has no storage policies), so a leaked URL expires within a minute and a
 * guessed document id returns nothing for non-recruiters.
 */
export const getDocumentUrl = createServerFn({ method: "POST" })
  .validator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    let ctx: Awaited<ReturnType<typeof requireRecruiter>>;
    try {
      ctx = await requireRecruiter();
    } catch (e) {
      console.warn("[careers] denied document access attempt");
      throw e;
    }
    const { supabase, admin, user } = ctx;
    // read through the user-scoped client so RLS is a second gate
    const { data: doc } = await supabase
      .from("application_documents")
      .select("id, application_id, storage_key, original_filename")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    const { data: signed, error } = await admin.storage
      .from("recruitment-docs")
      .createSignedUrl(doc.storage_key, 60, { download: doc.original_filename });
    if (error || !signed) throw new Error("Could not open this document");
    await audit(
      admin,
      user.id,
      "downloaded applicant document",
      "application",
      doc.application_id,
      {
        document_id: doc.id,
      },
    );
    return { url: signed.signedUrl };
  });

// ── Notification retry ──────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;

export const retryNotification = createServerFn({ method: "POST" })
  .validator(z.object({ notificationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabase, admin, user } = await requireRecruiter();
    const { data: n } = await supabase
      .from("application_notifications")
      .select("*")
      .eq("id", data.notificationId)
      .maybeSingle();
    if (!n) throw new Error("Notification not found");
    if (n.delivery_status === "sent") return { ok: true, status: "sent" as const };
    if (n.attempts >= MAX_ATTEMPTS) throw new Error(`Gave up after ${MAX_ATTEMPTS} attempts`);

    const [{ data: app }, { data: settings }] = await Promise.all([
      supabase.from("job_applications").select("*").eq("id", n.application_id).single(),
      supabase.from("recruitment_settings").select("notification_email").maybeSingle(),
    ]);
    if (!app) throw new Error("Application not found");
    const recipient = settings?.notification_email || n.recipient;

    let error: string | null = null;
    if (!recipient) error = "No recruitment notification email is configured";
    else {
      try {
        const env = serverEnv();
        const link = `${env.APP_URL}/careers/applications/${app.id}`;
        const when =
          new Date(app.submitted_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }) + " WAT";
        const rows: [string, string][] = [
          ["Applicant", `${app.first_name} ${app.last_name}`],
          ["Email", app.email],
          ["Phone", app.phone],
          ["Position", app.job_title],
          ["Job reference", app.job_reference],
          ["Application ref", app.application_reference],
          ["Submitted", when],
        ];
        const esc = (v: string) =>
          v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail({
          from: `4First Careers <${env.SHARED_MAILBOX_OWNER || `careers@${env.MAIL_DOMAIN}`}>`,
          to: [recipient],
          replyTo: app.email,
          subject: `New Job Application – ${app.job_title} – ${app.application_reference}`,
          html:
            `<table style="border-collapse:collapse;">` +
            rows
              .map(
                ([l, v]) =>
                  `<tr><td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">${l}</td><td style="padding:4px 0;font-size:14px;">${esc(v)}</td></tr>`,
              )
              .join("") +
            `</table><p style="margin-top:16px;"><a href="${link}">Open the application</a></p>`,
          text: rows.map(([l, v]) => `${l}: ${v}`).join("\n") + `\n\n${link}`,
        });
      } catch (e) {
        error = e instanceof Error ? e.message.slice(0, 300) : "send failed";
      }
    }

    await admin
      .from("application_notifications")
      .update({
        recipient: recipient || n.recipient,
        attempts: n.attempts + 1,
        last_attempt_at: new Date().toISOString(),
        delivery_status: error ? "failed" : "sent",
        sent_at: error ? null : new Date().toISOString(),
        last_error: error,
      })
      .eq("id", n.id);
    await audit(
      admin,
      user.id,
      "retried recruitment notification",
      "application",
      n.application_id,
      {
        ok: !error,
      },
    );
    if (error) throw new Error(error);
    return { ok: true, status: "sent" as const };
  });

// ── Dashboard / nav summary ─────────────────────────────────────────────────

export const getRecruitmentSummary = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabase } = await requireRecruiter();
    const [{ count: fresh }, { count: failed }, { count: open }] = await Promise.all([
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "received"),
      supabase
        .from("application_notifications")
        .select("id", { count: "exact", head: true })
        .neq("delivery_status", "sent"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published"),
    ]);
    return { fresh: fresh ?? 0, failedNotifications: failed ?? 0, openJobs: open ?? 0 };
  } catch {
    return null;
  }
});
