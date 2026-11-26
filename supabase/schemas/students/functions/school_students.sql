-- ===================================================
-- FUNCTIONS: a school adds and releases students
-- ===================================================
-- The owner (any branch) or an admin of the branch (or DriveRush staff).

-- Adds a learner's email to a branch and returns the link id. The month
-- starts now if a confirmed account has the email, it has no current school
-- link and no other school is waiting for it; otherwise the link is pending.
-- Adding an email whose month with this school is running is refused
-- (already_linked); one still waiting is sent again (private.invite_resend
-- limits) and renewed for 30 days.
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
  v_open public.school_student_links;
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

  -- Already open with this school: a running link is refused (nothing to
  -- send); a waiting one is sent again, within the limits, and renewed.
  select * into v_open from public.school_student_links
   where school_id = v_branch.school_id and email = v_email and status in ('pending', 'active')
   for update;
  if v_open.status = 'active' then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;
  if v_open.id is not null then
    perform private.invite_resend(v_open.last_sent_at, v_open.sent_count);
    update public.school_student_links
       set expires_at = now() + interval '30 days',
           sent_count = sent_count + 1,
           last_sent_at = now()
     where id = v_open.id;
    return v_open.id;
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
            and expires_at > now()
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
