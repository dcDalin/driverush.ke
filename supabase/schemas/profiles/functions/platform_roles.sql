-- ===================================================
-- FUNCTIONS: platform role checks
-- ===================================================
-- Read user_roles directly (not the token's user_role claim), so a revoked
-- role stops working at once, and only on a password session.

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.is_staff, private.is_su
create or replace function private.has_platform_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.signed_in_with_password()
     and exists (
       select 1 from public.user_roles as r
        where r.user_id = auth.uid() and r.role = any (p_roles)
     );
$$;

-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller's own roles)
-- Callers: RLS policies on every table; every admin_* and school_* function
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_platform_role(array['driverush_su', 'driverush_admin']::public.app_role[]);
$$;

-- Access:  authenticated (evaluated as the caller inside policies and functions)
-- Guard:   public (answers for the caller's own roles)
-- Callers: RLS policies (user_roles); grant_platform_role, revoke_platform_role
create or replace function private.is_su()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_platform_role(array['driverush_su']::public.app_role[]);
$$;

revoke all on function private.has_platform_role(public.app_role[]) from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_su() from public;
grant execute on function private.has_platform_role(public.app_role[]) to service_role;
grant execute on function private.is_staff() to service_role;
grant execute on function private.is_su() to service_role;

comment on function private.has_platform_role(public.app_role[]) is
  'Whether the caller holds one of these platform roles, on a password session.';
comment on function private.is_staff() is
  'Whether the caller is DriveRush su or admin (password session).';
comment on function private.is_su() is
  'Whether the caller is DriveRush su (password session).';
