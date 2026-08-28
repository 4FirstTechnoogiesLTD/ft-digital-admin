-- ============================================================================
-- Storage buckets
--   media            — public, CMS images referenced by the marketing site
--   mail-attachments — private, inbound/outbound email attachments (signed URLs)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 10485760,
    array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/avif']),
  ('mail-attachments', 'mail-attachments', false, 26214400, null)
on conflict (id) do nothing;

-- media bucket: world-readable, editors+ manage.
create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media editor write"
  on storage.objects for insert
  with check (bucket_id = 'media' and public.can_edit_content());

create policy "media editor update"
  on storage.objects for update
  using (bucket_id = 'media' and public.can_edit_content());

create policy "media editor delete"
  on storage.objects for delete
  using (bucket_id = 'media' and public.can_edit_content());

-- mail-attachments: only active members may read via signed URLs; writes go
-- through the service role (webhook ingest / send), so no client insert policy.
create policy "mail attachments member read"
  on storage.objects for select
  using (bucket_id = 'mail-attachments' and public.is_active_member());
