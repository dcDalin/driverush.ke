-- ===================================================
-- pgTAP: staff set a school up in private, then hand it over
-- ===================================================
-- A school created without an owner starts in `setup`: hidden from
-- learners, the board and the site, unable to take students. Handing it
-- over makes the email its owner (added or invited) and puts it live.
-- admin_list_schools pages, searches and filters for the console.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(16);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;

-- ── Created in setup ───────────────────────────────────────────────────
create temp table made as
select tests.run_as(pg_temp.w('staff'),
  $$select public.admin_create_school('Kilele Driving School', 'kilele', '')::text$$)::uuid as id;

select is((select status::text from public.schools where id = (select id from made)), 'setup',
  'a school created without an owner starts in setup');
select is((select count(*)::int from public.school_members where school_id = (select id from made)), 0,
  'with no owner yet');
select isnt(
  tests.run_as(pg_temp.w('staff'), format($$select public.school_create_branch(%L, 'Ruiru', 'Ruiru')::text$$, (select id from made))),
  '',
  'staff set it up: add a branch');
select is(
  tests.sqlstate_as(pg_temp.w('staff'), format(
    $$select public.school_add_student((select id from public.school_branches where school_id = %L limit 1), 'early@x.test')$$,
    (select id from made))),
  'P0001',
  'it takes no students while it is being set up');
select is(
  tests.value_as('anon', $$select count(*) from jsonb_array_elements(public.board_schools()) as e where e ->> 'slug' = 'kilele'$$),
  '0',
  'guests do not see it on the board or the site');
select is(
  tests.sqlstate_as(pg_temp.w('staff'), format($$select public.admin_set_school_status(%L, 'setup')$$, pg_temp.w('school_a'))),
  'P0001',
  'a live school cannot go back to setup');

-- ── Created with an owner: live at once ────────────────────────────────
create temp table made_live as
select tests.run_as(pg_temp.w('staff'),
  $$select public.admin_create_school('Baraka Driving', 'baraka-driving', 'founder@x.test')::text$$)::uuid as id;
select is((select status::text from public.schools where id = (select id from made_live)), 'active',
  'a school created with an owner''s email is live at once');

-- ── Handed over ────────────────────────────────────────────────────────
select is(
  tests.run_as(pg_temp.w('staff'), format($$select public.admin_hand_over_school(%L, 'Owner@Kilele.test')$$, (select id from made))),
  'invited',
  'handing over to an email with no account leaves an owner invite');
select is((select status::text from public.schools where id = (select id from made)), 'active',
  'and the school is live');
select is(
  (select email::text from public.school_member_invites where school_id = (select id from made) and role = 'owner' and status = 'pending'),
  'owner@kilele.test',
  'the invite is for that email, tidied');
select tests.make_persona('kilele owner', null, true, 'owner@kilele.test');
select is(
  (select m.role::text from public.school_members as m join auth.users as u on u.id = m.user_id
    where m.school_id = (select id from made) and u.email = 'owner@kilele.test'),
  'owner',
  'signing up with it makes them the owner');
select is(
  tests.run_as(pg_temp.w('staff'), format($$select public.admin_hand_over_school(%L, %L)$$, (select id from made), (select email from auth.users where id = pg_temp.w('owner_b')::uuid))),
  'added',
  'handing over again to someone with an account swaps the owner at once');

-- ── The console's list ─────────────────────────────────────────────────
select is(
  tests.value_as(pg_temp.w('staff'), $$select string_agg(slug, ',' order by slug) from public.admin_list_schools('kilele', 'any', 'any', 'any', 20, 0)$$),
  'kilele',
  'search finds a school by name or slug');
select is(
  tests.value_as(pg_temp.w('staff'), $$select count(*) from public.admin_list_schools(null, 'setup', 'any', 'any', 20, 0)$$),
  '0',
  'the status filter: nothing is left in setup after the hand-over');
select is(
  tests.value_as(pg_temp.w('staff'), $$select count(*) from public.admin_list_schools(null, 'any', 'any', 'any', 1, 0)$$),
  '1',
  'a page holds at most the limit');
select ok(
  tests.value_as(pg_temp.w('staff'), $$select total from public.admin_list_schools(null, 'any', 'any', 'any', 1, 0) limit 1$$)::int >= 4,
  'and every row carries the total for the pager');

select * from finish();
rollback;
