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
