-- Who started a broadcast, so the worker can attribute its completion in audit_log.
alter table mail_broadcasts
  add column created_by uuid references auth.users (id) on delete set null;
