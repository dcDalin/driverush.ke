-- ===================================================
-- FUNCTION: private.signed_in_for_staff
-- ===================================================
-- Whether the caller's session signed in a way a DriveRush su or admin role
-- counts on: a password, or Google (owner, 2026-11-28: Google proves the
-- account at least as well as a password). An emailed one-time code, which
-- is also what a password reset signs in with, plays as a plain learner.
-- Reads the token's `amr`, which Supabase Auth keeps through a refresh;
-- `oauth` is any OAuth provider, and Google is the only one turned on
-- (config.toml). custom_access_token_hook applies the same rule to the
-- `user_role` claim.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.has_platform_role
create or replace function private.signed_in_for_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from jsonb_array_elements(
             case when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
                  then auth.jwt() -> 'amr'
                  else '[]'::jsonb
             end
           ) as m
     where m ->> 'method' in ('password', 'oauth')
  );
$$;

revoke all on function private.signed_in_for_staff() from public;
grant execute on function private.signed_in_for_staff() to service_role;

comment on function private.signed_in_for_staff() is
  'Whether the caller''s session signed in with a password or Google. A DriveRush console role counts only on such a session.';
