-- Allow a member to upload outbound-mail attachments into their own folder
-- (mail-attachments/<user_id>/...). Webhook ingest still uses the service role.

create policy "mail attachments member upload"
  on storage.objects for insert
  with check (
    bucket_id = 'mail-attachments'
    and public.is_active_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "mail attachments member update own"
  on storage.objects for update
  using (
    bucket_id = 'mail-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "mail attachments member delete own"
  on storage.objects for delete
  using (
    bucket_id = 'mail-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
