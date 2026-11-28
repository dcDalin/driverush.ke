-- ===================================================
-- pgTAP: passes, school prices and earnings (owner, 2026-11-25)
-- ===================================================
-- A learner starts a payment (the amounts are worked out in the database),
-- the payment flow settles it once, a pass follows back to back, a school
-- pass keeps the learner linked to the school while it runs, a refund stops
-- the pass, and a school's team sees its earnings by branch. now() is fixed
-- inside the transaction, so dates compare exactly.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(48);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;

-- Starts a payment as the learner and keeps it; returns our reference.
create function pg_temp.checkout(p_user text, p_plan text, p_code text default null, p_branch text default null)
returns text language sql as $$
  select tests.run_as(p_user, format('select reference from public.start_pass_checkout(%L, %L, %L)',
    p_plan, p_code, p_branch))
$$;
create function pg_temp.pay(p_ref text) returns public.payments
  language sql as $$ select * from public.payments where provider_ref = p_ref $$;
create function pg_temp.settle(p_ref text) returns text language sql as $$
  select tests.run_as('service', format('select public.settle_payment(%L, %s, 10.5, ''{}'')',
    p_ref, (pg_temp.pay(p_ref)).amount_kes))
$$;
create function pg_temp.sub(p_ref text) returns public.learner_subscriptions
  language sql as $$ select s.* from public.learner_subscriptions as s
                      join public.payments as p on p.id = s.payment_id where p.provider_ref = p_ref $$;
create function pg_temp.ent(p_user text, p_col text) returns text
  language sql as $$ select tests.value_as(p_user, format('select %I::text from public.my_entitlement()', p_col)) $$;

-- School A takes passes (KES 700); school B's payments are not set up yet.
insert into public.school_payment_settings (school_id, code, price_kes, paystack_subaccount_code, bank_label) values
  (pg_temp.w('school_a')::uuid, 'PASSA', 700, 'ACCT_pass_a', 'Equity ••4321'),
  (pg_temp.w('school_b')::uuid, 'PASSB', 600, null, null);

-- ── A school's offer, from its code ────────────────────────────────────
select is(tests.value_as(pg_temp.w('learner_free'), $$select school_name from public.pass_school_by_code(' passa ')$$),
  'Test School A', 'a code finds its school, whatever the case and spaces');
select is(tests.value_as(pg_temp.w('learner_free'), $$select jsonb_array_length(branches) from public.pass_school_by_code('PASSA')$$),
  '2', 'with its active branches to choose from');
select is(tests.value_as(pg_temp.w('learner_free'), $$select count(*) from public.pass_school_by_code('PASSB')$$),
  '0', 'a school whose payments are not set up has no offer');

-- ── Starting a payment ─────────────────────────────────────────────────
create temp table refs (k text primary key, ref text);
insert into refs values ('public', pg_temp.checkout(pg_temp.w('learner_free'), 'learner_pass'));
create function pg_temp.r(k text) returns text language sql as $$ select ref from refs where refs.k = r.k $$;

select is((pg_temp.pay(pg_temp.r('public'))).amount_kes, 1000, 'a public pass is KES 1,000');
select is((pg_temp.pay(pg_temp.r('public'))).driverush_share_kes, 1000, 'all of it to DriveRush');
select is((pg_temp.pay(pg_temp.r('public'))).status, 'pending'::public.payment_status, 'pending until Paystack says so');
select ok(pg_temp.r('public') ~ '^dr_[0-9a-f]{32}$', 'with our own reference for Paystack');

insert into refs values ('school_b_to_a', pg_temp.checkout(pg_temp.w('learner_b'), 'school_pass', 'PASSA', pg_temp.w('a2')));
select is((pg_temp.pay(pg_temp.r('school_b_to_a'))).amount_kes, 700, 'a school pass is the school''s price');
select is((pg_temp.pay(pg_temp.r('school_b_to_a'))).school_share_kes, 400, 'the school keeps the price less DriveRush''s KES 300');
select is((pg_temp.pay(pg_temp.r('school_b_to_a'))).branch_id::text, pg_temp.w('a2'), 'for the branch the learner chose');

insert into refs values ('school_a1', pg_temp.checkout(pg_temp.w('learner_a1'), 'school_pass'));
select is((pg_temp.pay(pg_temp.r('school_a1'))).school_id::text, pg_temp.w('school_a'),
  'with no code, a linked learner pays their own school');
select is((pg_temp.pay(pg_temp.r('school_a1'))).branch_id::text, pg_temp.w('a1'), 'for their link''s branch');

select is(tests.sqlstate_as(pg_temp.w('learner_free'), $$select * from public.start_pass_checkout('school_pass', 'PASSA')$$),
  'P0001', 'a school with two branches asks which one (branch_required)');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), $$select * from public.start_pass_checkout('school_pass', 'NOPE')$$),
  'P0001', 'a wrong code is refused (bad_code)');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), $$select * from public.start_pass_checkout('school_pass', 'PASSB')$$),
  'P0001', 'so is a school that cannot take payments yet');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), format($$select * from public.start_pass_checkout('school_pass', 'PASSA', %L)$$, pg_temp.w('b1'))),
  'P0001', 'and a branch of another school (branch_inactive)');
select is(tests.sqlstate_as(pg_temp.w('learner_a2'), $$select * from public.start_pass_checkout('learner_extension')$$),
  'P0001', 'an extension needs a pass first (extension_not_allowed)');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), $$select * from public.start_pass_checkout('school_standard')$$),
  'P0001', 'only the three passes can be bought (unknown_plan)');

-- ── Settling ───────────────────────────────────────────────────────────
select isnt(pg_temp.settle(pg_temp.r('public')), '', 'the payment flow settles a verified payment');
select is((pg_temp.sub(pg_temp.r('public'))).ends_at - (pg_temp.sub(pg_temp.r('public'))).starts_at, interval '60 days',
  'a pass runs 60 days');
select is(pg_temp.settle(pg_temp.r('public')), (pg_temp.sub(pg_temp.r('public'))).id::text,
  'settling again returns the same pass');
select is((select count(*)::integer from public.learner_subscriptions where user_id = pg_temp.w('learner_free')::uuid), 1,
  'and adds nothing');
select is(pg_temp.ent(pg_temp.w('learner_free'), 'full_access'), 'true', 'the learner has full access');
select is(pg_temp.ent(pg_temp.w('learner_free'), 'tier'), 'paid', 'with sponsor cars (no school)');

insert into refs values ('short', pg_temp.checkout(pg_temp.w('learner_free'), 'learner_pass'));
select is(tests.sqlstate_as('service', format($$select private.settle_payment(%L, 999, 0, '{}')$$, pg_temp.r('short'))),
  'P0001', 'a payment for the wrong amount is refused (amount_mismatch)');
select is(tests.sqlstate_as(pg_temp.w('learner_free'), format($$select private.settle_payment(%L, 1000, 0, '{}')$$, pg_temp.r('short'))),
  '42501', 'a learner cannot settle their own payment');

insert into refs values ('ext', pg_temp.checkout(pg_temp.w('learner_free'), 'learner_extension'));
select is((pg_temp.pay(pg_temp.r('ext'))).amount_kes, 300, 'an extension is KES 300');
select is(pg_temp.settle(pg_temp.r('ext')) <> '', true, 'and settles');
select is((pg_temp.sub(pg_temp.r('ext'))).starts_at, (pg_temp.sub(pg_temp.r('public'))).ends_at,
  'it starts when the running pass ends');
select is(pg_temp.ent(pg_temp.w('learner_free'), 'pass_ends_at')::timestamptz, now() + interval '90 days',
  'so the learner''s access runs 90 days');

-- ── A school pass keeps the learner linked to that school ──────────────
select is(pg_temp.settle(pg_temp.r('school_b_to_a')) <> '', true, 'a school pass settles');
select is((select end_reason::text from public.school_student_links where id = pg_temp.w('link_b')::uuid), 'switched',
  'the link with the old school ends (switched)');
select is(pg_temp.ent(pg_temp.w('learner_b'), 'school_id'), pg_temp.w('school_a'), 'the learner now has the new school''s car');
select is(pg_temp.ent(pg_temp.w('learner_b'), 'ends_at')::timestamptz, now() + interval '60 days',
  'linked for as long as the pass runs');

select is(pg_temp.settle(pg_temp.r('school_a1')) <> '', true, 'a linked learner pays their school');
select is((select ends_at from public.school_student_links where id = pg_temp.w('link_a1')::uuid), now() + interval '60 days',
  'their link stays the same one, kept open for the pass');

-- ── Earnings ───────────────────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('owner_a'), format('select sum(school_share_kes) from public.school_earnings(%L)', pg_temp.w('school_a'))),
  '800', 'the owner sees every branch''s earnings');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select string_agg(branch_id::text, '','') from public.school_earnings(%L)', pg_temp.w('school_a'))),
  pg_temp.w('a1'), 'a branch admin sees only their branch');

-- ── Failing and refunding ──────────────────────────────────────────────
select tests.run_as('service', format($$select private.fail_payment(%L, '{"why": "test"}')$$, pg_temp.r('short')));
select is((pg_temp.pay(pg_temp.r('short'))).status, 'failed'::public.payment_status, 'an abandoned payment fails');

select tests.run_as('service', format($$select private.refund_payment(%L, '{}')$$, pg_temp.r('school_b_to_a')));
select tests.run_as('service', format($$select private.refund_payment(%L, '{}')$$, pg_temp.r('school_b_to_a')));
select is(pg_temp.ent(pg_temp.w('learner_b'), 'full_access'), 'false', 'a refund stops the pass (refunding twice is harmless)');
select is(tests.sqlstate_as('service', format($$select private.settle_payment(%L, 700, 0, '{}')$$, pg_temp.r('school_b_to_a'))),
  'P0001', 'and a refunded payment cannot be settled again');

-- ── Offers without a code ──────────────────────────────────────────────
select is(tests.value_as(pg_temp.w('learner_a2'), 'select string_agg(code || '':'' || price_kes || '':'' || linked, '','') from public.my_pass_offers()'),
  'PASSA:700:true', 'a linked learner is offered their own school''s price');
select is(tests.value_as(pg_temp.w('learner_free'), 'select count(*) from public.my_pass_offers()'),
  '0', 'a learner with no school is offered none');

-- ── The owner's price ──────────────────────────────────────────────────
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_set_pass_price(%L, 349)', pg_temp.w('school_a'))),
  'P0001', 'a price below DriveRush''s share plus the school''s minimum (KES 350) is refused (price_out_of_range)');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_set_pass_price(%L, 350)', pg_temp.w('school_a'))),
  'ok', 'the minimum itself is allowed');
select is(tests.sqlstate_as(pg_temp.w('owner_a'), format('select public.school_set_pass_price(%L, 2500)', pg_temp.w('school_a'))),
  'ok', 'there is no ceiling (KES 2,500 is fine)');
select tests.run_as(pg_temp.w('owner_a'), format('select public.school_set_pass_price(%L, 800)', pg_temp.w('school_a')));
select is(tests.value_as(pg_temp.w('learner_free'), $$select price_kes from public.pass_school_by_code('PASSA')$$),
  '800', 'the owner sets their learners'' price');
select is(tests.value_as(pg_temp.w('admin_a1'), format('select coalesce(bank_label, ''hidden'') from public.school_pass_info(%L)', pg_temp.w('school_a'))),
  'hidden', 'a branch admin sees the code and price but not the bank');

select * from finish();
rollback;
