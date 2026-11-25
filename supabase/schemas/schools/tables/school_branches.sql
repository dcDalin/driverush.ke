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
