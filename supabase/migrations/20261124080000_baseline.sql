-- Baseline: every file in supabase/schemas, in config.toml schema_paths order.
-- Rebuilt by `npm run db:baseline` while no hosted database exists; after
-- the first hosted push, never edit it: every change gets its own migration.

-- ── supabase/schemas/_private/extensions.sql
-- ===================================================
-- EXTENSIONS
-- ===================================================
-- citext: case-insensitive email columns, so a school adding
-- "Wanjiru@Mail.com" matches the learner who signed up as "wanjiru@mail.com".
create extension if not exists citext with schema extensions;

-- ── supabase/schemas/_private/private_schema.sql
-- ===================================================
-- SCHEMA: private
-- ===================================================
-- Every owner-rights (SECURITY DEFINER) function a client can reach lives
-- here. The Data API serves only the schemas in supabase/config.toml
-- [api] schemas, and private is not one of them, so nothing here has a
-- /rest/v1/rpc route. A client reaches a private function only through:
--
--   * the SECURITY INVOKER wrapper of the same name in public, which is
--     the function's Data API name and adds no rights of its own;
--   * a row level security policy that calls it (is_staff, can_see_branch).
--
-- Supabase's rule: a security definer function never lives in an exposed
-- schema (splinter lints 0028 and 0029). security_function_access enforces
-- it. Who may execute each function: supabase/schemas/_grants/function_privileges.sql.
create schema if not exists private;

comment on schema private is
  'Owner-rights functions clients reach only through public wrappers and policies. Not exposed by the Data API.';

-- ── supabase/schemas/_private/local_stack.sql
-- ===================================================
-- FUNCTION: private.is_local_stack
-- ===================================================
-- Whether this database is a Supabase CLI stack (local or CI). Their JWT
-- secret is the CLI's published default, which a hosted project never has,
-- and an unset secret reads as hosted, so it fails closed. The demo seed asks
-- it, so a production database never gets demo schools or learners, even
-- from `supabase db push --include-seed`.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: the local seed (supabase/seeds/local_demo.sql)
create or replace function private.is_local_stack()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.settings.jwt_secret', true), '')
       = 'super-secret-jwt-token-with-at-least-32-characters-long';
$$;

revoke all on function private.is_local_stack() from public;
grant execute on function private.is_local_stack() to service_role;

comment on function private.is_local_stack() is
  'Whether this is a Supabase CLI stack (local, CI): its JWT secret is the CLI default. Unset reads as hosted.';

-- ── supabase/schemas/_private/signed_in_with_password.sql
-- ===================================================
-- FUNCTION: private.signed_in_with_password
-- ===================================================
-- Whether the caller's session signed in with a password. A DriveRush su or
-- admin role counts only on such a session: an emailed one-time code or a
-- Google sign-in plays as a plain learner. Reads the token's `amr`, which
-- Supabase Auth keeps through a refresh. custom_access_token_hook applies the
-- same rule to the `user_role` claim.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.has_platform_role
create or replace function private.signed_in_with_password()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from jsonb_array_elements(
             case when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
                  then auth.jwt() -> 'amr'
                  else '[]'::jsonb
             end
           ) as m
     where m ->> 'method' = 'password'
  );
$$;

revoke all on function private.signed_in_with_password() from public;
grant execute on function private.signed_in_with_password() to service_role;

comment on function private.signed_in_with_password() is
  'Whether the caller''s session signed in with a password. A DriveRush console role counts only on such a session.';

-- ── supabase/schemas/_private/set_updated_at.sql
-- ===================================================
-- FUNCTION: private.set_updated_at
-- ===================================================
-- Stamps updated_at on every update of a table that has the column.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on profiles, schools, school_branches, learner_subscriptions, school_subscriptions, learner_progress
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
grant execute on function private.set_updated_at() to service_role;

comment on function private.set_updated_at() is
  'Trigger: stamps updated_at with now() on update.';

-- ── supabase/schemas/_private/media_checks.sql
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

-- ── supabase/schemas/profiles/enums/app_role.sql
-- ===================================================
-- ENUM: public.app_role
-- ===================================================
-- Platform roles. driverush_su runs the platform and manages staff roles;
-- driverush_admin creates and runs schools; user is every learner (and every
-- school owner or admin, whose school rights live in school_members, not here).
create type public.app_role as enum ('driverush_su', 'driverush_admin', 'user');

comment on type public.app_role is
  'Platform role: driverush_su, driverush_admin or user. School rights are in school_members.';

-- ── supabase/schemas/profiles/tables/profiles.sql
-- ===================================================
-- TABLE: public.profiles
-- ===================================================
-- One row per account, created by handle_new_user when Supabase Auth adds
-- the user. email mirrors auth.users.email (kept in sync by a trigger) so
-- schools and staff can see who a learner is without reading auth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);

comment on table public.profiles is
  'One row per account. email mirrors auth.users; learners edit full_name and avatar_url.';

-- ── supabase/schemas/profiles/tables/user_roles.sql
-- ===================================================
-- TABLE: public.user_roles
-- ===================================================
-- The platform roles each account holds. Sign-up adds `user`; a su grants
-- driverush_admin or driverush_su through grant_platform_role.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Platform roles per account. The access token carries the highest as user_role.';

-- ── supabase/schemas/schools/enums/school_enums.sql
-- ===================================================
-- ENUMS: schools
-- ===================================================
-- setup: DriveRush staff are still preparing it (no owner yet, hidden from
-- learners, the board and the site) until they hand it over.
create type public.school_status as enum ('setup', 'active', 'suspended', 'archived');

comment on type public.school_status is
  'setup: staff preparing it, hidden until handed over. active: links learners and shows its livery. suspended or archived: neither.';

-- owner: the school's su, one per school, set by DriveRush staff. admin: added
-- by the owner and tied to one or more branches (at most 50 per school).
create type public.school_role as enum ('owner', 'admin');

comment on type public.school_role is
  'owner (the school su, one per school) or admin (tied to branches, at most 50 per school).';

create type public.invite_status as enum ('pending', 'accepted', 'cancelled');

comment on type public.invite_status is
  'A school member invite waiting for its email to sign up, taken up, or withdrawn.';

-- A livery's life: staff upload a draft (livery:publish), preview it, publish
-- it (the school's one live livery), and retire it when a new one goes live.
create type public.livery_status as enum ('draft', 'live', 'retired');

comment on type public.livery_status is
  'draft (staff preview only), live (the school''s one shown livery) or retired.';

-- ── supabase/schemas/schools/tables/schools.sql
-- ===================================================
-- TABLE: public.schools
-- ===================================================
-- A driving school, the paying customer. Only DriveRush staff create one
-- (admin_create_school). Its slug is its id everywhere outside the database
-- (?school=, PostHog, the driving-school pages). Its look lives in
-- school_profiles (owner) and school_liveries (staff), its files in the
-- school-media bucket.
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 2 and 120),
  status public.school_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schools_created_by_idx on public.schools (created_by);

comment on table public.schools is
  'A driving school (the paying customer). Created by DriveRush staff only.';

-- ── supabase/schemas/schools/tables/school_branches.sql
-- ===================================================
-- TABLE: public.school_branches
-- ===================================================
-- A school's branch. Every student link belongs to one branch, and a school
-- admin sees only the branches they are tied to. (id, school_id) is unique so
-- member branches and student links can reference the pair and never point at
-- another school's branch.
create table public.school_branches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  town text check (town is null or char_length(town) between 2 and 80),
  is_active boolean not null default true,
  -- Details learners see on the school's page (school_update_branch_details).
  address text check (address is null or char_length(address) between 3 and 200),
  lat double precision check (lat is null or lat between -5 and 5.5),
  lng double precision check (lng is null or lng between 33.5 and 42.5),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  -- { "mon": {"open": "08:00", "close": "17:00"} | null, ... } (null: closed)
  hours jsonb check (hours is null or private.valid_branch_hours(hours)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id),
  check ((lat is null) = (lng is null))
);

comment on table public.school_branches is
  'A school''s branch. Student links and admin scopes are per branch.';

-- ── supabase/schemas/schools/tables/school_members.sql
-- ===================================================
-- TABLE: public.school_members
-- ===================================================
-- Who runs a school: its one owner and up to 50 admins. A person can be a
-- member of several schools. The owner sees every branch; an admin sees the
-- branches in school_member_branches.
create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.school_role not null,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, user_id),
  unique (id, school_id)
);

-- One owner per school.
create unique index school_members_one_owner_idx
  on public.school_members (school_id) where role = 'owner';

create index school_members_user_idx on public.school_members (user_id);
create index school_members_added_by_idx on public.school_members (added_by);

comment on table public.school_members is
  'A school''s owner (one) and admins (at most 50). Admin branch scope is in school_member_branches.';

-- ── supabase/schemas/schools/tables/school_member_branches.sql
-- ===================================================
-- TABLE: public.school_member_branches
-- ===================================================
-- The branches an admin works in. Both foreign keys carry school_id, so a
-- member can only be tied to a branch of their own school.
create table public.school_member_branches (
  member_id uuid not null,
  branch_id uuid not null,
  school_id uuid not null,
  primary key (member_id, branch_id),
  foreign key (member_id, school_id)
    references public.school_members (id, school_id) on delete cascade,
  foreign key (branch_id, school_id)
    references public.school_branches (id, school_id) on delete cascade
);

-- Cover both composite foreign keys (member and branch, each with school_id).
create index school_member_branches_member_idx on public.school_member_branches (member_id, school_id);
create index school_member_branches_branch_idx on public.school_member_branches (branch_id, school_id);

comment on table public.school_member_branches is
  'Which branches a school admin works in (always branches of their own school).';

-- ── supabase/schemas/schools/tables/school_member_invites.sql
-- ===================================================
-- TABLE: public.school_member_invites
-- ===================================================
-- An owner or admin added by an email that has no confirmed account yet. When
-- that email confirms, match_pending_invites turns it into a school_members
-- row (with its branches). A pending admin invite counts toward the 50.
create table public.school_member_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.school_role not null,
  branch_ids uuid[] not null default '{}',
  -- An owner invite: whether the owner it replaces stays on as an admin of
  -- every branch (owner, 2026-11-26) when the new owner signs up.
  keep_previous_owner boolean not null default false check (not keep_previous_owner or role = 'owner'),
  status public.invite_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'pending') = (closed_at is null))
);

create unique index school_member_invites_open_idx
  on public.school_member_invites (school_id, email) where status = 'pending';

create index school_member_invites_email_idx
  on public.school_member_invites (email) where status = 'pending';

create index school_member_invites_invited_by_idx on public.school_member_invites (invited_by);

comment on table public.school_member_invites is
  'An owner or admin added by an email with no confirmed account yet; taken up on confirmation.';

-- ── supabase/schemas/schools/tables/school_profiles.sql
-- ===================================================
-- TABLE: public.school_profiles
-- ===================================================
-- What a school says about itself, edited by its owner (or DriveRush staff):
-- the logo, brand colours, contacts, about text and social links. Learners
-- and guests read it through board_schools(), never this table. One row per
-- school, made on its first edit.
create table public.school_profiles (
  school_id uuid primary key references public.schools (id) on delete cascade,
  tagline text check (tagline is null or char_length(tagline) between 2 and 80),
  about text check (about is null or char_length(about) between 2 and 1200),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ]{7,20}$'),
  email extensions.citext check (email is null or email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website_url text check (website_url is null or website_url ~ '^https://[^\s/?#]+\.[^\s]+$'),
  -- { "facebook" | "instagram" | "tiktok" | "x" | "youtube": "https://..." }
  socials jsonb not null default '{}'::jsonb check (private.valid_socials(socials)),
  brand_paint text check (brand_paint is null or private.valid_hex_colour(brand_paint)),
  brand_ink text check (brand_ink is null or private.valid_hex_colour(brand_ink)),
  -- { path, width, height } in school-media (school_set_logo only).
  logo jsonb check (logo is null or private.valid_media_ref(logo, school_id)),
  logo_mono jsonb check (logo_mono is null or private.valid_media_ref(logo_mono, school_id)),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index school_profiles_updated_by_idx on public.school_profiles (updated_by);

comment on table public.school_profiles is
  'A school''s own profile: logo, brand colours, contacts, about and socials. Edited by its owner.';

-- ── supabase/schemas/schools/tables/school_liveries.sql
-- ===================================================
-- TABLE: public.school_liveries
-- ===================================================
-- A school's look on the board, made by DriveRush with the art pipeline
-- (scripts/sponsor-art, `npm run livery:publish`): car wraps per car model,
-- roof board, classroom banner and posters, the traced marks for the brass
-- plates, car menu thumbnails and the site's board stills. Every value is a
-- path in the school-media bucket. A draft is staff-only; at most one is
-- live per school; board_schools() hands the live one to the app.
create table public.school_liveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  status public.livery_status not null default 'draft',
  label text not null check (char_length(label) between 1 and 80),
  -- Body colour where no wrap is drawn, and the classroom's stripe rail.
  base_color text not null check (private.valid_hex_colour(base_color)),
  rail jsonb not null check (
    jsonb_typeof(rail) = 'object'
    and private.valid_hex_colour(rail ->> 'gold')
    and private.valid_hex_colour(rail ->> 'red')
  ),
  -- { "<car>": { "hi": path, "lo": path } }
  paint jsonb not null check (private.valid_paint(paint, school_id)),
  -- { path, width, height } of the picture, plus the board's size in metres,
  -- its corner cut and edge colour.
  top_board jsonb check (
    top_board is null or (
      private.valid_media_ref(top_board, school_id)
      and jsonb_typeof(top_board -> 'metres') = 'object'
      and (top_board #>> '{metres,width}')::numeric between 0.2 and 3
      and (top_board #>> '{metres,height}')::numeric between 0.1 and 1.5
      and (top_board ->> 'cut')::numeric between 0 and 0.5
      and private.valid_hex_colour(top_board ->> 'edge')
    )
  ),
  banner jsonb check (banner is null or (private.valid_media_paths(banner, school_id) and banner ? 'hi' and banner ? 'lo')),
  posters jsonb check (posters is null or private.valid_media_paths(posters, school_id)),
  -- The marks drawn on the board: { "full": path, "mono": path }.
  marks jsonb not null check (private.valid_media_paths(marks, school_id) and marks ? 'full' and marks ? 'mono'),
  thumbs jsonb not null default '{}'::jsonb check (thumbs = '{}'::jsonb or private.valid_media_paths(thumbs, school_id)),
  stills jsonb not null default '{}'::jsonb check (stills = '{}'::jsonb or private.valid_media_paths(stills, school_id)),
  -- Who made it: the staff member signed in (the console, livery:publish).
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'draft') = (published_at is null))
);

create unique index school_liveries_one_live_idx
  on public.school_liveries (school_id) where status = 'live';
create index school_liveries_school_idx on public.school_liveries (school_id, created_at desc);
create index school_liveries_created_by_idx on public.school_liveries (created_by);

comment on table public.school_liveries is
  'A school''s board livery (car wraps, roof board, banner, posters, marks, thumbs, stills) as school-media paths. Staff only.';

-- ── supabase/schemas/schools/tables/school_sponsorships.sql
-- ===================================================
-- TABLE: public.school_sponsorships
-- ===================================================
-- The paid time a school sponsors the board: while one is current and the
-- school has a live livery, its cars take turns for guests and free
-- learners. Dates are Kenyan calendar days; ends_on null runs until ended.
-- Set by DriveRush staff (admin_set_sponsorship, admin_end_sponsorship).
create table public.school_sponsorships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  starts_on date not null,
  ends_on date,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index school_sponsorships_school_idx on public.school_sponsorships (school_id, starts_on);
create index school_sponsorships_created_by_idx on public.school_sponsorships (created_by);

comment on table public.school_sponsorships is
  'When a school sponsors the board (its cars rotate for guests and free learners). Staff only.';

-- ── supabase/schemas/billing/enums/billing_enums.sql
-- ===================================================
-- ENUMS: billing
-- ===================================================
create type public.plan_audience as enum ('learner', 'school');

comment on type public.plan_audience is
  'Who buys the plan: a learner (a pass, public or through their school) or a school (unused: schools pay nothing).';

create type public.subscription_status as enum ('active', 'cancelled');

comment on type public.subscription_status is
  'active: counts while now() is between starts_at and ends_at. cancelled: never counts.';

create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

comment on type public.payment_status is
  'A payment attempt''s state, whatever the provider.';

-- ── supabase/schemas/billing/tables/plans.sql
-- ===================================================
-- TABLE: public.plans
-- ===================================================
-- What a learner or a school can buy. Reference rows are a migration
-- (supabase/migrations/*_reference_plans.sql), changed by a new migration.
-- limits (school plans): max_branches, max_admins (never above 50),
-- monthly_student_links.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  audience public.plan_audience not null,
  name text not null check (char_length(name) between 2 and 80),
  price_kes integer not null check (price_kes >= 0),
  period interval not null check (period > interval '0'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.plans is
  'Learner and school plans: price in KES, billing period and (for schools) limits.';

-- ── supabase/schemas/billing/tables/payments.sql
-- ===================================================
-- TABLE: public.payments
-- ===================================================
-- Every payment a learner starts for a pass (owner, 2026-11-25): a public
-- pass, a pass through their driving school, or an extension. Paystack takes
-- the money on its checkout page; provider_ref is our own reference, sent to
-- Paystack, so the webhook and the return page find the row and settling it
-- twice changes nothing (unique (provider, provider_ref)).
--
-- A school pass is split at source: Paystack settles school_share_kes to the
-- school's bank (its subaccount) and driverush_share_kes to DriveRush. The
-- amounts are fixed when the checkout starts, from the school's price and the
-- plan's share, so a later price change never alters a payment.
--
-- Written by start_pass_checkout (pending) and the payment flow (service
-- role) only.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payer_user_id uuid references auth.users (id) on delete set null,
  -- The school the learner paid through (its share is school_share_kes).
  school_id uuid references public.schools (id) on delete set null,
  branch_id uuid references public.school_branches (id) on delete set null,
  plan_id uuid references public.plans (id),
  amount_kes integer not null check (amount_kes > 0),
  driverush_share_kes integer not null check (driverush_share_kes > 0),
  school_share_kes integer not null default 0 check (school_share_kes >= 0),
  -- Paystack's fee, paid by DriveRush (bearer: account); known once settled.
  fee_kes numeric(10, 2) check (fee_kes is null or fee_kes >= 0),
  provider text not null check (char_length(provider) between 2 and 40),
  provider_ref text,
  status public.payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (driverush_share_kes + school_share_kes = amount_kes),
  check ((school_share_kes > 0) = (school_id is not null)),
  check ((status in ('succeeded', 'refunded')) = (settled_at is not null)),
  unique (provider, provider_ref)
);

create index payments_payer_idx on public.payments (payer_user_id);
create index payments_school_idx on public.payments (school_id, settled_at);
create index payments_branch_idx on public.payments (branch_id);
create index payments_plan_idx on public.payments (plan_id);

comment on table public.payments is
  'Learner payments for passes (Paystack). A school pass carries the school''s share, split at source. Service role writes only.';

-- ── supabase/schemas/billing/tables/learner_subscriptions.sql
-- ===================================================
-- TABLE: public.learner_subscriptions
-- ===================================================
-- A learner's passes: full access from starts_at to ends_at (owner,
-- 2026-11-25: a 60-day pass, or a 30-day extension; never a subscription that
-- renews). A pass bought while another runs starts when it ends, so a
-- learner's passes are back to back. A school link never pauses a pass: the
-- link is the school's view of the learner, the pass is what unlocks.
--
-- Written by settle_payment (source payment, with its payment_id) or by
-- DriveRush staff (source grant) only.
create table public.learner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null default 'payment' check (source in ('payment', 'grant')),
  payment_id uuid unique references public.payments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (source = 'grant' or payment_id is not null or status = 'cancelled')
);

create index learner_subscriptions_user_idx on public.learner_subscriptions (user_id, ends_at);
create index learner_subscriptions_plan_idx on public.learner_subscriptions (plan_id);

comment on table public.learner_subscriptions is
  'A learner''s passes (60 days, or a 30-day extension), back to back. Payment flow or staff grants only.';

-- ── supabase/schemas/billing/tables/school_subscriptions.sql
-- ===================================================
-- TABLE: public.school_subscriptions
-- ===================================================
-- A school's flat plan for a period. Written by the payment flow or staff
-- (service role) only. Not yet required for a school to link learners.
create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index school_subscriptions_school_idx on public.school_subscriptions (school_id, ends_at);
create index school_subscriptions_plan_idx on public.school_subscriptions (plan_id);

comment on table public.school_subscriptions is
  'A school''s flat plan for a period.';

-- ── supabase/schemas/billing/tables/school_payment_settings.sql
-- ===================================================
-- TABLE: public.school_payment_settings
-- ===================================================
-- How a school's learners pay through it: the code the school hands out
-- (HELTZ), the price it sets, and the Paystack subaccount its share settles
-- to. Kept apart from schools because it holds payment details.
--
-- Price (owner, 2026-11-26): no ceiling; at least DriveRush's fixed share
-- plus a small amount for the school (private.school_min_price(), from the
-- school_pass plan). A CHECK cannot read the plan, so the functions hold the
-- minimum and the table only keeps prices positive.
--
-- Bank (owner, 2026-11-26): the owner asks for a bank on the dashboard. The
-- server makes a Paystack subaccount with it and stores it as pending
-- (school_request_bank); DriveRush staff check it with the school and approve
-- it (admin_review_bank), which makes it the live one. Until then the live
-- subaccount, if any, keeps being paid. Staff may also set a bank directly
-- (admin_set_school_payments). Bank details stay in Paystack: here only a
-- label like "Equity ••4321" and the account name.
create table public.school_payment_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  code extensions.citext not null unique check (code::text ~ '^[A-Z0-9]{3,12}$'),
  price_kes integer not null default 700 check (price_kes > 0),
  paystack_subaccount_code text check (
    paystack_subaccount_code is null or paystack_subaccount_code ~ '^ACCT_[A-Za-z0-9_]+$'
  ),
  bank_label text check (bank_label is null or char_length(bank_label) between 2 and 80),
  account_name text check (account_name is null or char_length(account_name) between 2 and 120),
  -- A bank the owner asked for, waiting for staff.
  pending_subaccount_code text check (
    pending_subaccount_code is null or pending_subaccount_code ~ '^ACCT_[A-Za-z0-9_]+$'
  ),
  pending_bank_label text check (pending_bank_label is null or char_length(pending_bank_label) between 2 and 80),
  pending_account_name text check (
    pending_account_name is null or char_length(pending_account_name) between 2 and 120
  ),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz,
  -- The last review: who, when, and why a bank was turned down.
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) between 1 and 300),
  is_active boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pending_subaccount_code is null) = (pending_bank_label is null)),
  check ((pending_subaccount_code is null) = (requested_at is null))
);

create index school_payment_settings_updated_by_idx on public.school_payment_settings (updated_by);
create index school_payment_settings_requested_by_idx on public.school_payment_settings (requested_by);
create index school_payment_settings_reviewed_by_idx on public.school_payment_settings (reviewed_by);
create index school_payment_settings_pending_idx
  on public.school_payment_settings (requested_at) where pending_subaccount_code is not null;

comment on table public.school_payment_settings is
  'A school''s pass code, price (no ceiling, at least school_min_price) and Paystack subaccount, with a bank change waiting for staff.';

-- ── supabase/schemas/students/enums/student_enums.sql
-- ===================================================
-- ENUMS: students
-- ===================================================
-- pending: added by a school, waiting for the email to sign up or for the
--          learner to choose it. active: the one-month link (counts only
--          while now() < ends_at). ended: ran its month or ended early.
--          declined: the learner said no. cancelled: the school withdrew it
--          before it started.
create type public.student_link_status as enum ('pending', 'active', 'ended', 'declined', 'cancelled');

comment on type public.student_link_status is
  'A school-learner link: pending, active (until ends_at), ended, declined or cancelled.';

create type public.link_end_reason as enum ('expired', 'switched', 'released');

comment on type public.link_end_reason is
  'Why an active link ended: its month ran out, the learner switched school, or the school released them.';

-- ── supabase/schemas/students/tables/school_student_links.sql
-- ===================================================
-- TABLE: public.school_student_links
-- ===================================================
-- A school adds a learner by email to one of its branches. The link starts
-- (status active, a month long) when the email matches a confirmed account;
-- until then it is pending. A learner has at most one active link; another
-- school's add waits as pending until the learner chooses it
-- (learner_accept_school_link). Rows are history: re-adding after a month
-- ends inserts a new row. Writes go through the functions in
-- students/functions only.
create table public.school_student_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  branch_id uuid not null,
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references auth.users (id) on delete cascade,
  status public.student_link_status not null default 'pending',
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  end_reason public.link_end_reason,
  foreign key (branch_id, school_id)
    references public.school_branches (id, school_id),
  -- The dates each status carries.
  check (
    case status
      when 'pending' then starts_at is null and ends_at is null and ended_at is null and end_reason is null
      when 'active' then user_id is not null and starts_at is not null and ends_at > starts_at
                         and ended_at is null and end_reason is null
      when 'ended' then user_id is not null and starts_at is not null and ends_at > starts_at
                        and ended_at is not null and end_reason is not null
      else starts_at is null and ends_at is null and ended_at is not null and end_reason is null
    end
  )
);

-- At most one active link per learner (an expired one is closed before
-- another starts: private.close_expired_links).
create unique index school_student_links_one_active_idx
  on public.school_student_links (user_id) where status = 'active';

-- One open link per school and email.
create unique index school_student_links_open_idx
  on public.school_student_links (school_id, email) where status in ('pending', 'active');

create index school_student_links_email_idx
  on public.school_student_links (email) where status = 'pending';
-- Covers the (branch_id, school_id) foreign key and a branch's list by status.
create index school_student_links_branch_idx
  on public.school_student_links (branch_id, school_id, status);
create index school_student_links_added_by_idx
  on public.school_student_links (added_by);

comment on table public.school_student_links is
  'A school''s one-month link to a learner, added by email to a branch. History is kept.';

-- ── supabase/schemas/progress/tables/learner_progress.sql
-- ===================================================
-- TABLE: public.learner_progress
-- ===================================================
-- A signed-in learner's saved progress: one row per app store, holding what
-- that store keeps in localStorage today (data) and the store's persist
-- version. The learner reads and writes their own rows; the owner and branch
-- admins of the learner's current school read them through
-- school_student_progress.
create table public.learner_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null check (store in (
    'board', 'pelican', 'signs3d', 'streak', 'daily-drive', 'test', 'proud'
  )),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 262144),
  version integer not null default 1 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, store)
);

comment on table public.learner_progress is
  'A learner''s saved progress, one row per app store (board, pelican, signs3d, streak, daily-drive, test, proud).';

-- ── supabase/schemas/profiles/functions/platform_roles.sql
-- ===================================================
-- FUNCTIONS: platform role checks
-- ===================================================
-- Read user_roles directly (not the token's user_role claim), so a revoked
-- role stops working at once, and only on a password session.

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.is_staff, private.is_su
create or replace function private.has_platform_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.signed_in_with_password()
     and exists (
       select 1 from public.user_roles as r
        where r.user_id = auth.uid() and r.role = any (p_roles)
     );
$$;

-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller's own roles)
-- Callers: RLS policies on every table; every admin_* and school_* function
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_platform_role(array['driverush_su', 'driverush_admin']::public.app_role[]);
$$;

-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller's own roles)
-- Callers: RLS policies (user_roles); grant_platform_role, revoke_platform_role
create or replace function private.is_su()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_platform_role(array['driverush_su']::public.app_role[]);
$$;

revoke all on function private.has_platform_role(public.app_role[]) from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_su() from public;
grant execute on function private.has_platform_role(public.app_role[]) to service_role;
grant execute on function private.is_staff() to service_role;
grant execute on function private.is_su() to service_role;

comment on function private.has_platform_role(public.app_role[]) is
  'Whether the caller holds one of these platform roles, on a password session.';
comment on function private.is_staff() is
  'Whether the caller is DriveRush su or admin (password session).';
comment on function private.is_su() is
  'Whether the caller is DriveRush su (password session).';

-- ── supabase/schemas/profiles/functions/custom_access_token_hook.sql
-- ===================================================
-- FUNCTION: public.custom_access_token_hook
-- ===================================================
-- Supabase Auth runs this before it issues a token. It writes the highest
-- platform role the account holds into the user_role claim, downgraded to
-- `user` unless the session signed in with a password, so an emailed code or
-- a Google sign-in never carries a console role. The claim is for the app's
-- routing only; the database checks user_roles itself (private.is_staff).
--
-- Access:  auth_hook
-- Guard:   none (the grant is the gate)
-- Callers: Supabase Auth (access token hook)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := event -> 'claims';
  v_role public.app_role;
begin
  select r.role into v_role
    from public.user_roles as r
   where r.user_id = (event ->> 'user_id')::uuid
   order by case r.role
     when 'driverush_su' then 1
     when 'driverush_admin' then 2
     else 3
   end
   limit 1;

  if v_role in ('driverush_su', 'driverush_admin')
     and not exists (
       select 1
         from jsonb_array_elements(
                case when jsonb_typeof(v_claims -> 'amr') = 'array'
                     then v_claims -> 'amr'
                     else '[]'::jsonb
                end
              ) as m
        where m ->> 'method' = 'password'
     ) then
    v_role := 'user';
  end if;

  v_claims := jsonb_set(v_claims, '{user_role}', coalesce(to_jsonb(v_role), 'null'::jsonb));
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public;
grant execute on function public.custom_access_token_hook(jsonb) to service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Auth hook: adds the highest platform role as user_role (console roles only on a password session).';

-- ── supabase/schemas/schools/functions/school_access.sql
-- ===================================================
-- FUNCTIONS: who the caller is to a school
-- ===================================================
-- Owner-rights so policies can ask them without reading school_members
-- through its own policy (which would recurse). Each answers only for the
-- caller (auth.uid()).

-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller)
-- Callers: RLS policies (schools, school_members, school_member_invites, billing); school_* functions
create or replace function private.is_school_owner(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_members as m
     where m.school_id = p_school_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller)
-- Callers: RLS policies (schools, school_branches, school_members, school_member_branches)
create or replace function private.is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_members as m
     where m.school_id = p_school_id and m.user_id = auth.uid()
  );
$$;

-- Whether the caller works in this branch: the school's owner, or an admin
-- tied to it. Staff are not included (callers add is_staff themselves).
--
-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller)
-- Callers: RLS policies (school_student_links); private.can_manage_branch, school_student_progress
create or replace function private.can_see_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.school_branches as b
      join public.school_members as m on m.school_id = b.school_id and m.user_id = auth.uid()
     where b.id = p_branch_id
       and (m.role = 'owner'
            or exists (select 1 from public.school_member_branches as mb
                        where mb.member_id = m.id and mb.branch_id = b.id))
  );
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_create_branch, school_update_branch, school_add_admin, school_set_admin_branches (+2)
create or replace function private.can_manage_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() or private.is_school_owner(p_school_id);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_add_student, school_release_student, school_cancel_student_invite, school_move_student_branch
create or replace function private.can_manage_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() or private.can_see_branch(p_branch_id);
$$;

-- Whether the caller has (or had) a link with this school, so a learner can
-- read the name and branch of a school that added them.
--
-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller)
-- Callers: RLS policies (schools, school_branches)
create or replace function private.has_school_link(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_student_links as l
     where l.school_id = p_school_id and l.user_id = auth.uid()
  );
$$;

-- Whether a school is active: the one public fact about a school that
-- decides whether its profile and live livery are shown to everyone.
--
-- Access:  anon (evaluated as any caller inside policies, guests included)
-- Guard:   public (a public fact; no row of schools is returned)
-- Callers: RLS policies (school_profiles, school_liveries)
create or replace function private.is_active_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schools as s
     where s.id = p_school_id and s.status = 'active'
  );
$$;

revoke all on function private.is_active_school(uuid) from public;
grant execute on function private.is_active_school(uuid) to service_role;
comment on function private.is_active_school(uuid) is
  'Whether this school is active (its profile and live livery are public).';

revoke all on function private.is_school_owner(uuid) from public;
revoke all on function private.is_school_member(uuid) from public;
revoke all on function private.can_see_branch(uuid) from public;
revoke all on function private.can_manage_school(uuid) from public;
revoke all on function private.can_manage_branch(uuid) from public;
revoke all on function private.has_school_link(uuid) from public;
grant execute on function private.is_school_owner(uuid) to service_role;
grant execute on function private.is_school_member(uuid) to service_role;
grant execute on function private.can_see_branch(uuid) to service_role;
grant execute on function private.can_manage_school(uuid) to service_role;
grant execute on function private.can_manage_branch(uuid) to service_role;
grant execute on function private.has_school_link(uuid) to service_role;

comment on function private.is_school_owner(uuid) is
  'Whether the caller owns this school (is its school su).';
comment on function private.is_school_member(uuid) is
  'Whether the caller is this school''s owner or one of its admins.';
comment on function private.can_see_branch(uuid) is
  'Whether the caller works in this branch: the school owner, or an admin tied to it.';
comment on function private.can_manage_school(uuid) is
  'Whether the caller may run this school: DriveRush staff or the school owner.';
comment on function private.can_manage_branch(uuid) is
  'Whether the caller may add and release students in this branch: staff, the owner, or its admin.';
comment on function private.has_school_link(uuid) is
  'Whether the caller has or had a student link with this school.';

-- ── supabase/schemas/schools/functions/admin_limit.sql
-- ===================================================
-- FUNCTIONS: at most 50 admins per school
-- ===================================================
-- Admins are school_members with role admin plus pending admin invites; the
-- owner does not count. Each check locks the school row first, so two adds at
-- once cannot both take the 50th place. Refuses with SQLSTATE P0001,
-- message 'admin_limit'.

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.enforce_member_admin_limit, private.enforce_invite_admin_limit
create or replace function private.assert_admin_room(p_school_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform 1 from public.schools where id = p_school_id for update;

  select (select count(*) from public.school_members
           where school_id = p_school_id and role = 'admin')
       + (select count(*) from public.school_member_invites
           where school_id = p_school_id and role = 'admin' and status = 'pending')
    into v_count;

  if v_count >= 50 then
    raise exception 'admin_limit' using
      errcode = 'P0001',
      detail = 'A school has at most 50 admins (pending invites count).';
  end if;
end;
$$;

-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on school_members
create or replace function private.enforce_member_admin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    perform private.assert_admin_room(new.school_id);
  end if;
  return new;
end;
$$;

-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on school_member_invites
create or replace function private.enforce_invite_admin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending' or old.role is distinct from 'admin') then
    perform private.assert_admin_room(new.school_id);
  end if;
  return new;
end;
$$;

revoke all on function private.assert_admin_room(uuid) from public;
revoke all on function private.enforce_member_admin_limit() from public;
revoke all on function private.enforce_invite_admin_limit() from public;
grant execute on function private.assert_admin_room(uuid) to service_role;
grant execute on function private.enforce_member_admin_limit() to service_role;
grant execute on function private.enforce_invite_admin_limit() to service_role;

comment on function private.assert_admin_room(uuid) is
  'Refuses (P0001 admin_limit) when the school already has 50 admins, counting pending admin invites.';
comment on function private.enforce_member_admin_limit() is
  'Trigger: a new or promoted school admin must fit within the 50.';
comment on function private.enforce_invite_admin_limit() is
  'Trigger: a pending admin invite must fit within the 50.';

-- ── supabase/schemas/students/functions/link_lifecycle.sql
-- ===================================================
-- FUNCTIONS: starting and ending a school-learner link
-- ===================================================
-- Every status change of school_student_links goes through these, so the
-- one-active-link rule is applied in one place. A link is free (owner,
-- 2026-11-25): the school car and the school's view of the learner's
-- progress. A pass (learner_subscriptions) is what unlocks the course; a pass
-- bought through the school keeps the link open for as long as it runs
-- (private.settle_payment).

-- The confirmed account with this email, if any. Only a confirmed address
-- matches, so nobody claims a school link by typing someone else's email.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_add_student, school_add_admin, private.set_school_owner
create or replace function private.confirmed_user_id(p_email extensions.citext)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users as u
   where u.email::extensions.citext = p_email
     and u.email_confirmed_at is not null
   limit 1;
$$;

-- Closes active links whose month is over (status ended, reason expired) for
-- this learner or this email, before another link may start.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.activate_link, private.match_pending_invites, school_add_student, learner_accept_school_link
create or replace function private.close_expired_links(p_user_id uuid, p_email extensions.citext)
returns void
language sql
set search_path = ''
as $$
  update public.school_student_links
     set status = 'ended', end_reason = 'expired', ended_at = ends_at
   where status = 'active'
     and ends_at <= now()
     and (user_id = p_user_id or email = p_email);
$$;

-- The learner's current link: active and inside its month.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.match_pending_invites, school_add_student, learner_accept_school_link, my_entitlement, school_student_progress
create or replace function private.current_link_id(p_user_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select l.id from public.school_student_links as l
   where l.user_id = p_user_id and l.status = 'active' and l.ends_at > now()
   limit 1;
$$;

-- Starts a pending link now for this learner, a month long.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.match_pending_invites, school_add_student, learner_accept_school_link, settle_payment
create or replace function private.activate_link(p_link_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.close_expired_links(p_user_id, null);

  update public.school_student_links
     set status = 'active',
         user_id = p_user_id,
         starts_at = now(),
         ends_at = now() + interval '1 month'
   where id = p_link_id and status = 'pending';

  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
end;
$$;

-- Ends an active link now (switched or released).
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_release_student, learner_accept_school_link, settle_payment
create or replace function private.end_link(p_link_id uuid, p_reason public.link_end_reason)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  update public.school_student_links
     set status = 'ended', end_reason = p_reason, ended_at = v_now
   where id = p_link_id and status = 'active' and ends_at > v_now;

  if not found then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.confirmed_user_id(extensions.citext) from public;
revoke all on function private.close_expired_links(uuid, extensions.citext) from public;
revoke all on function private.current_link_id(uuid) from public;
revoke all on function private.activate_link(uuid, uuid) from public;
revoke all on function private.end_link(uuid, public.link_end_reason) from public;
grant execute on function private.confirmed_user_id(extensions.citext) to service_role;
grant execute on function private.close_expired_links(uuid, extensions.citext) to service_role;
grant execute on function private.current_link_id(uuid) to service_role;
grant execute on function private.activate_link(uuid, uuid) to service_role;
grant execute on function private.end_link(uuid, public.link_end_reason) to service_role;

comment on function private.confirmed_user_id(extensions.citext) is
  'The confirmed account with this email, or null. Unconfirmed addresses never match.';
comment on function private.close_expired_links(uuid, extensions.citext) is
  'Marks active links past their month as ended (expired) for a learner or email.';
comment on function private.current_link_id(uuid) is
  'The learner''s current link: active and inside its month, or null.';
comment on function private.activate_link(uuid, uuid) is
  'Starts a pending link now, a month long.';
comment on function private.end_link(uuid, public.link_end_reason) is
  'Ends an active link early (switched or released).';

-- ── supabase/schemas/profiles/functions/match_pending_invites.sql
-- ===================================================
-- FUNCTION: private.match_pending_invites
-- ===================================================
-- Runs when an account's email is confirmed (sign-up, or an email change).
--
-- School member invites for that email become memberships, with their
-- branches. An owner invite replaces the school's current owner.
--
-- Student links for that email are tied to the account. If the learner has no
-- current link and exactly one pending link, it starts now. With two or more
-- pending, nothing starts: the learner chooses (learner_accept_school_link).
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.handle_new_user, private.handle_auth_user_updated
create or replace function private.match_pending_invites(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext;
  v_invite public.school_member_invites;
  v_member_id uuid;
  v_pending_ids uuid[];
begin
  select u.email::extensions.citext into v_email
    from auth.users as u
   where u.id = p_user_id and u.email_confirmed_at is not null;
  if v_email is null then
    return;
  end if;

  -- School owners and admins.
  for v_invite in
    select * from public.school_member_invites
     where email = v_email and status = 'pending'
     order by created_at
     for update
  loop
    update public.school_member_invites
       set status = 'accepted', closed_at = now()
     where id = v_invite.id;

    if v_invite.role = 'owner' then
      perform private.step_down_owner(v_invite.school_id, p_user_id, v_invite.keep_previous_owner);
    end if;

    insert into public.school_members (school_id, user_id, role, added_by)
    values (v_invite.school_id, p_user_id, v_invite.role, v_invite.invited_by)
    on conflict (school_id, user_id) do update
      set role = case when excluded.role = 'owner' then 'owner'::public.school_role
                      else public.school_members.role end
    returning id into v_member_id;

    if v_invite.role = 'admin' then
      insert into public.school_member_branches (member_id, branch_id, school_id)
      select v_member_id, b.id, b.school_id
        from public.school_branches as b
       where b.school_id = v_invite.school_id and b.id = any (v_invite.branch_ids)
      on conflict do nothing;
    end if;
  end loop;

  -- Student links.
  update public.school_student_links
     set user_id = p_user_id
   where email = v_email and status = 'pending' and user_id is null;

  perform private.close_expired_links(p_user_id, v_email);

  if private.current_link_id(p_user_id) is null then
    select array_agg(l.id) into v_pending_ids
      from public.school_student_links as l
      join public.schools as s on s.id = l.school_id and s.status = 'active'
     where l.user_id = p_user_id and l.status = 'pending';

    if coalesce(array_length(v_pending_ids, 1), 0) = 1 then
      perform private.activate_link(v_pending_ids[1], p_user_id);
    end if;
  end if;
end;
$$;

revoke all on function private.match_pending_invites(uuid) from public;
grant execute on function private.match_pending_invites(uuid) to service_role;

comment on function private.match_pending_invites(uuid) is
  'On email confirmation: takes up school member invites and starts the learner''s only pending school link.';

-- ── supabase/schemas/profiles/functions/handle_auth_users.sql
-- ===================================================
-- FUNCTIONS: keeping profiles in step with auth.users
-- ===================================================

-- A new account gets its profile and the `user` role. If it arrives
-- confirmed (Google, or created confirmed by an admin), invites match now.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on auth.users
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), 2048), '')
  );

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  if new.email_confirmed_at is not null then
    perform private.match_pending_invites(new.id);
  end if;
  return new;
end;
$$;

-- An email confirmed or changed: the profile follows, and invites for the
-- (newly confirmed) address match.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on auth.users
create or replace function private.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;

  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or new.email is distinct from old.email) then
    perform private.match_pending_invites(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_auth_user_updated() from public;
grant execute on function private.handle_new_user() to service_role;
grant execute on function private.handle_auth_user_updated() to service_role;

comment on function private.handle_new_user() is
  'Trigger: a new account gets a profile and the user role; a confirmed one matches its invites.';
comment on function private.handle_auth_user_updated() is
  'Trigger: keeps profiles.email in step and matches invites when an email is confirmed.';

-- ── supabase/schemas/profiles/functions/grant_platform_role.sql
-- ===================================================
-- FUNCTIONS: granting and revoking DriveRush staff roles
-- ===================================================
-- Only a DriveRush su (on a password session). The first su is granted by
-- SQL on the database itself.

-- Access:  authenticated (DriveRush su)
-- Guard:   su (private.is_su)
-- Callers: DriveRush console (session)
create or replace function private.grant_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_su() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role) values (p_user_id, p_role)
  on conflict do nothing;
end;
$$;

-- Access:  authenticated (DriveRush su)
-- Guard:   su (private.is_su)
-- Callers: DriveRush console (session)
create or replace function private.revoke_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_su() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role = 'user' then
    raise exception 'cannot_revoke_user' using errcode = 'P0001';
  end if;
  if p_role = 'driverush_su' and p_user_id = auth.uid() then
    raise exception 'cannot_revoke_own_su' using errcode = 'P0001';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = p_role;
end;
$$;

-- Access:  authenticated (DriveRush su)
-- Guard:   su (the private body checks private.is_su)
-- Callers: DriveRush console (session)
create or replace function public.grant_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.grant_platform_role(p_user_id, p_role);
$$;

-- Access:  authenticated (DriveRush su)
-- Guard:   su (the private body checks private.is_su)
-- Callers: DriveRush console (session)
create or replace function public.revoke_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_platform_role(p_user_id, p_role);
$$;

revoke all on function private.grant_platform_role(uuid, public.app_role) from public;
revoke all on function private.revoke_platform_role(uuid, public.app_role) from public;
revoke all on function public.grant_platform_role(uuid, public.app_role) from public;
revoke all on function public.revoke_platform_role(uuid, public.app_role) from public;
grant execute on function private.grant_platform_role(uuid, public.app_role) to service_role;
grant execute on function private.revoke_platform_role(uuid, public.app_role) to service_role;
grant execute on function public.grant_platform_role(uuid, public.app_role) to service_role;
grant execute on function public.revoke_platform_role(uuid, public.app_role) to service_role;

comment on function private.grant_platform_role(uuid, public.app_role) is
  'DriveRush su: gives an account a platform role.';
comment on function private.revoke_platform_role(uuid, public.app_role) is
  'DriveRush su: takes a platform role away (never user, never your own su).';
comment on function public.grant_platform_role(uuid, public.app_role) is
  'DriveRush su: gives an account a platform role.';
comment on function public.revoke_platform_role(uuid, public.app_role) is
  'DriveRush su: takes a platform role away (never user, never your own su).';

-- ── supabase/schemas/schools/functions/admin_schools.sql
-- ===================================================
-- FUNCTIONS: DriveRush staff create and run schools
-- ===================================================

-- The school's owner, other than p_new_owner, steps down: kept as an admin of
-- every open branch when p_keep is true (and the school has one), otherwise
-- removed.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.set_school_owner, private.match_pending_invites
create or replace function private.step_down_owner(p_school_id uuid, p_new_owner uuid, p_keep boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  select m.id into v_member_id from public.school_members as m
   where m.school_id = p_school_id and m.role = 'owner' and m.user_id <> p_new_owner;
  if v_member_id is null then
    return;
  end if;
  if p_keep and exists (select 1 from public.school_branches as b
                         where b.school_id = p_school_id and b.is_active) then
    update public.school_members set role = 'admin' where id = v_member_id;
    insert into public.school_member_branches (member_id, branch_id, school_id)
    select v_member_id, b.id, b.school_id
      from public.school_branches as b
     where b.school_id = p_school_id and b.is_active
    on conflict do nothing;
  else
    delete from public.school_members where id = v_member_id;
  end if;
end;
$$;

-- Makes the account with this email the school's owner (replacing the
-- current one), or, if no confirmed account has it yet, leaves an owner
-- invite that match_pending_invites takes up on confirmation.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: admin_create_school, admin_transfer_school_owner
create or replace function private.set_school_owner(
  p_school_id uuid,
  p_email extensions.citext,
  p_actor uuid,
  p_keep_previous boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := private.confirmed_user_id(p_email);
begin
  update public.school_member_invites
     set status = 'cancelled', closed_at = now()
   where school_id = p_school_id and role = 'owner' and status = 'pending';

  if v_user_id is null then
    -- An earlier admin invite for the same email gives way to the owner one.
    update public.school_member_invites
       set status = 'cancelled', closed_at = now()
     where school_id = p_school_id and email = p_email and status = 'pending';
    insert into public.school_member_invites (school_id, email, role, invited_by, keep_previous_owner)
    values (p_school_id, p_email, 'owner', p_actor, coalesce(p_keep_previous, false));
    return 'invited';
  end if;

  perform private.step_down_owner(p_school_id, v_user_id, coalesce(p_keep_previous, false));

  insert into public.school_members (school_id, user_id, role, added_by)
  values (p_school_id, v_user_id, 'owner', p_actor)
  on conflict (school_id, user_id) do update set role = 'owner';

  -- The owner sees every branch; branch ties from an admin past are dropped.
  delete from public.school_member_branches as mb
   using public.school_members as m
   where mb.member_id = m.id and m.school_id = p_school_id and m.user_id = v_user_id;
  return 'added';
end;
$$;

-- With an owner's email the school is active at once (the owner is added,
-- or invited until they sign up). Without one it is created in `setup`:
-- hidden from learners, the board and the site while staff prepare its
-- profile, branches and livery, until admin_hand_over_school.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_create_school(
  p_name text,
  p_slug text,
  p_owner_email text
)
returns uuid
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

  insert into public.schools (name, slug, created_by, status)
  values (
    btrim(p_name),
    lower(btrim(p_slug)),
    auth.uid(),
    case when nullif(btrim(coalesce(p_owner_email, '')), '') is null
         then 'setup'::public.school_status else 'active'::public.school_status end
  )
  returning id into v_school_id;

  if nullif(btrim(coalesce(p_owner_email, '')), '') is not null then
    perform private.set_school_owner(v_school_id, lower(btrim(p_owner_email))::extensions.citext, auth.uid());
  end if;
  return v_school_id;
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- `setup` is only where a school starts; a live school never goes back.
  if p_status = 'setup' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.schools set status = p_status where id = p_school_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Returns 'added' (the account exists and is now owner) or 'invited'.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_transfer_school_owner(p_school_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.set_school_owner(p_school_id, lower(btrim(p_email))::extensions.citext, auth.uid());
end;
$$;

-- Staff hand a school they have set up to its owner: the email becomes the
-- owner (added, or invited until they sign up) and a `setup` school goes
-- live. Returns 'added' or 'invited'. For an active school it is a plain
-- change of owner.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_hand_over_school(
  p_school_id uuid,
  p_owner_email text,
  p_keep_previous_owner boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.school_status;
  v_result text;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_status from public.schools where id = p_school_id for update;
  if v_status is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status = 'archived' then
    raise exception 'school_inactive' using errcode = 'P0001';
  end if;
  v_result := private.set_school_owner(
    p_school_id, lower(btrim(p_owner_email))::extensions.citext, auth.uid(), p_keep_previous_owner
  );
  if v_status = 'setup' then
    update public.schools set status = 'active' where id = p_school_id;
  end if;
  return v_result;
end;
$$;

-- One page of schools for the console: search by name, slug or owner email,
-- filter by status, livery and sponsorship, newest first. `total` is the
-- count of every match, on every row, for the pager.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_list_schools(
  p_search text,
  p_status text,
  p_livery text,
  p_sponsoring text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.school_status,
  created_at timestamptz,
  owner_email text,
  invited_owner_email text,
  admins integer,
  branches integer,
  students integer,
  livery text,
  drafts integer,
  sponsoring boolean,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with base as (
    select
      s.id, s.name, s.slug, s.status, s.created_at,
      (select u.email::text from public.school_members as m
         join auth.users as u on u.id = m.user_id
        where m.school_id = s.id and m.role = 'owner' limit 1) as owner_email,
      (select i.email::text from public.school_member_invites as i
        where i.school_id = s.id and i.role = 'owner' and i.status = 'pending'
        order by i.created_at desc limit 1) as invited_owner_email,
      (select count(*)::integer from public.school_members as m
        where m.school_id = s.id and m.role = 'admin') as admins,
      (select count(*)::integer from public.school_branches as b
        where b.school_id = s.id) as branches,
      (select count(*)::integer from public.school_student_links as l
        where l.school_id = s.id and l.status = 'active' and l.ends_at > now()) as students,
      case
        when exists (select 1 from public.school_liveries as v where v.school_id = s.id and v.status = 'live') then 'live'
        when exists (select 1 from public.school_liveries as v where v.school_id = s.id and v.status = 'draft') then 'draft'
        else 'none'
      end as livery,
      (select count(*)::integer from public.school_liveries as v
        where v.school_id = s.id and v.status = 'draft') as drafts,
      exists (
        select 1 from public.school_sponsorships as sp
         where sp.school_id = s.id
           and sp.starts_on <= private.kenya_today()
           and (sp.ends_on is null or sp.ends_on >= private.kenya_today())
      ) as sponsoring
    from public.schools as s
  ),
  matched as (
    select * from base as b
     where (v_search is null
            or b.name ilike '%' || v_search || '%'
            or b.slug ilike '%' || v_search || '%'
            or coalesce(b.owner_email, '') ilike '%' || v_search || '%'
            or coalesce(b.invited_owner_email, '') ilike '%' || v_search || '%')
       and (coalesce(p_status, 'any') = 'any' or b.status::text = p_status)
       and (coalesce(p_livery, 'any') = 'any' or b.livery = p_livery)
       and (coalesce(p_sponsoring, 'any') = 'any'
            or (p_sponsoring = 'yes' and b.sponsoring)
            or (p_sponsoring = 'no' and not b.sponsoring))
  )
  select m.id, m.name, m.slug, m.status, m.created_at, m.owner_email, m.invited_owner_email,
         m.admins, m.branches, m.students, m.livery, m.drafts, m.sponsoring,
         count(*) over () as total
    from matched as m
   order by m.created_at desc, m.name
   limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_create_school(
  p_name text,
  p_slug text,
  p_owner_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_school(p_name, p_slug, p_owner_email);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_school_status(p_school_id, p_status);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_transfer_school_owner(p_school_id uuid, p_email text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_transfer_school_owner(p_school_id, p_email);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_hand_over_school(
  p_school_id uuid,
  p_owner_email text,
  p_keep_previous_owner boolean default false
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_hand_over_school(p_school_id, p_owner_email, p_keep_previous_owner);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_list_schools(
  p_search text,
  p_status text,
  p_livery text,
  p_sponsoring text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.school_status,
  created_at timestamptz,
  owner_email text,
  invited_owner_email text,
  admins integer,
  branches integer,
  students integer,
  livery text,
  drafts integer,
  sponsoring boolean,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_schools(p_search, p_status, p_livery, p_sponsoring, p_limit, p_offset);
$$;

revoke all on function private.admin_hand_over_school(uuid, text, boolean) from public;
revoke all on function private.admin_list_schools(text, text, text, text, integer, integer) from public;
revoke all on function public.admin_hand_over_school(uuid, text, boolean) from public;
revoke all on function public.admin_list_schools(text, text, text, text, integer, integer) from public;
grant execute on function private.admin_hand_over_school(uuid, text, boolean) to service_role;
grant execute on function private.admin_list_schools(text, text, text, text, integer, integer) to service_role;
grant execute on function public.admin_hand_over_school(uuid, text, boolean) to service_role;
grant execute on function public.admin_list_schools(text, text, text, text, integer, integer) to service_role;
comment on function private.admin_hand_over_school(uuid, text, boolean) is
  'DriveRush staff: makes an email the school owner (added or invited), keeping the old owner as an admin if asked, and puts a setup school live.';
comment on function public.admin_hand_over_school(uuid, text, boolean) is
  'DriveRush staff: makes an email the school owner (added or invited), keeping the old owner as an admin if asked, and puts a setup school live.';
comment on function private.admin_list_schools(text, text, text, text, integer, integer) is
  'DriveRush staff: one page of schools (search, status, livery and sponsorship filters) with the total count.';
comment on function public.admin_list_schools(text, text, text, text, integer, integer) is
  'DriveRush staff: one page of schools (search, status, livery and sponsorship filters) with the total count.';

revoke all on function private.step_down_owner(uuid, uuid, boolean) from public;
revoke all on function private.set_school_owner(uuid, extensions.citext, uuid, boolean) from public;
revoke all on function private.admin_create_school(text, text, text) from public;
revoke all on function private.admin_set_school_status(uuid, public.school_status) from public;
revoke all on function private.admin_transfer_school_owner(uuid, text) from public;
revoke all on function public.admin_create_school(text, text, text) from public;
revoke all on function public.admin_set_school_status(uuid, public.school_status) from public;
revoke all on function public.admin_transfer_school_owner(uuid, text) from public;
grant execute on function private.step_down_owner(uuid, uuid, boolean) to service_role;
grant execute on function private.set_school_owner(uuid, extensions.citext, uuid, boolean) to service_role;
grant execute on function private.admin_create_school(text, text, text) to service_role;
grant execute on function private.admin_set_school_status(uuid, public.school_status) to service_role;
grant execute on function private.admin_transfer_school_owner(uuid, text) to service_role;
grant execute on function public.admin_create_school(text, text, text) to service_role;
grant execute on function public.admin_set_school_status(uuid, public.school_status) to service_role;
grant execute on function public.admin_transfer_school_owner(uuid, text) to service_role;

comment on function private.step_down_owner(uuid, uuid, boolean) is
  'The school''s old owner steps down: kept as an admin of every open branch, or removed.';
comment on function private.set_school_owner(uuid, extensions.citext, uuid, boolean) is
  'Makes an email the school owner now (confirmed account) or by invite; replaces the current owner.';
comment on function private.admin_create_school(text, text, text) is
  'DriveRush staff: creates a school and sets its owner by email.';
comment on function private.admin_set_school_status(uuid, public.school_status) is
  'DriveRush staff: sets a school active, suspended or archived.';
comment on function private.admin_transfer_school_owner(uuid, text) is
  'DriveRush staff: makes another email the school owner. Returns added or invited.';
comment on function public.admin_create_school(text, text, text) is
  'DriveRush staff: creates a school and sets its owner by email.';
comment on function public.admin_set_school_status(uuid, public.school_status) is
  'DriveRush staff: sets a school active, suspended or archived.';
comment on function public.admin_transfer_school_owner(uuid, text) is
  'DriveRush staff: makes another email the school owner. Returns added or invited.';

-- ── supabase/schemas/schools/functions/school_branches.sql
-- ===================================================
-- FUNCTIONS: a school owner manages branches
-- ===================================================

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_create_branch(p_school_id uuid, p_name text, p_town text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.school_branches (school_id, name, town)
  values (p_school_id, btrim(p_name), nullif(btrim(p_town), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_update_branch(
  p_branch_id uuid,
  p_name text,
  p_town text,
  p_is_active boolean
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
     set name = btrim(p_name), town = nullif(btrim(p_town), ''), is_active = p_is_active
   where id = p_branch_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_create_branch(p_school_id uuid, p_name text, p_town text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.school_create_branch(p_school_id, p_name, p_town);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_update_branch(
  p_branch_id uuid,
  p_name text,
  p_town text,
  p_is_active boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_update_branch(p_branch_id, p_name, p_town, p_is_active);
$$;

revoke all on function private.school_create_branch(uuid, text, text) from public;
revoke all on function private.school_update_branch(uuid, text, text, boolean) from public;
revoke all on function public.school_create_branch(uuid, text, text) from public;
revoke all on function public.school_update_branch(uuid, text, text, boolean) from public;
grant execute on function private.school_create_branch(uuid, text, text) to service_role;
grant execute on function private.school_update_branch(uuid, text, text, boolean) to service_role;
grant execute on function public.school_create_branch(uuid, text, text) to service_role;
grant execute on function public.school_update_branch(uuid, text, text, boolean) to service_role;

comment on function private.school_create_branch(uuid, text, text) is
  'School owner or staff: adds a branch.';
comment on function private.school_update_branch(uuid, text, text, boolean) is
  'School owner or staff: renames, moves or closes a branch.';
comment on function public.school_create_branch(uuid, text, text) is
  'School owner or staff: adds a branch.';
comment on function public.school_update_branch(uuid, text, text, boolean) is
  'School owner or staff: renames, moves or closes a branch.';

-- ── supabase/schemas/schools/functions/school_admins.sql
-- ===================================================
-- FUNCTIONS: a school owner manages admins and their branches
-- ===================================================
-- At most 50 admins per school (private.assert_admin_room, via triggers).
-- An admin always has at least one branch.

-- Refuses unless every id is a branch of this school and there is at least one.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_add_admin, school_set_admin_branches
create or replace function private.assert_school_branches(p_school_id uuid, p_branch_ids uuid[])
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_branch_ids), 0) = 0
     or exists (
       select 1 from unnest(p_branch_ids) as x(id)
        where not exists (select 1 from public.school_branches as b
                           where b.id = x.id and b.school_id = p_school_id)
     ) then
    raise exception 'invalid_branches' using errcode = 'P0001';
  end if;
end;
$$;

-- Adds an admin by email, tied to these branches. Returns 'added' when a
-- confirmed account has the email, 'invited' when it waits for sign-up.
-- Adding an existing admin again replaces their branches.
--
-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_add_admin(p_school_id uuid, p_email text, p_branch_ids uuid[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_user_id uuid;
  v_member public.school_members;
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.assert_school_branches(p_school_id, p_branch_ids);

  v_user_id := private.confirmed_user_id(v_email);

  if v_user_id is null then
    insert into public.school_member_invites (school_id, email, role, branch_ids, invited_by)
    values (p_school_id, v_email, 'admin', p_branch_ids, auth.uid())
    on conflict (school_id, email) where status = 'pending'
    do update set branch_ids = excluded.branch_ids
    where public.school_member_invites.role = 'admin';
    if not found then
      raise exception 'already_owner' using errcode = 'P0001';
    end if;
    return 'invited';
  end if;

  select * into v_member from public.school_members
   where school_id = p_school_id and user_id = v_user_id;

  if v_member.role = 'owner' then
    raise exception 'already_owner' using errcode = 'P0001';
  end if;

  if v_member.id is null then
    insert into public.school_members (school_id, user_id, role, added_by)
    values (p_school_id, v_user_id, 'admin', auth.uid())
    returning * into v_member;
  end if;

  delete from public.school_member_branches where member_id = v_member.id;
  insert into public.school_member_branches (member_id, branch_id, school_id)
  select v_member.id, x.id, p_school_id from unnest(p_branch_ids) as x(id)
  on conflict do nothing;
  return 'added';
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_set_admin_branches(p_member_id uuid, p_branch_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.school_members;
begin
  select * into v_member from public.school_members where id = p_member_id;
  if v_member.id is null or not private.can_manage_school(v_member.school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  perform private.assert_school_branches(v_member.school_id, p_branch_ids);

  delete from public.school_member_branches where member_id = p_member_id;
  insert into public.school_member_branches (member_id, branch_id, school_id)
  select p_member_id, x.id, v_member.school_id from unnest(p_branch_ids) as x(id)
  on conflict do nothing;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_remove_admin(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.school_members;
begin
  select * into v_member from public.school_members where id = p_member_id;
  if v_member.id is null or not private.can_manage_school(v_member.school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  delete from public.school_members where id = p_member_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_cancel_member_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.school_member_invites;
begin
  select * into v_invite from public.school_member_invites where id = p_invite_id;
  if v_invite.id is null or not private.can_manage_school(v_invite.school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Only staff withdraw an owner invite (owners are theirs to set).
  if v_invite.role = 'owner' and not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_member_invites
     set status = 'cancelled', closed_at = now()
   where id = p_invite_id and status = 'pending';
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_add_admin(p_school_id uuid, p_email text, p_branch_ids uuid[])
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.school_add_admin(p_school_id, p_email, p_branch_ids);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_set_admin_branches(p_member_id uuid, p_branch_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_set_admin_branches(p_member_id, p_branch_ids);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_remove_admin(p_member_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_remove_admin(p_member_id);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_cancel_member_invite(p_invite_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_cancel_member_invite(p_invite_id);
$$;

revoke all on function private.assert_school_branches(uuid, uuid[]) from public;
revoke all on function private.school_add_admin(uuid, text, uuid[]) from public;
revoke all on function private.school_set_admin_branches(uuid, uuid[]) from public;
revoke all on function private.school_remove_admin(uuid) from public;
revoke all on function private.school_cancel_member_invite(uuid) from public;
revoke all on function public.school_add_admin(uuid, text, uuid[]) from public;
revoke all on function public.school_set_admin_branches(uuid, uuid[]) from public;
revoke all on function public.school_remove_admin(uuid) from public;
revoke all on function public.school_cancel_member_invite(uuid) from public;
grant execute on function private.assert_school_branches(uuid, uuid[]) to service_role;
grant execute on function private.school_add_admin(uuid, text, uuid[]) to service_role;
grant execute on function private.school_set_admin_branches(uuid, uuid[]) to service_role;
grant execute on function private.school_remove_admin(uuid) to service_role;
grant execute on function private.school_cancel_member_invite(uuid) to service_role;
grant execute on function public.school_add_admin(uuid, text, uuid[]) to service_role;
grant execute on function public.school_set_admin_branches(uuid, uuid[]) to service_role;
grant execute on function public.school_remove_admin(uuid) to service_role;
grant execute on function public.school_cancel_member_invite(uuid) to service_role;

comment on function private.assert_school_branches(uuid, uuid[]) is
  'Refuses (P0001 invalid_branches) unless the list is non-empty and every id is a branch of the school.';
comment on function private.school_add_admin(uuid, text, uuid[]) is
  'School owner or staff: adds an admin by email tied to branches. Returns added or invited.';
comment on function private.school_set_admin_branches(uuid, uuid[]) is
  'School owner or staff: replaces an admin''s branches.';
comment on function private.school_remove_admin(uuid) is
  'School owner or staff: removes an admin.';
comment on function private.school_cancel_member_invite(uuid) is
  'School owner or staff: withdraws a pending admin invite (owner invites: staff only).';
comment on function public.school_add_admin(uuid, text, uuid[]) is
  'School owner or staff: adds an admin by email tied to branches. Returns added or invited.';
comment on function public.school_set_admin_branches(uuid, uuid[]) is
  'School owner or staff: replaces an admin''s branches.';
comment on function public.school_remove_admin(uuid) is
  'School owner or staff: removes an admin.';
comment on function public.school_cancel_member_invite(uuid) is
  'School owner or staff: withdraws a pending admin invite (owner invites: staff only).';

-- ── supabase/schemas/schools/functions/school_members_list.sql
-- ===================================================
-- FUNCTION: school_members_list
-- ===================================================
-- A school's team for its dashboard: the owner and every admin, with their
-- email, name and branches. School members read school_members directly,
-- but not other accounts' profiles, so names and emails come from here.
--
-- Access:  authenticated (school owner, school admin or DriveRush staff)
-- Guard:   school (private.is_school_member or is_staff)
-- Callers: school dashboard (session)
create or replace function private.school_members_list(p_school_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email extensions.citext,
  full_name text,
  role public.school_role,
  branch_ids uuid[],
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() and not private.is_school_member(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select m.id, m.user_id, p.email, p.full_name, m.role,
         coalesce((select array_agg(mb.branch_id order by mb.branch_id)
                     from public.school_member_branches as mb where mb.member_id = m.id), '{}'),
         m.created_at
    from public.school_members as m
    left join public.profiles as p on p.id = m.user_id
   where m.school_id = p_school_id
   order by m.role, p.email;
end;
$$;

-- Access:  authenticated (school owner, school admin or DriveRush staff)
-- Guard:   school (the private body checks membership)
-- Callers: school dashboard (session)
create or replace function public.school_members_list(p_school_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email extensions.citext,
  full_name text,
  role public.school_role,
  branch_ids uuid[],
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.school_members_list(p_school_id);
$$;

revoke all on function private.school_members_list(uuid) from public;
revoke all on function public.school_members_list(uuid) from public;
grant execute on function private.school_members_list(uuid) to service_role;
grant execute on function public.school_members_list(uuid) to service_role;

comment on function private.school_members_list(uuid) is
  'School owner, admin or staff: the school''s owner and admins with email, name and branches.';
comment on function public.school_members_list(uuid) is
  'School owner, admin or staff: the school''s owner and admins with email, name and branches.';

-- ── supabase/schemas/schools/functions/school_profiles.sql
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

-- ── supabase/schemas/schools/functions/school_liveries.sql
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
-- Guard:   public (only active schools' public profile and live livery)
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
   where s.status = 'active'
     and (l.id is not null or exists (select 1 from public.school_profiles as p where p.school_id = s.id));
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

-- ── supabase/schemas/students/functions/school_students.sql
-- ===================================================
-- FUNCTIONS: a school adds and releases students
-- ===================================================
-- The owner (any branch) or an admin of the branch (or DriveRush staff).

-- Adds a learner's email to a branch and returns the link id. The month
-- starts now if a confirmed account has the email, it has no current school
-- link and no other school is waiting for it; otherwise the link is pending.
-- Adding an email that already has an open link with this school returns
-- that link unchanged.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (private.can_manage_branch: owner, admin of the branch, or staff)
-- Callers: school dashboard (session)
create or replace function private.school_add_student(p_branch_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_branch public.school_branches;
  v_link_id uuid;
  v_user_id uuid;
begin
  if not private.can_manage_branch(p_branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_branch from public.school_branches where id = p_branch_id;
  if v_branch.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not v_branch.is_active then
    raise exception 'branch_inactive' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.schools where id = v_branch.school_id and status = 'active') then
    raise exception 'school_inactive' using errcode = 'P0001';
  end if;

  perform private.close_expired_links(null, v_email);

  select id into v_link_id from public.school_student_links
   where school_id = v_branch.school_id and email = v_email and status in ('pending', 'active');
  if v_link_id is not null then
    return v_link_id;
  end if;

  v_user_id := private.confirmed_user_id(v_email);

  insert into public.school_student_links (school_id, branch_id, email, user_id, added_by)
  values (v_branch.school_id, p_branch_id, v_email, v_user_id, auth.uid())
  returning id into v_link_id;

  if v_user_id is not null then
    perform private.close_expired_links(v_user_id, null);
    if private.current_link_id(v_user_id) is null
       and not exists (
         select 1 from public.school_student_links
          where user_id = v_user_id and status = 'pending' and id <> v_link_id
       ) then
      perform private.activate_link(v_link_id, v_user_id);
    end if;
  end if;

  return v_link_id;
end;
$$;

-- Ends a learner's current link with this school now.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (private.can_manage_branch on the link's branch)
-- Callers: school dashboard (session)
create or replace function private.school_release_student(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_id uuid;
begin
  select branch_id into v_branch_id from public.school_student_links where id = p_link_id;
  if v_branch_id is null or not private.can_manage_branch(v_branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.end_link(p_link_id, 'released');
end;
$$;

-- Withdraws a link that has not started.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (private.can_manage_branch on the link's branch)
-- Callers: school dashboard (session)
create or replace function private.school_cancel_student_invite(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_id uuid;
begin
  select branch_id into v_branch_id from public.school_student_links where id = p_link_id;
  if v_branch_id is null or not private.can_manage_branch(v_branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_student_links
     set status = 'cancelled', ended_at = now()
   where id = p_link_id and status = 'pending';
  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
end;
$$;

-- Moves an open link to another branch of the same school. The caller must
-- work in both branches.
--
-- Access:  authenticated (school owner, admin of both branches, or DriveRush staff)
-- Guard:   admin (private.can_manage_branch on both branches)
-- Callers: school dashboard (session)
create or replace function private.school_move_student_branch(p_link_id uuid, p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.school_student_links;
begin
  select * into v_link from public.school_student_links where id = p_link_id;
  if v_link.id is null
     or not private.can_manage_branch(v_link.branch_id)
     or not private.can_manage_branch(p_branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.school_branches
                  where id = p_branch_id and school_id = v_link.school_id and is_active) then
    raise exception 'invalid_branches' using errcode = 'P0001';
  end if;
  update public.school_student_links
     set branch_id = p_branch_id
   where id = p_link_id and status in ('pending', 'active');
  if not found then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
end;
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_branch)
-- Callers: school dashboard (session)
create or replace function public.school_add_student(p_branch_id uuid, p_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.school_add_student(p_branch_id, p_email);
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_branch)
-- Callers: school dashboard (session)
create or replace function public.school_release_student(p_link_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_release_student(p_link_id);
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_branch)
-- Callers: school dashboard (session)
create or replace function public.school_cancel_student_invite(p_link_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_cancel_student_invite(p_link_id);
$$;

-- Access:  authenticated (school owner, admin of both branches, or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_branch on both)
-- Callers: school dashboard (session)
create or replace function public.school_move_student_branch(p_link_id uuid, p_branch_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_move_student_branch(p_link_id, p_branch_id);
$$;

revoke all on function private.school_add_student(uuid, text) from public;
revoke all on function private.school_release_student(uuid) from public;
revoke all on function private.school_cancel_student_invite(uuid) from public;
revoke all on function private.school_move_student_branch(uuid, uuid) from public;
revoke all on function public.school_add_student(uuid, text) from public;
revoke all on function public.school_release_student(uuid) from public;
revoke all on function public.school_cancel_student_invite(uuid) from public;
revoke all on function public.school_move_student_branch(uuid, uuid) from public;
grant execute on function private.school_add_student(uuid, text) to service_role;
grant execute on function private.school_release_student(uuid) to service_role;
grant execute on function private.school_cancel_student_invite(uuid) to service_role;
grant execute on function private.school_move_student_branch(uuid, uuid) to service_role;
grant execute on function public.school_add_student(uuid, text) to service_role;
grant execute on function public.school_release_student(uuid) to service_role;
grant execute on function public.school_cancel_student_invite(uuid) to service_role;
grant execute on function public.school_move_student_branch(uuid, uuid) to service_role;

comment on function private.school_add_student(uuid, text) is
  'School owner, branch admin or staff: adds a learner email to a branch; starts the month when it can.';
comment on function private.school_release_student(uuid) is
  'School owner, branch admin or staff: ends a learner''s current link now.';
comment on function private.school_cancel_student_invite(uuid) is
  'School owner, branch admin or staff: withdraws a link that has not started.';
comment on function private.school_move_student_branch(uuid, uuid) is
  'School owner, admin of both branches, or staff: moves an open link to another branch.';
comment on function public.school_add_student(uuid, text) is
  'School owner, branch admin or staff: adds a learner email to a branch; starts the month when it can.';
comment on function public.school_release_student(uuid) is
  'School owner, branch admin or staff: ends a learner''s current link now.';
comment on function public.school_cancel_student_invite(uuid) is
  'School owner, branch admin or staff: withdraws a link that has not started.';
comment on function public.school_move_student_branch(uuid, uuid) is
  'School owner, admin of both branches, or staff: moves an open link to another branch.';

-- ── supabase/schemas/students/functions/learner_links.sql
-- ===================================================
-- FUNCTIONS: a learner chooses among schools that added them
-- ===================================================

-- Starts a pending link now. A current link with another school ends early
-- (reason switched; that school sees it in its history).
--
-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the link's user_id is auth.uid())
-- Callers: web (learner session)
create or replace function private.learner_accept_school_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.school_student_links;
  v_current uuid;
begin
  select * into v_link from public.school_student_links where id = p_link_id for update;
  if v_uid is null or v_link.id is null or v_link.user_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_link.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.schools where id = v_link.school_id and status = 'active') then
    raise exception 'school_inactive' using errcode = 'P0001';
  end if;

  perform private.close_expired_links(v_uid, null);
  v_current := private.current_link_id(v_uid);
  if v_current is not null then
    perform private.end_link(v_current, 'switched');
  end if;
  perform private.activate_link(p_link_id, v_uid);
end;
$$;

-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the link's user_id is auth.uid())
-- Callers: web (learner session)
create or replace function private.learner_decline_school_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.school_student_links
     set status = 'declined', ended_at = now()
   where id = p_link_id and user_id = v_uid and status = 'pending';
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the private body checks the link is the caller's)
-- Callers: web (learner session)
create or replace function public.learner_accept_school_link(p_link_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.learner_accept_school_link(p_link_id);
$$;

-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the private body checks the link is the caller's)
-- Callers: web (learner session)
create or replace function public.learner_decline_school_link(p_link_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.learner_decline_school_link(p_link_id);
$$;

revoke all on function private.learner_accept_school_link(uuid) from public;
revoke all on function private.learner_decline_school_link(uuid) from public;
revoke all on function public.learner_accept_school_link(uuid) from public;
revoke all on function public.learner_decline_school_link(uuid) from public;
grant execute on function private.learner_accept_school_link(uuid) to service_role;
grant execute on function private.learner_decline_school_link(uuid) to service_role;
grant execute on function public.learner_accept_school_link(uuid) to service_role;
grant execute on function public.learner_decline_school_link(uuid) to service_role;

comment on function private.learner_accept_school_link(uuid) is
  'Learner: starts a pending school link now, ending any current one (switched).';
comment on function private.learner_decline_school_link(uuid) is
  'Learner: declines a pending school link.';
comment on function public.learner_accept_school_link(uuid) is
  'Learner: starts a pending school link now, ending any current one (switched).';
comment on function public.learner_decline_school_link(uuid) is
  'Learner: declines a pending school link.';

-- ── supabase/schemas/billing/functions/my_entitlement.sql
-- ===================================================
-- FUNCTION: my_entitlement
-- ===================================================
-- What the signed-in learner gets right now, for the app to decide content
-- and livery (owner, 2026-11-25):
--   tier    school  a current link with an active school: that school's car
--                   (school_slug, looked up in board_schools()); ends_at is
--                   the link's end
--           paid    no school link, a pass running: sponsor schools take
--                   turns; ends_at is the pass's end
--           free    neither
--   full_access     a pass is running now (bought alone or through a school):
--                   the course past the free levels opens
--   pass_ends_at    when the learner's passes run out (they are back to back)
-- pending_invites counts schools waiting for the learner to choose them.
--
-- Access:  authenticated (the learner)
-- Guard:   self (answers for auth.uid() only)
-- Callers: web (learner session)
create or replace function private.my_entitlement()
returns table (
  tier text,
  school_id uuid,
  school_name text,
  school_slug text,
  branch_id uuid,
  ends_at timestamptz,
  pending_invites integer,
  full_access boolean,
  pass_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.school_student_links;
  v_school public.schools;
  v_paid_until timestamptz;
  v_pending integer;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*)::integer into v_pending
    from public.school_student_links as l
    join public.schools as s on s.id = l.school_id and s.status = 'active'
   where l.user_id = v_uid and l.status = 'pending';

  select max(s.ends_at) into v_paid_until
    from public.learner_subscriptions as s
   where s.user_id = v_uid and s.status = 'active' and s.ends_at > now()
     and exists (
       select 1 from public.learner_subscriptions as n
        where n.user_id = v_uid and n.status = 'active'
          and n.starts_at <= now() and n.ends_at > now()
     );

  select * into v_link from public.school_student_links
   where id = private.current_link_id(v_uid);
  if v_link.id is not null then
    select * into v_school from public.schools where id = v_link.school_id and status = 'active';
  end if;

  if v_school.id is not null then
    return query select 'school'::text, v_school.id, v_school.name, v_school.slug,
                        v_link.branch_id, v_link.ends_at, v_pending,
                        v_paid_until is not null, v_paid_until;
    return;
  end if;

  if v_paid_until is not null then
    return query select 'paid'::text, null::uuid, null::text, null::text, null::uuid,
                        v_paid_until, v_pending, true, v_paid_until;
    return;
  end if;

  return query select 'free'::text, null::uuid, null::text, null::text, null::uuid,
                      null::timestamptz, v_pending, false, null::timestamptz;
end;
$$;

-- Access:  authenticated (the learner)
-- Guard:   self (the private body answers for auth.uid() only)
-- Callers: web (learner session)
create or replace function public.my_entitlement()
returns table (
  tier text,
  school_id uuid,
  school_name text,
  school_slug text,
  branch_id uuid,
  ends_at timestamptz,
  pending_invites integer,
  full_access boolean,
  pass_ends_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_entitlement();
$$;

revoke all on function private.my_entitlement() from public;
revoke all on function public.my_entitlement() from public;
grant execute on function private.my_entitlement() to service_role;
grant execute on function public.my_entitlement() to service_role;

comment on function private.my_entitlement() is
  'The signed-in learner''s tier now (school, paid or free), whether a pass is running, the school livery and pending invites.';
comment on function public.my_entitlement() is
  'The signed-in learner''s tier now (school, paid or free), whether a pass is running, the school livery and pending invites.';

-- ── supabase/schemas/billing/functions/passes.sql
-- ===================================================
-- FUNCTIONS: a learner buys a pass (Paystack)
-- ===================================================
-- Owner, 2026-11-25. Three plans (reference rows in
-- migrations/*_reference_plans.sql):
--   learner_pass       KES 1,000 for 60 days, all to DriveRush
--   school_pass        the school's own price for 60 days, no ceiling (owner,
--                      2026-11-26); DriveRush keeps limits.driverush_share_kes
--                      (300), the rest settles to the school's bank (Paystack
--                      subaccount), which pays Paystack's fee. The price is at
--                      least the share plus limits.min_school_share_kes (50),
--                      private.school_min_price()
--   learner_extension  KES 300 for 30 days, all to DriveRush, for a learner
--                      who has had a pass
--
-- The flow: start_pass_checkout (learner session) writes a pending payment
-- with the amounts fixed; the server sends the learner to Paystack with our
-- reference; the webhook or the return page asks Paystack how it ended and
-- calls settle_payment or fail_payment (service role). Settling is
-- idempotent, so both may call it.

-- A school's pass offer, from the code the school handed out. Only a school
-- that can take payments answers (active, its payments set up).
--
-- Access:  authenticated (any signed-in learner)
-- Guard:   public (a school's public price and branch names, nothing else)
-- Callers: /pass (server, learner session)
create or replace function private.pass_school_by_code(p_code text)
returns table (
  school_id uuid,
  school_name text,
  school_slug text,
  price_kes integer,
  branches jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.slug, ps.price_kes,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'town', b.town) order by b.name)
             from public.school_branches as b
            where b.school_id = s.id and b.is_active
         ), '[]'::jsonb)
    from public.school_payment_settings as ps
    join public.schools as s on s.id = ps.school_id and s.status = 'active'
   where ps.code = upper(btrim(p_code))::extensions.citext
     and ps.is_active
     and ps.paystack_subaccount_code is not null;
$$;

-- The schools the caller can pay through without typing a code: their
-- current school and any school waiting for them, each with its price and the
-- branch it added them to. Only schools that can take payments.
--
-- Access:  authenticated (the learner)
-- Guard:   self (answers for auth.uid() only)
-- Callers: /pass (server, learner session)
create or replace function private.my_pass_offers()
returns table (
  school_id uuid,
  school_name text,
  code text,
  price_kes integer,
  branch_id uuid,
  branch_name text,
  linked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, ps.code::text, ps.price_kes, b.id, b.name,
           l.status = 'active'
      from public.school_student_links as l
      join public.schools as s on s.id = l.school_id and s.status = 'active'
      join public.school_payment_settings as ps
        on ps.school_id = s.id and ps.is_active and ps.paystack_subaccount_code is not null
      join public.school_branches as b on b.id = l.branch_id
     where l.user_id = v_uid
       and (l.status = 'pending' or (l.status = 'active' and l.ends_at > now()))
     order by l.status = 'active' desc, s.name;
end;
$$;

-- Starts a payment for the caller: a pending row with the amount and both
-- shares worked out here, never by the client. A school pass goes to the
-- school of p_school_code, or (no code) the learner's current school; its
-- branch is p_branch_id, else the learner's link's branch, else the school's
-- only branch. Each call is a new try with a new reference.
--
-- Access:  authenticated (the learner paying)
-- Guard:   self (the payment is the caller's own)
-- Callers: /pass action (server, learner session)
create or replace function private.start_pass_checkout(
  p_plan_code text,
  p_school_code text default null,
  p_branch_id uuid default null
)
returns table (
  payment_id uuid,
  reference text,
  amount_kes integer,
  email text,
  school_id uuid,
  school_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email extensions.citext;
  v_plan public.plans;
  v_settings public.school_payment_settings;
  v_school public.schools;
  v_branch_id uuid;
  v_amount integer;
  v_share integer;
  v_ref text := 'dr_' || replace(gen_random_uuid()::text, '-', '');
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select u.email::extensions.citext into v_email
    from auth.users as u where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'email_unconfirmed' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans as p
   where p.code = p_plan_code and p.is_active and p.audience = 'learner'
     and p.code in ('learner_pass', 'school_pass', 'learner_extension');
  if v_plan.id is null then
    raise exception 'unknown_plan' using errcode = 'P0001';
  end if;

  if v_plan.code = 'learner_extension'
     and not exists (select 1 from public.learner_subscriptions as s
                      where s.user_id = v_uid and s.status = 'active') then
    raise exception 'extension_not_allowed' using errcode = 'P0001';
  end if;

  if v_plan.code = 'school_pass' then
    if nullif(btrim(p_school_code), '') is not null then
      select * into v_settings from public.school_payment_settings as ps
       where ps.code = upper(btrim(p_school_code))::extensions.citext;
    else
      select ps.* into v_settings
        from public.school_student_links as l
        join public.school_payment_settings as ps on ps.school_id = l.school_id
       where l.id = private.current_link_id(v_uid);
    end if;
    if v_settings.school_id is not null then
      select * into v_school from public.schools as s
       where s.id = v_settings.school_id and s.status = 'active';
    end if;
    if v_school.id is null or not v_settings.is_active
       or v_settings.paystack_subaccount_code is null then
      raise exception 'bad_code' using errcode = 'P0001';
    end if;

    if p_branch_id is not null then
      select b.id into v_branch_id from public.school_branches as b
       where b.id = p_branch_id and b.school_id = v_school.id and b.is_active;
      if v_branch_id is null then
        raise exception 'branch_inactive' using errcode = 'P0001';
      end if;
    else
      select l.branch_id into v_branch_id
        from public.school_student_links as l
        join public.school_branches as b on b.id = l.branch_id and b.is_active
       where l.school_id = v_school.id and l.email = v_email and l.status in ('active', 'pending')
       order by l.status = 'active' desc
       limit 1;
      if v_branch_id is null
         and (select count(*) from public.school_branches as b
               where b.school_id = v_school.id and b.is_active) = 1 then
        select b.id into v_branch_id from public.school_branches as b
         where b.school_id = v_school.id and b.is_active;
      end if;
      if v_branch_id is null then
        raise exception 'branch_required' using errcode = 'P0001';
      end if;
    end if;

    v_amount := v_settings.price_kes;
    v_share := (v_plan.limits ->> 'driverush_share_kes')::integer;
    -- A school price set before the minimum went up is refused, not raised
    -- behind the learner's back: the school sets a new price.
    if v_share is null or v_share <= 0 or v_amount < private.school_min_price() then
      raise exception 'price_below_share' using errcode = 'P0001';
    end if;
  else
    v_amount := v_plan.price_kes;
    v_share := v_plan.price_kes;
  end if;

  insert into public.payments (
    payer_user_id, school_id, branch_id, plan_id, amount_kes,
    driverush_share_kes, school_share_kes, provider, provider_ref
  ) values (
    v_uid, v_school.id, v_branch_id, v_plan.id, v_amount,
    v_share, v_amount - v_share, 'paystack', v_ref
  )
  returning id into v_payment_id;

  return query select v_payment_id, v_ref, v_amount, v_email::text, v_school.id, v_school.name;
end;
$$;

-- Paystack says the payment succeeded for this amount: mark it, add the pass
-- (back to back after any pass still running) and, for a school pass, keep
-- the learner linked to that school while the pass runs (a link with another
-- school ends: switched). Returns the pass. Settling twice returns the same
-- pass and changes nothing.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /webhooks/paystack, /pass/done (server, after verifying with Paystack); the seed
create or replace function private.settle_payment(
  p_reference text,
  p_amount_kes integer,
  p_fee_kes numeric,
  p_raw jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_plan public.plans;
  v_sub_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_email extensions.citext;
  v_current public.school_student_links;
  v_link_id uuid;
begin
  select * into v_pay from public.payments
   where provider = 'paystack' and provider_ref = p_reference
   for update;
  if v_pay.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'succeeded' then
    select id into v_sub_id from public.learner_subscriptions where payment_id = v_pay.id;
    return v_sub_id;
  end if;
  if v_pay.status = 'refunded' then
    raise exception 'refunded' using errcode = 'P0001';
  end if;
  if p_amount_kes is distinct from v_pay.amount_kes then
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;
  if v_pay.payer_user_id is null then
    raise exception 'no_payer' using errcode = 'P0001';
  end if;

  update public.payments
     set status = 'succeeded', settled_at = now(), fee_kes = p_fee_kes, raw = p_raw
   where id = v_pay.id;

  select * into v_plan from public.plans where id = v_pay.plan_id;

  select greatest(now(), coalesce(max(s.ends_at), now())) into v_start
    from public.learner_subscriptions as s
   where s.user_id = v_pay.payer_user_id and s.status = 'active' and s.ends_at > now();
  v_end := v_start + v_plan.period;

  insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at, source, payment_id)
  values (v_pay.payer_user_id, v_plan.id, v_start, v_end, 'payment', v_pay.id)
  returning id into v_sub_id;

  if v_pay.school_id is not null then
    select u.email::extensions.citext into v_email from auth.users as u where u.id = v_pay.payer_user_id;
    perform private.close_expired_links(v_pay.payer_user_id, v_email);

    select * into v_current from public.school_student_links
     where id = private.current_link_id(v_pay.payer_user_id);

    if v_current.id is not null and v_current.school_id = v_pay.school_id then
      v_link_id := v_current.id;
    else
      if v_current.id is not null then
        perform private.end_link(v_current.id, 'switched');
      end if;

      select id into v_link_id from public.school_student_links
       where school_id = v_pay.school_id and email = v_email and status = 'pending';
      if v_link_id is null then
        if v_pay.branch_id is null then
          raise exception 'no_branch' using errcode = 'P0001';
        end if;
        insert into public.school_student_links (school_id, branch_id, email, user_id)
        values (v_pay.school_id, v_pay.branch_id, v_email, v_pay.payer_user_id)
        returning id into v_link_id;
      else
        update public.school_student_links
           set user_id = v_pay.payer_user_id,
               branch_id = coalesce(v_pay.branch_id, branch_id)
         where id = v_link_id;
      end if;
      perform private.activate_link(v_link_id, v_pay.payer_user_id);
    end if;

    update public.school_student_links
       set ends_at = greatest(ends_at, v_end)
     where id = v_link_id;
  end if;

  return v_sub_id;
end;
$$;

-- Paystack says the payment did not go through (or the learner gave up).
-- A settled payment is never failed.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /webhooks/paystack, /pass/done (server, after verifying with Paystack)
create or replace function private.fail_payment(p_reference text, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.payments where provider = 'paystack' and provider_ref = p_reference) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.payments
     set status = 'failed', raw = p_raw
   where provider = 'paystack' and provider_ref = p_reference and status = 'pending';
end;
$$;

-- Money went back to the learner (refunded in the Paystack dashboard): the
-- payment is refunded and its pass stops counting. A school link stays (it
-- is free). Refunding twice changes nothing.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /webhooks/paystack (server)
create or replace function private.refund_payment(p_reference text, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments
   where provider = 'paystack' and provider_ref = p_reference
   for update;
  if v_pay.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'refunded' then
    return;
  end if;
  if v_pay.status <> 'succeeded' then
    raise exception 'not_settled' using errcode = 'P0001';
  end if;

  update public.payments
     set status = 'refunded', raw = coalesce(v_pay.raw, '{}'::jsonb) || jsonb_build_object('refund', p_raw)
   where id = v_pay.id;
  update public.learner_subscriptions
     set status = 'cancelled'
   where payment_id = v_pay.id;
end;
$$;

-- Access:  authenticated (any signed-in learner)
-- Guard:   public (the private body returns only a school's public offer)
-- Callers: /pass (server, learner session)
create or replace function public.pass_school_by_code(p_code text)
returns table (
  school_id uuid,
  school_name text,
  school_slug text,
  price_kes integer,
  branches jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.pass_school_by_code(p_code);
$$;

-- Access:  authenticated (the learner)
-- Guard:   self (the private body answers for auth.uid() only)
-- Callers: /pass (server, learner session)
create or replace function public.my_pass_offers()
returns table (
  school_id uuid,
  school_name text,
  code text,
  price_kes integer,
  branch_id uuid,
  branch_name text,
  linked boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_pass_offers();
$$;

-- Access:  authenticated (the learner paying)
-- Guard:   self (the private body writes only the caller's own payment)
-- Callers: /pass action (server, learner session)
create or replace function public.start_pass_checkout(
  p_plan_code text,
  p_school_code text default null,
  p_branch_id uuid default null
)
returns table (
  payment_id uuid,
  reference text,
  amount_kes integer,
  email text,
  school_id uuid,
  school_name text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.start_pass_checkout(p_plan_code, p_school_code, p_branch_id);
$$;

revoke all on function private.pass_school_by_code(text) from public;
revoke all on function public.pass_school_by_code(text) from public;
-- The payment flow reaches these through the Data API, which shows only
-- schema public: same-named wrappers, executable by the service role alone.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /api/webhooks/paystack, /pass/done (server, service role); the seed
create or replace function public.settle_payment(
  p_reference text,
  p_amount_kes integer,
  p_fee_kes numeric,
  p_raw jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.settle_payment(p_reference, p_amount_kes, p_fee_kes, p_raw);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /api/webhooks/paystack, /pass/done (server, service role)
create or replace function public.fail_payment(p_reference text, p_raw jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.fail_payment(p_reference, p_raw);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /api/webhooks/paystack (server, service role)
create or replace function public.refund_payment(p_reference text, p_raw jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.refund_payment(p_reference, p_raw);
$$;

revoke all on function private.my_pass_offers() from public;
revoke all on function public.my_pass_offers() from public;
grant execute on function private.my_pass_offers() to service_role;
grant execute on function public.my_pass_offers() to service_role;
revoke all on function private.start_pass_checkout(text, text, uuid) from public;
revoke all on function public.start_pass_checkout(text, text, uuid) from public;
revoke all on function private.settle_payment(text, integer, numeric, jsonb) from public;
revoke all on function private.fail_payment(text, jsonb) from public;
revoke all on function private.refund_payment(text, jsonb) from public;
grant execute on function private.pass_school_by_code(text) to service_role;
grant execute on function public.pass_school_by_code(text) to service_role;
grant execute on function private.start_pass_checkout(text, text, uuid) to service_role;
grant execute on function public.start_pass_checkout(text, text, uuid) to service_role;
grant execute on function private.settle_payment(text, integer, numeric, jsonb) to service_role;
revoke all on function public.settle_payment(text, integer, numeric, jsonb) from public;
revoke all on function public.fail_payment(text, jsonb) from public;
revoke all on function public.refund_payment(text, jsonb) from public;
grant execute on function public.settle_payment(text, integer, numeric, jsonb) to service_role;
grant execute on function public.fail_payment(text, jsonb) to service_role;
grant execute on function public.refund_payment(text, jsonb) to service_role;
grant execute on function private.fail_payment(text, jsonb) to service_role;
grant execute on function private.refund_payment(text, jsonb) to service_role;

comment on function private.pass_school_by_code(text) is
  'A school''s pass offer (name, price, active branches) from its code, if it can take payments.';
comment on function public.pass_school_by_code(text) is
  'A school''s pass offer (name, price, active branches) from its code, if it can take payments.';
comment on function private.my_pass_offers() is
  'Learner: their current and waiting schools that take payments, with price and branch.';
comment on function public.my_pass_offers() is
  'Learner: their current and waiting schools that take payments, with price and branch.';
comment on function private.start_pass_checkout(text, text, uuid) is
  'Learner: a pending payment for a pass, amounts and shares worked out here; returns our Paystack reference.';
comment on function public.start_pass_checkout(text, text, uuid) is
  'Learner: a pending payment for a pass, amounts and shares worked out here; returns our Paystack reference.';
comment on function private.settle_payment(text, integer, numeric, jsonb) is
  'Payment flow: marks a verified payment paid, adds the pass and keeps a school pass''s link open. Idempotent.';
comment on function public.settle_payment(text, integer, numeric, jsonb) is
  'Payment flow: marks a verified payment paid, adds the pass and keeps a school pass''s link open. Idempotent.';
comment on function public.fail_payment(text, jsonb) is
  'Payment flow: marks a pending payment failed.';
comment on function public.refund_payment(text, jsonb) is
  'Payment flow: marks a payment refunded and cancels its pass. Idempotent.';
comment on function private.fail_payment(text, jsonb) is
  'Payment flow: marks a pending payment failed.';
comment on function private.refund_payment(text, jsonb) is
  'Payment flow: marks a payment refunded and cancels its pass. Idempotent.';

-- ── supabase/schemas/billing/functions/school_passes.sql
-- ===================================================
-- FUNCTIONS: a school's pass code, price, bank and earnings
-- ===================================================
-- Owner, 2026-11-25: schools pay nothing and earn from every learner who pays
-- through them (price minus DriveRush's fixed share). Paystack settles the
-- school's share to its bank itself, so there is no balance to withdraw:
-- earnings are a read of the payments.
--
-- Owner, 2026-11-26: a school sets any price at or above
-- private.school_min_price() (DriveRush's share plus a little for the school,
-- which pays Paystack's fee from its share). The owner asks for the bank; staff
-- approve it.

-- The lowest price a school may set: DriveRush's share plus the school's
-- minimum, both from the school_pass plan.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate; reads the public plans only)
-- Callers: school_pass_info, school_set_pass_price, school_request_bank, start_pass_checkout
create or replace function private.school_min_price()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((p.limits ->> 'driverush_share_kes')::integer, 0)
       + coalesce((p.limits ->> 'min_school_share_kes')::integer, 0)
    from public.plans as p
   where p.code = 'school_pass';
$$;

-- A free pass code from a school's short name: HELTZ, then HELTZ2, HELTZ3.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_request_bank
create or replace function private.new_pass_code(p_slug text)
returns extensions.citext
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := left(upper(regexp_replace(coalesce(p_slug, ''), '[^A-Za-z0-9]', '', 'g')), 10);
  v_try text;
  v_n integer := 1;
begin
  if char_length(v_base) < 3 then
    v_base := rpad(v_base || 'DR', 3, 'X');
  end if;
  v_try := v_base;
  while exists (select 1 from public.school_payment_settings as ps where ps.code = v_try::extensions.citext) loop
    v_n := v_n + 1;
    v_try := v_base || v_n::text;
  end loop;
  return v_try::extensions.citext;
end;
$$;

-- The school's code and price, for its team to hand out, and (owner and
-- staff only) its bank and any bank waiting for DriveRush.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (is_school_member or is_staff)
-- Callers: school dashboard (session), console (session)
create or replace function private.school_pass_info(p_school_id uuid)
returns table (
  code text,
  price_kes integer,
  driverush_share_kes integer,
  min_price_kes integer,
  ready boolean,
  bank_label text,
  account_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_view boolean;
begin
  if not (private.is_school_member(p_school_id) or private.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_owner_view := private.is_school_owner(p_school_id) or private.is_staff();
  return query
    select ps.code::text,
           ps.price_kes,
           (select (p.limits ->> 'driverush_share_kes')::integer from public.plans as p where p.code = 'school_pass'),
           private.school_min_price(),
           ps.is_active and ps.paystack_subaccount_code is not null,
           case when v_owner_view then ps.bank_label end,
           case when v_owner_view then ps.account_name end,
           case when v_owner_view then ps.pending_bank_label end,
           case when v_owner_view then ps.pending_account_name end,
           case when v_owner_view then ps.requested_at end,
           case when v_owner_view then ps.reviewed_at end,
           case when v_owner_view then ps.review_note end
      from public.school_payment_settings as ps
     where ps.school_id = p_school_id;
end;
$$;

-- The owner sets what their learners pay through the school: any price at or
-- above school_min_price(). Payments already started keep their price.
--
-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_set_pass_price(p_school_id uuid, p_price_kes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_price_kes is null or p_price_kes < private.school_min_price() or p_price_kes > 1000000 then
    raise exception 'price_out_of_range' using errcode = 'P0001';
  end if;
  update public.school_payment_settings
     set price_kes = p_price_kes, updated_by = auth.uid()
   where school_id = p_school_id;
  if not found then
    raise exception 'payments_not_set_up' using errcode = 'P0001';
  end if;
end;
$$;

-- What the school earned: every settled payment through it, newest first.
-- The owner and staff see every branch; an admin only their branches.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (is_school_member or is_staff; rows by can_see_branch)
-- Callers: school dashboard (session), console (session)
create or replace function private.school_earnings(p_school_id uuid, p_branch_id uuid default null)
returns table (
  payment_id uuid,
  paid_at timestamptz,
  learner_email text,
  branch_id uuid,
  branch_name text,
  price_kes integer,
  school_share_kes integer,
  status public.payment_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_all boolean;
begin
  if not (private.is_school_member(p_school_id) or private.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_all := private.is_school_owner(p_school_id) or private.is_staff();
  return query
    select p.id, p.settled_at, u.email::text, p.branch_id, b.name,
           p.amount_kes, p.school_share_kes, p.status
      from public.payments as p
      left join auth.users as u on u.id = p.payer_user_id
      left join public.school_branches as b on b.id = p.branch_id
     where p.school_id = p_school_id
       and p.status in ('succeeded', 'refunded')
       and (p_branch_id is null or p.branch_id = p_branch_id)
       and (v_all or (p.branch_id is not null and private.can_see_branch(p.branch_id)))
     order by p.settled_at desc
     limit 1000;
end;
$$;

-- Records the bank an owner asked for, after the server made its Paystack
-- subaccount, as waiting for DriveRush. Makes the school's settings (code from
-- its short name, the usual first price) if it has none. Returns the
-- subaccount of an earlier request this one replaces (null if none), for the
-- server to switch off on Paystack.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate; the server checks the owner first)
-- Callers: school dashboard bank form (server, service role)
create or replace function private.school_request_bank(
  p_school_id uuid,
  p_actor uuid,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_replaced text;
begin
  select s.slug into v_slug from public.schools as s
   where s.id = p_school_id and s.status in ('setup', 'active');
  if v_slug is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select ps.pending_subaccount_code into v_replaced
    from public.school_payment_settings as ps where ps.school_id = p_school_id for update;
  insert into public.school_payment_settings (
    school_id, code, price_kes, pending_subaccount_code, pending_bank_label,
    pending_account_name, requested_by, requested_at, updated_by
  ) values (
    p_school_id, private.new_pass_code(v_slug), greatest(700, private.school_min_price()),
    btrim(p_subaccount_code), btrim(p_bank_label), nullif(btrim(p_account_name), ''),
    p_actor, now(), p_actor
  )
  on conflict (school_id) do update
    set pending_subaccount_code = excluded.pending_subaccount_code,
        pending_bank_label = excluded.pending_bank_label,
        pending_account_name = excluded.pending_account_name,
        requested_by = excluded.requested_by,
        requested_at = excluded.requested_at,
        review_note = null,
        updated_by = excluded.updated_by;
  return v_replaced;
end;
$$;

-- Staff approve or turn down the bank an owner asked for. Approving makes it
-- the live one and returns the subaccount it replaces; turning down clears it
-- (with a note the owner reads) and returns that one. Either way the returned
-- subaccount is for the server to switch off on Paystack.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_review_bank(
  p_school_id uuid,
  p_approve boolean,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.school_payment_settings;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_settings from public.school_payment_settings as ps
   where ps.school_id = p_school_id for update;
  if v_settings.pending_subaccount_code is null then
    raise exception 'nothing_to_review' using errcode = 'P0001';
  end if;
  if coalesce(p_approve, false) then
    update public.school_payment_settings
       set paystack_subaccount_code = v_settings.pending_subaccount_code,
           bank_label = v_settings.pending_bank_label,
           account_name = v_settings.pending_account_name,
           pending_subaccount_code = null, pending_bank_label = null,
           pending_account_name = null, requested_at = null,
           reviewed_by = auth.uid(), reviewed_at = now(), review_note = null,
           updated_by = auth.uid()
     where school_id = p_school_id;
    return v_settings.paystack_subaccount_code;
  end if;
  update public.school_payment_settings
     set pending_subaccount_code = null, pending_bank_label = null,
         pending_account_name = null, requested_at = null,
         reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = coalesce(nullif(btrim(p_note), ''), 'Not approved. Call DriveRush.'),
         updated_by = auth.uid()
   where school_id = p_school_id;
  return v_settings.pending_subaccount_code;
end;
$$;

-- DriveRush staff set a school's passes directly: its code, and (when given)
-- a bank already checked with the school, live at once. With no subaccount
-- the bank stays as it is (a code or on/off change). Returns the subaccount
-- the new one replaces, for the server to switch off on Paystack.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session); the seed
create or replace function private.admin_set_school_payments(
  p_school_id uuid,
  p_code text,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text,
  p_is_active boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_new text := nullif(btrim(coalesce(p_subaccount_code, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select ps.paystack_subaccount_code into v_old
    from public.school_payment_settings as ps where ps.school_id = p_school_id for update;
  insert into public.school_payment_settings as ps (
    school_id, code, price_kes, paystack_subaccount_code, bank_label, account_name,
    is_active, updated_by, reviewed_by, reviewed_at
  ) values (
    p_school_id, upper(btrim(p_code)), greatest(700, private.school_min_price()), v_new,
    nullif(btrim(p_bank_label), ''), nullif(btrim(coalesce(p_account_name, '')), ''),
    coalesce(p_is_active, true), auth.uid(),
    case when v_new is not null then auth.uid() end,
    case when v_new is not null then now() end
  )
  on conflict (school_id) do update
    set code = excluded.code,
        paystack_subaccount_code = coalesce(v_new, ps.paystack_subaccount_code),
        bank_label = case when v_new is not null then excluded.bank_label
                          else ps.bank_label end,
        account_name = case when v_new is not null then excluded.account_name
                            else ps.account_name end,
        reviewed_by = coalesce(excluded.reviewed_by, ps.reviewed_by),
        reviewed_at = coalesce(excluded.reviewed_at, ps.reviewed_at),
        is_active = excluded.is_active,
        updated_by = excluded.updated_by;
  return case when v_new is not null and v_old is distinct from v_new then v_old end;
end;
$$;

-- Banks owners asked for, waiting for DriveRush, oldest first.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_list_bank_requests()
returns table (
  school_id uuid,
  school_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  requested_by_email text,
  live_bank_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select ps.school_id, s.name, ps.pending_bank_label, ps.pending_account_name,
           ps.requested_at, u.email::text, ps.bank_label
      from public.school_payment_settings as ps
      join public.schools as s on s.id = ps.school_id
      left join auth.users as u on u.id = ps.requested_by
     where ps.pending_subaccount_code is not null
     order by ps.requested_at;
end;
$$;

-- One page of every payment, for staff: newest first, searched by the payer's
-- email, the school's name or the reference, filtered by status and school.
-- `total` is the count of every match, on every row.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_list_payments(
  p_search text,
  p_status text,
  p_limit integer,
  p_offset integer,
  p_school_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  settled_at timestamptz,
  status public.payment_status,
  payer_email text,
  school_id uuid,
  school_name text,
  plan_code text,
  amount_kes integer,
  driverush_share_kes integer,
  school_share_kes integer,
  fee_kes numeric,
  provider_ref text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.created_at, p.settled_at, p.status, u.email::text, p.school_id,
           s.name, pl.code, p.amount_kes, p.driverush_share_kes, p.school_share_kes,
           p.fee_kes, p.provider_ref, count(*) over ()
      from public.payments as p
      left join auth.users as u on u.id = p.payer_user_id
      left join public.schools as s on s.id = p.school_id
      left join public.plans as pl on pl.id = p.plan_id
     where (p_status is null or p_status = '' or p.status::text = p_status)
       and (p_school_id is null or p.school_id = p_school_id)
       and (v_q is null
            or u.email::text ilike '%' || v_q || '%'
            or s.name ilike '%' || v_q || '%'
            or p.provider_ref ilike '%' || v_q || '%')
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 100))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- Money this month and last month (Kenyan calendar), for staff: settled
-- payments, what learners paid, DriveRush's and the schools' shares, and
-- Paystack's fees.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_payment_totals()
returns table (
  month date,
  payments bigint,
  paid_kes bigint,
  driverush_kes bigint,
  schools_kes bigint,
  fees_kes numeric,
  refunded bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_this date := date_trunc('month', (now() at time zone 'Africa/Nairobi'))::date;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.month,
           count(p.id) filter (where p.status = 'succeeded'),
           coalesce(sum(p.amount_kes) filter (where p.status = 'succeeded'), 0)::bigint,
           coalesce(sum(p.driverush_share_kes) filter (where p.status = 'succeeded'), 0)::bigint,
           coalesce(sum(p.school_share_kes) filter (where p.status = 'succeeded'), 0)::bigint,
           coalesce(sum(p.fee_kes) filter (where p.status = 'succeeded'), 0),
           count(p.id) filter (where p.status = 'refunded')
      from (values (v_this), ((v_this - interval '1 month')::date)) as m (month)
      left join public.payments as p
        on p.settled_at is not null
       and date_trunc('month', (p.settled_at at time zone 'Africa/Nairobi'))::date = m.month
     group by m.month
     order by m.month desc;
end;
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (the private body checks is_school_member or is_staff)
-- Callers: school dashboard (session), console (session)
create or replace function public.school_pass_info(p_school_id uuid)
returns table (
  code text,
  price_kes integer,
  driverush_share_kes integer,
  min_price_kes integer,
  ready boolean,
  bank_label text,
  account_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.school_pass_info(p_school_id);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_set_pass_price(p_school_id uuid, p_price_kes integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_set_pass_price(p_school_id, p_price_kes);
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (the private body checks membership; rows by can_see_branch)
-- Callers: school dashboard (session), console (session)
create or replace function public.school_earnings(p_school_id uuid, p_branch_id uuid default null)
returns table (
  payment_id uuid,
  paid_at timestamptz,
  learner_email text,
  branch_id uuid,
  branch_name text,
  price_kes integer,
  school_share_kes integer,
  status public.payment_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.school_earnings(p_school_id, p_branch_id);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate; the server checks the owner first)
-- Callers: school dashboard bank form (server, service role)
create or replace function public.school_request_bank(
  p_school_id uuid,
  p_actor uuid,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.school_request_bank(p_school_id, p_actor, p_subaccount_code, p_bank_label, p_account_name);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_review_bank(p_school_id uuid, p_approve boolean, p_note text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_review_bank(p_school_id, p_approve, p_note);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session); the seed
create or replace function public.admin_set_school_payments(
  p_school_id uuid,
  p_code text,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text,
  p_is_active boolean
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_school_payments(
    p_school_id, p_code, p_subaccount_code, p_bank_label, p_account_name, p_is_active
  );
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_list_bank_requests()
returns table (
  school_id uuid,
  school_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  requested_by_email text,
  live_bank_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_bank_requests();
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_list_payments(
  p_search text,
  p_status text,
  p_limit integer,
  p_offset integer,
  p_school_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  settled_at timestamptz,
  status public.payment_status,
  payer_email text,
  school_id uuid,
  school_name text,
  plan_code text,
  amount_kes integer,
  driverush_share_kes integer,
  school_share_kes integer,
  fee_kes numeric,
  provider_ref text,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_payments(p_search, p_status, p_limit, p_offset, p_school_id);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_payment_totals()
returns table (
  month date,
  payments bigint,
  paid_kes bigint,
  driverush_kes bigint,
  schools_kes bigint,
  fees_kes numeric,
  refunded bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_payment_totals();
$$;

revoke all on function private.school_min_price() from public;
revoke all on function private.new_pass_code(text) from public;
revoke all on function private.school_pass_info(uuid) from public;
revoke all on function public.school_pass_info(uuid) from public;
revoke all on function private.school_set_pass_price(uuid, integer) from public;
revoke all on function public.school_set_pass_price(uuid, integer) from public;
revoke all on function private.school_earnings(uuid, uuid) from public;
revoke all on function public.school_earnings(uuid, uuid) from public;
revoke all on function private.school_request_bank(uuid, uuid, text, text, text) from public;
revoke all on function public.school_request_bank(uuid, uuid, text, text, text) from public;
revoke all on function private.admin_review_bank(uuid, boolean, text) from public;
revoke all on function public.admin_review_bank(uuid, boolean, text) from public;
revoke all on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) from public;
revoke all on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) from public;
revoke all on function private.admin_list_bank_requests() from public;
revoke all on function public.admin_list_bank_requests() from public;
revoke all on function private.admin_list_payments(text, text, integer, integer, uuid) from public;
revoke all on function public.admin_list_payments(text, text, integer, integer, uuid) from public;
revoke all on function private.admin_payment_totals() from public;
revoke all on function public.admin_payment_totals() from public;
grant execute on function private.school_min_price() to service_role;
grant execute on function private.new_pass_code(text) to service_role;
grant execute on function private.school_pass_info(uuid) to service_role;
grant execute on function public.school_pass_info(uuid) to service_role;
grant execute on function private.school_set_pass_price(uuid, integer) to service_role;
grant execute on function public.school_set_pass_price(uuid, integer) to service_role;
grant execute on function private.school_earnings(uuid, uuid) to service_role;
grant execute on function public.school_earnings(uuid, uuid) to service_role;
grant execute on function private.school_request_bank(uuid, uuid, text, text, text) to service_role;
grant execute on function public.school_request_bank(uuid, uuid, text, text, text) to service_role;
grant execute on function private.admin_review_bank(uuid, boolean, text) to service_role;
grant execute on function public.admin_review_bank(uuid, boolean, text) to service_role;
grant execute on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) to service_role;
grant execute on function private.admin_list_bank_requests() to service_role;
grant execute on function public.admin_list_bank_requests() to service_role;
grant execute on function private.admin_list_payments(text, text, integer, integer, uuid) to service_role;
grant execute on function public.admin_list_payments(text, text, integer, integer, uuid) to service_role;
grant execute on function private.admin_payment_totals() to service_role;
grant execute on function public.admin_payment_totals() to service_role;

comment on function private.school_min_price() is
  'The lowest school pass price: DriveRush''s share plus the school''s minimum (school_pass plan).';
comment on function private.new_pass_code(text) is
  'A free pass code made from a school''s short name.';
comment on function private.school_pass_info(uuid) is
  'School team: the school''s pass code, price, minimum and readiness; the bank (live and waiting) to owner and staff.';
comment on function public.school_pass_info(uuid) is
  'School team: the school''s pass code, price, minimum and readiness; the bank (live and waiting) to owner and staff.';
comment on function private.school_set_pass_price(uuid, integer) is
  'School owner or staff: sets the school pass price (at least school_min_price, no ceiling).';
comment on function public.school_set_pass_price(uuid, integer) is
  'School owner or staff: sets the school pass price (at least school_min_price, no ceiling).';
comment on function private.school_earnings(uuid, uuid) is
  'School team: settled payments through the school, by branch for admins.';
comment on function public.school_earnings(uuid, uuid) is
  'School team: settled payments through the school, by branch for admins.';
comment on function private.school_request_bank(uuid, uuid, text, text, text) is
  'Server (after its owner check): the bank an owner asked for, waiting for staff. Returns the request it replaces.';
comment on function public.school_request_bank(uuid, uuid, text, text, text) is
  'Server (after its owner check): the bank an owner asked for, waiting for staff. Returns the request it replaces.';
comment on function private.admin_review_bank(uuid, boolean, text) is
  'Staff: approve or turn down a bank an owner asked for. Returns the subaccount to switch off.';
comment on function public.admin_review_bank(uuid, boolean, text) is
  'Staff: approve or turn down a bank an owner asked for. Returns the subaccount to switch off.';
comment on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) is
  'Staff: a school''s pass code and (when given) its checked bank, live at once. Returns the subaccount replaced.';
comment on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) is
  'Staff: a school''s pass code and (when given) its checked bank, live at once. Returns the subaccount replaced.';
comment on function private.admin_list_bank_requests() is
  'Staff: banks owners asked for, waiting for approval.';
comment on function public.admin_list_bank_requests() is
  'Staff: banks owners asked for, waiting for approval.';
comment on function private.admin_list_payments(text, text, integer, integer, uuid) is
  'Staff: one page of every payment, searched and filtered.';
comment on function public.admin_list_payments(text, text, integer, integer, uuid) is
  'Staff: one page of every payment, searched and filtered.';
comment on function private.admin_payment_totals() is
  'Staff: this month''s and last month''s money (Kenyan calendar).';
comment on function public.admin_payment_totals() is
  'Staff: this month''s and last month''s money (Kenyan calendar).';

-- ── supabase/schemas/progress/functions/school_student_progress.sql
-- ===================================================
-- FUNCTION: school_student_progress
-- ===================================================
-- The learners a school is linked to right now, with their saved progress
-- (one object keyed by store). The owner sees every branch, an admin only
-- their branches, DriveRush staff everything. A learner's progress is visible
-- only while their link is current.
--
-- Access:  authenticated (school owner, school admin or DriveRush staff)
-- Guard:   admin (private.is_school_member or is_staff; rows filtered by private.can_see_branch)
-- Callers: school dashboard (session)
create or replace function private.school_student_progress(p_school_id uuid, p_branch_id uuid default null)
returns table (
  link_id uuid,
  branch_id uuid,
  user_id uuid,
  email extensions.citext,
  full_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  progress jsonb,
  progress_updated_at timestamptz,
  pass_ends_at timestamptz,
  pass_through_school boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.is_staff();
begin
  if not v_staff and not private.is_school_member(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select l.id, l.branch_id, l.user_id, l.email, p.full_name, l.starts_at, l.ends_at,
         coalesce((select jsonb_object_agg(lp.store, lp.data)
                     from public.learner_progress as lp where lp.user_id = l.user_id), '{}'::jsonb),
         (select max(lp.updated_at) from public.learner_progress as lp where lp.user_id = l.user_id),
         pass.ends_at,
         coalesce(pass.through_school, false)
    from public.school_student_links as l
    -- The learner's pass running now or next (passes are back to back), and
    -- whether one of them was bought through this school.
    left join lateral (
      select max(ls.ends_at) as ends_at,
             bool_or(pay.school_id = p_school_id) as through_school
        from public.learner_subscriptions as ls
        left join public.payments as pay on pay.id = ls.payment_id
       where ls.user_id = l.user_id and ls.status = 'active' and ls.ends_at > now()
    ) as pass on true
    left join public.profiles as p on p.id = l.user_id
   where l.school_id = p_school_id
     and l.status = 'active' and l.ends_at > now()
     and (p_branch_id is null or l.branch_id = p_branch_id)
     and (v_staff or private.can_see_branch(l.branch_id))
   order by l.starts_at desc;
end;
$$;

-- Access:  authenticated (school owner, school admin or DriveRush staff)
-- Guard:   admin (the private body checks membership and filters by branch)
-- Callers: school dashboard (session)
create or replace function public.school_student_progress(p_school_id uuid, p_branch_id uuid default null)
returns table (
  link_id uuid,
  branch_id uuid,
  user_id uuid,
  email extensions.citext,
  full_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  progress jsonb,
  progress_updated_at timestamptz,
  pass_ends_at timestamptz,
  pass_through_school boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.school_student_progress(p_school_id, p_branch_id);
$$;

revoke all on function private.school_student_progress(uuid, uuid) from public;
revoke all on function public.school_student_progress(uuid, uuid) from public;
grant execute on function private.school_student_progress(uuid, uuid) to service_role;
grant execute on function public.school_student_progress(uuid, uuid) to service_role;

comment on function private.school_student_progress(uuid, uuid) is
  'School owner, admin (own branches) or staff: currently linked learners with their saved progress and pass.';
comment on function public.school_student_progress(uuid, uuid) is
  'School owner, admin (own branches) or staff: currently linked learners with their saved progress and pass.';

-- ── supabase/schemas/profiles/triggers/auth_users_triggers.sql
-- ===================================================
-- TRIGGERS: auth.users and profiles
-- ===================================================
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function private.handle_auth_user_updated();

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ── supabase/schemas/schools/triggers/school_triggers.sql
-- ===================================================
-- TRIGGERS: schools
-- ===================================================
create or replace trigger schools_set_updated_at
  before update on public.schools
  for each row execute function private.set_updated_at();

create or replace trigger school_branches_set_updated_at
  before update on public.school_branches
  for each row execute function private.set_updated_at();

-- At most 50 admins per school, pending admin invites included.
create or replace trigger school_members_admin_limit
  before insert or update of role on public.school_members
  for each row execute function private.enforce_member_admin_limit();

create or replace trigger school_member_invites_admin_limit
  before insert or update of role, status on public.school_member_invites
  for each row execute function private.enforce_invite_admin_limit();

create or replace trigger school_profiles_set_updated_at
  before update on public.school_profiles
  for each row execute function private.set_updated_at();

-- ── supabase/schemas/billing/triggers/billing_triggers.sql
-- ===================================================
-- TRIGGERS: billing
-- ===================================================
create or replace trigger learner_subscriptions_set_updated_at
  before update on public.learner_subscriptions
  for each row execute function private.set_updated_at();

create or replace trigger school_subscriptions_set_updated_at
  before update on public.school_subscriptions
  for each row execute function private.set_updated_at();

create or replace trigger school_payment_settings_set_updated_at
  before update on public.school_payment_settings
  for each row execute function private.set_updated_at();

-- ── supabase/schemas/progress/triggers/progress_triggers.sql
-- ===================================================
-- TRIGGERS: progress
-- ===================================================
create or replace trigger learner_progress_set_updated_at
  before update on public.learner_progress
  for each row execute function private.set_updated_at();

-- ── supabase/schemas/profiles/rls/profiles_rls.sql
-- ===================================================
-- ACCESS: public.profiles
-- ===================================================
-- Reads:  A learner reads their own profile; DriveRush staff read all.
--         Schools see their learners' names through school_student_progress.
-- Writes: A learner updates their own full_name and avatar_url. Rows are
--         created by handle_new_user; email follows auth.users.
-- Grants: anon: none; authenticated: SELECT, UPDATE(avatar_url, full_name)
--         (supabase/schemas/_grants/table_privileges.sql)
alter table public.profiles enable row level security;

create policy "profiles: read own or staff"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── supabase/schemas/profiles/rls/user_roles_rls.sql
-- ===================================================
-- ACCESS: public.user_roles
-- ===================================================
-- Reads:  Each account reads its own roles; a DriveRush su reads all.
-- Writes: No client: sign-up adds `user`, grant_platform_role and
--         revoke_platform_role (su) change the rest.
-- Grants: anon: none; authenticated: SELECT
--         (supabase/schemas/_grants/table_privileges.sql)
alter table public.user_roles enable row level security;

create policy "user_roles: read own or su"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_su()));

-- ── supabase/schemas/schools/rls/schools_rls.sql
-- ===================================================
-- ACCESS: public.schools
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins; a learner the
--         school has added (any link, so a pending invite shows its name).
-- Writes: No client: admin_create_school, admin_set_school_status and
--         admin_hand_over_school (staff).
-- Grants: anon: none; authenticated: SELECT
alter table public.schools enable row level security;

create policy "schools: staff, members and linked learners read"
  on public.schools for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(id) or private.has_school_link(id));

-- ===================================================
-- ACCESS: public.school_branches
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins (every branch, so
--         an admin can see where colleagues work); its linked learners.
-- Writes: No client: school_create_branch and school_update_branch (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_branches enable row level security;

create policy "school_branches: staff, members and linked learners read"
  on public.school_branches for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id) or private.has_school_link(school_id));

-- ===================================================
-- ACCESS: public.school_members
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins.
-- Writes: No client: admin_create_school, admin_transfer_school_owner
--         (staff); school_add_admin and school_remove_admin (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_members enable row level security;

create policy "school_members: staff and members read"
  on public.school_members for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id));

-- ===================================================
-- ACCESS: public.school_member_branches
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins.
-- Writes: No client: school_add_admin and school_set_admin_branches (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_member_branches enable row level security;

create policy "school_member_branches: staff and members read"
  on public.school_member_branches for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id));

-- ===================================================
-- ACCESS: public.school_member_invites
-- ===================================================
-- Reads:  DriveRush staff; the school's owner.
-- Writes: No client: school_add_admin, school_cancel_member_invite (owner),
--         admin_create_school, admin_transfer_school_owner (staff);
--         match_pending_invites on confirmation.
-- Grants: anon: none; authenticated: SELECT
alter table public.school_member_invites enable row level security;

create policy "school_member_invites: staff and owner read"
  on public.school_member_invites for select to authenticated
  using ((select private.is_staff()) or private.is_school_owner(school_id));

-- ===================================================
-- ACCESS: public.school_profiles
-- ===================================================
-- Reads:  anyone, guests included: an active school's profile is public
--         (what learners read about it). The school's owner and admins and
--         DriveRush staff also read it while the school is suspended or
--         archived. `updated_by` (who edited) is granted to nobody.
-- Writes: No client: school_update_profile (owner, staff: the words,
--         contacts and colours); school_set_logo (the server, after
--         uploading the file). No client ever writes a media path.
-- Grants: anon: SELECT (public columns); authenticated: SELECT (public columns)
alter table public.school_profiles enable row level security;

create policy "school_profiles: anyone reads active schools"
  on public.school_profiles for select to anon
  using (private.is_active_school(school_id));

create policy "school_profiles: public if active; members and staff"
  on public.school_profiles for select to authenticated
  using (
    private.is_active_school(school_id)
    or private.is_school_member(school_id)
    or (select private.is_staff())
  );

-- ===================================================
-- ACCESS: public.school_liveries
-- ===================================================
-- Reads:  anyone, guests included: the live livery of an active school
--         (the board shows it to everyone). DriveRush staff read every
--         livery: drafts, live and retired. `created_by` is granted to nobody.
-- Writes: DriveRush staff only (password session, private.is_staff):
--           insert  a draft (status draft, published_at null: the table's
--                   defaults; the columns are not granted)
--           update  a livery's content (label, colours, media paths)
--           delete  a livery that is not live
--         Going live or retiring is admin_publish_livery and
--         admin_retire_livery (staff), which keep one live livery per
--         school. `npm run livery:publish` signs in as staff and goes
--         through these same policies.
-- Grants: anon: SELECT (content columns);
--         authenticated: SELECT (content columns), INSERT and UPDATE (content
--         columns), DELETE
alter table public.school_liveries enable row level security;

create policy "school_liveries: anyone reads live liveries"
  on public.school_liveries for select to anon
  using (status = 'live' and private.is_active_school(school_id));

create policy "school_liveries: anyone reads live liveries, staff read all"
  on public.school_liveries for select to authenticated
  using (
    (status = 'live' and private.is_active_school(school_id))
    or (select private.is_staff())
  );

create policy "school_liveries: staff insert drafts"
  on public.school_liveries for insert to authenticated
  with check ((select private.is_staff()) and status = 'draft');

create policy "school_liveries: staff update"
  on public.school_liveries for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "school_liveries: staff delete all but the live one"
  on public.school_liveries for delete to authenticated
  using ((select private.is_staff()) and status <> 'live');

-- ===================================================
-- ACCESS: public.school_sponsorships
-- ===================================================
-- Reads:  DriveRush staff. board_schools() says only whether one is current.
-- Writes: No client: admin_set_sponsorship and admin_end_sponsorship (staff).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_sponsorships enable row level security;

create policy "school_sponsorships: staff read"
  on public.school_sponsorships for select to authenticated
  using ((select private.is_staff()));

-- ── supabase/schemas/billing/rls/billing_rls.sql
-- ===================================================
-- ACCESS: public.plans
-- ===================================================
-- Reads:  Anyone reads active plans (the pricing page); staff read all.
-- Writes: No client: a migration (reference rows).
-- Grants: anon: SELECT; authenticated: SELECT
alter table public.plans enable row level security;

-- One policy per role and command, so Postgres never evaluates two
-- permissive policies for the same read (advisor: multiple_permissive_policies).
-- anon gets its own: it cannot call private.is_staff().
create policy "plans: guests read active"
  on public.plans for select to anon
  using (is_active);

create policy "plans: signed-in read active, staff read all"
  on public.plans for select to authenticated
  using (is_active or (select private.is_staff()));

-- ===================================================
-- ACCESS: public.learner_subscriptions
-- ===================================================
-- Reads:  A learner reads their own passes; DriveRush staff read all.
-- Writes: No client: settle_payment and refund_payment (service role), or
--         staff grants (service role).
-- Grants: anon: none; authenticated: SELECT
alter table public.learner_subscriptions enable row level security;

create policy "learner_subscriptions: read own or staff"
  on public.learner_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- ===================================================
-- ACCESS: public.school_subscriptions
-- ===================================================
-- Reads:  The school's owner; DriveRush staff.
-- Writes: No client: the payment flow or staff (service role).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_subscriptions enable row level security;

create policy "school_subscriptions: owner or staff read"
  on public.school_subscriptions for select to authenticated
  using ((select private.is_staff()) or private.is_school_owner(school_id));

-- ===================================================
-- ACCESS: public.payments
-- ===================================================
-- Reads:  The learner who paid; the owner of the school they paid through;
--         staff. Branch admins see their branches' payments through
--         school_earnings, never the table.
-- Writes: No client: start_pass_checkout (a pending row for the caller) and
--         the payment flow (service role: settle, fail, refund).
-- Grants: anon: none; authenticated: SELECT
alter table public.payments enable row level security;

create policy "payments: payer, school owner or staff read"
  on public.payments for select to authenticated
  using (
    payer_user_id = (select auth.uid())
    or (select private.is_staff())
    or (school_id is not null and private.is_school_owner(school_id))
  );

-- ===================================================
-- ACCESS: public.school_payment_settings
-- ===================================================
-- Reads:  The school's owner; DriveRush staff. Branch admins get the code and
--         price through school_pass_info; learners resolve a code through
--         pass_school_by_code.
-- Writes: No client: admin_set_school_payments, admin_review_bank (staff),
--         school_request_bank (the server, after its owner check), school_set_pass_price
--         (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_payment_settings enable row level security;

create policy "school_payment_settings: owner or staff read"
  on public.school_payment_settings for select to authenticated
  using ((select private.is_staff()) or private.is_school_owner(school_id));

-- ── supabase/schemas/students/rls/school_student_links_rls.sql
-- ===================================================
-- ACCESS: public.school_student_links
-- ===================================================
-- Reads:  A learner reads their own links (pending invites included); the
--         school owner reads every link of the school; an admin reads links
--         in their branches; DriveRush staff read all.
-- Writes: No client: school_add_student, school_release_student,
--         school_cancel_student_invite, school_move_student_branch (school),
--         learner_accept_school_link, learner_decline_school_link (learner),
--         match_pending_invites on confirmation.
-- Grants: anon: none; authenticated: SELECT
alter table public.school_student_links enable row level security;

create policy "school_student_links: learner, branch staff or staff read"
  on public.school_student_links for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_staff())
    or private.can_see_branch(branch_id)
  );

-- ── supabase/schemas/progress/rls/learner_progress_rls.sql
-- ===================================================
-- ACCESS: public.learner_progress
-- ===================================================
-- Reads:  A learner reads their own rows. Their school (owner, branch admin)
--         and staff read them through school_student_progress.
-- Writes: A learner inserts, updates and deletes their own rows (the app's
--         sync upserts one row per store).
-- Grants: anon: none; authenticated: SELECT, INSERT(data, store, user_id, version),
--         UPDATE(data, store, user_id, version), DELETE
alter table public.learner_progress enable row level security;

create policy "learner_progress: read own"
  on public.learner_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "learner_progress: insert own"
  on public.learner_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "learner_progress: update own"
  on public.learner_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "learner_progress: delete own"
  on public.learner_progress for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── supabase/schemas/realtime/school_broadcasts.sql
-- ===================================================
-- REALTIME: dashboards that update themselves (owner, 2026-11-26)
-- ===================================================
-- A school's dashboard and the DriveRush console listen on private broadcast
-- topics and re-read their loaders when something changes, as thinkrush's
-- admin console does:
--
--   school:<school_id>  a payment through the school settled or was refunded,
--                       a student was added, joined, moved or left, an admin
--                       or invite changed, its bank or price changed
--   console             any payment, any bank waiting for a check
--
-- The message says only which table changed and how: never a name, an email
-- or an amount. The page re-reads its own data through row level security.
-- Broadcasting never fails the write that caused it.
--
-- Who may listen: the policy on realtime.messages below. Every channel is
-- private; no client may broadcast (no INSERT policy): only the database does
-- (realtime.send).

-- Access:  trigger (never called directly; service_role only)
-- Guard:   none (the grant is the gate)
-- Callers: triggers on payments, school_student_links, school_members,
--          school_member_invites, school_payment_settings
create or replace function private.broadcast_school_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid := coalesce(
    (to_jsonb(NEW) ->> 'school_id')::uuid,
    (to_jsonb(OLD) ->> 'school_id')::uuid
  );
  v_payload jsonb := jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP);
  v_console boolean := TG_TABLE_NAME in ('payments', 'school_payment_settings');
begin
  begin
    if v_school_id is not null then
      execute 'select realtime.send($1, $2, $3, $4)'
        using v_payload, lower(TG_OP), 'school:' || v_school_id::text, true;
    end if;
    if v_console then
      execute 'select realtime.send($1, $2, $3, $4)'
        using v_payload, lower(TG_OP), 'console', true;
    end if;
  exception
    when others then
      raise warning '[school-broadcast] % on %: % (sqlstate %)',
        TG_OP, TG_TABLE_NAME, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

revoke all on function private.broadcast_school_change() from public;
grant execute on function private.broadcast_school_change() to service_role;

comment on function private.broadcast_school_change() is
  'Trigger: tells school:<id> (and console, for money) that a table changed; no row data.';

-- A payment matters to a dashboard once it settles, fails or is refunded.
create or replace trigger payments_broadcast
  after update of status on public.payments
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function private.broadcast_school_change();

create or replace trigger school_student_links_broadcast
  after insert or update or delete on public.school_student_links
  for each row execute function private.broadcast_school_change();

create or replace trigger school_members_broadcast
  after insert or update or delete on public.school_members
  for each row execute function private.broadcast_school_change();

create or replace trigger school_member_invites_broadcast
  after insert or update or delete on public.school_member_invites
  for each row execute function private.broadcast_school_change();

create or replace trigger school_payment_settings_broadcast
  after insert or update on public.school_payment_settings
  for each row execute function private.broadcast_school_change();

-- ===================================================
-- ACCESS: realtime.messages (who hears which topic)
-- ===================================================
-- Reads:  school:<id>: that school's owner and admins, and DriveRush staff.
--         console: DriveRush staff. Any other topic: nobody.
-- Writes: No client (no INSERT policy): only realtime.send in the database.
drop policy if exists "realtime.messages: topic-gated read" on realtime.messages;

create policy "realtime.messages: topic-gated read"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and case
      when topic = 'console' then (select private.is_staff())
      when topic ~ '^school:[0-9a-f-]{36}$' then
        (select private.is_staff())
        or private.is_school_member(substr(topic, 8)::uuid)
      else false
    end
  );

-- ── supabase/schemas/_grants/function_privileges.sql
-- ===================================================
-- GRANTS: who may execute our functions
-- ===================================================
-- The only place that grants EXECUTE to anon or authenticated. Every other
-- /schemas file grants to service_role at most. The declared intent, with a
-- guard and callers per function, is tests.function_access in
-- supabase/tests/database/000_security_manifest.test.sql; the security_*
-- pgTAP files fail when this file and the manifest disagree.
--
-- An owner-rights (SECURITY DEFINER) function a client can reach lives in
-- schema private, which the Data API does not expose; its Data API name is a
-- SECURITY INVOKER wrapper of the same name in public. The wrapper runs with
-- the caller's rights, so a caller needs EXECUTE on both.
--
-- Listed last in supabase/config.toml schema_paths (with table_privileges.sql)
-- and copied verbatim into a migration whenever it changes.

-- ── 1. Nothing is executable by clients by default ──────────────────────
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema private
  grant execute on functions to service_role;

-- ── 2. Start from nothing ───────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

-- A signed-in client resolves a private function only through a public
-- wrapper or a policy; USAGE lets those calls reach the schema. The Data API
-- does not expose private, so USAGE alone reaches nothing.
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ── 3. Row level security helpers (policies run as the caller) ──────────
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_su() to authenticated;
grant execute on function private.is_school_owner(uuid) to authenticated;
grant execute on function private.is_school_member(uuid) to authenticated;
grant execute on function private.can_see_branch(uuid) to authenticated;
grant execute on function private.has_school_link(uuid) to authenticated;

-- ── 3b. Anyone, guests included (public data only) ──────────────────────
grant execute on function public.board_schools() to anon, authenticated;
grant execute on function private.board_schools() to anon, authenticated;
-- Row level security helper for the public profile and livery policies.
grant execute on function private.is_active_school(uuid) to anon, authenticated;

-- ── 3c. CHECKs on tables staff write directly (school_liveries) ─────────
-- A CHECK runs its function as the writer. These only test their own
-- arguments (a colour, a media path in the school's folder) and read no
-- table, so any signed-in caller may run them.
grant execute on function private.valid_hex_colour(text) to authenticated;
grant execute on function private.valid_media_path(text, uuid) to authenticated;
grant execute on function private.valid_media_paths(jsonb, uuid) to authenticated;
grant execute on function private.valid_media_ref(jsonb, uuid) to authenticated;
grant execute on function private.valid_paint(jsonb, uuid) to authenticated;

-- ── 4. Learners, with their own session ─────────────────────────────────
grant execute on function public.my_entitlement() to authenticated;
grant execute on function private.my_entitlement() to authenticated;
grant execute on function public.learner_accept_school_link(uuid) to authenticated;
grant execute on function private.learner_accept_school_link(uuid) to authenticated;
grant execute on function public.learner_decline_school_link(uuid) to authenticated;
grant execute on function private.learner_decline_school_link(uuid) to authenticated;
grant execute on function public.pass_school_by_code(text) to authenticated;
grant execute on function private.pass_school_by_code(text) to authenticated;
grant execute on function public.start_pass_checkout(text, text, uuid) to authenticated;
grant execute on function public.my_pass_offers() to authenticated;
grant execute on function private.my_pass_offers() to authenticated;
grant execute on function private.start_pass_checkout(text, text, uuid) to authenticated;

-- ── 5. School owners and admins (each checks the caller's school role) ──
grant execute on function public.school_create_branch(uuid, text, text) to authenticated;
grant execute on function private.school_create_branch(uuid, text, text) to authenticated;
grant execute on function public.school_update_branch(uuid, text, text, boolean) to authenticated;
grant execute on function private.school_update_branch(uuid, text, text, boolean) to authenticated;
grant execute on function public.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) to authenticated;
grant execute on function private.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb) to authenticated;
grant execute on function public.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) to authenticated;
grant execute on function private.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text) to authenticated;
grant execute on function public.school_add_admin(uuid, text, uuid[]) to authenticated;
grant execute on function private.school_add_admin(uuid, text, uuid[]) to authenticated;
grant execute on function public.school_set_admin_branches(uuid, uuid[]) to authenticated;
grant execute on function private.school_set_admin_branches(uuid, uuid[]) to authenticated;
grant execute on function public.school_remove_admin(uuid) to authenticated;
grant execute on function private.school_remove_admin(uuid) to authenticated;
grant execute on function public.school_cancel_member_invite(uuid) to authenticated;
grant execute on function private.school_cancel_member_invite(uuid) to authenticated;
grant execute on function public.school_add_student(uuid, text) to authenticated;
grant execute on function private.school_add_student(uuid, text) to authenticated;
grant execute on function public.school_release_student(uuid) to authenticated;
grant execute on function private.school_release_student(uuid) to authenticated;
grant execute on function public.school_cancel_student_invite(uuid) to authenticated;
grant execute on function private.school_cancel_student_invite(uuid) to authenticated;
grant execute on function public.school_move_student_branch(uuid, uuid) to authenticated;
grant execute on function private.school_move_student_branch(uuid, uuid) to authenticated;
grant execute on function public.school_members_list(uuid) to authenticated;
grant execute on function private.school_members_list(uuid) to authenticated;
grant execute on function public.school_student_progress(uuid, uuid) to authenticated;
grant execute on function private.school_student_progress(uuid, uuid) to authenticated;
grant execute on function public.school_pass_info(uuid) to authenticated;
grant execute on function private.school_pass_info(uuid) to authenticated;
grant execute on function public.school_set_pass_price(uuid, integer) to authenticated;
grant execute on function private.school_set_pass_price(uuid, integer) to authenticated;
grant execute on function public.school_earnings(uuid, uuid) to authenticated;
grant execute on function private.school_earnings(uuid, uuid) to authenticated;

-- ── 6. DriveRush console (each checks is_staff or is_su) ────────────────
grant execute on function public.admin_create_school(text, text, text) to authenticated;
grant execute on function private.admin_create_school(text, text, text) to authenticated;
grant execute on function public.admin_set_school_status(uuid, public.school_status) to authenticated;
grant execute on function private.admin_set_school_status(uuid, public.school_status) to authenticated;
grant execute on function public.admin_transfer_school_owner(uuid, text) to authenticated;
grant execute on function private.admin_transfer_school_owner(uuid, text) to authenticated;
grant execute on function public.admin_hand_over_school(uuid, text, boolean) to authenticated;
grant execute on function private.admin_hand_over_school(uuid, text, boolean) to authenticated;
grant execute on function public.admin_list_schools(text, text, text, text, integer, integer) to authenticated;
grant execute on function private.admin_list_schools(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_livery_draft_get(uuid) to authenticated;
grant execute on function private.admin_livery_draft_get(uuid) to authenticated;
grant execute on function public.admin_publish_livery(uuid) to authenticated;
grant execute on function private.admin_publish_livery(uuid) to authenticated;
grant execute on function public.admin_retire_livery(uuid) to authenticated;
grant execute on function private.admin_retire_livery(uuid) to authenticated;
grant execute on function public.admin_set_sponsorship(uuid, date, date, text) to authenticated;
grant execute on function private.admin_set_sponsorship(uuid, date, date, text) to authenticated;
grant execute on function public.admin_end_sponsorship(uuid) to authenticated;
grant execute on function private.admin_end_sponsorship(uuid) to authenticated;
grant execute on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_review_bank(uuid, boolean, text) to authenticated;
grant execute on function private.admin_review_bank(uuid, boolean, text) to authenticated;
grant execute on function public.admin_list_bank_requests() to authenticated;
grant execute on function private.admin_list_bank_requests() to authenticated;
grant execute on function public.admin_list_payments(text, text, integer, integer, uuid) to authenticated;
grant execute on function private.admin_list_payments(text, text, integer, integer, uuid) to authenticated;
grant execute on function public.admin_payment_totals() to authenticated;
grant execute on function private.admin_payment_totals() to authenticated;
grant execute on function public.grant_platform_role(uuid, public.app_role) to authenticated;
grant execute on function private.grant_platform_role(uuid, public.app_role) to authenticated;
grant execute on function public.revoke_platform_role(uuid, public.app_role) to authenticated;
grant execute on function private.revoke_platform_role(uuid, public.app_role) to authenticated;

-- ── 7. Supabase Auth ────────────────────────────────────────────────────
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ── supabase/schemas/_grants/table_privileges.sql
-- ===================================================
-- GRANTS: who may read and write our tables
-- ===================================================
-- The only place that grants table privileges to anon or authenticated.
-- Row level security then decides which rows; a privilege missing here means
-- the API refuses the statement before any policy runs. The declared intent
-- per table is tests.table_access in
-- supabase/tests/database/000_security_manifest.test.sql.
--
-- Listed last in supabase/config.toml schema_paths and copied verbatim into a
-- migration whenever it changes.

-- ── 1. Nothing is readable or writable by clients by default ────────────
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ── 2. Start from nothing ───────────────────────────────────────────────
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ── 3. anon: the plans (pricing page) ───────────────────────────────────
grant select on public.plans to anon;

-- A school's public face: everyone reads an active school's profile and its
-- live livery (row level security picks the rows). Who edited or made them
-- (updated_by, created_by) is not granted.
grant select (school_id, tagline, about, phone, whatsapp, email, website_url, socials,
              brand_paint, brand_ink, logo, logo_mono, updated_at)
  on public.school_profiles to anon, authenticated;
grant select (id, school_id, status, label, base_color, rail, paint, top_board, banner,
              posters, marks, thumbs, stills, created_at, published_at)
  on public.school_liveries to anon, authenticated;

-- DriveRush staff make and edit liveries (the policies check private.is_staff).
-- Status and published_at are not granted: going live or retiring is
-- admin_publish_livery / admin_retire_livery.
grant insert (school_id, label, base_color, rail, paint, top_board, banner, posters,
              marks, thumbs, stills)
  on public.school_liveries to authenticated;
grant update (label, base_color, rail, paint, top_board, banner, posters, marks,
              thumbs, stills)
  on public.school_liveries to authenticated;
grant delete on public.school_liveries to authenticated;

-- ── 4. authenticated: reads (row level security picks the rows) ─────────
grant select on public.learner_progress to authenticated;
grant select on public.learner_subscriptions to authenticated;
grant select on public.payments to authenticated;
grant select on public.plans to authenticated;
grant select on public.profiles to authenticated;
grant select on public.school_branches to authenticated;
grant select on public.school_member_branches to authenticated;
grant select on public.school_member_invites to authenticated;
grant select on public.school_members to authenticated;
grant select on public.school_payment_settings to authenticated;
grant select on public.school_sponsorships to authenticated;
grant select on public.school_student_links to authenticated;
grant select on public.school_subscriptions to authenticated;
grant select on public.schools to authenticated;
grant select on public.user_roles to authenticated;

-- ── 5. authenticated: the only direct writes ────────────────────────────
-- A learner's own profile fields.
grant update (full_name, avatar_url) on public.profiles to authenticated;
-- A learner's own saved progress (the app upserts one row per store). An
-- upsert's DO UPDATE sets every column it sends, user_id and store included;
-- the policies keep user_id the caller's own.
grant insert (user_id, store, data, version) on public.learner_progress to authenticated;
grant update (user_id, store, data, version) on public.learner_progress to authenticated;
grant delete on public.learner_progress to authenticated;

-- ── supabase/schemas/storage/school_media_bucket.sql
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
-- else is refused. `npm run livery:publish` signs in as staff and goes
-- through these policies; only the server's logo upload (after its owner
-- check) uses the service role.
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
