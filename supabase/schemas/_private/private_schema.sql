-- ===================================================
-- SCHEMA: private
-- ===================================================
-- Every owner-rights (SECURITY DEFINER) function a client can reach lives
-- here. The Data API serves only the schemas in supabase/config.toml
-- [api] schemas, and private is not one of them, so nothing here has a
-- /rest/v1/rpc route. A client reaches a private function only through:
--
--   * the SECURITY INVOKER wrapper of the same name in public, which is
--     the function's Data API name and adds no rights of its own;
--   * a row level security policy that calls it (is_staff, can_see_branch).
--
-- Supabase's rule: a security definer function never lives in an exposed
-- schema (splinter lints 0028 and 0029). security_function_access enforces
-- it. Who may execute each function: supabase/schemas/_grants/function_privileges.sql.
create schema if not exists private;

comment on schema private is
  'Owner-rights functions clients reach only through public wrappers and policies. Not exposed by the Data API.';
