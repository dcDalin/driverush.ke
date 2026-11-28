-- ===================================================
-- pgTAP: who can execute which function
-- ===================================================
-- Compares the live grants on every function we own (schemas public and
-- private, extension functions excluded) with tests.function_access, the manifest
-- in 000_security_manifest.test.sql. A new function fails here until it
-- is classified there and granted in supabase/schemas/_grants/.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(18);

set local search_path = public, extensions;

create temp view ours as
select
  p.oid,
  case when n.nspname = 'public' then '' else n.nspname || '.' end
    || format('%s(%s)', p.proname, oidvectortypes(p.proargtypes)) as fn,
  n.nspname as schema,
  p.proname as name,
  p.prosrc as src,
  p.prosecdef as definer,
  p.prorettype = 'trigger'::regtype as is_trigger,
  coalesce(p.proconfig, '{}') as config,
  pg_get_userbyid(p.proowner) as owner,
  coalesce(p.proacl, acldefault('f', p.proowner)) as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where
  n.nspname in ('public', 'private')
  and p.prokind in ('f', 'p')
  and not exists (
    select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
  );

-- ── Every function is classified ────────────────────────────────────────
select is_empty(
  $$ select fn from ours except select fn from tests.function_access $$,
  'every function is classified in 000_security_manifest (add a row for each one listed)'
);

select is_empty(
  $$ select fn from tests.function_access except select fn from ours $$,
  'every manifest row names a function that exists'
);

select is_empty(
  $$ select o.fn from ours as o join tests.function_access as m using (fn)
      where (m.access = 'trigger') <> o.is_trigger $$,
  'trigger functions, and only they, are declared as trigger'
);

-- ── anon ────────────────────────────────────────────────────────────────
select is_empty(
  $$ select o.fn from ours as o join tests.function_access as m using (fn)
      where has_function_privilege('anon', o.oid, 'execute')
        and m.access <> 'anon' $$,
  'anon can execute nothing beyond the functions declared anon'
);

select is_empty(
  $$ select o.fn from ours as o join tests.function_access as m using (fn)
      where not has_function_privilege('anon', o.oid, 'execute')
        and m.access = 'anon' $$,
  'anon can execute every function declared anon'
);

-- ── authenticated ───────────────────────────────────────────────────────
select is_empty(
  $$ select o.fn from ours as o join tests.function_access as m using (fn)
      where has_function_privilege('authenticated', o.oid, 'execute')
        and m.access not in ('anon', 'authenticated') $$,
  'a signed-in caller can execute nothing beyond the functions declared anon or authenticated'
);

select is_empty(
  $$ select o.fn from ours as o join tests.function_access as m using (fn)
      where not has_function_privilege('authenticated', o.oid, 'execute')
        and m.access in ('anon', 'authenticated') $$,
  'a signed-in caller can execute every function declared anon or authenticated'
);

-- ── service_role and the auth hook ──────────────────────────────────────
select is_empty(
  $$ select fn from ours where not has_function_privilege('service_role', oid, 'execute') $$,
  'the service role can execute every function'
);

select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'Supabase Auth can run the access token hook'
);

select is_empty(
  $$ select o.fn from ours as o join tests.function_access as m using (fn)
      where has_function_privilege('supabase_auth_admin', o.oid, 'execute')
        and m.access <> 'auth_hook' $$,
  'Supabase Auth can execute nothing but the hook'
);

-- ── PUBLIC (every role, including ones created later) ───────────────────
select is_empty(
  $$ select fn from ours
      where exists (
        select 1 from aclexplode(acl) as a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ) $$,
  'no function grants EXECUTE to PUBLIC'
);

-- ── search_path and ownership ───────────────────────────────────────────
-- Supabase's linter (lint 0011, function_search_path_mutable, shown in
-- Studio's Security Advisor) flags any function without a pinned
-- search_path, and Supabase recommends the empty string: every reference
-- in the body is then schema-qualified and nothing resolves through the
-- caller's search_path.
select is_empty(
  $$ select fn || ' has ' || coalesce(array_to_string(config, ','), 'no search_path') from ours
      where not config @> array['search_path=""'] $$,
  'every function pins search_path to the empty string (Supabase lint 0011)'
);

select is_empty(
  $$ select fn from ours where owner <> 'postgres' $$,
  'every function is owned by postgres'
);

select ok(
  not has_schema_privilege('anon', 'public', 'CREATE')
    and not has_schema_privilege('authenticated', 'public', 'CREATE')
    and not has_schema_privilege('public', 'public', 'CREATE'),
  'no client role can create objects in public'
);

select is_empty(
  $$ select m.fn from tests.function_access as m join ours as o using (fn)
      where o.definer and m.access in ('anon', 'authenticated') and m.guard = 'none' $$,
  'every client-callable owner-rights function declares a guard'
);

-- ── Owner-rights functions stay out of the Data API ────────────────────
-- Supabase's linter (lints 0028 and 0029, in Studio's Security Advisor)
-- flags a SECURITY DEFINER function a client can execute in an exposed
-- schema: it is a /rest/v1/rpc route that runs with the owner's rights.
-- Those live in schema private, which the Data API does not expose, and
-- public holds a SECURITY INVOKER wrapper of the same name.
select is_empty(
  $$ select fn from ours
      where schema = 'public' and definer
        and (has_function_privilege('anon', oid, 'execute')
          or has_function_privilege('authenticated', oid, 'execute')) $$,
  'no owner-rights function in public is executable by anon or authenticated (Supabase lints 0028, 0029)'
);

select is_empty(
  $$ select pub.fn from ours as pub
      join ours as priv on priv.schema = 'private' and priv.name = pub.name
      where pub.schema = 'public'
        and (pub.definer or position('private.' || pub.name || '(' in pub.src) = 0) $$,
  'a public function with a private namesake is its caller-rights wrapper and calls it'
);

-- ── Documentation ───────────────────────────────────────────────────────
select is_empty(
  $$ select fn from ours where coalesce(obj_description(oid, 'pg_proc'), '') = '' $$,
  'every function has a comment (comment on function) describing it'
);

select * from finish();
rollback;
