-- ===================================================
-- FUNCTIONS: a school owner manages admins and their branches
-- ===================================================
-- At most 50 admins per school (private.assert_admin_room, via triggers).
-- An admin always has at least one branch.

-- Refuses unless every id is a branch of this school and there is at least one.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_add_admin, school_set_admin_branches
create or replace function private.assert_school_branches(p_school_id uuid, p_branch_ids uuid[])
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_branch_ids), 0) = 0
     or exists (
       select 1 from unnest(p_branch_ids) as x(id)
        where not exists (select 1 from public.school_branches as b
                           where b.id = x.id and b.school_id = p_school_id)
     ) then
    raise exception 'invalid_branches' using errcode = 'P0001';
  end if;
end;
$$;

-- Adds an admin by email, tied to these branches. Returns 'added' when a
-- confirmed account has the email, 'invited' when it waits for sign-up.
-- Adding an existing admin again replaces their branches.
--
-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_add_admin(p_school_id uuid, p_email text, p_branch_ids uuid[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_user_id uuid;
  v_member public.school_members;
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.assert_school_branches(p_school_id, p_branch_ids);

  v_user_id := private.confirmed_user_id(v_email);

  if v_user_id is null then
    insert into public.school_member_invites (school_id, email, role, branch_ids, invited_by)
    values (p_school_id, v_email, 'admin', p_branch_ids, auth.uid())
    on conflict (school_id, email) where status = 'pending'
    do update set branch_ids = excluded.branch_ids
    where public.school_member_invites.role = 'admin';
    if not found then
      raise exception 'already_owner' using errcode = 'P0001';
    end if;
    return 'invited';
  end if;

  select * into v_member from public.school_members
   where school_id = p_school_id and user_id = v_user_id;

  if v_member.role = 'owner' then
    raise exception 'already_owner' using errcode = 'P0001';
  end if;

  if v_member.id is null then
    insert into public.school_members (school_id, user_id, role, added_by)
    values (p_school_id, v_user_id, 'admin', auth.uid())
    returning * into v_member;
  end if;

  delete from public.school_member_branches where member_id = v_member.id;
  insert into public.school_member_branches (member_id, branch_id, school_id)
  select v_member.id, x.id, p_school_id from unnest(p_branch_ids) as x(id)
  on conflict do nothing;
  return 'added';
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_set_admin_branches(p_member_id uuid, p_branch_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.school_members;
begin
  select * into v_member from public.school_members where id = p_member_id;
  if v_member.id is null or not private.can_manage_school(v_member.school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  perform private.assert_school_branches(v_member.school_id, p_branch_ids);

  delete from public.school_member_branches where member_id = p_member_id;
  insert into public.school_member_branches (member_id, branch_id, school_id)
  select p_member_id, x.id, v_member.school_id from unnest(p_branch_ids) as x(id)
  on conflict do nothing;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_remove_admin(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.school_members;
begin
  select * into v_member from public.school_members where id = p_member_id;
  if v_member.id is null or not private.can_manage_school(v_member.school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  delete from public.school_members where id = p_member_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_cancel_member_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.school_member_invites;
begin
  select * into v_invite from public.school_member_invites where id = p_invite_id;
  if v_invite.id is null or not private.can_manage_school(v_invite.school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Only staff withdraw an owner invite (owners are theirs to set).
  if v_invite.role = 'owner' and not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_member_invites
     set status = 'cancelled', closed_at = now()
   where id = p_invite_id and status = 'pending';
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_add_admin(p_school_id uuid, p_email text, p_branch_ids uuid[])
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.school_add_admin(p_school_id, p_email, p_branch_ids);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_set_admin_branches(p_member_id uuid, p_branch_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_set_admin_branches(p_member_id, p_branch_ids);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_remove_admin(p_member_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_remove_admin(p_member_id);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_cancel_member_invite(p_invite_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_cancel_member_invite(p_invite_id);
$$;

revoke all on function private.assert_school_branches(uuid, uuid[]) from public;
revoke all on function private.school_add_admin(uuid, text, uuid[]) from public;
revoke all on function private.school_set_admin_branches(uuid, uuid[]) from public;
revoke all on function private.school_remove_admin(uuid) from public;
revoke all on function private.school_cancel_member_invite(uuid) from public;
revoke all on function public.school_add_admin(uuid, text, uuid[]) from public;
revoke all on function public.school_set_admin_branches(uuid, uuid[]) from public;
revoke all on function public.school_remove_admin(uuid) from public;
revoke all on function public.school_cancel_member_invite(uuid) from public;
grant execute on function private.assert_school_branches(uuid, uuid[]) to service_role;
grant execute on function private.school_add_admin(uuid, text, uuid[]) to service_role;
grant execute on function private.school_set_admin_branches(uuid, uuid[]) to service_role;
grant execute on function private.school_remove_admin(uuid) to service_role;
grant execute on function private.school_cancel_member_invite(uuid) to service_role;
grant execute on function public.school_add_admin(uuid, text, uuid[]) to service_role;
grant execute on function public.school_set_admin_branches(uuid, uuid[]) to service_role;
grant execute on function public.school_remove_admin(uuid) to service_role;
grant execute on function public.school_cancel_member_invite(uuid) to service_role;

comment on function private.assert_school_branches(uuid, uuid[]) is
  'Refuses (P0001 invalid_branches) unless the list is non-empty and every id is a branch of the school.';
comment on function private.school_add_admin(uuid, text, uuid[]) is
  'School owner or staff: adds an admin by email tied to branches. Returns added or invited.';
comment on function private.school_set_admin_branches(uuid, uuid[]) is
  'School owner or staff: replaces an admin''s branches.';
comment on function private.school_remove_admin(uuid) is
  'School owner or staff: removes an admin.';
comment on function private.school_cancel_member_invite(uuid) is
  'School owner or staff: withdraws a pending admin invite (owner invites: staff only).';
comment on function public.school_add_admin(uuid, text, uuid[]) is
  'School owner or staff: adds an admin by email tied to branches. Returns added or invited.';
comment on function public.school_set_admin_branches(uuid, uuid[]) is
  'School owner or staff: replaces an admin''s branches.';
comment on function public.school_remove_admin(uuid) is
  'School owner or staff: removes an admin.';
comment on function public.school_cancel_member_invite(uuid) is
  'School owner or staff: withdraws a pending admin invite (owner invites: staff only).';
