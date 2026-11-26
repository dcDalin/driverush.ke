-- ===================================================
-- pgTAP: a school's bank, its price and its owner changing (owner, 2026-11-26)
-- ===================================================
-- The owner asks for a bank (the server records it), it waits for staff, the
-- live bank keeps being paid until staff approve; turning it down leaves a
-- note. Prices have no ceiling and a floor from the plan. Staff see every
-- payment and the month's totals. A new owner can keep the old one on as an
-- admin of every branch.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(22);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.settings() returns public.school_payment_settings
  language sql as $$ select * from public.school_payment_settings where school_id = pg_temp.w('school_a')::uuid $$;

-- ── The owner asks for a bank ──────────────────────────────────────────
select is(
  tests.run_as('service', format($$select coalesce(public.school_request_bank(%L, %L, 'ACCT_first', 'Equity ••1111', 'Test School A Ltd'), 'none')$$,
    pg_temp.w('school_a'), pg_temp.w('owner_a'))),
  'none', 'a first request replaces nothing');
select ok((pg_temp.settings()).code::text ~ '^TESTA[0-9]+$', 'the school gets a pass code from its short name');
select is((pg_temp.settings()).paystack_subaccount_code, null, 'the bank waits: nothing is paid to it yet');
select is(tests.value_as(pg_temp.w('owner_a'), format('select ready::text from public.school_pass_info(%L)', pg_temp.w('school_a'))),
  'false', 'so the school does not take payments yet');
select is(tests.value_as(pg_temp.w('owner_a'), format('select pending_bank_label from public.school_pass_info(%L)', pg_temp.w('school_a'))),
  'Equity ••1111', 'the owner sees the bank waiting');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select coalesce(pending_bank_label, ''hidden'') from public.school_pass_info(%L)', pg_temp.w('school_a'))),
  'hidden', 'a branch admin does not');
select is(tests.value_as(pg_temp.w('staff'), 'select string_agg(pending_bank_label, '','') from public.admin_list_bank_requests()'),
  'Equity ••1111', 'staff see it in their list');

select is(
  tests.run_as('service', format($$select public.school_request_bank(%L, %L, 'ACCT_second', 'KCB ••2222', 'Test School A Ltd')$$,
    pg_temp.w('school_a'), pg_temp.w('owner_a'))),
  'ACCT_first', 'asking again replaces the waiting request (for the server to switch it off)');

-- ── Staff approve ──────────────────────────────────────────────────────
select is(tests.run_as(pg_temp.w('staff'), format('select coalesce(public.admin_review_bank(%L, true, null), ''none'')', pg_temp.w('school_a'))),
  'none', 'approving the first bank replaces no live one');
select is((pg_temp.settings()).paystack_subaccount_code, 'ACCT_second', 'the approved bank is live');
select is((pg_temp.settings()).account_name, 'Test School A Ltd', 'with its account name');
select is((pg_temp.settings()).pending_subaccount_code, null, 'and nothing waits');
select is(tests.sqlstate_as(pg_temp.w('staff'), format('select public.admin_review_bank(%L, true, null)', pg_temp.w('school_a'))),
  'P0001', 'there is nothing more to review (nothing_to_review)');

-- ── A change, turned down ──────────────────────────────────────────────
select tests.run_as('service', format($$select public.school_request_bank(%L, %L, 'ACCT_third', 'Coop ••3333', null)$$,
  pg_temp.w('school_a'), pg_temp.w('owner_a')));
select is((pg_temp.settings()).paystack_subaccount_code, 'ACCT_second', 'while a change waits, the live bank keeps being paid');
select is(tests.run_as(pg_temp.w('staff'), format($$select public.admin_review_bank(%L, false, 'The account name does not match.')$$, pg_temp.w('school_a'))),
  'ACCT_third', 'turning it down hands back the request to switch off');
select is(tests.value_as(pg_temp.w('owner_a'), format('select review_note from public.school_pass_info(%L)', pg_temp.w('school_a'))),
  'The account name does not match.', 'the owner reads why');

-- ── Prices: a floor from the plan, no ceiling ──────────────────────────
select is(tests.value_as(pg_temp.w('owner_a'), format('select min_price_kes::text from public.school_pass_info(%L)', pg_temp.w('school_a'))),
  '350', 'the minimum is DriveRush''s KES 300 plus KES 50 for the school');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_set_pass_price(%L, 5000)', pg_temp.w('school_a'))),
  'ok', 'any price above it, however high');

-- ── Staff see the money ────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('staff'), 'select count(*)::text from public.admin_payment_totals()'),
  '2', 'this month and last month');

-- ── A new owner keeps the old one as an admin ──────────────────────────
select tests.run_as(pg_temp.w('staff'), format('select public.admin_hand_over_school(%L, %L, true)',
  pg_temp.w('school_a'), (select email from auth.users where id = pg_temp.w('learner_free')::uuid)));
select is((select role::text from public.school_members
            where school_id = pg_temp.w('school_a')::uuid and user_id = pg_temp.w('owner_a')::uuid),
  'admin', 'the old owner stays on as an admin');
select is((select count(*)::int from public.school_member_branches as mb
             join public.school_members as m on m.id = mb.member_id
            where m.school_id = pg_temp.w('school_a')::uuid and m.user_id = pg_temp.w('owner_a')::uuid),
  (select count(*)::int from public.school_branches where school_id = pg_temp.w('school_a')::uuid and is_active),
  'of every open branch');
select is((select user_id::text from public.school_members
            where school_id = pg_temp.w('school_a')::uuid and role = 'owner'),
  pg_temp.w('learner_free'), 'and the new owner owns it');

select * from finish();
rollback;
