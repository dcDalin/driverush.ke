-- ===================================================
-- pgTAP: what a newly created function, table or sequence gets by default
-- ===================================================
-- Supabase ships default privileges that give anon and authenticated
-- EXECUTE on every function and full access to every table and sequence
-- postgres creates in public, and Postgres itself gives EXECUTE on
-- functions to PUBLIC. Any of them silently exposes a new object through
-- the API. supabase/schemas/_grants/ removes them; this file proves it with
-- the catalog and with probes.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(13);

select is(
  (select defaclacl::text from pg_default_acl
    where defaclrole = 'postgres'::regrole and defaclnamespace = 0 and defaclobjtype = 'f'),
  '{postgres=X/postgres}',
  'functions postgres creates anywhere are executable by postgres only (no PUBLIC)'
);

select is(
  (select defaclacl::text from pg_default_acl
    where defaclrole = 'postgres'::regrole
      and defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'f'),
  '{postgres=X/postgres,service_role=X/postgres}',
  'functions postgres creates in public are executable by postgres and service_role only'
);

-- A probe created the way a migration creates any function.
create function public.__security_probe() returns integer language sql as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'public.__security_probe()', 'execute'),
  'a new function is not executable by anon'
);

select ok(
  not has_function_privilege('authenticated', 'public.__security_probe()', 'execute'),
  'a new function is not executable by a signed-in caller'
);

select ok(
  not exists (
    select 1
    from pg_proc as p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as a
    where p.oid = 'public.__security_probe()'::regprocedure and a.grantee = 0
  ),
  'a new function grants nothing to PUBLIC'
);

select ok(
  has_function_privilege('service_role', 'public.__security_probe()', 'execute'),
  'a new function is executable by the service role'
);

-- The same for a function created in schema private.
create function private.__security_probe() returns integer language sql as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'private.__security_probe()', 'execute')
    and not has_function_privilege('authenticated', 'private.__security_probe()', 'execute')
    and not exists (
      select 1
      from pg_proc as p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as a
      where p.oid = 'private.__security_probe()'::regprocedure and a.grantee = 0
    )
    and has_function_privilege('service_role', 'private.__security_probe()', 'execute'),
  'a new function in private is executable by the service role only'
);

select is(
  (select defaclacl::text from pg_default_acl
    where defaclrole = 'postgres'::regrole
      and defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'r'),
  '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}',
  'tables postgres creates in public are usable by postgres and service_role only'
);

select is(
  (select defaclacl::text from pg_default_acl
    where defaclrole = 'postgres'::regrole
      and defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'S'),
  '{postgres=rwU/postgres,service_role=rwU/postgres}',
  'sequences postgres creates in public are usable by postgres and service_role only'
);

-- Probes created the way a migration creates any table.
create table public.__security_probe_table (id bigserial primary key, note text);

select ok(
  not has_table_privilege('anon', 'public.__security_probe_table', 'SELECT')
    and not has_table_privilege('anon', 'public.__security_probe_table', 'INSERT'),
  'a new table is not readable or writable by anon'
);

select ok(
  not has_table_privilege('authenticated', 'public.__security_probe_table', 'SELECT')
    and not has_table_privilege('authenticated', 'public.__security_probe_table', 'INSERT'),
  'a new table is not readable or writable by a signed-in caller'
);

select ok(
  not has_sequence_privilege('authenticated', 'public.__security_probe_table_id_seq', 'USAGE'),
  'a new sequence is not usable by a signed-in caller'
);

select ok(
  has_table_privilege('service_role', 'public.__security_probe_table', 'INSERT'),
  'a new table is writable by the service role'
);

select * from finish();
rollback;
