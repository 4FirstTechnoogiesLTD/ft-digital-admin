-- ============================================================================
-- Careers & Recruitment
--   jobs                    — vacancies managed in the admin, shown on /careers
--   job_applications        — candidate submissions (no public access, ever)
--   application_documents   — CV / supporting docs, referenced by private storage key
--   application_notifications — recruitment-team email attempts + status
--   recruitment_settings    — singleton: notification inbox, upload limits
--   recruitment-docs bucket — private; only the service role reads/writes
--
-- Public submissions go through the marketing site's server function (service
-- role) which calls submit_application() — one transaction that re-checks the
-- vacancy is open, enforces idempotency and records application + document +
-- pending notification together.
-- ============================================================================

-- ── Access: who may touch recruitment data ──────────────────────────────────
alter table members add column if not exists can_recruit boolean not null default false;

create or replace function can_manage_recruitment()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where user_id = auth.uid() and is_active and (role = 'admin' or can_recruit)
  );
$$;

-- ── Enums ───────────────────────────────────────────────────────────────────
create type job_status as enum ('draft', 'published', 'closed', 'archived');
create type application_status as enum
  ('received', 'under_review', 'shortlisted', 'interview', 'rejected', 'hired', 'withdrawn');
create type notification_status as enum ('pending', 'sent', 'failed');

-- ── Settings (singleton) ────────────────────────────────────────────────────
create table recruitment_settings (
  id                     boolean primary key default true check (id),
  notification_email     text,
  max_cv_mb              integer not null default 5 check (max_cv_mb between 1 and 25),
  allow_word_docs        boolean not null default true,
  privacy_notice_version text not null default '2026-10',
  -- choices offered in the vacancy editor; edit under Settings → Recruitment
  employment_types       text[] not null default
    '{Full-time,Part-time,Contract,Internship,Graduate trainee,Temporary}',
  work_arrangements      text[] not null default '{On-site,Hybrid,Remote}',
  updated_at            timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null
);
insert into recruitment_settings (id) values (true) on conflict do nothing;
create trigger recruitment_settings_updated before update on recruitment_settings
  for each row execute function set_updated_at();

-- ── Jobs ────────────────────────────────────────────────────────────────────
create sequence job_reference_seq;

create table jobs (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique
    default ('JOB-' || to_char(now() at time zone 'Africa/Lagos', 'YYYY') || '-' ||
             lpad(nextval('job_reference_seq')::text, 4, '0')),
  slug                 text not null unique,
  title                text not null,
  department           text not null,
  employment_type      text not null,
  work_arrangement     text not null,
  location             text not null,
  summary              text not null,
  description          text not null,
  responsibilities     text[] not null default '{}',
  qualifications       text[] not null default '{}',
  skills               text[] not null default '{}',
  preferred            text[] not null default '{}',
  benefits             text[] not null default '{}',
  salary_range         text,
  application_instructions text,
  recruitment_contact  text,
  allow_supporting_doc boolean not null default false,
  status               job_status not null default 'draft',
  published_at         timestamptz,
  application_deadline timestamptz,
  closed_at            timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index jobs_status_idx on jobs (status, published_at desc);
create trigger jobs_updated before update on jobs
  for each row execute function set_updated_at();

-- ── Applications ────────────────────────────────────────────────────────────
create table job_applications (
  id                            uuid primary key default gen_random_uuid(),
  application_reference         text not null unique,
  idempotency_key               text not null unique,
  job_id                        uuid not null references jobs (id) on delete restrict,
  -- snapshots so history survives later edits to the vacancy
  job_title                     text not null,
  job_reference                 text not null,
  first_name                    text not null,
  last_name                     text not null,
  email                         text not null,
  phone                         text not null,
  location                      text not null,
  linkedin_url                  text,
  portfolio_url                 text,
  cover_letter                  text,
  privacy_notice_version        text not null,
  privacy_notice_acknowledged_at timestamptz not null,
  status                        application_status not null default 'received',
  internal_notes                text,
  submitted_at                  timestamptz not null default now(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
create index job_applications_job_idx on job_applications (job_id, submitted_at desc);
create index job_applications_status_idx on job_applications (status, submitted_at desc);
create index job_applications_email_idx on job_applications (lower(email));
create trigger job_applications_updated before update on job_applications
  for each row execute function set_updated_at();

create table application_documents (
  id                 uuid primary key default gen_random_uuid(),
  application_id     uuid not null references job_applications (id) on delete cascade,
  kind               text not null default 'cv' check (kind in ('cv', 'supporting')),
  storage_key        text not null unique,
  original_filename  text not null,
  verified_file_type text not null,
  file_size          integer not null check (file_size > 0),
  upload_status      text not null default 'stored',
  created_at         timestamptz not null default now()
);
create index application_documents_app_idx on application_documents (application_id);

create table application_notifications (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references job_applications (id) on delete cascade,
  notification_type text not null default 'new_application',
  recipient        text not null,
  delivery_status  notification_status not null default 'pending',
  attempts         integer not null default 0,
  last_attempt_at  timestamptz,
  sent_at          timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  -- one notification per (application, type): protects against duplicate sends
  unique (application_id, notification_type)
);
create index application_notifications_status_idx on application_notifications (delivery_status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table recruitment_settings     enable row level security;
alter table jobs                     enable row level security;
alter table job_applications         enable row level security;
alter table application_documents    enable row level security;
alter table application_notifications enable row level security;

-- Public (anon) may read published + closed vacancies (closed ones power the
-- "no longer accepting applications" page). Drafts/archived stay private.
create policy jobs_public_read on jobs for select
  using (status in ('published', 'closed') or can_manage_recruitment());
create policy jobs_manage on jobs for all
  using (can_manage_recruitment()) with check (can_manage_recruitment());

create policy recruitment_settings_manage on recruitment_settings for all
  using (can_manage_recruitment()) with check (can_manage_recruitment());

-- Applicant data: recruiters only. No anon policies — inserts use the service role.
create policy applications_read on job_applications for select
  using (can_manage_recruitment());
create policy applications_update on job_applications for update
  using (can_manage_recruitment()) with check (can_manage_recruitment());
create policy documents_read on application_documents for select
  using (can_manage_recruitment());
create policy notifications_read on application_notifications for select
  using (can_manage_recruitment());

-- ── Private storage ─────────────────────────────────────────────────────────
-- No storage.objects policies on purpose: with RLS on and no policy, neither
-- anon nor authenticated can touch it. The service role (server functions)
-- uploads, and hands recruiters short-lived signed URLs after a role check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recruitment-docs', 'recruitment-docs', false, 26214400,
  array['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- ── Atomic submission ───────────────────────────────────────────────────────
-- Returns jsonb: { status: 'ok' | 'duplicate' | 'closed' | 'not_found', ... }
create or replace function submit_application(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j jobs%rowtype;
  existing job_applications%rowtype;
  app_id uuid;
  recipient text;
begin
  -- idempotency: the same submission attempt returns the original record
  select * into existing from job_applications where idempotency_key = p->>'idempotency_key';
  if found then
    return jsonb_build_object('status', 'duplicate',
      'reference', existing.application_reference,
      'job_title', existing.job_title,
      'submitted_at', existing.submitted_at);
  end if;

  -- lock the vacancy row so a concurrent close can't interleave
  select * into j from jobs where id = (p->>'job_id')::uuid for share;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if j.status <> 'published'
     or (j.application_deadline is not null and j.application_deadline <= now()) then
    return jsonb_build_object('status', 'closed');
  end if;

  insert into job_applications (
    application_reference, idempotency_key, job_id, job_title, job_reference,
    first_name, last_name, email, phone, location, linkedin_url, portfolio_url,
    cover_letter, privacy_notice_version, privacy_notice_acknowledged_at
  ) values (
    p->>'reference', p->>'idempotency_key', j.id, j.title, j.reference,
    p->>'first_name', p->>'last_name', p->>'email', p->>'phone', p->>'location',
    nullif(p->>'linkedin_url', ''), nullif(p->>'portfolio_url', ''),
    nullif(p->>'cover_letter', ''), p->>'privacy_notice_version', now()
  ) returning id into app_id;

  insert into application_documents
    (application_id, kind, storage_key, original_filename, verified_file_type, file_size)
  select app_id, d->>'kind', d->>'storage_key', d->>'original_filename',
         d->>'verified_file_type', (d->>'file_size')::int
  from jsonb_array_elements(p->'documents') d;

  select notification_email into recipient from recruitment_settings where id;
  insert into application_notifications (application_id, recipient)
  values (app_id, coalesce(recipient, ''));

  return jsonb_build_object('status', 'ok', 'application_id', app_id,
    'reference', p->>'reference', 'job_title', j.title, 'submitted_at', now());
end;
$$;

revoke all on function submit_application(jsonb) from public, anon, authenticated;
grant execute on function submit_application(jsonb) to service_role;
