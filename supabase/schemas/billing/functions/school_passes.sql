-- ===================================================
-- FUNCTIONS: a school's pass code, price, bank and earnings
-- ===================================================
-- Owner, 2026-11-25: schools pay nothing and earn from every learner who pays
-- through them (price minus DriveRush's fixed share). Paystack settles the
-- school's share to its bank itself, so there is no balance to withdraw:
-- earnings are a read of the payments.
--
-- Owner, 2026-11-26: a school sets any price at or above
-- private.school_min_price() (DriveRush's share plus a little for the school,
-- which pays Paystack's fee from its share). The owner asks for the bank; staff
-- approve it.

-- The lowest price a school may set: DriveRush's share plus the school's
-- minimum, both from the school_pass plan.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate; reads the public plans only)
-- Callers: school_pass_info, school_set_pass_price, school_request_bank, start_pass_checkout
create or replace function private.school_min_price()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((p.limits ->> 'driverush_share_kes')::integer, 0)
       + coalesce((p.limits ->> 'min_school_share_kes')::integer, 0)
    from public.plans as p
   where p.code = 'school_pass';
$$;

-- A free pass code from a school's short name: HELTZ, then HELTZ2, HELTZ3.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_request_bank
create or replace function private.new_pass_code(p_slug text)
returns extensions.citext
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := left(upper(regexp_replace(coalesce(p_slug, ''), '[^A-Za-z0-9]', '', 'g')), 10);
  v_try text;
  v_n integer := 1;
begin
  if char_length(v_base) < 3 then
    v_base := rpad(v_base || 'DR', 3, 'X');
  end if;
  v_try := v_base;
  while exists (select 1 from public.school_payment_settings as ps where ps.code = v_try::extensions.citext) loop
    v_n := v_n + 1;
    v_try := v_base || v_n::text;
  end loop;
  return v_try::extensions.citext;
end;
$$;

-- The school's code and price, for its team to hand out, and (owner and
-- staff only) its bank and any bank waiting for DriveRush.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (is_school_member or is_staff)
-- Callers: school dashboard (session), console (session)
create or replace function private.school_pass_info(p_school_id uuid)
returns table (
  code text,
  price_kes integer,
  driverush_share_kes integer,
  min_price_kes integer,
  ready boolean,
  bank_label text,
  account_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_view boolean;
begin
  if not (private.is_school_member(p_school_id) or private.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_owner_view := private.is_school_owner(p_school_id) or private.is_staff();
  return query
    select ps.code::text,
           ps.price_kes,
           (select (p.limits ->> 'driverush_share_kes')::integer from public.plans as p where p.code = 'school_pass'),
           private.school_min_price(),
           ps.is_active and ps.paystack_subaccount_code is not null,
           case when v_owner_view then ps.bank_label end,
           case when v_owner_view then ps.account_name end,
           case when v_owner_view then ps.pending_bank_label end,
           case when v_owner_view then ps.pending_account_name end,
           case when v_owner_view then ps.requested_at end,
           case when v_owner_view then ps.reviewed_at end,
           case when v_owner_view then ps.review_note end
      from public.school_payment_settings as ps
     where ps.school_id = p_school_id;
end;
$$;

-- The owner sets what their learners pay through the school: any price at or
-- above school_min_price(). Payments already started keep their price.
--
-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (private.can_manage_school: owner or staff)
-- Callers: school dashboard (session)
create or replace function private.school_set_pass_price(p_school_id uuid, p_price_kes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_school(p_school_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_price_kes is null or p_price_kes < private.school_min_price() or p_price_kes > 1000000 then
    raise exception 'price_out_of_range' using errcode = 'P0001';
  end if;
  update public.school_payment_settings
     set price_kes = p_price_kes, updated_by = auth.uid()
   where school_id = p_school_id;
  if not found then
    raise exception 'payments_not_set_up' using errcode = 'P0001';
  end if;
end;
$$;

-- What the school earned: every settled payment through it, newest first.
-- The owner and staff see every branch; an admin only their branches.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (is_school_member or is_staff; rows by can_see_branch)
-- Callers: school dashboard (session), console (session)
create or replace function private.school_earnings(p_school_id uuid, p_branch_id uuid default null)
returns table (
  payment_id uuid,
  paid_at timestamptz,
  learner_email text,
  branch_id uuid,
  branch_name text,
  price_kes integer,
  school_share_kes integer,
  status public.payment_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_all boolean;
begin
  if not (private.is_school_member(p_school_id) or private.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_all := private.is_school_owner(p_school_id) or private.is_staff();
  return query
    select p.id, p.settled_at, u.email::text, p.branch_id, b.name,
           p.amount_kes, p.school_share_kes, p.status
      from public.payments as p
      left join auth.users as u on u.id = p.payer_user_id
      left join public.school_branches as b on b.id = p.branch_id
     where p.school_id = p_school_id
       and p.status in ('succeeded', 'refunded')
       and (p_branch_id is null or p.branch_id = p_branch_id)
       and (v_all or (p.branch_id is not null and private.can_see_branch(p.branch_id)))
     order by p.settled_at desc
     limit 1000;
end;
$$;

-- Records the bank an owner asked for, after the server made its Paystack
-- subaccount, as waiting for DriveRush. Makes the school's settings (code from
-- its short name, the usual first price) if it has none. Returns the
-- subaccount of an earlier request this one replaces (null if none), for the
-- server to switch off on Paystack.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate; the server checks the owner first)
-- Callers: school dashboard bank form (server, service role)
create or replace function private.school_request_bank(
  p_school_id uuid,
  p_actor uuid,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_replaced text;
begin
  select s.slug into v_slug from public.schools as s
   where s.id = p_school_id and s.status in ('setup', 'active');
  if v_slug is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select ps.pending_subaccount_code into v_replaced
    from public.school_payment_settings as ps where ps.school_id = p_school_id for update;
  insert into public.school_payment_settings (
    school_id, code, price_kes, pending_subaccount_code, pending_bank_label,
    pending_account_name, requested_by, requested_at, updated_by
  ) values (
    p_school_id, private.new_pass_code(v_slug), greatest(700, private.school_min_price()),
    btrim(p_subaccount_code), btrim(p_bank_label), nullif(btrim(p_account_name), ''),
    p_actor, now(), p_actor
  )
  on conflict (school_id) do update
    set pending_subaccount_code = excluded.pending_subaccount_code,
        pending_bank_label = excluded.pending_bank_label,
        pending_account_name = excluded.pending_account_name,
        requested_by = excluded.requested_by,
        requested_at = excluded.requested_at,
        review_note = null,
        updated_by = excluded.updated_by;
  return v_replaced;
end;
$$;

-- Staff approve or turn down the bank an owner asked for. Approving makes it
-- the live one and returns the subaccount it replaces; turning down clears it
-- (with a note the owner reads) and returns that one. Either way the returned
-- subaccount is for the server to switch off on Paystack.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_review_bank(
  p_school_id uuid,
  p_approve boolean,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.school_payment_settings;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_settings from public.school_payment_settings as ps
   where ps.school_id = p_school_id for update;
  if v_settings.pending_subaccount_code is null then
    raise exception 'nothing_to_review' using errcode = 'P0001';
  end if;
  if coalesce(p_approve, false) then
    update public.school_payment_settings
       set paystack_subaccount_code = v_settings.pending_subaccount_code,
           bank_label = v_settings.pending_bank_label,
           account_name = v_settings.pending_account_name,
           pending_subaccount_code = null, pending_bank_label = null,
           pending_account_name = null, requested_at = null,
           reviewed_by = auth.uid(), reviewed_at = now(), review_note = null,
           updated_by = auth.uid()
     where school_id = p_school_id;
    return v_settings.paystack_subaccount_code;
  end if;
  update public.school_payment_settings
     set pending_subaccount_code = null, pending_bank_label = null,
         pending_account_name = null, requested_at = null,
         reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = coalesce(nullif(btrim(p_note), ''), 'Not approved. Call DriveRush.'),
         updated_by = auth.uid()
   where school_id = p_school_id;
  return v_settings.pending_subaccount_code;
end;
$$;

-- DriveRush staff set a school's passes directly: its code, and (when given)
-- a bank already checked with the school, live at once. With no subaccount
-- the bank stays as it is (a code or on/off change). Returns the subaccount
-- the new one replaces, for the server to switch off on Paystack.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session); the seed
create or replace function private.admin_set_school_payments(
  p_school_id uuid,
  p_code text,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text,
  p_is_active boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_new text := nullif(btrim(coalesce(p_subaccount_code, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select ps.paystack_subaccount_code into v_old
    from public.school_payment_settings as ps where ps.school_id = p_school_id for update;
  insert into public.school_payment_settings as ps (
    school_id, code, price_kes, paystack_subaccount_code, bank_label, account_name,
    is_active, updated_by, reviewed_by, reviewed_at
  ) values (
    p_school_id, upper(btrim(p_code)), greatest(700, private.school_min_price()), v_new,
    nullif(btrim(p_bank_label), ''), nullif(btrim(coalesce(p_account_name, '')), ''),
    coalesce(p_is_active, true), auth.uid(),
    case when v_new is not null then auth.uid() end,
    case when v_new is not null then now() end
  )
  on conflict (school_id) do update
    set code = excluded.code,
        paystack_subaccount_code = coalesce(v_new, ps.paystack_subaccount_code),
        bank_label = case when v_new is not null then excluded.bank_label
                          else ps.bank_label end,
        account_name = case when v_new is not null then excluded.account_name
                            else ps.account_name end,
        reviewed_by = coalesce(excluded.reviewed_by, ps.reviewed_by),
        reviewed_at = coalesce(excluded.reviewed_at, ps.reviewed_at),
        is_active = excluded.is_active,
        updated_by = excluded.updated_by;
  return case when v_new is not null and v_old is distinct from v_new then v_old end;
end;
$$;

-- Banks owners asked for, waiting for DriveRush, oldest first.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_list_bank_requests()
returns table (
  school_id uuid,
  school_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  requested_by_email text,
  live_bank_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select ps.school_id, s.name, ps.pending_bank_label, ps.pending_account_name,
           ps.requested_at, u.email::text, ps.bank_label
      from public.school_payment_settings as ps
      join public.schools as s on s.id = ps.school_id
      left join auth.users as u on u.id = ps.requested_by
     where ps.pending_subaccount_code is not null
     order by ps.requested_at;
end;
$$;

-- One page of every payment, for staff: newest first, searched by the payer's
-- email, the school's name or the reference, filtered by status and school.
-- `total` is the count of every match, on every row.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_list_payments(
  p_search text,
  p_status text,
  p_limit integer,
  p_offset integer,
  p_school_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  settled_at timestamptz,
  status public.payment_status,
  payer_email text,
  school_id uuid,
  school_name text,
  plan_code text,
  amount_kes integer,
  driverush_share_kes integer,
  school_share_kes integer,
  fee_kes numeric,
  provider_ref text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.created_at, p.settled_at, p.status, u.email::text, p.school_id,
           s.name, pl.code, p.amount_kes, p.driverush_share_kes, p.school_share_kes,
           p.fee_kes, p.provider_ref, count(*) over ()
      from public.payments as p
      left join auth.users as u on u.id = p.payer_user_id
      left join public.schools as s on s.id = p.school_id
      left join public.plans as pl on pl.id = p.plan_id
     where (p_status is null or p_status = '' or p.status::text = p_status)
       and (p_school_id is null or p.school_id = p_school_id)
       and (v_q is null
            or u.email::text ilike '%' || v_q || '%'
            or s.name ilike '%' || v_q || '%'
            or p.provider_ref ilike '%' || v_q || '%')
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 100))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- Money this month and last month (Kenyan calendar), for staff: settled
-- payments, what learners paid, DriveRush's and the schools' shares, and
-- Paystack's fees.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_payment_totals()
returns table (
  month date,
  payments bigint,
  paid_kes bigint,
  driverush_kes bigint,
  schools_kes bigint,
  fees_kes numeric,
  refunded bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_this date := date_trunc('month', (now() at time zone 'Africa/Nairobi'))::date;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.month,
           count(p.id) filter (where p.status = 'succeeded'),
           coalesce(sum(p.amount_kes) filter (where p.status = 'succeeded'), 0)::bigint,
           coalesce(sum(p.driverush_share_kes) filter (where p.status = 'succeeded'), 0)::bigint,
           coalesce(sum(p.school_share_kes) filter (where p.status = 'succeeded'), 0)::bigint,
           coalesce(sum(p.fee_kes) filter (where p.status = 'succeeded'), 0),
           count(p.id) filter (where p.status = 'refunded')
      from (values (v_this), ((v_this - interval '1 month')::date)) as m (month)
      left join public.payments as p
        on p.settled_at is not null
       and date_trunc('month', (p.settled_at at time zone 'Africa/Nairobi'))::date = m.month
     group by m.month
     order by m.month desc;
end;
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (the private body checks is_school_member or is_staff)
-- Callers: school dashboard (session), console (session)
create or replace function public.school_pass_info(p_school_id uuid)
returns table (
  code text,
  price_kes integer,
  driverush_share_kes integer,
  min_price_kes integer,
  ready boolean,
  bank_label text,
  account_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.school_pass_info(p_school_id);
$$;

-- Access:  authenticated (school owner or DriveRush staff)
-- Guard:   school (the private body checks private.can_manage_school)
-- Callers: school dashboard (session)
create or replace function public.school_set_pass_price(p_school_id uuid, p_price_kes integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.school_set_pass_price(p_school_id, p_price_kes);
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (the private body checks membership; rows by can_see_branch)
-- Callers: school dashboard (session), console (session)
create or replace function public.school_earnings(p_school_id uuid, p_branch_id uuid default null)
returns table (
  payment_id uuid,
  paid_at timestamptz,
  learner_email text,
  branch_id uuid,
  branch_name text,
  price_kes integer,
  school_share_kes integer,
  status public.payment_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.school_earnings(p_school_id, p_branch_id);
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate; the server checks the owner first)
-- Callers: school dashboard bank form (server, service role)
create or replace function public.school_request_bank(
  p_school_id uuid,
  p_actor uuid,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.school_request_bank(p_school_id, p_actor, p_subaccount_code, p_bank_label, p_account_name);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_review_bank(p_school_id uuid, p_approve boolean, p_note text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_review_bank(p_school_id, p_approve, p_note);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session); the seed
create or replace function public.admin_set_school_payments(
  p_school_id uuid,
  p_code text,
  p_subaccount_code text,
  p_bank_label text,
  p_account_name text,
  p_is_active boolean
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_school_payments(
    p_school_id, p_code, p_subaccount_code, p_bank_label, p_account_name, p_is_active
  );
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_list_bank_requests()
returns table (
  school_id uuid,
  school_name text,
  pending_bank_label text,
  pending_account_name text,
  requested_at timestamptz,
  requested_by_email text,
  live_bank_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_bank_requests();
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_list_payments(
  p_search text,
  p_status text,
  p_limit integer,
  p_offset integer,
  p_school_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  settled_at timestamptz,
  status public.payment_status,
  payer_email text,
  school_id uuid,
  school_name text,
  plan_code text,
  amount_kes integer,
  driverush_share_kes integer,
  school_share_kes integer,
  fee_kes numeric,
  provider_ref text,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_payments(p_search, p_status, p_limit, p_offset, p_school_id);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_payment_totals()
returns table (
  month date,
  payments bigint,
  paid_kes bigint,
  driverush_kes bigint,
  schools_kes bigint,
  fees_kes numeric,
  refunded bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_payment_totals();
$$;

revoke all on function private.school_min_price() from public;
revoke all on function private.new_pass_code(text) from public;
revoke all on function private.school_pass_info(uuid) from public;
revoke all on function public.school_pass_info(uuid) from public;
revoke all on function private.school_set_pass_price(uuid, integer) from public;
revoke all on function public.school_set_pass_price(uuid, integer) from public;
revoke all on function private.school_earnings(uuid, uuid) from public;
revoke all on function public.school_earnings(uuid, uuid) from public;
revoke all on function private.school_request_bank(uuid, uuid, text, text, text) from public;
revoke all on function public.school_request_bank(uuid, uuid, text, text, text) from public;
revoke all on function private.admin_review_bank(uuid, boolean, text) from public;
revoke all on function public.admin_review_bank(uuid, boolean, text) from public;
revoke all on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) from public;
revoke all on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) from public;
revoke all on function private.admin_list_bank_requests() from public;
revoke all on function public.admin_list_bank_requests() from public;
revoke all on function private.admin_list_payments(text, text, integer, integer, uuid) from public;
revoke all on function public.admin_list_payments(text, text, integer, integer, uuid) from public;
revoke all on function private.admin_payment_totals() from public;
revoke all on function public.admin_payment_totals() from public;
grant execute on function private.school_min_price() to service_role;
grant execute on function private.new_pass_code(text) to service_role;
grant execute on function private.school_pass_info(uuid) to service_role;
grant execute on function public.school_pass_info(uuid) to service_role;
grant execute on function private.school_set_pass_price(uuid, integer) to service_role;
grant execute on function public.school_set_pass_price(uuid, integer) to service_role;
grant execute on function private.school_earnings(uuid, uuid) to service_role;
grant execute on function public.school_earnings(uuid, uuid) to service_role;
grant execute on function private.school_request_bank(uuid, uuid, text, text, text) to service_role;
grant execute on function public.school_request_bank(uuid, uuid, text, text, text) to service_role;
grant execute on function private.admin_review_bank(uuid, boolean, text) to service_role;
grant execute on function public.admin_review_bank(uuid, boolean, text) to service_role;
grant execute on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) to service_role;
grant execute on function private.admin_list_bank_requests() to service_role;
grant execute on function public.admin_list_bank_requests() to service_role;
grant execute on function private.admin_list_payments(text, text, integer, integer, uuid) to service_role;
grant execute on function public.admin_list_payments(text, text, integer, integer, uuid) to service_role;
grant execute on function private.admin_payment_totals() to service_role;
grant execute on function public.admin_payment_totals() to service_role;

comment on function private.school_min_price() is
  'The lowest school pass price: DriveRush''s share plus the school''s minimum (school_pass plan).';
comment on function private.new_pass_code(text) is
  'A free pass code made from a school''s short name.';
comment on function private.school_pass_info(uuid) is
  'School team: the school''s pass code, price, minimum and readiness; the bank (live and waiting) to owner and staff.';
comment on function public.school_pass_info(uuid) is
  'School team: the school''s pass code, price, minimum and readiness; the bank (live and waiting) to owner and staff.';
comment on function private.school_set_pass_price(uuid, integer) is
  'School owner or staff: sets the school pass price (at least school_min_price, no ceiling).';
comment on function public.school_set_pass_price(uuid, integer) is
  'School owner or staff: sets the school pass price (at least school_min_price, no ceiling).';
comment on function private.school_earnings(uuid, uuid) is
  'School team: settled payments through the school, by branch for admins.';
comment on function public.school_earnings(uuid, uuid) is
  'School team: settled payments through the school, by branch for admins.';
comment on function private.school_request_bank(uuid, uuid, text, text, text) is
  'Server (after its owner check): the bank an owner asked for, waiting for staff. Returns the request it replaces.';
comment on function public.school_request_bank(uuid, uuid, text, text, text) is
  'Server (after its owner check): the bank an owner asked for, waiting for staff. Returns the request it replaces.';
comment on function private.admin_review_bank(uuid, boolean, text) is
  'Staff: approve or turn down a bank an owner asked for. Returns the subaccount to switch off.';
comment on function public.admin_review_bank(uuid, boolean, text) is
  'Staff: approve or turn down a bank an owner asked for. Returns the subaccount to switch off.';
comment on function private.admin_set_school_payments(uuid, text, text, text, text, boolean) is
  'Staff: a school''s pass code and (when given) its checked bank, live at once. Returns the subaccount replaced.';
comment on function public.admin_set_school_payments(uuid, text, text, text, text, boolean) is
  'Staff: a school''s pass code and (when given) its checked bank, live at once. Returns the subaccount replaced.';
comment on function private.admin_list_bank_requests() is
  'Staff: banks owners asked for, waiting for approval.';
comment on function public.admin_list_bank_requests() is
  'Staff: banks owners asked for, waiting for approval.';
comment on function private.admin_list_payments(text, text, integer, integer, uuid) is
  'Staff: one page of every payment, searched and filtered.';
comment on function public.admin_list_payments(text, text, integer, integer, uuid) is
  'Staff: one page of every payment, searched and filtered.';
comment on function private.admin_payment_totals() is
  'Staff: this month''s and last month''s money (Kenyan calendar).';
comment on function public.admin_payment_totals() is
  'Staff: this month''s and last month''s money (Kenyan calendar).';
