-- ===================================================
-- FUNCTIONS: the board's schools, liveries and sponsorships
-- ===================================================
-- board_schools() is the one thing the app reads to show schools: every
-- active school with a profile or a live livery, as one JSON array of words,
-- numbers and school-media paths (a few KB). The app caches it on the
-- server and the CDN; the files it names are cached by their own URLs.
-- Drafts, who made what, and inactive schools never appear in it.

-- Today in Kenya, the calendar sponsorships are written in.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.board_school_json, admin_end_sponsorship
create or replace function private.kenya_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Nairobi')::date;
$$;

-- One school as the app sees it, with the given livery (live or a draft
-- being previewed) or none.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: board_schools, admin_livery_draft_get
create or replace function private.board_school_json(p_school public.schools, p_livery public.school_liveries)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', p_school.slug,
    'name', p_school.name,
    'sponsoring', exists (
      select 1 from public.school_sponsorships as sp
       where sp.school_id = p_school.id
         and sp.starts_on <= private.kenya_today()
         and (sp.ends_on is null or sp.ends_on >= private.kenya_today())
    ),
    'profile', (
      select jsonb_build_object(
        'tagline', p.tagline, 'about', p.about, 'phone', p.phone,
        'whatsapp', p.whatsapp, 'email', p.email, 'website_url', p.website_url,
        'socials', p.socials, 'brand_paint', p.brand_paint, 'brand_ink', p.brand_ink,
        'logo', p.logo, 'logo_mono', p.logo_mono
      )
        from public.school_profiles as p where p.school_id = p_school.id
    ),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', b.name, 'town', b.town, 'address', b.address, 'lat', b.lat,
        'lng', b.lng, 'phone', b.phone, 'hours', b.hours
      ) order by b.name)
        from public.school_branches as b
       where b.school_id = p_school.id and b.is_active
    ), '[]'::jsonb),
    'livery', case when p_livery.id is null then null else jsonb_build_object(
      'id', p_livery.id, 'status', p_livery.status, 'base_color', p_livery.base_color,
      'rail', p_livery.rail, 'paint', p_livery.paint, 'top_board', p_livery.top_board,
      'banner', p_livery.banner, 'posters', p_livery.posters, 'marks', p_livery.marks,
      'thumbs', p_livery.thumbs, 'stills', p_livery.stills
    ) end
  );
$$;

-- Access:  anon (anyone, guests included)
-- Guard:   public (only public schools: active and made ready by their
--          owner, private.is_active_school; their profile and live livery)
-- Callers: web root loader and /api/board-schools (server, cached)
create or replace function private.board_schools()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.board_school_json(s, l) order by s.name), '[]'::jsonb)
    from public.schools as s
    left join public.school_liveries as l on l.school_id = s.id and l.status = 'live'
   where private.is_active_school(s.id);
$$;

-- A draft (or any livery) shaped like a board_schools() entry, for staff to
-- preview on the board before it goes live.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: board ?livery= preview (staff session)
create or replace function private.admin_livery_draft_get(p_livery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_livery public.school_liveries;
  v_school public.schools;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_livery from public.school_liveries where id = p_livery_id;
  if v_livery.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_school from public.schools where id = v_livery.school_id;
  return private.board_school_json(v_school, v_livery);
end;
$$;

-- Makes a draft or retired livery the school's live one; the one live
-- before is retired.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session); livery:publish --live (staff session)
create or replace function private.admin_publish_livery(p_livery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select school_id into v_school_id from public.school_liveries where id = p_livery_id for update;
  if v_school_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.school_liveries
     set status = 'retired'
   where school_id = v_school_id and status = 'live' and id <> p_livery_id;
  update public.school_liveries
     set status = 'live', published_at = coalesce(published_at, now())
   where id = p_livery_id;
end;
$$;

-- Takes a live livery off the board (the school shows plain cars until
-- another is published).
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_retire_livery(p_livery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_liveries
     set status = 'retired', published_at = coalesce(published_at, now())
   where id = p_livery_id and status in ('live', 'draft');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_set_sponsorship(
  p_school_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.school_sponsorships (school_id, starts_on, ends_on, note, created_by)
  values (p_school_id, p_starts_on, p_ends_on, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Ends a sponsorship today (Kenyan date), or on an earlier set end.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_end_sponsorship(p_sponsorship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_sponsorships
     set ends_on = greatest(starts_on, least(coalesce(ends_on, private.kenya_today()), private.kenya_today()))
   where id = p_sponsorship_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Access:  anon (anyone, guests included)
-- Guard:   public (the private body returns only public data)
-- Callers: web root loader and /api/board-schools (server, cached)
create or replace function public.board_schools()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.board_schools();
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: board ?livery= preview (staff session)
create or replace function public.admin_livery_draft_get(p_livery_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_livery_draft_get(p_livery_id);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session); livery:publish --live (staff session)
create or replace function public.admin_publish_livery(p_livery_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_publish_livery(p_livery_id);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_retire_livery(p_livery_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_retire_livery(p_livery_id);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_set_sponsorship(
  p_school_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_note text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_sponsorship(p_school_id, p_starts_on, p_ends_on, p_note);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_end_sponsorship(p_sponsorship_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_end_sponsorship(p_sponsorship_id);
$$;

revoke all on function private.kenya_today() from public;
revoke all on function private.board_school_json(public.schools, public.school_liveries) from public;
revoke all on function private.board_schools() from public;
revoke all on function private.admin_livery_draft_get(uuid) from public;
revoke all on function private.admin_publish_livery(uuid) from public;
revoke all on function private.admin_retire_livery(uuid) from public;
revoke all on function private.admin_set_sponsorship(uuid, date, date, text) from public;
revoke all on function private.admin_end_sponsorship(uuid) from public;
revoke all on function public.board_schools() from public;
revoke all on function public.admin_livery_draft_get(uuid) from public;
revoke all on function public.admin_publish_livery(uuid) from public;
revoke all on function public.admin_retire_livery(uuid) from public;
revoke all on function public.admin_set_sponsorship(uuid, date, date, text) from public;
revoke all on function public.admin_end_sponsorship(uuid) from public;
grant execute on function private.kenya_today() to service_role;
grant execute on function private.board_school_json(public.schools, public.school_liveries) to service_role;
grant execute on function private.board_schools() to service_role;
grant execute on function private.admin_livery_draft_get(uuid) to service_role;
grant execute on function private.admin_publish_livery(uuid) to service_role;
grant execute on function private.admin_retire_livery(uuid) to service_role;
grant execute on function private.admin_set_sponsorship(uuid, date, date, text) to service_role;
grant execute on function private.admin_end_sponsorship(uuid) to service_role;
grant execute on function public.board_schools() to service_role;
grant execute on function public.admin_livery_draft_get(uuid) to service_role;
grant execute on function public.admin_publish_livery(uuid) to service_role;
grant execute on function public.admin_retire_livery(uuid) to service_role;
grant execute on function public.admin_set_sponsorship(uuid, date, date, text) to service_role;
grant execute on function public.admin_end_sponsorship(uuid) to service_role;

comment on function private.kenya_today() is
  'Today''s date in Kenya (Africa/Nairobi).';
comment on function private.board_school_json(public.schools, public.school_liveries) is
  'One school as the app sees it: slug, name, sponsoring, profile, branches and the given livery.';
comment on function private.board_schools() is
  'Every active school with a profile or live livery, public fields only: the app''s school manifest.';
comment on function private.admin_livery_draft_get(uuid) is
  'DriveRush staff: a livery (draft included) shaped like a board_schools() entry, for preview.';
comment on function private.admin_publish_livery(uuid) is
  'DriveRush staff: makes a livery the school''s live one and retires the one before.';
comment on function private.admin_retire_livery(uuid) is
  'DriveRush staff: takes a livery off the board.';
comment on function private.admin_set_sponsorship(uuid, date, date, text) is
  'DriveRush staff: records a sponsorship period (Kenyan dates; no end runs until ended).';
comment on function private.admin_end_sponsorship(uuid) is
  'DriveRush staff: ends a sponsorship today (Kenyan date).';
comment on function public.board_schools() is
  'Every active school with a profile or live livery, public fields only: the app''s school manifest.';
comment on function public.admin_livery_draft_get(uuid) is
  'DriveRush staff: a livery (draft included) shaped like a board_schools() entry, for preview.';
comment on function public.admin_publish_livery(uuid) is
  'DriveRush staff: makes a livery the school''s live one and retires the one before.';
comment on function public.admin_retire_livery(uuid) is
  'DriveRush staff: takes a livery off the board.';
comment on function public.admin_set_sponsorship(uuid, date, date, text) is
  'DriveRush staff: records a sponsorship period (Kenyan dates; no end runs until ended).';
comment on function public.admin_end_sponsorship(uuid) is
  'DriveRush staff: ends a sponsorship today (Kenyan date).';
