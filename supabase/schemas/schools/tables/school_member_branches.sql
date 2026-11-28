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
