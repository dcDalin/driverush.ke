-- ===================================================
-- FUNCTIONS: CHECKs for school media and branch hours
-- ===================================================
-- Files in the school-media bucket are named by content:
--   <school_id>/<kind>/<sha256, 16 hex>.<webp|png|jpg>
-- so a path never changes meaning, can be cached for a year, and only ever
-- points into its own school's folder. A reference to one is
-- { "path": ..., "width": n, "height": n }.

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_profiles, school_liveries; private.valid_media_ref
create or replace function private.valid_media_path(p_path text, p_school_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path is not null
     and p_path ~ '^[0-9a-f-]{36}/(logo|livery)/[0-9a-f]{16}\.(webp|png|jpg)$'
     and split_part(p_path, '/', 1) = p_school_id::text;
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_profiles, school_liveries
create or replace function private.valid_media_ref(p_ref jsonb, p_school_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_ref) = 'object'
     and private.valid_media_path(p_ref ->> 'path', p_school_id)
     and jsonb_typeof(p_ref -> 'width') = 'number'
     and jsonb_typeof(p_ref -> 'height') = 'number'
     and (p_ref ->> 'width')::numeric between 1 and 8192
     and (p_ref ->> 'height')::numeric between 1 and 8192;
$$;

-- Every value of an object is a media path of this school (paint, banner,
-- posters, thumbs, stills: { "<name>": "<path>" } or { "<name>": { "hi": path, "lo": path } }).
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_liveries
create or replace function private.valid_media_paths(p_value jsonb, p_school_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_value)
    when 'string' then private.valid_media_path(p_value #>> '{}', p_school_id)
    when 'object' then not exists (
      select 1 from jsonb_each(p_value) as e
       where e.key !~ '^[a-z0-9_]{1,24}$'
          or not private.valid_media_paths(e.value, p_school_id)
    )
    else false
  end;
$$;

-- { "mon".."sun": {"open": "HH:MM", "close": "HH:MM"} or null }, open before close.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_branches
create or replace function private.valid_branch_hours(p_hours jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_hours) = 'object'
     and not exists (
       select 1 from jsonb_each(p_hours) as d
        where d.key not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
           or not (
             jsonb_typeof(d.value) = 'null'
             or (jsonb_typeof(d.value) = 'object'
                 and coalesce(d.value ->> 'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 and coalesce(d.value ->> 'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 and d.value ->> 'open' < d.value ->> 'close')
           )
     );
$$;

-- A colour as the app writes it: #rrggbb.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_profiles, school_liveries
create or replace function private.valid_hex_colour(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value ~ '^#[0-9a-f]{6}$';
$$;

-- { "<car>": { "hi": path, "lo": path } } for at least one car.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_liveries
create or replace function private.valid_paint(p_paint jsonb, p_school_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.valid_media_paths(p_paint, p_school_id)
     and exists (select 1 from jsonb_each(p_paint))
     and not exists (
       select 1 from jsonb_each(p_paint) as p
        where jsonb_typeof(p.value) <> 'object' or not (p.value ? 'hi' and p.value ? 'lo')
     );
$$;

-- { "facebook" | "instagram" | "tiktok" | "x" | "youtube": "https://..." }
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: CHECK on school_profiles
create or replace function private.valid_socials(p_socials jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_socials) = 'object'
     and not exists (
       select 1 from jsonb_each(p_socials) as s
        where s.key not in ('facebook', 'instagram', 'tiktok', 'x', 'youtube')
           or jsonb_typeof(s.value) <> 'string'
           or s.value #>> '{}' !~ '^https://[^\s/?#]+\.[^\s]+$'
     );
$$;

revoke all on function private.valid_media_path(text, uuid) from public;
revoke all on function private.valid_media_ref(jsonb, uuid) from public;
revoke all on function private.valid_media_paths(jsonb, uuid) from public;
revoke all on function private.valid_branch_hours(jsonb) from public;
revoke all on function private.valid_hex_colour(text) from public;
revoke all on function private.valid_paint(jsonb, uuid) from public;
revoke all on function private.valid_socials(jsonb) from public;
grant execute on function private.valid_media_path(text, uuid) to service_role;
grant execute on function private.valid_media_ref(jsonb, uuid) to service_role;
grant execute on function private.valid_media_paths(jsonb, uuid) to service_role;
grant execute on function private.valid_branch_hours(jsonb) to service_role;
grant execute on function private.valid_hex_colour(text) to service_role;
grant execute on function private.valid_paint(jsonb, uuid) to service_role;
grant execute on function private.valid_socials(jsonb) to service_role;

comment on function private.valid_media_path(text, uuid) is
  'CHECK: a school-media path <school_id>/<logo|livery>/<16 hex>.<webp|png|jpg> in this school''s folder.';
comment on function private.valid_media_ref(jsonb, uuid) is
  'CHECK: { path, width, height } pointing at this school''s media.';
comment on function private.valid_media_paths(jsonb, uuid) is
  'CHECK: a path, or an object whose values are paths (nested), all in this school''s folder.';
comment on function private.valid_branch_hours(jsonb) is
  'CHECK: opening hours per weekday, HH:MM open before close, or null for closed.';
comment on function private.valid_hex_colour(text) is
  'CHECK: a #rrggbb colour (lower case).';
comment on function private.valid_paint(jsonb, uuid) is
  'CHECK: car wraps { <car>: { hi, lo } } in this school''s media, at least one car.';
comment on function private.valid_socials(jsonb) is
  'CHECK: social links by network (facebook, instagram, tiktok, x, youtube), https only.';
