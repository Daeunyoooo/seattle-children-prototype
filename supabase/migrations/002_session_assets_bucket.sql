-- Prototype public bucket for session PNGs (drawings + uploads).
-- Not for PHI/HIPAA: anon can read and write objects in this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-assets',
  'session-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "prototype_anon_select_session_assets" on storage.objects;
create policy "prototype_anon_select_session_assets"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'session-assets');

drop policy if exists "prototype_anon_insert_session_assets" on storage.objects;
create policy "prototype_anon_insert_session_assets"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'session-assets');

drop policy if exists "prototype_anon_update_session_assets" on storage.objects;
create policy "prototype_anon_update_session_assets"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'session-assets')
  with check (bucket_id = 'session-assets');
