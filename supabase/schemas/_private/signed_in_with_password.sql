-- ===================================================
-- FUNCTION: private.signed_in_with_password
-- ===================================================
-- Whether the caller's session signed in with a password. A DriveRush su or
-- admin role counts only on such a session: an emailed one-time code or a
-- Google sign-in plays as a plain learner. Reads the token's `amr`, which
-- Supabase Auth keeps through a refresh. custom_access_token_hook applies the
-- same rule to the `user_role` claim.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.has_platform_role
create or replace function private.signed_in_with_password()
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
     where m ->> 'method' = 'password'
  );
$$;

revoke all on function private.signed_in_with_password() from public;
grant execute on function private.signed_in_with_password() to service_role;

comment on function private.signed_in_with_password() is
  'Whether the caller''s session signed in with a password. A DriveRush console role counts only on such a session.';
