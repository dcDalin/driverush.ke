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
