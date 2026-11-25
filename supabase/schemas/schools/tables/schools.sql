-- ===================================================
-- TABLE: public.schools
-- ===================================================
-- A driving school, the paying customer. Only DriveRush staff create one
-- (admin_create_school). sponsor_id names the school's livery art in the app
-- (app/lib/board/sponsors.ts Sponsor.id); a school without one links learners
-- but shows plain cars.
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 2 and 120),
  status public.school_status not null default 'active',
  sponsor_id text unique check (sponsor_id is null or sponsor_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schools_created_by_idx on public.schools (created_by);

comment on table public.schools is
  'A driving school (the paying customer). Created by DriveRush staff only.';
