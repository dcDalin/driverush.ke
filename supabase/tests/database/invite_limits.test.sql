-- ===================================================
-- pgTAP: invites lapse after 30 days; re-sends are limited (owner, 2026-11-26)
-- ===================================================
-- A waiting student invite or admin invite is sent at most 5 times, at
-- least 10 minutes apart; sending renews it for 30 days. A lapsed invite is
-- not taken up at sign-up, not joinable, not counted.
--
-- Everything runs in one rolled-back transaction. "Ten minutes later" is
-- written as moving last_sent_at back.
-- ===================================================
begin;

select plan(18);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.link(p_email text) returns public.school_student_links
  language sql as $$ select * from public.school_student_links
                      where email = p_email::extensions.citext and school_id = pg_temp.w('school_a')::uuid $$;
create function pg_temp.later(p_email text) returns void language sql as $$
  update public.school_student_links set last_sent_at = now() - interval '11 minutes'
   where email = p_email::extensions.citext;
  update public.school_member_invites set last_sent_at = now() - interval '11 minutes'
   where email = p_email::extensions.citext;
$$;

-- ── A student invite ───────────────────────────────────────────────────
select tests.run_as(pg_temp.w('owner_a'), format($$select public.school_add_student(%L, 'lapse@x.test')$$, pg_temp.w('a1')));
select is((pg_temp.link('lapse@x.test')).sent_count, 1::smallint, 'adding sends it once');
select is((pg_temp.link('lapse@x.test')).expires_at, now() + interval '30 days', 'and it lasts 30 days');

select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select * from public.school_resend_student_invite(%L)', (pg_temp.link('lapse@x.test')).id)),
  'P0001', 'sending again at once is refused (resend_too_soon)');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format($$select public.school_add_student(%L, 'lapse@x.test')$$, pg_temp.w('a1'))),
  'P0001', 'so is adding the same email again at once');

select pg_temp.later('lapse@x.test');
select is(tests.run_as(pg_temp.w('admin_a1'), format('select email from public.school_resend_student_invite(%L)', (pg_temp.link('lapse@x.test')).id)),
  'lapse@x.test', 'ten minutes later the branch admin sends it again');
select is((pg_temp.link('lapse@x.test')).sent_count, 2::smallint, 'counted');

select pg_temp.later('lapse@x.test');
select tests.run_as(pg_temp.w('owner_a'), format($$select public.school_add_student(%L, 'lapse@x.test')$$, pg_temp.w('a1')));
select is((pg_temp.link('lapse@x.test')).sent_count, 3::smallint, 'adding a waiting email again counts as a send');

update public.school_student_links set sent_count = 5, last_sent_at = now() - interval '1 day'
 where email = 'lapse@x.test';
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select * from public.school_resend_student_invite(%L)', (pg_temp.link('lapse@x.test')).id)),
  'P0001', 'a sixth send is refused (resend_limit)');

select is(tests.sqlstate_as(pg_temp.w('admin_a2'), format('select * from public.school_resend_student_invite(%L)', (pg_temp.link('lapse@x.test')).id)),
  '42501', 'an admin of another branch cannot send it');

-- ── A lapsed invite matches nothing ────────────────────────────────────
select tests.run_as(pg_temp.w('owner_a'), format($$select public.school_add_student(%L, 'gone@x.test')$$, pg_temp.w('a1')));
update public.school_student_links set expires_at = now() - interval '1 second' where email = 'gone@x.test';
create temp table gone as select tests.make_persona('gone', null, true, 'gone@x.test') as id;
select is((pg_temp.link('gone@x.test')).status, 'pending'::public.student_link_status, 'signing up with a lapsed invite starts nothing');
select is(tests.value_as((select id::text from gone), 'select pending_invites::text from public.my_entitlement()'),
  '0', 'and it is not offered to the learner');
select is(tests.sqlstate_as((select id::text from gone), format('select public.learner_accept_school_link(%L)', (pg_temp.link('gone@x.test')).id)),
  'P0001', 'nor can they join it (invite_expired)');

select pg_temp.later('gone@x.test');
select tests.run_as(pg_temp.w('owner_a'), format('select * from public.school_resend_student_invite(%L)', (pg_temp.link('gone@x.test')).id));
select is(tests.run_as((select id::text from gone), format('select public.learner_accept_school_link(%L)', (pg_temp.link('gone@x.test')).id)),
  '', 'sent again, it is renewed and they can join');

-- ── An admin invite ────────────────────────────────────────────────────
select is(tests.run_as(pg_temp.w('owner_a'), format($$select public.school_add_admin(%L, 'helper@x.test', array[%L]::uuid[])$$, pg_temp.w('school_a'), pg_temp.w('a1'))),
  'invited', 'the owner invites an admin');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format($$select public.school_add_admin(%L, 'helper@x.test', array[%L]::uuid[])$$, pg_temp.w('school_a'), pg_temp.w('a1'))),
  'P0001', 'asking again at once is refused (resend_too_soon)');
select pg_temp.later('helper@x.test');
select is(tests.run_as(pg_temp.w('owner_a'), format('select email from public.school_resend_member_invite(%L)', (select id from public.school_member_invites where email = 'helper@x.test'))),
  'helper@x.test', 'ten minutes later the owner sends it again');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select * from public.school_resend_member_invite(%L)', (select id from public.school_member_invites where email = 'helper@x.test'))),
  '42501', 'a branch admin cannot send member invites');
select is(tests.run_as(pg_temp.w('owner_a'), format($$select public.school_add_admin(%L, %L, array[%L]::uuid[])$$,
    pg_temp.w('school_a'), (select email from auth.users where id = pg_temp.w('admin_a1')::uuid), pg_temp.w('a2'))),
  'updated', 'changing an existing admin''s branches is an update: nothing to email');

select * from finish();
rollback;
