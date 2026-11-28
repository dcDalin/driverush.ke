-- ===================================================
-- pgTAP: tiers and passes, the token hook and school progress
-- ===================================================
-- A pass gives full access and a school link the school car, independently
-- (a link never moves a pass); the access token carries a console role only on a
-- password session; a school reads only its current learners' progress, an
-- admin only in their branches. now() is fixed inside the transaction, so
-- dates compare exactly.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(21);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.tier(p_user text) returns text
  language sql as $$ select tests.value_as(p_user, 'select tier from public.my_entitlement()') $$;
create function pg_temp.access(p_user text) returns text
  language sql as $$ select tests.value_as(p_user, 'select full_access from public.my_entitlement()') $$;
create function pg_temp.sub(p_user text) returns public.learner_subscriptions
  language sql as $$ select * from public.learner_subscriptions where user_id = p_user::uuid order by created_at limit 1 $$;

-- ── Passes and school links (owner, 2026-11-25) ────────────────────────
-- A pass unlocks; a school link is the school car and the school's view.
-- A link never moves a pass.
insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at, source)
select pg_temp.w('learner_free')::uuid, p.id, now() - interval '5 days', now() + interval '55 days', 'grant'
  from public.plans as p where p.code = 'learner_pass';
select is(pg_temp.tier(pg_temp.w('learner_free')), 'paid', 'a learner with a pass and no school is paid');
select is(pg_temp.access(pg_temp.w('learner_free')), 'true', 'and has full access');

select isnt(tests.run_as(pg_temp.w('owner_a'), format('select public.school_add_student(%L, %L)',
  pg_temp.w('a1'), (select email from auth.users where id = pg_temp.w('learner_free')::uuid))), null,
  'a school links them');
select is(pg_temp.tier(pg_temp.w('learner_free')), 'school', 'the school car wins');
select is(pg_temp.access(pg_temp.w('learner_free')), 'true', 'their own pass still opens everything');
select is((pg_temp.sub(pg_temp.w('learner_free'))).ends_at, now() + interval '55 days',
  'the link does not move the pass');

select is(tests.run_as(pg_temp.w('owner_a'), format('select public.school_release_student(%L)',
  (select id from public.school_student_links where user_id = pg_temp.w('learner_free')::uuid and status = 'active'))), '',
  'the school releases them');
select is(pg_temp.tier(pg_temp.w('learner_free')), 'paid', 'and they are paid again');

select is(pg_temp.tier(pg_temp.w('learner_a1')), 'school', 'a linked learner without a pass has the school car');
select is(pg_temp.access(pg_temp.w('learner_a1')), 'false', 'but not full access: the link is free, the pass unlocks');

-- ── Tiers ──────────────────────────────────────────────────────────────
select is(pg_temp.tier(pg_temp.w('learner_a2')), 'school', 'a linked learner is school');
select is(pg_temp.tier(pg_temp.w('owner_b')), 'free', 'an account with nothing is free');

-- ── The access token ───────────────────────────────────────────────────
select is(tests.claims_for(pg_temp.w('staff')::uuid) ->> 'user_role', 'driverush_admin',
  'a DriveRush admin''s password session carries their role');
select is(tests.claims_for(pg_temp.w('staff')::uuid, 'otp') ->> 'user_role', 'user',
  'an emailed-code session carries only user');
select is(tests.claims_for(pg_temp.w('staff')::uuid, 'oauth') ->> 'user_role', 'driverush_admin',
  'a DriveRush admin''s Google session carries their role');
select is(tests.claims_for(pg_temp.w('su')::uuid) ->> 'user_role', 'driverush_su',
  'a su''s password session carries su');
select is(tests.value_as('otp:' || pg_temp.w('su'), 'select private.is_staff()'), 'false',
  'the database itself ignores console roles on an emailed-code session');

-- ── School progress, by branch ─────────────────────────────────────────
select is(tests.value_as(pg_temp.w('owner_a'), format('select count(*) from public.school_student_progress(%L)', pg_temp.w('school_a'))), '2',
  'the owner sees every current learner''s progress');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select string_agg(progress ->> ''streak'', '','') from public.school_student_progress(%L)', pg_temp.w('school_a'))),
  '{"who": "learner_a1"}', 'a branch admin sees only their branch''s learner');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select count(*) from public.school_student_progress(%L, %L)', pg_temp.w('school_a'), pg_temp.w('a2'))), '0',
  'asking for another branch returns nothing');

update public.school_student_links
   set starts_at = now() - interval '40 days', ends_at = now() - interval '10 days'
 where id = pg_temp.w('link_a2')::uuid;
select is(tests.value_as(pg_temp.w('owner_a'), format('select count(*) from public.school_student_progress(%L)', pg_temp.w('school_a'))), '1',
  'once a link''s month is over, the school no longer sees that learner');

select * from finish();
rollback;
