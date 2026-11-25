-- ===================================================
-- pgTAP: who sees which rows (row level security, with real data)
-- ===================================================
-- Reads and writes on every client-visible table as each persona of
-- tests.make_world: DriveRush su and admin, school A's owner and its two
-- branch admins, school B's owner, learners linked to A (two branches) and B,
-- a learner with no school, and anon. Counts are limited to the world's own
-- rows so the demo seed does not change them.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(41);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.schools() returns text language sql as
  $$ select format('(%L, %L)', j ->> 'school_a', j ->> 'school_b') from w $$;

-- ── schools ────────────────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('staff'), 'select count(*) from public.schools where id in ' || pg_temp.schools()), '2',
  'schools: DriveRush admin sees both');
select is(tests.value_as(pg_temp.w('admin_a1'), 'select count(*) from public.schools where id in ' || pg_temp.schools()), '1',
  'schools: a school admin sees their own school only');
select is(tests.value_as(pg_temp.w('learner_a1'), 'select count(*) from public.schools where id in ' || pg_temp.schools()), '1',
  'schools: a linked learner sees their school');
select is(tests.value_as(pg_temp.w('learner_free'), 'select count(*) from public.schools where id in ' || pg_temp.schools()), '0',
  'schools: a learner with no school sees none');
select is(tests.sqlstate_as('anon', 'select count(*) from public.schools'), '42501',
  'schools: anon cannot read');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('update public.schools set name = %L where id = %L', 'Hacked', pg_temp.w('school_a'))), '42501',
  'schools: an owner cannot write directly');

-- ── school_branches ────────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('admin_a1'), format('select count(*) from public.school_branches where school_id = %L', pg_temp.w('school_a'))), '2',
  'school_branches: a branch admin sees every branch of their school');
select is(tests.value_as(pg_temp.w('owner_b'), format('select count(*) from public.school_branches where school_id = %L', pg_temp.w('school_a'))), '0',
  'school_branches: another school''s owner sees none');

-- ── school_members and invites ─────────────────────────────────────────
select is(tests.value_as(pg_temp.w('admin_a2'), format('select count(*) from public.school_members where school_id = %L', pg_temp.w('school_a'))), '3',
  'school_members: an admin sees their school''s owner and admins');
select is(tests.value_as(pg_temp.w('learner_a1'), format('select count(*) from public.school_members where school_id = %L', pg_temp.w('school_a'))), '0',
  'school_members: a learner sees none');
select is(tests.value_as(pg_temp.w('owner_b'), format('select count(*) from public.school_member_branches where school_id = %L', pg_temp.w('school_a'))), '0',
  'school_member_branches: another school''s owner sees none');

select is(tests.run_as(pg_temp.w('owner_a'),
  format('select public.school_add_admin(%L, %L, array[%L]::uuid[])', pg_temp.w('school_a'), 'invitee@matrix.test', pg_temp.w('a1'))), 'invited',
  'an admin added by an email with no account is invited');
select is(tests.value_as(pg_temp.w('owner_a'), format('select count(*) from public.school_member_invites where school_id = %L', pg_temp.w('school_a'))), '1',
  'school_member_invites: the owner sees the pending invite');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select count(*) from public.school_member_invites where school_id = %L', pg_temp.w('school_a'))), '0',
  'school_member_invites: an admin does not');

-- ── school_student_links ───────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('owner_a'), format('select count(*) from public.school_student_links where school_id = %L', pg_temp.w('school_a'))), '2',
  'links: the owner sees every branch''s students');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select count(*) from public.school_student_links where school_id = %L', pg_temp.w('school_a'))), '1',
  'links: a branch admin sees only their branch''s students');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select user_id::text from public.school_student_links where school_id = %L', pg_temp.w('school_a'))), pg_temp.w('learner_a1'),
  'links: ...and it is the learner in their branch');
select is(tests.value_as(pg_temp.w('owner_b'), format('select count(*) from public.school_student_links where school_id = %L', pg_temp.w('school_a'))), '0',
  'links: another school''s owner sees none');
select is(tests.value_as(pg_temp.w('learner_a1'), 'select count(*) from public.school_student_links'), '1',
  'links: a learner sees only their own');
select is(tests.value_as(pg_temp.w('staff'), format('select count(*) from public.school_student_links where school_id in %s', pg_temp.schools())), '3',
  'links: DriveRush admin sees all');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format(
  'insert into public.school_student_links (school_id, branch_id, email) values (%L, %L, %L)', pg_temp.w('school_a'), pg_temp.w('a1'), 'x@y.test')), '42501',
  'links: nobody inserts directly');

-- ── profiles ───────────────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('learner_a1'), 'select count(*) from public.profiles'), '1',
  'profiles: a learner sees only their own');
select is(tests.value_as(pg_temp.w('owner_a'), format('select count(*) from public.profiles where id = %L', pg_temp.w('learner_a1'))), '0',
  'profiles: a school sees learners only through school_student_progress');
select is(tests.value_as(pg_temp.w('learner_a1'), $$with u as (update public.profiles set full_name = 'New Name' returning 1) select count(*) from u$$), '1',
  'profiles: a learner renames themselves');
select is(tests.sqlstate_as(pg_temp.w('learner_a1'), $$update public.profiles set email = 'x@y.test'$$), '42501',
  'profiles: a learner cannot change their email row directly');

-- ── user_roles ─────────────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('learner_a1'), 'select count(*) from public.user_roles'), '1',
  'user_roles: a learner sees their own role');
select is(tests.value_as(pg_temp.w('su'), format('select count(*) from public.user_roles where user_id = %L', pg_temp.w('learner_a1'))), '1',
  'user_roles: a su sees everyone''s');
select is(tests.value_as('otp:' || pg_temp.w('su'), format('select count(*) from public.user_roles where user_id = %L', pg_temp.w('learner_a1'))), '0',
  'user_roles: ...but not on an emailed-code session');
select is(tests.sqlstate_as(pg_temp.w('learner_a1'), format('insert into public.user_roles (user_id, role) values (%L, %L)', pg_temp.w('learner_a1'), 'driverush_su')), '42501',
  'user_roles: nobody grants themselves a role');

-- ── learner_progress ───────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('learner_a1'), 'select count(*) from public.learner_progress'), '1',
  'progress: a learner reads only their own rows');
select is(tests.value_as(pg_temp.w('owner_a'), 'select count(*) from public.learner_progress'), '0',
  'progress: a school cannot read the table directly');
select is(tests.sqlstate_as(pg_temp.w('learner_a1'), $$insert into public.learner_progress (store, data) values ('board', '{"levels": 3}')$$), 'ok',
  'progress: a learner saves a store');
select is(tests.sqlstate_as(pg_temp.w('learner_a1'), format($$insert into public.learner_progress (user_id, store, data) values (%L, 'board', '{}')$$, pg_temp.w('learner_a2'))), '42501',
  'progress: a learner cannot write someone else''s row');
select is(tests.value_as(pg_temp.w('learner_a1'), format($$with u as (update public.learner_progress set data = '{}' where user_id = %L returning 1) select count(*) from u$$, pg_temp.w('learner_a2'))), '0',
  'progress: a learner''s update never reaches someone else''s row');

select is(tests.sqlstate_as(pg_temp.w('learner_a1'), format('update public.learner_progress set user_id = %L', pg_temp.w('learner_a2'))), '42501',
  'progress: a learner cannot hand their rows to someone else');

-- ── billing ────────────────────────────────────────────────────────────
select is(tests.value_as('anon', 'select string_agg(code, '','' order by code) from public.plans'), 'learner_extension,learner_pass,school_pass',
  'plans: anon sees only the active plans (the three passes)');
select is(tests.value_as(pg_temp.w('staff'), $$select count(*) from public.plans where code in ('learner_monthly', 'school_standard')$$), '2',
  'plans: staff see the inactive ones too');

insert into public.school_payment_settings (school_id, code, paystack_subaccount_code, bank_label)
values (pg_temp.w('school_a')::uuid, 'RLSA', 'ACCT_rls_a', 'Bank ••0001');
select is(tests.value_as(pg_temp.w('owner_a'), 'select count(*) from public.school_payment_settings'), '1',
  'school_payment_settings: the owner reads their school''s');
select is(tests.value_as(pg_temp.w('admin_a1'), 'select count(*) from public.school_payment_settings'), '0',
  'school_payment_settings: a branch admin does not (school_pass_info gives them the code)');
select is(tests.value_as(pg_temp.w('owner_b'), 'select count(*) from public.school_payment_settings'), '0',
  'school_payment_settings: another school''s owner does not');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format($$update public.school_payment_settings set price_kes = 999 where school_id = %L$$, pg_temp.w('school_a'))), '42501',
  'school_payment_settings: not even the owner writes it directly');

select * from finish();
rollback;
