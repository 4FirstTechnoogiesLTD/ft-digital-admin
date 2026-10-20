-- Scope mail-attachment reads to the owner. The 0002 policy let any active
-- member read (and so sign URLs for) every object in the bucket. Inbound and
-- outbound attachments are both stored under <user_id>/..., so the owner check
-- is the folder prefix. Webhook ingest uses the service role and is unaffected.

drop policy if exists "mail attachments member read" on storage.objects;

create policy "mail attachments owner read"
  on storage.objects for select
  using (
    bucket_id = 'mail-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
