-- ===================================================
-- STORAGE: the school-media bucket
-- ===================================================
-- School logos and liveries. Public: phones load them by plain URL from
-- Supabase's CDN, cached for a year (every path is named by its content, so
-- a file never changes). Raster images only: SVG can carry script.
--
-- No storage.objects policy exists for it on purpose: a public bucket serves
-- its files without one, and a SELECT policy would let anyone list the
-- bucket (Supabase lint 0025). Only the service role writes: the server's
-- logo upload and `npm run livery:publish`.
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
