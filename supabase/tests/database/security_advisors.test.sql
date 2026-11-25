-- ===================================================
-- pgTAP: what Supabase's Security and Performance advisors check
-- ===================================================
-- The dashboard's advisors (splinter lints) flag these; `supabase db
-- advisors` runs them too. This file holds the schema to them, so a change
-- that would bring a warning back fails here first:
--
--   unindexed_foreign_keys        every foreign key has a covering index
--   rls_enabled_no_policy         every table with row level security has a policy
--   multiple_permissive_policies  one permissive policy per table, role and command
--   auth_rls_initplan             policies call auth.uid() / auth.jwt() once per
--                                 query (wrapped in a SELECT), not once per row
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(5);

-- ── unindexed_foreign_keys ─────────────────────────────────────────────
-- An index covers a foreign key when its leading columns are the key's
-- columns (in any order).
select is_empty(
  $$ select c.conrelid::regclass || ' / ' || c.conname
       from pg_constraint as c
      where c.contype = 'f'
        and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1
            from pg_index as i
           where i.indrelid = c.conrelid
             and (select array_agg(k order by k)
                    from unnest((string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)]) as k)
               = (select array_agg(k order by k) from unnest(c.conkey) as k)
        ) $$,
  'every foreign key has a covering index (advisor: unindexed_foreign_keys)'
);

-- ── rls_enabled_no_policy ──────────────────────────────────────────────
select is_empty(
  $$ select c.relname
       from pg_class as c
      where c.relnamespace = 'public'::regnamespace
        and c.relkind in ('r', 'p')
        and c.relrowsecurity
        and not exists (
          select 1 from pg_policies as p
           where p.schemaname = 'public' and p.tablename = c.relname
        ) $$,
  'every table with row level security has at least one policy (advisor: rls_enabled_no_policy)'
);

-- ── multiple_permissive_policies ───────────────────────────────────────
-- An ALL policy counts for each command it covers.
select is_empty(
  $$ select pol.tablename || ' / ' || r.role || ' / ' || c.cmd
       from pg_policies as pol
      cross join lateral unnest(pol.roles) as r(role)
      cross join lateral unnest(
        case when pol.cmd = 'ALL'
             then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
             else array[pol.cmd]
        end
      ) as c(cmd)
      where pol.schemaname = 'public' and pol.permissive = 'PERMISSIVE'
      group by pol.tablename, r.role, c.cmd
     having count(*) > 1 $$,
  'one permissive policy per table, role and command (advisor: multiple_permissive_policies)'
);

-- ── auth_rls_initplan ──────────────────────────────────────────────────
-- Postgres prints a wrapped call as `( SELECT auth.uid() AS uid)`. Every
-- auth.uid(), auth.jwt() or auth.role() in a policy must be one of those.
select is_empty(
  $$ select tablename || ' / ' || policyname
       from pg_policies,
            lateral (select coalesce(qual, '') || ' ' || coalesce(with_check, '') as body) as b
      where schemaname = 'public'
        and (select count(*) from regexp_matches(b.body, 'auth\.(uid|jwt|role)\(\)', 'g'))
          <> (select count(*) from regexp_matches(b.body, 'SELECT auth\.(uid|jwt|role)\(\)', 'g')) $$,
  'policies wrap auth.uid() / auth.jwt() in a SELECT (advisor: auth_rls_initplan)'
);

-- Same for the caller's role in a policy: current_setting() per row.
select is_empty(
  $$ select tablename || ' / ' || policyname
       from pg_policies
      where schemaname = 'public'
        and coalesce(qual, '') || coalesce(with_check, '') ~ 'current_setting\(' $$,
  'no policy reads current_setting() per row (advisor: auth_rls_initplan)'
);

select * from finish();
rollback;
