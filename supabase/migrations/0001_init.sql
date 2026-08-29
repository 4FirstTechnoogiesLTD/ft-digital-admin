-- ============================================================================
-- 4First Admin Center — initial schema
-- Content management + per-user team mailbox
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────
create type member_role as enum ('admin', 'editor', 'member');
create type submission_status as enum ('new', 'read', 'archived');
create type mail_direction as enum ('inbound', 'outbound');
create type mail_folder as enum ('inbox', 'sent', 'drafts', 'archive', 'trash', 'spam');

-- ── Helper: updated_at trigger ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- ACCESS
-- ============================================================================

create table members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        member_role not null default 'member',
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index members_role_idx on members (role);

-- role lookups used by RLS policies (security definer to avoid recursive RLS)
create or replace function current_member_role()
returns member_role language sql stable security definer set search_path = public as $$
  select role from members where user_id = auth.uid() and is_active limit 1;
$$;

create or replace function is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and is_active);
$$;

create or replace function can_edit_content()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_member_role() in ('admin', 'editor'), false);
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_member_role() = 'admin', false);
$$;

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action        text not null,
  entity        text not null,
  entity_id     text,
  diff          jsonb,
  created_at    timestamptz not null default now()
);

create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_entity_idx on audit_log (entity, entity_id);

-- ============================================================================
-- CMS
-- ============================================================================

create table site_settings (
  id             uuid primary key default gen_random_uuid(),
  contact_email  text,
  contact_phone  text,
  linkedin_url   text,
  studio_address text,
  hours          text,
  footer_tagline text,
  og_image_url   text,
  metrics        jsonb not null default '[]'::jsonb,
  ticker         jsonb not null default '[]'::jsonb,
  socials        jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);
create trigger site_settings_updated before update on site_settings
  for each row execute function set_updated_at();

create table pages (
  slug             text primary key,
  meta_title       text,
  meta_description  text,
  og_title         text,
  og_description    text,
  canonical        text,
  hero             jsonb not null default '{}'::jsonb,
  draft            jsonb,
  is_published     boolean not null default false,
  published_at     timestamptz,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null
);
create trigger pages_updated before update on pages
  for each row execute function set_updated_at();

create table collections (
  key         text primary key,
  label       text not null,
  heading     text,
  subheading  text,
  item_shape  text not null default 'generic',
  updated_at  timestamptz not null default now()
);
create trigger collections_updated before update on collections
  for each row execute function set_updated_at();

create table collection_items (
  id             uuid primary key default gen_random_uuid(),
  collection_key text not null references collections (key) on delete cascade,
  position       integer not null default 0,
  data           jsonb not null default '{}'::jsonb,
  body_rich      jsonb,
  is_published   boolean not null default true,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);
create index collection_items_key_pos_idx on collection_items (collection_key, position);
create trigger collection_items_updated before update on collection_items
  for each row execute function set_updated_at();

create table media (
  id           uuid primary key default gen_random_uuid(),
  path         text not null,
  url          text not null,
  alt          text,
  width        integer,
  height       integer,
  size         integer,
  content_type text,
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index media_created_idx on media (created_at desc);

create table contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  company     text,
  interests   text[] not null default '{}',
  brief       text not null,
  status      submission_status not null default 'new',
  assigned_to uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index contact_submissions_created_idx on contact_submissions (created_at desc);
create index contact_submissions_status_idx on contact_submissions (status);

-- ============================================================================
-- MAILBOX  (scoped per user)
-- ============================================================================

create table mailboxes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  address        text not null unique,
  display_name   text not null default '',
  signature_rich jsonb,
  created_at     timestamptz not null default now()
);

-- fast "does this mailbox belong to me" check for RLS
create or replace function owns_mailbox(mb uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from mailboxes where id = mb and user_id = auth.uid());
$$;

create table threads (
  id              uuid primary key default gen_random_uuid(),
  mailbox_id      uuid not null references mailboxes (id) on delete cascade,
  subject         text not null default '(no subject)',
  snippet         text,
  last_message_at timestamptz not null default now(),
  message_count   integer not null default 0,
  unread_count    integer not null default 0,
  is_starred      boolean not null default false,
  folder          mail_folder not null default 'inbox',
  labels          text[] not null default '{}',
  created_at      timestamptz not null default now()
);
create index threads_mailbox_folder_idx on threads (mailbox_id, folder, last_message_at desc);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references threads (id) on delete cascade,
  mailbox_id       uuid not null references mailboxes (id) on delete cascade,
  direction        mail_direction not null,
  resend_email_id  text,
  message_id       text,
  in_reply_to      text,
  "references"     text[] not null default '{}',
  from_addr        text not null,
  from_name        text,
  to_addrs         jsonb not null default '[]'::jsonb,
  cc_addrs         jsonb not null default '[]'::jsonb,
  bcc_addrs        jsonb not null default '[]'::jsonb,
  subject          text not null default '(no subject)',
  html             text,
  text             text,
  headers          jsonb,
  folder           mail_folder not null default 'inbox',
  is_read          boolean not null default false,
  is_starred       boolean not null default false,
  has_attachments  boolean not null default false,
  sent_at          timestamptz,
  received_at      timestamptz,
  raw_download_url text,
  created_at       timestamptz not null default now()
);
create index messages_thread_idx on messages (thread_id, created_at);
create index messages_mailbox_folder_idx on messages (mailbox_id, folder, created_at desc);
create unique index messages_resend_email_uidx on messages (resend_email_id) where resend_email_id is not null;

create table attachments (
  id                   uuid primary key default gen_random_uuid(),
  message_id           uuid not null references messages (id) on delete cascade,
  resend_attachment_id text,
  filename             text not null default 'attachment',
  content_type         text,
  size                 integer,
  storage_path         text,
  content_id           text,
  disposition          text,
  created_at           timestamptz not null default now()
);
create index attachments_message_idx on attachments (message_id);

create table drafts (
  id                     uuid primary key default gen_random_uuid(),
  mailbox_id             uuid not null references mailboxes (id) on delete cascade,
  to_addrs               jsonb not null default '[]'::jsonb,
  cc_addrs               jsonb not null default '[]'::jsonb,
  bcc_addrs              jsonb not null default '[]'::jsonb,
  subject                text not null default '',
  body_rich              jsonb,
  in_reply_to_message_id uuid references messages (id) on delete set null,
  updated_at             timestamptz not null default now()
);
create index drafts_mailbox_idx on drafts (mailbox_id, updated_at desc);
create trigger drafts_updated before update on drafts
  for each row execute function set_updated_at();

create table labels (
  id         uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references mailboxes (id) on delete cascade,
  name       text not null,
  color      text not null default '#c0562a',
  created_at timestamptz not null default now(),
  unique (mailbox_id, name)
);

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  mailbox_id        uuid not null references mailboxes (id) on delete cascade,
  name              text,
  email             text not null,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (mailbox_id, email)
);

-- ============================================================================
-- RLS
-- ============================================================================

alter table members             enable row level security;
alter table audit_log           enable row level security;
alter table site_settings       enable row level security;
alter table pages               enable row level security;
alter table collections         enable row level security;
alter table collection_items    enable row level security;
alter table media               enable row level security;
alter table contact_submissions enable row level security;
alter table mailboxes           enable row level security;
alter table threads             enable row level security;
alter table messages            enable row level security;
alter table attachments         enable row level security;
alter table drafts              enable row level security;
alter table labels              enable row level security;
alter table contacts            enable row level security;

-- members: everyone active can read the roster; only admins mutate.
create policy members_read   on members for select using (is_active_member());
create policy members_self   on members for select using (user_id = auth.uid());
create policy members_admin_write on members for all
  using (is_admin()) with check (is_admin());

-- audit_log: editors+ read; inserts happen via service role.
create policy audit_read on audit_log for select using (can_edit_content());

-- ── CMS: public (anon) reads PUBLISHED content; editors read everything & write.
create policy site_settings_public_read on site_settings for select using (true);
create policy site_settings_edit on site_settings for all
  using (can_edit_content()) with check (can_edit_content());

create policy pages_public_read on pages for select using (is_published or can_edit_content());
create policy pages_edit on pages for all
  using (can_edit_content()) with check (can_edit_content());

create policy collections_public_read on collections for select using (true);
create policy collections_edit on collections for all
  using (can_edit_content()) with check (can_edit_content());

create policy collection_items_public_read on collection_items for select
  using (is_published or can_edit_content());
create policy collection_items_edit on collection_items for all
  using (can_edit_content()) with check (can_edit_content());

create policy media_public_read on media for select using (true);
create policy media_edit on media for all
  using (can_edit_content()) with check (can_edit_content());

-- contact_submissions: anyone (anon) may INSERT; editors+ read/update.
create policy contact_submissions_insert on contact_submissions for insert with check (true);
create policy contact_submissions_read on contact_submissions for select using (can_edit_content());
create policy contact_submissions_update on contact_submissions for update
  using (can_edit_content()) with check (can_edit_content());

-- ── Mailbox: strictly the owner. (Service role bypasses RLS for ingest.)
create policy mailboxes_owner on mailboxes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy threads_owner on threads for all
  using (owns_mailbox(mailbox_id)) with check (owns_mailbox(mailbox_id));

create policy messages_owner on messages for all
  using (owns_mailbox(mailbox_id)) with check (owns_mailbox(mailbox_id));

create policy attachments_owner on attachments for all
  using (exists (select 1 from messages m where m.id = attachments.message_id and owns_mailbox(m.mailbox_id)))
  with check (exists (select 1 from messages m where m.id = attachments.message_id and owns_mailbox(m.mailbox_id)));

create policy drafts_owner on drafts for all
  using (owns_mailbox(mailbox_id)) with check (owns_mailbox(mailbox_id));

create policy labels_owner on labels for all
  using (owns_mailbox(mailbox_id)) with check (owns_mailbox(mailbox_id));

create policy contacts_owner on contacts for all
  using (owns_mailbox(mailbox_id)) with check (owns_mailbox(mailbox_id));

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table threads;
alter publication supabase_realtime add table contact_submissions;
