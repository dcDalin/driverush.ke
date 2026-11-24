-- ===================================================
-- FUNCTIONS: DriveRush staff create and run schools
-- ===================================================

-- Makes the account with this email the school's owner (replacing the
-- current one), or, if no confirmed account has it yet, leaves an owner
-- invite that match_pending_invites takes up on confirmation.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: admin_create_school, admin_transfer_school_owner
create or replace function private.set_school_owner(
  p_school_id uuid,
  p_email extensions.citext,
  p_actor uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := private.confirmed_user_id(p_email);
begin
  update public.school_member_invites
     set status = 'cancelled', closed_at = now()
   where school_id = p_school_id and role = 'owner' and status = 'pending';

  if v_user_id is null then
    -- An earlier admin invite for the same email gives way to the owner one.
    update public.school_member_invites
       set status = 'cancelled', closed_at = now()
     where school_id = p_school_id and email = p_email and status = 'pending';
    insert into public.school_member_invites (school_id, email, role, invited_by)
    values (p_school_id, p_email, 'owner', p_actor);
    return 'invited';
  end if;

  delete from public.school_members
   where school_id = p_school_id and role = 'owner' and user_id <> v_user_id;

  insert into public.school_members (school_id, user_id, role, added_by)
  values (p_school_id, v_user_id, 'owner', p_actor)
  on conflict (school_id, user_id) do update set role = 'owner';

  -- The owner sees every branch; branch ties from an admin past are dropped.
  delete from public.school_member_branches as mb
   using public.school_members as m
   where mb.member_id = m.id and m.school_id = p_school_id and m.user_id = v_user_id;
  return 'added';
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_create_school(
  p_name text,
  p_slug text,
  p_sponsor_id text,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.schools (name, slug, sponsor_id, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), nullif(lower(btrim(p_sponsor_id)), ''), auth.uid())
  returning id into v_school_id;

  perform private.set_school_owner(v_school_id, lower(btrim(p_owner_email))::extensions.citext, auth.uid());
  return v_school_id;
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.schools set status = p_status where id = p_school_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Returns 'added' (the account exists and is now owner) or 'invited'.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_transfer_school_owner(p_school_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.set_school_owner(p_school_id, lower(btrim(p_email))::extensions.citext, auth.uid());
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_create_school(
  p_name text,
  p_slug text,
  p_sponsor_id text,
  p_owner_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_school(p_name, p_slug, p_sponsor_id, p_owner_email);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_school_status(p_school_id, p_status);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_transfer_school_owner(p_school_id uuid, p_email text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_transfer_school_owner(p_school_id, p_email);
$$;

revoke all on function private.set_school_owner(uuid, extensions.citext, uuid) from public;
revoke all on function private.admin_create_school(text, text, text, text) from public;
revoke all on function private.admin_set_school_status(uuid, public.school_status) from public;
revoke all on function private.admin_transfer_school_owner(uuid, text) from public;
revoke all on function public.admin_create_school(text, text, text, text) from public;
revoke all on function public.admin_set_school_status(uuid, public.school_status) from public;
revoke all on function public.admin_transfer_school_owner(uuid, text) from public;
grant execute on function private.set_school_owner(uuid, extensions.citext, uuid) to service_role;
grant execute on function private.admin_create_school(text, text, text, text) to service_role;
grant execute on function private.admin_set_school_status(uuid, public.school_status) to service_role;
grant execute on function private.admin_transfer_school_owner(uuid, text) to service_role;
grant execute on function public.admin_create_school(text, text, text, text) to service_role;
grant execute on function public.admin_set_school_status(uuid, public.school_status) to service_role;
grant execute on function public.admin_transfer_school_owner(uuid, text) to service_role;

comment on function private.set_school_owner(uuid, extensions.citext, uuid) is
  'Makes an email the school owner now (confirmed account) or by invite; replaces the current owner.';
comment on function private.admin_create_school(text, text, text, text) is
  'DriveRush staff: creates a school and sets its owner by email.';
comment on function private.admin_set_school_status(uuid, public.school_status) is
  'DriveRush staff: sets a school active, suspended or archived.';
comment on function private.admin_transfer_school_owner(uuid, text) is
  'DriveRush staff: makes another email the school owner. Returns added or invited.';
comment on function public.admin_create_school(text, text, text, text) is
  'DriveRush staff: creates a school and sets its owner by email.';
comment on function public.admin_set_school_status(uuid, public.school_status) is
  'DriveRush staff: sets a school active, suspended or archived.';
comment on function public.admin_transfer_school_owner(uuid, text) is
  'DriveRush staff: makes another email the school owner. Returns added or invited.';
