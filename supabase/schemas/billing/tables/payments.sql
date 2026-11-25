-- ===================================================
-- TABLE: public.payments
-- ===================================================
-- Every payment attempt, whatever the provider (chosen later). Written by the
-- service role only. A learner pays for themselves (payer_user_id), or a school
-- pays its plan (school_id, with payer_user_id the member who paid).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payer_user_id uuid references auth.users (id) on delete set null,
  school_id uuid references public.schools (id) on delete set null,
  plan_id uuid references public.plans (id),
  amount_kes integer not null check (amount_kes > 0),
  provider text not null check (char_length(provider) between 2 and 40),
  provider_ref text,
  status public.payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (num_nonnulls(payer_user_id, school_id) >= 1),
  unique (provider, provider_ref)
);

create index payments_payer_idx on public.payments (payer_user_id);
create index payments_school_idx on public.payments (school_id);
create index payments_plan_idx on public.payments (plan_id);

comment on table public.payments is
  'Payment attempts, provider-neutral. Service role writes only.';
