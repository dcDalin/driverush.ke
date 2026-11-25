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
