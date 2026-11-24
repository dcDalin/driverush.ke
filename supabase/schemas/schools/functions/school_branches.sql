-- ===================================================
-- FUNCTIONS: a school owner manages branches
-- ===================================================

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_create_branch(p_school_id uuid, p_name text, p_town text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.school_branches (school_id, name, town)
  values (p_school_id, btrim(p_name), nullif(btrim(p_town), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_update_branch(
  p_branch_id uuid,
  p_name text,
  p_town text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id from public.school_branches where id = p_branch_id;
  if v_school_id is null or not private.can_manage_school(v_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.school_branches
     set name = btrim(p_name), town = nullif(btrim(p_town), ''), is_active = p_is_active
   where id = p_branch_id;
end;
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_create_branch(p_school_id uuid, p_name text, p_town text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.school_create_branch(p_school_id, p_name, p_town);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_update_branch(
  p_branch_id uuid,
  p_name text,
  p_town text,
  p_is_active boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_update_branch(p_branch_id, p_name, p_town, p_is_active);
$$;

revoke all on function private.school_create_branch(uuid, text, text) from public;
revoke all on function private.school_update_branch(uuid, text, text, boolean) from public;
revoke all on function public.school_create_branch(uuid, text, text) from public;
revoke all on function public.school_update_branch(uuid, text, text, boolean) from public;
grant execute on function private.school_create_branch(uuid, text, text) to service_role;
grant execute on function private.school_update_branch(uuid, text, text, boolean) to service_role;
grant execute on function public.school_create_branch(uuid, text, text) to service_role;
grant execute on function public.school_update_branch(uuid, text, text, boolean) to service_role;

comment on function private.school_create_branch(uuid, text, text) is
  'School owner or staff: adds a branch.';
comment on function private.school_update_branch(uuid, text, text, boolean) is
  'School owner or staff: renames, moves or closes a branch.';
comment on function public.school_create_branch(uuid, text, text) is
  'School owner or staff: adds a branch.';
comment on function public.school_update_branch(uuid, text, text, boolean) is
  'School owner or staff: renames, moves or closes a branch.';
