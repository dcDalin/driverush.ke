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
