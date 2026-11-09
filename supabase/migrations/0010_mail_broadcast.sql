-- Broadcast mail: one message fanned out as individual emails (each recipient
-- sees only their own address), drained by a rate-limited worker.

create type outbox_status as enum ('pending', 'sending', 'sent', 'failed');

create table mail_broadcasts (
  id               uuid primary key default gen_random_uuid(),
  mailbox_id       uuid not null references mailboxes (id) on delete cascade,
  thread_id        uuid references threads (id) on delete set null,
  subject          text not null default '(no subject)',
  html             text,
  text_body        text,
  attachment_paths text[] not null default '{}',
  total            integer not null default 0,
  created_at       timestamptz not null default now()
);
create index mail_broadcasts_mailbox_idx on mail_broadcasts (mailbox_id, created_at desc);

create table mail_outbox (
  id               uuid primary key default gen_random_uuid(),
  broadcast_id     uuid not null references mail_broadcasts (id) on delete cascade,
  mailbox_id       uuid not null references mailboxes (id) on delete cascade,
  to_email         text not null,
  to_name          text,
  status           outbox_status not null default 'pending',
  attempts         integer not null default 0,
  error            text,
  resend_email_id  text,
  send_after       timestamptz not null default now(),
  claimed_at       timestamptz,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (broadcast_id, to_email)
);
create index mail_outbox_queue_idx on mail_outbox (status, send_after, created_at);
create index mail_outbox_broadcast_idx on mail_outbox (broadcast_id, status);

-- Owners can read their own queue; all writes go through the service role.
alter table mail_broadcasts enable row level security;
alter table mail_outbox     enable row level security;

create policy mail_broadcasts_owner_read on mail_broadcasts
  for select using (owns_mailbox(mailbox_id));
create policy mail_outbox_owner_read on mail_outbox
  for select using (owns_mailbox(mailbox_id));
