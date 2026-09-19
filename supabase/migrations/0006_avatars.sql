-- ============================================================================
-- Member profile images
--   avatars — public bucket, one folder per user id: <user_id>/<file>
--   Used for the sender portrait in the mailbox and the account menu.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
    array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
on conflict (id) do nothing;

-- world-readable: avatar URLs are embedded in the admin UI and in sent mail.
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- a member may only write inside their own <user_id>/ folder.
create policy "avatars owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.is_active_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.is_active_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.is_active_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
