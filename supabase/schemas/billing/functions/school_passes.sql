-- ===================================================
-- FUNCTIONS: a school's pass code, price and earnings
-- ===================================================
-- Owner, 2026-11-25: schools pay nothing and earn from every learner who pays
-- through them (price minus DriveRush's fixed share). Paystack settles the
-- school's share to its bank itself, so there is no balance to withdraw:
-- earnings are a read of the payments.

-- The school's code and price, for its team to hand out. The bank label is
-- shown to the owner and staff only.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (is_school_member or is_staff)
-- Callers: school dashboard (session)
create or replace function private.school_pass_info(p_school_id uuid)
returns table (
  code text,
  price_kes integer,
  driverush_share_kes integer,
  ready boolean,
  bank_label text
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
           ps.is_active and ps.paystack_subaccount_code is not null,
           case when v_owner_view then ps.bank_label end
      from public.school_payment_settings as ps
     where ps.school_id = p_school_id;
end;
$$;

-- The owner sets what their learners pay through the school (KES 500 to
-- 1,000). Payments already started keep the price they started with.
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
  if p_price_kes is null or p_price_kes not between 500 and 1000 then
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
-- Callers: school dashboard (session)
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

-- DriveRush staff turn a school's payments on: its code, the Paystack
-- subaccount made with its bank details (by the console, from the school's
-- own confirmation), and a label for the bank. The price stays (700 at
-- first; the owner sets it).
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_set_school_payments(
  p_school_id uuid,
  p_code text,
  p_subaccount_code text,
  p_bank_label text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.school_payment_settings (
    school_id, code, paystack_subaccount_code, bank_label, is_active, updated_by
  ) values (
    p_school_id, upper(btrim(p_code)), nullif(btrim(p_subaccount_code), ''),
    nullif(btrim(p_bank_label), ''), coalesce(p_is_active, true), auth.uid()
  )
  on conflict (school_id) do update
    set code = excluded.code,
        paystack_subaccount_code = excluded.paystack_subaccount_code,
        bank_label = excluded.bank_label,
        is_active = excluded.is_active,
        updated_by = excluded.updated_by;
end;
$$;

-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   school (the private body checks is_school_member or is_staff)
-- Callers: school dashboard (session)
create or replace function public.school_pass_info(p_school_id uuid)
returns table (
  code text,
  price_kes integer,
  driverush_share_kes integer,
  ready boolean,
  bank_label text
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
-- Callers: school dashboard (session)
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

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_set_school_payments(
  p_school_id uuid,
  p_code text,
  p_subaccount_code text,
  p_bank_label text,
  p_is_active boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_school_payments(p_school_id, p_code, p_subaccount_code, p_bank_label, p_is_active);
$$;

revoke all on function private.school_pass_info(uuid) from public;
revoke all on function public.school_pass_info(uuid) from public;
revoke all on function private.school_set_pass_price(uuid, integer) from public;
revoke all on function public.school_set_pass_price(uuid, integer) from public;
revoke all on function private.school_earnings(uuid, uuid) from public;
revoke all on function public.school_earnings(uuid, uuid) from public;
revoke all on function private.admin_set_school_payments(uuid, text, text, text, boolean) from public;
revoke all on function public.admin_set_school_payments(uuid, text, text, text, boolean) from public;
grant execute on function private.school_pass_info(uuid) to service_role;
grant execute on function public.school_pass_info(uuid) to service_role;
grant execute on function private.school_set_pass_price(uuid, integer) to service_role;
grant execute on function public.school_set_pass_price(uuid, integer) to service_role;
grant execute on function private.school_earnings(uuid, uuid) to service_role;
grant execute on function public.school_earnings(uuid, uuid) to service_role;
grant execute on function private.admin_set_school_payments(uuid, text, text, text, boolean) to service_role;
grant execute on function public.admin_set_school_payments(uuid, text, text, text, boolean) to service_role;

comment on function private.school_pass_info(uuid) is
  'School team: the school''s pass code, price, DriveRush''s share and whether payments are ready.';
comment on function public.school_pass_info(uuid) is
  'School team: the school''s pass code, price, DriveRush''s share and whether payments are ready.';
comment on function private.school_set_pass_price(uuid, integer) is
  'School owner or staff: sets the school pass price (KES 500 to 1,000).';
comment on function public.school_set_pass_price(uuid, integer) is
  'School owner or staff: sets the school pass price (KES 500 to 1,000).';
comment on function private.school_earnings(uuid, uuid) is
  'School team: settled payments through the school, by branch for admins.';
comment on function public.school_earnings(uuid, uuid) is
  'School team: settled payments through the school, by branch for admins.';
comment on function private.admin_set_school_payments(uuid, text, text, text, boolean) is
  'Staff: a school''s pass code, Paystack subaccount and bank label.';
comment on function public.admin_set_school_payments(uuid, text, text, text, boolean) is
  'Staff: a school''s pass code, Paystack subaccount and bank label.';
