-- ===================================================
-- ACCESS: public.user_roles
-- ===================================================
-- Reads:  Each account reads its own roles; a DriveRush su reads all.
-- Writes: No client: sign-up adds `user`, grant_platform_role and
--         revoke_platform_role (su) change the rest.
-- Grants: anon: none; authenticated: SELECT
--         (supabase/schemas/_grants/table_privileges.sql)
alter table public.user_roles enable row level security;

create policy "user_roles: read own or su"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_su()));
