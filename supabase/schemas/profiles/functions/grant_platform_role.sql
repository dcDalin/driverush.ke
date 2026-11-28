-- ===================================================
-- FUNCTIONS: granting and revoking DriveRush staff roles
-- ===================================================
-- Only a DriveRush su (on a password or Google session). The first su is granted by
-- SQL on the database itself.

-- Access:  authenticated (DriveRush su)
-- Guard:   su (private.is_su)
-- Callers: DriveRush console (session)
create or replace function private.grant_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_su() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role) values (p_user_id, p_role)
  on conflict do nothing;
end;
$$;

-- Access:  authenticated (DriveRush su)
-- Guard:   su (private.is_su)
-- Callers: DriveRush console (session)
create or replace function private.revoke_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_su() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role = 'user' then
    raise exception 'cannot_revoke_user' using errcode = 'P0001';
  end if;
  if p_role = 'driverush_su' and p_user_id = auth.uid() then
    raise exception 'cannot_revoke_own_su' using errcode = 'P0001';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = p_role;
end;
$$;

-- Access:  authenticated (DriveRush su)
-- Guard:   su (the private body checks private.is_su)
-- Callers: DriveRush console (session)
create or replace function public.grant_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.grant_platform_role(p_user_id, p_role);
$$;

-- Access:  authenticated (DriveRush su)
-- Guard:   su (the private body checks private.is_su)
-- Callers: DriveRush console (session)
create or replace function public.revoke_platform_role(p_user_id uuid, p_role public.app_role)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_platform_role(p_user_id, p_role);
$$;

revoke all on function private.grant_platform_role(uuid, public.app_role) from public;
revoke all on function private.revoke_platform_role(uuid, public.app_role) from public;
revoke all on function public.grant_platform_role(uuid, public.app_role) from public;
revoke all on function public.revoke_platform_role(uuid, public.app_role) from public;
grant execute on function private.grant_platform_role(uuid, public.app_role) to service_role;
grant execute on function private.revoke_platform_role(uuid, public.app_role) to service_role;
grant execute on function public.grant_platform_role(uuid, public.app_role) to service_role;
grant execute on function public.revoke_platform_role(uuid, public.app_role) to service_role;

comment on function private.grant_platform_role(uuid, public.app_role) is
  'DriveRush su: gives an account a platform role.';
comment on function private.revoke_platform_role(uuid, public.app_role) is
  'DriveRush su: takes a platform role away (never user, never your own su).';
comment on function public.grant_platform_role(uuid, public.app_role) is
  'DriveRush su: gives an account a platform role.';
comment on function public.revoke_platform_role(uuid, public.app_role) is
  'DriveRush su: takes a platform role away (never user, never your own su).';
