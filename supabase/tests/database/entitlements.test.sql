-- ===================================================
-- pgTAP: tiers, paused paid time, the token hook and school progress
-- ===================================================
-- A learner's own paid time pauses while a school link runs and comes back
-- when it ends early; the access token carries a console role only on a
-- password session; a school reads only its current learners' progress, an
-- admin only in their branches. now() is fixed inside the transaction, so
-- dates compare exactly.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(20);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.tier(p_user text) returns text
  language sql as $$ select tests.value_as(p_user, 'select tier from public.my_entitlement()') $$;
create function pg_temp.sub(p_user text) returns public.learner_subscriptions
  language sql as $$ select * from public.learner_subscriptions where user_id = p_user::uuid order by created_at limit 1 $$;

-- ── Paid time pauses during a school month ─────────────────────────────
insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at)
select pg_temp.w('learner_free')::uuid, p.id, now() - interval '5 days', now() + interval '25 days'
  from public.plans as p where p.code = 'learner_monthly';
select is(pg_temp.tier(pg_temp.w('learner_free')), 'paid', 'a learner with their own subscription is paid');

select isnt(tests.run_as(pg_temp.w('owner_a'), format('select public.school_add_student(%L, %L)',
  pg_temp.w('a1'), (select email from auth.users where id = pg_temp.w('learner_free')::uuid))), null,
  'a school links them');
select is(pg_temp.tier(pg_temp.w('learner_free')), 'school', 'the school tier wins');
select is((pg_temp.sub(pg_temp.w('learner_free'))).ends_at, now() + interval '1 month' + interval '25 days',
  'their paid time is pushed past the school month');
select is((pg_temp.sub(pg_temp.w('learner_free'))).starts_at, now() - interval '5 days',
  'a subscription already running keeps its start');

select is(tests.run_as(pg_temp.w('owner_a'), format('select public.school_release_student(%L)',
  (select id from public.school_student_links where user_id = pg_temp.w('learner_free')::uuid and status = 'active'))), '',
  'the school releases them the same moment');
select is((pg_temp.sub(pg_temp.w('learner_free'))).ends_at, now() + interval '25 days',
  'the unused school time is given back: paid time ends where it did');
select is(pg_temp.tier(pg_temp.w('learner_free')), 'paid', 'and they are paid again');

-- ── Paid time bought during a school month starts after it ─────────────
insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at)
select pg_temp.w('learner_a1')::uuid, p.id, now(), now() + interval '30 days'
  from public.plans as p where p.code = 'learner_monthly';
select is((pg_temp.sub(pg_temp.w('learner_a1'))).starts_at,
  (select ends_at from public.school_student_links where id = pg_temp.w('link_a1')::uuid),
  'a subscription bought during a school month starts when the month ends');
select is((pg_temp.sub(pg_temp.w('learner_a1'))).ends_at - (pg_temp.sub(pg_temp.w('learner_a1'))).starts_at, interval '30 days',
  'and keeps its full length');

-- ── Tiers ──────────────────────────────────────────────────────────────
select is(pg_temp.tier(pg_temp.w('learner_a2')), 'school', 'a linked learner is school');
select is(pg_temp.tier(pg_temp.w('owner_b')), 'free', 'an account with nothing is free');

-- ── The access token ───────────────────────────────────────────────────
select is(tests.claims_for(pg_temp.w('staff')::uuid) ->> 'user_role', 'driverush_admin',
  'a DriveRush admin''s password session carries their role');
select is(tests.claims_for(pg_temp.w('staff')::uuid, 'otp') ->> 'user_role', 'user',
  'an emailed-code session carries only user');
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
