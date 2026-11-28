-- ===================================================
-- FUNCTIONS: a school's profile and branch details
-- ===================================================
-- The owner (or DriveRush staff) edits the words, colours and contacts. The
-- logo files are made and uploaded by the server (sharp, then the
-- school-media bucket with the service role), which then records them with
-- school_set_logo: no client ever writes a media path.

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (private.can_manage_school: owner or staff)
-- Callers: school dashboard profile tab, DriveRush console (session)
create or replace function private.school_update_profile(
  p_school_id uuid,
  p_tagline text,
  p_about text,
  p_phone text,
  p_whatsapp text,
  p_email text,
  p_website_url text,
  p_socials jsonb,
  p_brand_paint text,
  p_brand_ink text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.school_profiles as p (
    school_id, tagline, about, phone, whatsapp, email, website_url, socials,
    brand_paint, brand_ink, updated_by
  ) values (
    p_school_id,
    nullif(btrim(p_tagline), ''),
    nullif(btrim(p_about), ''),
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_whatsapp), ''),
    nullif(lower(btrim(p_email)), '')::extensions.citext,
    nullif(btrim(p_website_url), ''),
    coalesce(p_socials, '{}'::jsonb),
    nullif(lower(btrim(p_brand_paint)), ''),
    nullif(lower(btrim(p_brand_ink)), ''),
    auth.uid()
  )
  on conflict (school_id) do update
    set tagline = excluded.tagline,
        about = excluded.about,
        phone = excluded.phone,
        whatsapp = excluded.whatsapp,
        email = excluded.email,
        website_url = excluded.website_url,
        socials = excluded.socials,
        brand_paint = excluded.brand_paint,
        brand_ink = excluded.brand_ink,
        updated_by = excluded.updated_by;
end;
$$;

-- Records a logo the server has just uploaded and returns the path it
-- replaces (null if none), for the server to delete from the bucket.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate; the server checks the owner first)
-- Callers: school dashboard logo upload (server, service role); the seed
create or replace function private.school_set_logo(
  p_school_id uuid,
  p_kind text,
  p_ref jsonb,
  p_actor uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  if p_kind not in ('logo', 'logo_mono') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  insert into public.school_profiles (school_id, updated_by) values (p_school_id, p_actor)
  on conflict (school_id) do nothing;
  if p_kind = 'logo' then
    select logo into v_old from public.school_profiles where school_id = p_school_id for update;
    update public.school_profiles set logo = p_ref, updated_by = p_actor where school_id = p_school_id;
  else
    select logo_mono into v_old from public.school_profiles where school_id = p_school_id for update;
    update public.school_profiles set logo_mono = p_ref, updated_by = p_actor where school_id = p_school_id;
  end if;
  if v_old ->> 'path' is distinct from p_ref ->> 'path' then
    return v_old ->> 'path';
  end if;
  return null;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (private.can_manage_school: owner or staff)
-- Callers: school dashboard branches (session)
create or replace function private.school_update_branch_details(
  p_branch_id uuid,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_phone text,
  p_hours jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id from public.school_branches where id = p_branch_id;
  if v_school_id is null or not private.can_manage_school(v_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_branches
     set address = nullif(btrim(p_address), ''),
         lat = p_lat,
         lng = p_lng,
         phone = nullif(btrim(p_phone), ''),
         hours = p_hours
   where id = p_branch_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (the private body checks private.can_manage_school)
-- Callers: school dashboard profile tab, DriveRush console (session)
create or replace function public.school_update_profile(
  p_school_id uuid,
  p_tagline text,
  p_about text,
  p_phone text,
  p_whatsapp text,
  p_email text,
  p_website_url text,
  p_socials jsonb,
  p_brand_paint text,
  p_brand_ink text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_update_profile(
    p_school_id, p_tagline, p_about, p_phone, p_whatsapp, p_email,
    p_website_url, p_socials, p_brand_paint, p_brand_ink
  );
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate; the server checks the owner first)
-- Callers: school dashboard logo upload (server, service role); the seed
create or replace function public.school_set_logo(
  p_school_id uuid,
  p_kind text,
  p_ref jsonb,
  p_actor uuid
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.school_set_logo(p_school_id, p_kind, p_ref, p_actor);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (the private body checks private.can_manage_school)
-- Callers: school dashboard branches (session)
create or replace function public.school_update_branch_details(
  p_branch_id uuid,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_phone text,
  p_hours jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_update_branch_details(p_branch_id, p_address, p_lat, p_lng, p_phone, p_hours);
$$;

revoke all on function private.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) from public;
revoke all on function private.school_set_logo(uuid, text, jsonb, uuid) from public;
revoke all on function private.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) from public;
revoke all on function public.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) from public;
revoke all on function public.school_set_logo(uuid, text, jsonb, uuid) from public;
revoke all on function public.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) from public;
grant execute on function private.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function private.school_set_logo(uuid, text, jsonb, uuid) to service_role;
grant execute on function private.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) to service_role;
grant execute on function public.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.school_set_logo(uuid, text, jsonb, uuid) to service_role;
grant execute on function public.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) to service_role;

comment on function private.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) is
  'School owner or staff: sets the profile''s words, contacts, socials and brand colours.';
comment on function private.school_set_logo(uuid, text, jsonb, uuid) is
  'Server only: records an uploaded logo (logo or logo_mono) and returns the path it replaces.';
comment on function private.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) is
  'School owner or staff: sets a branch''s address, map pin, phone and opening hours.';
comment on function public.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) is
  'School owner or staff: sets the profile''s words, contacts, socials and brand colours.';
comment on function public.school_set_logo(uuid, text, jsonb, uuid) is
  'Server only: records an uploaded logo (logo or logo_mono) and returns the path it replaces.';
comment on function public.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) is
  'School owner or staff: sets a branch''s address, map pin, phone and opening hours.';
