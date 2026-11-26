-- ===================================================
-- FUNCTIONS: a learner buys a pass (Paystack)
-- ===================================================
-- Owner, 2026-11-25. Three plans (reference rows in
-- migrations/*_reference_plans.sql):
--   learner_pass       KES 1,000 for 60 days, all to DriveRush
--   school_pass        the school's own price for 60 days, no ceiling (owner,
--                      2026-11-26); DriveRush keeps limits.driverush_share_kes
--                      (300), the rest settles to the school's bank (Paystack
--                      subaccount), which pays Paystack's fee. The price is at
--                      least the share plus limits.min_school_share_kes (50),
--                      private.school_min_price()
--   learner_extension  KES 300 for 30 days, all to DriveRush, for a learner
--                      who has had a pass
--
-- The flow: start_pass_checkout (learner session) writes a pending payment
-- with the amounts fixed; the server sends the learner to Paystack with our
-- reference; the webhook or the return page asks Paystack how it ended and
-- calls settle_payment or fail_payment (service role). Settling is
-- idempotent, so both may call it.

-- A school's pass offer, from the code the school handed out. Only a school
-- that can take payments answers (active, its payments set up).
--
-- Access:  authenticated (any signed-in learner)
-- Guard:   public (a school's public price and branch names, nothing else)
-- Callers: /pass (server, learner session)
create or replace function private.pass_school_by_code(p_code text)
returns table (
  school_id uuid,
  school_name text,
  school_slug text,
  price_kes integer,
  branches jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.slug, ps.price_kes,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'town', b.town) order by b.name)
             from public.school_branches as b
            where b.school_id = s.id and b.is_active
         ), '[]'::jsonb)
    from public.school_payment_settings as ps
    join public.schools as s on s.id = ps.school_id and s.status = 'active'
   where ps.code = upper(btrim(p_code))::extensions.citext
     and ps.is_active
     and ps.paystack_subaccount_code is not null;
$$;

-- The schools the caller can pay through without typing a code: their
-- current school and any school waiting for them, each with its price and the
-- branch it added them to. Only schools that can take payments.
--
-- Access:  authenticated (the learner)
-- Guard:   self (answers for auth.uid() only)
-- Callers: /pass (server, learner session)
create or replace function private.my_pass_offers()
returns table (
  school_id uuid,
  school_name text,
  code text,
  price_kes integer,
  branch_id uuid,
  branch_name text,
  linked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, ps.code::text, ps.price_kes, b.id, b.name,
           l.status = 'active'
      from public.school_student_links as l
      join public.schools as s on s.id = l.school_id and s.status = 'active'
      join public.school_payment_settings as ps
        on ps.school_id = s.id and ps.is_active and ps.paystack_subaccount_code is not null
      join public.school_branches as b on b.id = l.branch_id
     where l.user_id = v_uid
       and ((l.status = 'pending' and l.expires_at > now()) or (l.status = 'active' and l.ends_at > now()))
     order by l.status = 'active' desc, s.name;
end;
$$;

-- Starts a payment for the caller: a pending row with the amount and both
-- shares worked out here, never by the client. A school pass goes to the
-- school of p_school_code, or (no code) the learner's current school; its
-- branch is p_branch_id, else the learner's link's branch, else the school's
-- only branch. Each call is a new try with a new reference.
--
-- Access:  authenticated (the learner paying)
-- Guard:   self (the payment is the caller's own)
-- Callers: /pass action (server, learner session)
create or replace function private.start_pass_checkout(
  p_plan_code text,
  p_school_code text default null,
  p_branch_id uuid default null
)
returns table (
  payment_id uuid,
  reference text,
  amount_kes integer,
  email text,
  school_id uuid,
  school_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email extensions.citext;
  v_plan public.plans;
  v_settings public.school_payment_settings;
  v_school public.schools;
  v_branch_id uuid;
  v_amount integer;
  v_share integer;
  v_ref text := 'dr_' || replace(gen_random_uuid()::text, '-', '');
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select u.email::extensions.citext into v_email
    from auth.users as u where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'email_unconfirmed' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans as p
   where p.code = p_plan_code and p.is_active and p.audience = 'learner'
     and p.code in ('learner_pass', 'school_pass', 'learner_extension');
  if v_plan.id is null then
    raise exception 'unknown_plan' using errcode = 'P0001';
  end if;

  if v_plan.code = 'learner_extension'
     and not exists (select 1 from public.learner_subscriptions as s
                      where s.user_id = v_uid and s.status = 'active') then
    raise exception 'extension_not_allowed' using errcode = 'P0001';
  end if;

  if v_plan.code = 'school_pass' then
    if nullif(btrim(p_school_code), '') is not null then
      select * into v_settings from public.school_payment_settings as ps
       where ps.code = upper(btrim(p_school_code))::extensions.citext;
    else
      select ps.* into v_settings
        from public.school_student_links as l
        join public.school_payment_settings as ps on ps.school_id = l.school_id
       where l.id = private.current_link_id(v_uid);
    end if;
    if v_settings.school_id is not null then
      select * into v_school from public.schools as s
       where s.id = v_settings.school_id and s.status = 'active';
    end if;
    if v_school.id is null or not v_settings.is_active
       or v_settings.paystack_subaccount_code is null then
      raise exception 'bad_code' using errcode = 'P0001';
    end if;

    if p_branch_id is not null then
      select b.id into v_branch_id from public.school_branches as b
       where b.id = p_branch_id and b.school_id = v_school.id and b.is_active;
      if v_branch_id is null then
        raise exception 'branch_inactive' using errcode = 'P0001';
      end if;
    else
      select l.branch_id into v_branch_id
        from public.school_student_links as l
        join public.school_branches as b on b.id = l.branch_id and b.is_active
       where l.school_id = v_school.id and l.email = v_email and l.status in ('active', 'pending')
       order by l.status = 'active' desc
       limit 1;
      if v_branch_id is null
         and (select count(*) from public.school_branches as b
               where b.school_id = v_school.id and b.is_active) = 1 then
        select b.id into v_branch_id from public.school_branches as b
         where b.school_id = v_school.id and b.is_active;
      end if;
      if v_branch_id is null then
        raise exception 'branch_required' using errcode = 'P0001';
      end if;
    end if;

    v_amount := v_settings.price_kes;
    v_share := (v_plan.limits ->> 'driverush_share_kes')::integer;
    -- A school price set before the minimum went up is refused, not raised
    -- behind the learner's back: the school sets a new price.
    if v_share is null or v_share <= 0 or v_amount < private.school_min_price() then
      raise exception 'price_below_share' using errcode = 'P0001';
    end if;
  else
    v_amount := v_plan.price_kes;
    v_share := v_plan.price_kes;
  end if;

  insert into public.payments (
    payer_user_id, school_id, branch_id, plan_id, amount_kes,
    driverush_share_kes, school_share_kes, provider, provider_ref
  ) values (
    v_uid, v_school.id, v_branch_id, v_plan.id, v_amount,
    v_share, v_amount - v_share, 'paystack', v_ref
  )
  returning id into v_payment_id;

  return query select v_payment_id, v_ref, v_amount, v_email::text, v_school.id, v_school.name;
end;
$$;

-- Paystack says the payment succeeded for this amount: mark it, add the pass
-- (back to back after any pass still running) and, for a school pass, keep
-- the learner linked to that school while the pass runs (a link with another
-- school ends: switched). Returns the pass. Settling twice returns the same
-- pass and changes nothing.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /webhooks/paystack, /pass/done (server, after verifying with Paystack); the seed
create or replace function private.settle_payment(
  p_reference text,
  p_amount_kes integer,
  p_fee_kes numeric,
  p_raw jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_plan public.plans;
  v_sub_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_email extensions.citext;
  v_current public.school_student_links;
  v_link_id uuid;
begin
  select * into v_pay from public.payments
   where provider = 'paystack' and provider_ref = p_reference
   for update;
  if v_pay.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'succeeded' then
    select id into v_sub_id from public.learner_subscriptions where payment_id = v_pay.id;
    return v_sub_id;
  end if;
  if v_pay.status = 'refunded' then
    raise exception 'refunded' using errcode = 'P0001';
  end if;
  if p_amount_kes is distinct from v_pay.amount_kes then
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;
  if v_pay.payer_user_id is null then
    raise exception 'no_payer' using errcode = 'P0001';
  end if;

  update public.payments
     set status = 'succeeded', settled_at = now(), fee_kes = p_fee_kes, raw = p_raw
   where id = v_pay.id;

  select * into v_plan from public.plans where id = v_pay.plan_id;

  select greatest(now(), coalesce(max(s.ends_at), now())) into v_start
    from public.learner_subscriptions as s
   where s.user_id = v_pay.payer_user_id and s.status = 'active' and s.ends_at > now();
  v_end := v_start + v_plan.period;

  insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at, source, payment_id)
  values (v_pay.payer_user_id, v_plan.id, v_start, v_end, 'payment', v_pay.id)
  returning id into v_sub_id;

  if v_pay.school_id is not null then
    select u.email::extensions.citext into v_email from auth.users as u where u.id = v_pay.payer_user_id;
    perform private.close_expired_links(v_pay.payer_user_id, v_email);

    select * into v_current from public.school_student_links
     where id = private.current_link_id(v_pay.payer_user_id);

    if v_current.id is not null and v_current.school_id = v_pay.school_id then
      v_link_id := v_current.id;
    else
      if v_current.id is not null then
        perform private.end_link(v_current.id, 'switched');
      end if;

      select id into v_link_id from public.school_student_links
       where school_id = v_pay.school_id and email = v_email and status = 'pending';
      if v_link_id is null then
        if v_pay.branch_id is null then
          raise exception 'no_branch' using errcode = 'P0001';
        end if;
        insert into public.school_student_links (school_id, branch_id, email, user_id)
        values (v_pay.school_id, v_pay.branch_id, v_email, v_pay.payer_user_id)
        returning id into v_link_id;
      else
        update public.school_student_links
           set user_id = v_pay.payer_user_id,
               branch_id = coalesce(v_pay.branch_id, branch_id)
         where id = v_link_id;
      end if;
      perform private.activate_link(v_link_id, v_pay.payer_user_id);
    end if;

    update public.school_student_links
       set ends_at = greatest(ends_at, v_end)
     where id = v_link_id;
  end if;

  return v_sub_id;
end;
$$;

-- Paystack says the payment did not go through (or the learner gave up).
-- A settled payment is never failed.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /webhooks/paystack, /pass/done (server, after verifying with Paystack)
create or replace function private.fail_payment(p_reference text, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.payments where provider = 'paystack' and provider_ref = p_reference) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.payments
     set status = 'failed', raw = p_raw
   where provider = 'paystack' and provider_ref = p_reference and status = 'pending';
end;
$$;

-- Money went back to the learner (refunded in the Paystack dashboard): the
-- payment is refunded and its pass stops counting. A school link stays (it
-- is free). Refunding twice changes nothing.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /webhooks/paystack (server)
create or replace function private.refund_payment(p_reference text, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments
   where provider = 'paystack' and provider_ref = p_reference
   for update;
  if v_pay.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'refunded' then
    return;
  end if;
  if v_pay.status <> 'succeeded' then
    raise exception 'not_settled' using errcode = 'P0001';
  end if;

  update public.payments
     set status = 'refunded', raw = coalesce(v_pay.raw, '{}'::jsonb) || jsonb_build_object('refund', p_raw)
   where id = v_pay.id;
  update public.learner_subscriptions
     set status = 'cancelled'
   where payment_id = v_pay.id;
end;
$$;

-- Access:  authenticated (any signed-in learner)
-- Guard:   public (the private body returns only a school's public offer)
-- Callers: /pass (server, learner session)
create or replace function public.pass_school_by_code(p_code text)
returns table (
  school_id uuid,
  school_name text,
  school_slug text,
  price_kes integer,
  branches jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.pass_school_by_code(p_code);
$$;

-- Access:  authenticated (the learner)
-- Guard:   self (the private body answers for auth.uid() only)
-- Callers: /pass (server, learner session)
create or replace function public.my_pass_offers()
returns table (
  school_id uuid,
  school_name text,
  code text,
  price_kes integer,
  branch_id uuid,
  branch_name text,
  linked boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_pass_offers();
$$;

-- Access:  authenticated (the learner paying)
-- Guard:   self (the private body writes only the caller's own payment)
-- Callers: /pass action (server, learner session)
create or replace function public.start_pass_checkout(
  p_plan_code text,
  p_school_code text default null,
  p_branch_id uuid default null
)
returns table (
  payment_id uuid,
  reference text,
  amount_kes integer,
  email text,
  school_id uuid,
  school_name text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.start_pass_checkout(p_plan_code, p_school_code, p_branch_id);
$$;

revoke all on function private.pass_school_by_code(text) from public;
revoke all on function public.pass_school_by_code(text) from public;
-- The payment flow reaches these through the Data API, which shows only
-- schema public: same-named wrappers, executable by the service role alone.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /api/webhooks/paystack, /pass/done (server, service role); the seed
create or replace function public.settle_payment(
  p_reference text,
  p_amount_kes integer,
  p_fee_kes numeric,
  p_raw jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.settle_payment(p_reference, p_amount_kes, p_fee_kes, p_raw);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /api/webhooks/paystack, /pass/done (server, service role)
create or replace function public.fail_payment(p_reference text, p_raw jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.fail_payment(p_reference, p_raw);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: /api/webhooks/paystack (server, service role)
create or replace function public.refund_payment(p_reference text, p_raw jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.refund_payment(p_reference, p_raw);
$$;

revoke all on function private.my_pass_offers() from public;
revoke all on function public.my_pass_offers() from public;
grant execute on function private.my_pass_offers() to service_role;
grant execute on function public.my_pass_offers() to service_role;
revoke all on function private.start_pass_checkout(text, text, uuid) from public;
revoke all on function public.start_pass_checkout(text, text, uuid) from public;
revoke all on function private.settle_payment(text, integer, numeric, jsonb) from public;
revoke all on function private.fail_payment(text, jsonb) from public;
revoke all on function private.refund_payment(text, jsonb) from public;
grant execute on function private.pass_school_by_code(text) to service_role;
grant execute on function public.pass_school_by_code(text) to service_role;
grant execute on function private.start_pass_checkout(text, text, uuid) to service_role;
grant execute on function public.start_pass_checkout(text, text, uuid) to service_role;
grant execute on function private.settle_payment(text, integer, numeric, jsonb) to service_role;
revoke all on function public.settle_payment(text, integer, numeric, jsonb) from public;
revoke all on function public.fail_payment(text, jsonb) from public;
revoke all on function public.refund_payment(text, jsonb) from public;
grant execute on function public.settle_payment(text, integer, numeric, jsonb) to service_role;
grant execute on function public.fail_payment(text, jsonb) to service_role;
grant execute on function public.refund_payment(text, jsonb) to service_role;
grant execute on function private.fail_payment(text, jsonb) to service_role;
grant execute on function private.refund_payment(text, jsonb) to service_role;

comment on function private.pass_school_by_code(text) is
  'A school''s pass offer (name, price, active branches) from its code, if it can take payments.';
comment on function public.pass_school_by_code(text) is
  'A school''s pass offer (name, price, active branches) from its code, if it can take payments.';
comment on function private.my_pass_offers() is
  'Learner: their current and waiting schools that take payments, with price and branch.';
comment on function public.my_pass_offers() is
  'Learner: their current and waiting schools that take payments, with price and branch.';
comment on function private.start_pass_checkout(text, text, uuid) is
  'Learner: a pending payment for a pass, amounts and shares worked out here; returns our Paystack reference.';
comment on function public.start_pass_checkout(text, text, uuid) is
  'Learner: a pending payment for a pass, amounts and shares worked out here; returns our Paystack reference.';
comment on function private.settle_payment(text, integer, numeric, jsonb) is
  'Payment flow: marks a verified payment paid, adds the pass and keeps a school pass''s link open. Idempotent.';
comment on function public.settle_payment(text, integer, numeric, jsonb) is
  'Payment flow: marks a verified payment paid, adds the pass and keeps a school pass''s link open. Idempotent.';
comment on function public.fail_payment(text, jsonb) is
  'Payment flow: marks a pending payment failed.';
comment on function public.refund_payment(text, jsonb) is
  'Payment flow: marks a payment refunded and cancels its pass. Idempotent.';
comment on function private.fail_payment(text, jsonb) is
  'Payment flow: marks a pending payment failed.';
comment on function private.refund_payment(text, jsonb) is
  'Payment flow: marks a payment refunded and cancels its pass. Idempotent.';
