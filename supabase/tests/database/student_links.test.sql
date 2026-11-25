-- ===================================================
-- pgTAP: a school links a learner by email for a month
-- ===================================================
-- Matching on sign-up and confirmation, one active link at a time, the
-- learner choosing between schools, release, cancel, decline, move, expiry
-- and a suspended school. now() is fixed inside the transaction, so dates
-- compare exactly.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(35);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.link(p_email text, p_school text) returns public.school_student_links
  language sql as $$ select * from public.school_student_links
                     where email = p_email and school_id = pg_temp.w(p_school)::uuid
                     order by added_at desc, status limit 1 $$;
create function pg_temp.add(p_who text, p_branch text, p_email text) returns text
  language sql as $$ select tests.run_as(pg_temp.w(p_who),
                       format('select public.school_add_student(%L, %L)', pg_temp.w(p_branch), p_email)) $$;
create function pg_temp.tier(p_user uuid) returns text
  language sql as $$ select tests.value_as(p_user::text, 'select tier from public.my_entitlement()') $$;

-- ── Added before the learner has an account ────────────────────────────
select isnt(pg_temp.add('admin_a1', 'a1', 'Wanjiru@Example.test'), null, 'a branch admin adds an email with no account');
select is((pg_temp.link('wanjiru@example.test', 'school_a')).status, 'pending', 'the link waits (email matched case-insensitively)');
select is((pg_temp.link('wanjiru@example.test', 'school_a')).user_id, null, 'no account is attached yet');

create temp table wanjiru as select tests.make_persona('wanjiru', null, true, 'wanjiru@example.test') as id;
select is((pg_temp.link('wanjiru@example.test', 'school_a')).status, 'active', 'signing up with that email starts the link');
select is((pg_temp.link('wanjiru@example.test', 'school_a')).ends_at, now() + interval '1 month', 'the link runs one month from the match');
select is(pg_temp.tier((select id from wanjiru)), 'school', 'the learner''s tier is school');
select is(
  tests.value_as((select id::text from wanjiru), 'select school_slug from public.my_entitlement()'),
  (select slug from public.schools where id = pg_temp.w('school_a')::uuid),
  'and they wear the school''s livery');

-- ── Only a confirmed email matches ─────────────────────────────────────
select isnt(pg_temp.add('owner_a', 'a2', 'otieno@example.test'), null, 'the owner adds another email');
create temp table otieno as select tests.make_persona('otieno', null, false, 'otieno@example.test') as id;
select is((pg_temp.link('otieno@example.test', 'school_a')).user_id, null, 'an unconfirmed sign-up does not claim the link');
update auth.users set email_confirmed_at = now() where id = (select id from otieno);
select is((pg_temp.link('otieno@example.test', 'school_a')).status, 'active', 'confirming the email starts it');

-- ── An existing account starts at once ─────────────────────────────────
create temp table kamau as select tests.make_persona('kamau', null, true, 'kamau@example.test') as id;
select isnt(pg_temp.add('admin_a1', 'a1', 'kamau@example.test'), null, 'adding a confirmed learner');
select is((pg_temp.link('kamau@example.test', 'school_a')).status, 'active', 'starts the month at once');
select is(pg_temp.add('owner_a', 'a1', 'kamau@example.test'), (pg_temp.link('kamau@example.test', 'school_a')).id::text,
  'adding the same email again returns the same link');

-- ── Two schools before sign-up: the learner chooses ────────────────────
select isnt(pg_temp.add('owner_a', 'a1', 'njeri@example.test'), null, 'school A adds an email');
select isnt(pg_temp.add('owner_b', 'b1', 'njeri@example.test'), null, 'school B adds the same email');
create temp table njeri as select tests.make_persona('njeri', null, true, 'njeri@example.test') as id;
select is(
  (select count(*)::int from public.school_student_links where user_id = (select id from njeri) and status = 'pending'),
  2, 'with two schools waiting, neither starts');
select is(tests.value_as((select id::text from njeri), 'select pending_invites from public.my_entitlement()'), '2',
  'the learner sees two invites');
select is(pg_temp.tier((select id from njeri)), 'free', 'and is free until they choose');
select is(tests.run_as((select id::text from njeri),
  format('select public.learner_accept_school_link(%L)', (pg_temp.link('njeri@example.test', 'school_b')).id)), '',
  'the learner chooses school B');
select is((pg_temp.link('njeri@example.test', 'school_b')).status, 'active', 'B''s link is active');
select is((pg_temp.link('njeri@example.test', 'school_a')).status, 'pending', 'A''s stays pending');

-- ── A second school while linked: switching ends the first early ───────
select isnt(pg_temp.add('owner_b', 'b1', (select email from auth.users where id = pg_temp.w('learner_a1')::uuid)), null,
  'school B adds a learner who is linked to school A');
select is((select status::text from public.school_student_links where school_id = pg_temp.w('school_b')::uuid and user_id = pg_temp.w('learner_a1')::uuid),
  'pending', 'B''s link waits while A''s is current');
select is(tests.run_as(pg_temp.w('learner_a1'), format('select public.learner_accept_school_link(%L)',
  (select id from public.school_student_links where school_id = pg_temp.w('school_b')::uuid and user_id = pg_temp.w('learner_a1')::uuid))), '',
  'the learner switches to B');
select is((select end_reason::text from public.school_student_links where id = pg_temp.w('link_a1')::uuid), 'switched',
  'A''s link ended early, marked switched');

-- ── Decline, cancel, release, move ─────────────────────────────────────
select is(tests.run_as((select id::text from njeri),
  format('select public.learner_decline_school_link(%L)', (pg_temp.link('njeri@example.test', 'school_a')).id)), '',
  'the learner declines A''s invite');
select isnt(pg_temp.add('owner_a', 'a1', 'later@example.test'), null, 'the owner adds an email');
select is(tests.run_as(pg_temp.w('admin_a1'), format('select public.school_cancel_student_invite(%L)', (pg_temp.link('later@example.test', 'school_a')).id)), '',
  'the branch admin withdraws it before it starts');
select is(tests.run_as(pg_temp.w('owner_a'), format('select public.school_move_student_branch(%L, %L)', pg_temp.w('link_a2'), pg_temp.w('a1'))), '',
  'the owner moves a student to another branch');
select is(tests.run_as(pg_temp.w('owner_a'), format('select public.school_release_student(%L)', pg_temp.w('link_a2'))), '',
  'the owner releases a student');
select is(pg_temp.tier(pg_temp.w('learner_a2')::uuid), 'free', 'a released learner is free again');

-- ── Expiry: a month that has run out frees the learner ─────────────────
update public.school_student_links
   set starts_at = now() - interval '40 days', ends_at = now() - interval '10 days'
 where id = pg_temp.w('link_b')::uuid;
select is(pg_temp.tier(pg_temp.w('learner_b')::uuid), 'free', 'after its month the link no longer counts');
select isnt(pg_temp.add('owner_a', 'a1', (select email from auth.users where id = pg_temp.w('learner_b')::uuid)), null,
  'another school adds the learner');
select is((select end_reason::text from public.school_student_links where id = pg_temp.w('link_b')::uuid), 'expired',
  'the old link is closed as expired, and the new one starts');

-- ── A suspended school links nobody ────────────────────────────────────
update public.schools set status = 'suspended' where id = pg_temp.w('school_a')::uuid;
select is(pg_temp.tier((select id from wanjiru)), 'free', 'a suspended school''s learners lose the school tier');

select * from finish();
rollback;
