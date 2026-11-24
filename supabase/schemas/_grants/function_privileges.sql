-- ===================================================
-- GRANTS: who may execute our functions
-- ===================================================
-- The only place that grants EXECUTE to anon or authenticated. Every other
-- /schemas file grants to service_role at most. The declared intent, with a
-- guard and callers per function, is tests.function_access in
-- supabase/tests/database/000_security_manifest.test.sql; the security_*
-- pgTAP files fail when this file and the manifest disagree.
--
-- An owner-rights (SECURITY DEFINER) function a client can reach lives in
-- schema private, which the Data API does not expose; its Data API name is a
-- SECURITY INVOKER wrapper of the same name in public. The wrapper runs with
-- the caller's rights, so a caller needs EXECUTE on both.
--
-- Listed last in supabase/config.toml schema_paths (with table_privileges.sql)
-- and copied verbatim into a migration whenever it changes.

-- ── 1. Nothing is executable by clients by default ──────────────────────
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema private
  grant execute on functions to service_role;

-- ── 2. Start from nothing ───────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

-- A signed-in client resolves a private function only through a public
-- wrapper or a policy; USAGE lets those calls reach the schema. The Data API
-- does not expose private, so USAGE alone reaches nothing.
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ── 3. Row level security helpers (policies run as the caller) ──────────
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_su() to authenticated;
grant execute on function private.is_school_owner(uuid) to authenticated;
grant execute on function private.is_school_member(uuid) to authenticated;
grant execute on function private.can_see_branch(uuid) to authenticated;
grant execute on function private.has_school_link(uuid) to authenticated;

-- ── 4. Learners, with their own session ─────────────────────────────────
grant execute on function public.my_entitlement() to authenticated;
grant execute on function private.my_entitlement() to authenticated;
grant execute on function public.learner_accept_school_link(uuid) to authenticated;
grant execute on function private.learner_accept_school_link(uuid) to authenticated;
grant execute on function public.learner_decline_school_link(uuid) to authenticated;
grant execute on function private.learner_decline_school_link(uuid) to authenticated;

-- ── 5. School owners and admins (each checks the caller's school role) ──
grant execute on function public.school_create_branch(uuid, text, text) to authenticated;
grant execute on function private.school_create_branch(uuid, text, text) to authenticated;
grant execute on function public.school_update_branch(uuid, text, text, boolean) to authenticated;
grant execute on function private.school_update_branch(uuid, text, text, boolean) to authenticated;
grant execute on function public.school_add_admin(uuid, text, uuid[]) to authenticated;
grant execute on function private.school_add_admin(uuid, text, uuid[]) to authenticated;
grant execute on function public.school_set_admin_branches(uuid, uuid[]) to authenticated;
grant execute on function private.school_set_admin_branches(uuid, uuid[]) to authenticated;
grant execute on function public.school_remove_admin(uuid) to authenticated;
grant execute on function private.school_remove_admin(uuid) to authenticated;
grant execute on function public.school_cancel_member_invite(uuid) to authenticated;
grant execute on function private.school_cancel_member_invite(uuid) to authenticated;
grant execute on function public.school_add_student(uuid, text) to authenticated;
grant execute on function private.school_add_student(uuid, text) to authenticated;
grant execute on function public.school_release_student(uuid) to authenticated;
grant execute on function private.school_release_student(uuid) to authenticated;
grant execute on function public.school_cancel_student_invite(uuid) to authenticated;
grant execute on function private.school_cancel_student_invite(uuid) to authenticated;
grant execute on function public.school_move_student_branch(uuid, uuid) to authenticated;
grant execute on function private.school_move_student_branch(uuid, uuid) to authenticated;
grant execute on function public.school_student_progress(uuid, uuid) to authenticated;
grant execute on function private.school_student_progress(uuid, uuid) to authenticated;

-- ── 6. DriveRush console (each checks is_staff or is_su) ────────────────
grant execute on function public.admin_create_school(text, text, text, text) to authenticated;
grant execute on function private.admin_create_school(text, text, text, text) to authenticated;
grant execute on function public.admin_set_school_status(uuid, public.school_status) to authenticated;
grant execute on function private.admin_set_school_status(uuid, public.school_status) to authenticated;
grant execute on function public.admin_transfer_school_owner(uuid, text) to authenticated;
grant execute on function private.admin_transfer_school_owner(uuid, text) to authenticated;
grant execute on function public.grant_platform_role(uuid, public.app_role) to authenticated;
grant execute on function private.grant_platform_role(uuid, public.app_role) to authenticated;
grant execute on function public.revoke_platform_role(uuid, public.app_role) to authenticated;
grant execute on function private.revoke_platform_role(uuid, public.app_role) to authenticated;

-- ── 7. Supabase Auth ────────────────────────────────────────────────────
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
