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
