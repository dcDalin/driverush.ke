-- ===================================================
-- pgTAP: who can read and write which table
-- ===================================================
-- Compares the live table privileges and row level security policies with
-- tests.table_access and tests.policy_access (000_security_manifest). A new
-- table, a widened grant or an unreviewed policy fails here until it is
-- declared there and granted in supabase/schemas/_grants/table_privileges.sql.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(14);

set local search_path = public, extensions;

-- The privileges a role holds on a table, as the manifest writes them:
-- 'SELECT', 'SELECT, UPDATE(a, b)', 'SELECT(a, b)' (named columns only),
-- or '' for none.
create function pg_temp.privileges_of(p_role text, p_table regclass)
returns text
language sql
stable
as $$
  with t as (
    select k from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as k
    where has_table_privilege(p_role, p_table, k)
  ),
  c as (
    select cp.privilege_type as k, string_agg(cp.column_name, ', ' order by cp.column_name) as cols
    from information_schema.column_privileges as cp
    where cp.grantee = p_role
      and cp.table_schema = 'public'
      and cp.table_name = (select relname from pg_class where oid = p_table)
      and cp.privilege_type in ('SELECT', 'INSERT', 'UPDATE')
      and not has_table_privilege(p_role, p_table, cp.privilege_type)
    group by cp.privilege_type
  )
  select coalesce(string_agg(x, ', ' order by ord), '')
  from (
    select k as x, array_position(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'], k) as ord from t
    union all
    select k || '(' || cols || ')', array_position(array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], k) from c
  ) as all_privs;
$$;

create temp view ours as
select c.oid::regclass as rel, c.relname as tbl, c.relkind, c.relrowsecurity, c.reloptions
from pg_class as c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm');

-- ── Every table and view is declared ────────────────────────────────────
select is_empty(
  $$ select tbl from ours except select tbl from tests.table_access $$,
  'every table and view is declared in 000_security_manifest (add a row for each one listed)'
);

select is_empty(
  $$ select tbl from tests.table_access except select tbl from ours $$,
  'every declared table exists'
);

-- ── Row level security is on everywhere ─────────────────────────────────
select is_empty(
  $$ select tbl from ours where relkind in ('r', 'p') and not relrowsecurity $$,
  'every table has row level security enabled'
);

select is_empty(
  $$ select tbl from ours
      where relkind = 'v'
        and not coalesce(reloptions @> array['security_invoker=true']
                         or reloptions @> array['security_invoker=on'], false) $$,
  'every view runs with the caller''s rights (security_invoker), so row level security applies'
);

select is_empty(
  $$ select tbl from ours where relkind = 'm' $$,
  'no materialized views: they have no row level security'
);

-- ── Privileges per role ─────────────────────────────────────────────────
select is_empty(
  $$ select o.tbl || ': anon has "' || pg_temp.privileges_of('anon', o.rel) || '", declared "' || m.anon || '"'
       from ours as o join tests.table_access as m using (tbl)
      where pg_temp.privileges_of('anon', o.rel) <> m.anon $$,
  'anon holds exactly the declared privileges on every table'
);

select is_empty(
  $$ select o.tbl || ': authenticated has "' || pg_temp.privileges_of('authenticated', o.rel) || '", declared "' || m.authenticated || '"'
       from ours as o join tests.table_access as m using (tbl)
      where pg_temp.privileges_of('authenticated', o.rel) <> m.authenticated $$,
  'a signed-in caller holds exactly the declared privileges on every table'
);

select is_empty(
  $$ select tbl from ours
      where not (has_table_privilege('service_role', rel, 'SELECT')
             and has_table_privilege('service_role', rel, 'INSERT')
             and has_table_privilege('service_role', rel, 'UPDATE')
             and has_table_privilege('service_role', rel, 'DELETE')) $$,
  'the service role can read and write every table'
);

select is_empty(
  $$ select o.tbl from ours as o, pg_class as c,
            aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) as a
      where c.oid = o.rel and a.grantee = 0 $$,
  'no table grants anything to PUBLIC'
);

select is_empty(
  $$ select c.relname from pg_class as c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
        and (has_sequence_privilege('anon', c.oid, 'USAGE')
          or has_sequence_privilege('authenticated', c.oid, 'USAGE')
          or has_sequence_privilege('anon', c.oid, 'SELECT')
          or has_sequence_privilege('authenticated', c.oid, 'SELECT')) $$,
  'no sequence is usable by a client'
);

-- ── Policies ────────────────────────────────────────────────────────────
select is_empty(
  $$ select tablename || ' / ' || policyname || ' (' || cmd || ' to ' ||
            array_to_string(array(select unnest(roles) order by 1), ',') || ')'
       from pg_policies where schemaname = 'public'
     except
     select tbl || ' / ' || policy || ' (' || cmd || ' to ' || roles || ')'
       from tests.policy_access $$,
  'every policy is declared in 000_security_manifest with its command and roles'
);

select is_empty(
  $$ select tbl || ' / ' || policy from tests.policy_access
     except
     select tablename || ' / ' || policyname from pg_policies where schemaname = 'public' $$,
  'every declared policy exists'
);

select is_empty(
  $$ select tablename || ' / ' || policyname from pg_policies
      where schemaname = 'public' and cmd = 'ALL'
        and not (coalesce(qual, '') = 'false' and coalesce(with_check, '') = 'false') $$,
  'the only ALL policies are the explicit "clients no access" ones (using false, with check false)'
);

select is_empty(
  $$ select tablename || ' / ' || policyname from pg_policies
      where schemaname = 'public' and 'public' = any (roles) $$,
  'no policy applies to PUBLIC; each names its roles'
);

select * from finish();
rollback;
