-- ===================================================
-- pgTAP: who hears which realtime topic (owner, 2026-11-26)
-- ===================================================
-- A school's owner and admins hear school:<their id>, staff hear every
-- school and console, nobody else hears anything; changes broadcast only
-- which table changed.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(9);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;

-- Whether this person may read a message on this topic (the policy, as them).
create function pg_temp.hears(p_user text, p_topic text) returns text
language sql as $$
  select tests.value_as(p_user, format(
    $q$select count(*)::text from realtime.messages where topic = %L and event = 'probe'$q$, p_topic))
$$;

-- One message per topic, as realtime.send would leave it.
insert into realtime.messages (topic, extension, event, payload, private)
values
  ('school:' || pg_temp.w('school_a'), 'broadcast', 'probe', '{"table":"payments"}', true),
  ('school:' || pg_temp.w('school_b'), 'broadcast', 'probe', '{"table":"payments"}', true),
  ('console', 'broadcast', 'probe', '{"table":"payments"}', true),
  ('elsewhere', 'broadcast', 'probe', '{}', true);

select is(pg_temp.hears(pg_temp.w('owner_a'), 'school:' || pg_temp.w('school_a')), '1', 'an owner hears their school');
select is(pg_temp.hears(pg_temp.w('admin_a1'), 'school:' || pg_temp.w('school_a')), '1', 'an admin hears their school');
select is(pg_temp.hears(pg_temp.w('owner_a'), 'school:' || pg_temp.w('school_b')), '0', 'but not another school');
select is(pg_temp.hears(pg_temp.w('learner_a1'), 'school:' || pg_temp.w('school_a')), '0', 'a learner hears no school');
select is(pg_temp.hears(pg_temp.w('owner_a'), 'console'), '0', 'an owner does not hear the console');
select is(pg_temp.hears(pg_temp.w('staff'), 'console'), '1', 'staff hear the console');
select is(pg_temp.hears(pg_temp.w('staff'), 'school:' || pg_temp.w('school_b')), '1', 'and every school');
select is(pg_temp.hears(pg_temp.w('staff'), 'elsewhere'), '0', 'no one hears an unlisted topic');

-- A student added broadcasts on the school's topic, without the email.
select tests.run_as(pg_temp.w('owner_a'), format($$select public.school_add_student(%L, 'rt-learner@x.test')$$, pg_temp.w('a1')));
select is(
  (select count(*)::int from realtime.messages
    where topic = 'school:' || pg_temp.w('school_a')
      and payload ->> 'table' = 'school_student_links'
      and event = 'insert'
      and payload::text not like '%rt-learner%') >= 1,
  true, 'adding a student tells the school''s topic, with no email in it');

select * from finish();
rollback;
