-- ===================================================
-- TABLE: public.payments
-- ===================================================
-- Every payment a learner starts for a pass (owner, 2026-11-25): a public
-- pass, a pass through their driving school, or an extension. Paystack takes
-- the money on its checkout page; provider_ref is our own reference, sent to
-- Paystack, so the webhook and the return page find the row and settling it
-- twice changes nothing (unique (provider, provider_ref)).
--
-- A school pass is split at source: Paystack settles school_share_kes to the
-- school's bank (its subaccount) and driverush_share_kes to DriveRush. The
-- amounts are fixed when the checkout starts, from the school's price and the
-- plan's share, so a later price change never alters a payment.
--
-- Written by start_pass_checkout (pending) and the payment flow (service
-- role) only.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payer_user_id uuid references auth.users (id) on delete set null,
  -- The school the learner paid through (its share is school_share_kes).
  school_id uuid references public.schools (id) on delete set null,
  branch_id uuid references public.school_branches (id) on delete set null,
  plan_id uuid references public.plans (id),
  amount_kes integer not null check (amount_kes > 0),
  driverush_share_kes integer not null check (driverush_share_kes > 0),
  school_share_kes integer not null default 0 check (school_share_kes >= 0),
  -- Paystack's fee, paid by DriveRush (bearer: account); known once settled.
  fee_kes numeric(10, 2) check (fee_kes is null or fee_kes >= 0),
  provider text not null check (char_length(provider) between 2 and 40),
  provider_ref text,
  status public.payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (driverush_share_kes + school_share_kes = amount_kes),
  check ((school_share_kes > 0) = (school_id is not null)),
  check ((status in ('succeeded', 'refunded')) = (settled_at is not null)),
  unique (provider, provider_ref)
);

create index payments_payer_idx on public.payments (payer_user_id);
create index payments_school_idx on public.payments (school_id, settled_at);
create index payments_branch_idx on public.payments (branch_id);
create index payments_plan_idx on public.payments (plan_id);

comment on table public.payments is
  'Learner payments for passes (Paystack). A school pass carries the school''s share, split at source. Service role writes only.';
