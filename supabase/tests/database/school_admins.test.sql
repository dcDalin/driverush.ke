-- ===================================================
-- pgTAP: school owners, admins and branches
-- ===================================================
-- One owner per school; at most 50 admins (pending invites count); admins
-- tied to branches of their own school; invites taken up on sign-up; staff
-- create schools and hand them to a new owner.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(21);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.add_admin(p_email text, p_branch text) returns text
  language sql as $$ select tests.run_as(pg_temp.w('owner_a'), format(
    'select public.school_add_admin(%L, %L, array[%L]::uuid[])', pg_temp.w('school_a'), p_email, pg_temp.w(p_branch))) $$;
create function pg_temp.admins() returns integer language sql as $$
  select (select count(*) from public.school_members where school_id = pg_temp.w('school_a')::uuid and role = 'admin')::int
       + (select count(*) from public.school_member_invites
           where school_id = pg_temp.w('school_a')::uuid and role = 'admin' and status = 'pending')::int $$;

-- ── Invites become memberships on sign-up ──────────────────────────────
select is(pg_temp.add_admin('mwangi@example.test', 'a2'), 'invited', 'an admin email with no account is invited');
create temp table mwangi as select tests.make_persona('mwangi', null, true, 'mwangi@example.test') as id;
select is(
  (select role::text from public.school_members where user_id = (select id from mwangi)), 'admin',
  'signing up makes them an admin');
select is(
  (select array_agg(mb.branch_id)::text from public.school_member_branches as mb
     join public.school_members as m on m.id = mb.member_id where m.user_id = (select id from mwangi)),
  format('{%s}', pg_temp.w('a2')),
  'tied to the branch they were invited to');
select is(tests.value_as((select id::text from mwangi),
  format('select count(*) from public.school_student_links where school_id = %L', pg_temp.w('school_a'))), '1',
  'and they see that branch''s student');

-- ── Admins only on their own school's branches ─────────────────────────
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_add_admin(%L, %L, array[%L]::uuid[])',
  pg_temp.w('school_a'), 'x@example.test', pg_temp.w('b1'))), 'P0001',
  'an admin cannot be tied to another school''s branch');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_add_admin(%L, %L, %L::uuid[])',
  pg_temp.w('school_a'), 'x@example.test', '{}')), 'P0001',
  'an admin needs at least one branch');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_add_admin(%L, %L, array[%L]::uuid[])',
  pg_temp.w('school_a'), (select email from auth.users where id = pg_temp.w('owner_a')::uuid), pg_temp.w('a1'))), 'P0001',
  'the owner cannot also be an admin');
select throws_ok(
  format('insert into public.school_member_branches (member_id, branch_id, school_id) values (%L, %L, %L)',
    pg_temp.w('member_a1'), pg_temp.w('b1'), pg_temp.w('school_a')),
  '23503', null, 'the database refuses a branch from another school (foreign key on the pair)');

-- ── A person can be an admin of several schools ────────────────────────
select is(tests.run_as(pg_temp.w('owner_b'), format('select public.school_add_admin(%L, %L, array[%L]::uuid[])',
  pg_temp.w('school_b'), (select email from auth.users where id = pg_temp.w('admin_a1')::uuid), pg_temp.w('b1'))), 'added',
  'school A''s admin is added to school B too');
select is(tests.value_as(pg_temp.w('admin_a1'), 'select count(distinct school_id) from public.school_members'), '2',
  'and sees both schools'' teams');

-- ── At most 50 admins, pending invites included ────────────────────────
select is(pg_temp.admins(), 3, 'school A starts with three admins');
select lives_ok(
  $$ select pg_temp.add_admin(format('filler%s@example.test', n), 'a1') from generate_series(1, 47) as n $$,
  'the owner fills the school to 50 admins (most of them invites)');
select is(pg_temp.admins(), 50, 'fifty admins');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_add_admin(%L, %L, array[%L]::uuid[])',
  pg_temp.w('school_a'), 'one-too-many@example.test', pg_temp.w('a1'))), 'P0001',
  'the 51st is refused (admin_limit)');
select is(tests.run_as(pg_temp.w('owner_a'), format('select public.school_remove_admin(%L)', pg_temp.w('member_a1'))), '',
  'removing an admin');
select is(pg_temp.add_admin('one-more@example.test', 'a1'), 'invited', 'makes room for another');

-- ── One owner per school ───────────────────────────────────────────────
select throws_ok(
  format('insert into public.school_members (school_id, user_id, role) values (%L, %L, %L)',
    pg_temp.w('school_a'), pg_temp.w('learner_free'), 'owner'),
  '23505', null, 'a second owner row is refused');

-- ── Staff create schools and set owners ────────────────────────────────
create temp table new_school as select tests.run_as(pg_temp.w('staff'),
  $$select public.admin_create_school('Fresh School', 'fresh-school', null, 'founder@example.test')$$)::uuid as id;
select is(
  (select role::text from public.school_member_invites where school_id = (select id from new_school) and status = 'pending'),
  'owner', 'a school created for an email with no account waits on an owner invite');
create temp table founder as select tests.make_persona('founder', null, true, 'founder@example.test') as id;
select ok(
  exists (select 1 from public.school_members where school_id = (select id from new_school)
           and user_id = (select id from founder) and role = 'owner'),
  'the founder''s sign-up makes them the owner');

select is(tests.run_as(pg_temp.w('staff'), format('select public.admin_transfer_school_owner(%L, %L)',
  pg_temp.w('school_b'), (select email from auth.users where id = pg_temp.w('learner_free')::uuid))), 'added',
  'staff hand school B to an existing account');
select is(
  (select user_id::text from public.school_members where school_id = pg_temp.w('school_b')::uuid and role = 'owner'),
  pg_temp.w('learner_free'), 'the new owner replaces the old one');

select * from finish();
rollback;
