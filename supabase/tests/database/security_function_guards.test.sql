-- ===================================================
-- pgTAP: every client-callable function refuses the wrong caller
-- ===================================================
-- Each guarded function is called by someone it must refuse (SQLSTATE 42501)
-- and by someone it must serve. The last test fails when a guarded function
-- in the manifest has no refusal probe here.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(37);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;

-- Which public functions this file probes for a refusal.
create temp table probed (fn text primary key);
insert into probed values
  ('admin_create_school'), ('admin_set_school_status'), ('admin_transfer_school_owner'),
  ('grant_platform_role'), ('revoke_platform_role'),
  ('school_create_branch'), ('school_update_branch'), ('school_add_admin'),
  ('school_set_admin_branches'), ('school_remove_admin'), ('school_cancel_member_invite'),
  ('school_add_student'), ('school_release_student'), ('school_cancel_student_invite'),
  ('school_move_student_branch'), ('school_student_progress'),
  ('learner_accept_school_link'), ('learner_decline_school_link'), ('my_entitlement');

-- ── anon can call nothing ──────────────────────────────────────────────
select is(tests.sqlstate_as('anon', 'select public.my_entitlement()'), '42501',
  'anon cannot ask for an entitlement');
select is(tests.sqlstate_as('anon', format('select public.school_add_student(%L, %L)', pg_temp.w('a1'), 'x@y.test')), '42501',
  'anon cannot add a student');
select is(tests.sqlstate_as('anon', $$select public.admin_create_school('New School', 'new-school', null, 'o@x.test')$$), '42501',
  'anon cannot create a school');

-- ── DriveRush console ──────────────────────────────────────────────────
select is(tests.sqlstate_as(pg_temp.w('learner_free'), $$select public.admin_create_school('New School', 'new-school', null, 'o@x.test')$$), '42501',
  'a learner cannot create a school');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), $$select public.admin_create_school('New School', 'new-school', null, 'o@x.test')$$), '42501',
  'a school owner cannot create a school');
select is(tests.sqlstate_as('otp:' || pg_temp.w('staff'), $$select public.admin_create_school('New School', 'new-school', null, 'o@x.test')$$), '42501',
  'DriveRush admin on an emailed-code session cannot create a school');
select is(tests.sqlstate_as(pg_temp.w('staff'), $$select public.admin_create_school('New School', 'new-school', null, 'o@x.test')$$), 'ok',
  'DriveRush admin on a password session creates a school');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.admin_set_school_status(%L, %L)', pg_temp.w('school_a'), 'suspended')), '42501',
  'a school owner cannot suspend their school');
select is(tests.sqlstate_as(pg_temp.w('staff'), format('select public.admin_set_school_status(%L, %L)', pg_temp.w('school_a'), 'suspended')), 'ok',
  'DriveRush admin suspends a school');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.admin_transfer_school_owner(%L, %L)', pg_temp.w('school_a'), 'z@y.test')), '42501',
  'a school owner cannot hand the school to someone else');
select is(tests.sqlstate_as(pg_temp.w('staff'), format('select public.grant_platform_role(%L, %L)', pg_temp.w('learner_free'), 'driverush_admin')), '42501',
  'DriveRush admin cannot grant platform roles');
select is(tests.sqlstate_as(pg_temp.w('su'), format('select public.grant_platform_role(%L, %L)', pg_temp.w('learner_free'), 'driverush_admin')), 'ok',
  'DriveRush su grants a platform role');
select is(tests.sqlstate_as(pg_temp.w('staff'), format('select public.revoke_platform_role(%L, %L)', pg_temp.w('su'), 'driverush_su')), '42501',
  'DriveRush admin cannot revoke a su');
select is(tests.sqlstate_as(pg_temp.w('su'), format('select public.revoke_platform_role(%L, %L)', pg_temp.w('su'), 'driverush_su')), 'P0001',
  'a su cannot revoke their own su');

-- ── School owners ──────────────────────────────────────────────────────
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_create_branch(%L, %L, null)', pg_temp.w('school_a'), 'New')), '42501',
  'a branch admin cannot add a branch');
select is(tests.sqlstate_as(pg_temp.w('owner_b'), format('select public.school_create_branch(%L, %L, null)', pg_temp.w('school_a'), 'New')), '42501',
  'another school''s owner cannot add a branch');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_create_branch(%L, %L, null)', pg_temp.w('school_a'), 'New')), 'ok',
  'the owner adds a branch');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_update_branch(%L, %L, null, true)', pg_temp.w('a1'), 'Renamed')), '42501',
  'a branch admin cannot rename their branch');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_add_admin(%L, %L, array[%L]::uuid[])', pg_temp.w('school_a'), 'n@y.test', pg_temp.w('a1'))), '42501',
  'a branch admin cannot add admins');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_add_admin(%L, %L, array[%L]::uuid[])', pg_temp.w('school_a'), 'n@y.test', pg_temp.w('a1'))), 'ok',
  'the owner adds an admin');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_set_admin_branches(%L, array[%L]::uuid[])', pg_temp.w('member_a1'), pg_temp.w('a2'))), '42501',
  'a branch admin cannot widen their own branches');
select is(tests.sqlstate_as(pg_temp.w('owner_b'), format('select public.school_remove_admin(%L)', pg_temp.w('member_a1'))), '42501',
  'another school''s owner cannot remove an admin');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_remove_admin(%L)', pg_temp.w('member_a1'))), 'ok',
  'the owner removes an admin');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), format('select public.school_cancel_member_invite(%L)', gen_random_uuid())), '42501',
  'a learner cannot cancel a member invite');

-- ── School owners and branch admins ────────────────────────────────────
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_add_student(%L, %L)', pg_temp.w('a2'), 's@y.test')), '42501',
  'a branch admin cannot add a student to another branch');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_add_student(%L, %L)', pg_temp.w('a1'), 's@y.test')), 'ok',
  'a branch admin adds a student to their branch');
select is(tests.sqlstate_as(pg_temp.w('owner_b'), format('select public.school_add_student(%L, %L)', pg_temp.w('a1'), 's@y.test')), '42501',
  'another school''s owner cannot add a student');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_release_student(%L)', pg_temp.w('link_a2'))), '42501',
  'a branch admin cannot release a student of another branch');
select is(tests.sqlstate_as(pg_temp.w('admin_a2'), format('select public.school_release_student(%L)', pg_temp.w('link_a2'))), 'ok',
  'a branch admin releases a student of their branch');
select is(tests.sqlstate_as(pg_temp.w('learner_a1'), format('select public.school_cancel_student_invite(%L)', pg_temp.w('link_a1'))), '42501',
  'a learner cannot cancel a school''s link');
select is(tests.sqlstate_as(pg_temp.w('admin_a1'), format('select public.school_move_student_branch(%L, %L)', pg_temp.w('link_a1'), pg_temp.w('a2'))), '42501',
  'a branch admin cannot move a student to a branch they do not work in');
select is(tests.sqlstate_as(pg_temp.w('learner_a1'), format('select count(*) from public.school_student_progress(%L)', pg_temp.w('school_a'))), '42501',
  'a learner cannot read a school''s progress list');
select is(tests.sqlstate_as(pg_temp.w('owner_b'), format('select count(*) from public.school_student_progress(%L)', pg_temp.w('school_a'))), '42501',
  'another school''s owner cannot read the progress list');

-- ── Learners ───────────────────────────────────────────────────────────
select is(tests.sqlstate_as(pg_temp.w('learner_free'), format('select public.learner_accept_school_link(%L)', pg_temp.w('link_a1'))), '42501',
  'a learner cannot accept someone else''s link');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), format('select public.learner_decline_school_link(%L)', pg_temp.w('link_a1'))), '42501',
  'a learner cannot decline someone else''s link');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), 'select tier from public.my_entitlement()'), 'ok',
  'a learner reads their own entitlement');

-- ── Coverage ───────────────────────────────────────────────────────────
select is_empty(
  $$ select fn from tests.function_access
      where access in ('anon', 'authenticated') and guard not in ('none', 'public')
        and fn not like 'private.%'
        and split_part(fn, '(', 1) not in (select fn from probed) $$,
  'every guarded client-callable function has a refusal probe in this file'
);

select * from finish();
rollback;
