-- ===================================================
-- STORAGE: the school-media bucket
-- ===================================================
-- School logos and liveries. Public: phones load them by plain URL from
-- Supabase's CDN, cached for a year (every path is named by its content, so
-- a file never changes). Raster images only: SVG can carry script.
--
-- Reading: a public bucket serves its files by URL with no policy, so there
-- is no SELECT policy for anyone else: a public one would let anyone list
-- the bucket (Supabase lint 0025).
--
-- Writing: DriveRush staff only (password session, private.is_staff), as
-- for school_liveries: they may list, upload, replace and delete. Everyone
-- else is refused. The service role (the server's logo upload after its
-- owner check, and `npm run livery:publish`) bypasses row level security.
--
-- `supabase db diff` does not read the storage schema, so this row is an
-- idempotent insert here (it lands in the baseline) and config.toml declares
-- the same bucket for local stacks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-media', 'school-media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ===================================================
-- ACCESS: storage.objects in school-media
-- ===================================================
-- Reads:  anyone, by public URL (no policy needed); listing: staff only.
-- Writes: DriveRush staff only. School owners' logos go through the server.
drop policy if exists "school-media: staff list" on storage.objects;
create policy "school-media: staff list"
  on storage.objects for select to authenticated
  using (bucket_id = 'school-media' and (select private.is_staff()));

drop policy if exists "school-media: staff upload" on storage.objects;
create policy "school-media: staff upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'school-media' and (select private.is_staff()));

drop policy if exists "school-media: staff replace" on storage.objects;
create policy "school-media: staff replace"
  on storage.objects for update to authenticated
  using (bucket_id = 'school-media' and (select private.is_staff()))
  with check (bucket_id = 'school-media' and (select private.is_staff()));

drop policy if exists "school-media: staff delete" on storage.objects;
create policy "school-media: staff delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'school-media' and (select private.is_staff()));
