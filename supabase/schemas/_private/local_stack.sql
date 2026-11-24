-- ===================================================
-- FUNCTION: private.is_local_stack
-- ===================================================
-- Whether this database is a Supabase CLI stack (local or CI). Their JWT
-- secret is the CLI's published default, which a hosted project never has,
-- and an unset secret reads as hosted, so it fails closed. The demo seed asks
-- it, so a production database never gets demo schools or learners, even
-- from `supabase db push --include-seed`.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: the local seed (supabase/seeds/local_demo.sql)
create or replace function private.is_local_stack()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.settings.jwt_secret', true), '')
       = 'super-secret-jwt-token-with-at-least-32-characters-long';
$$;

revoke all on function private.is_local_stack() from public;
grant execute on function private.is_local_stack() to service_role;

comment on function private.is_local_stack() is
  'Whether this is a Supabase CLI stack (local, CI): its JWT secret is the CLI default. Unset reads as hosted.';
