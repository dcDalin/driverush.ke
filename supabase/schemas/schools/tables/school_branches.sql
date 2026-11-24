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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

comment on table public.school_branches is
  'A school''s branch. Student links and admin scopes are per branch.';
