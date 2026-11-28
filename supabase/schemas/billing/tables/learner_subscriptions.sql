-- ===================================================
-- TABLE: public.learner_subscriptions
-- ===================================================
-- A learner's passes: full access from starts_at to ends_at (owner,
-- 2026-11-25: a 60-day pass, or a 30-day extension; never a subscription that
-- renews). A pass bought while another runs starts when it ends, so a
-- learner's passes are back to back. A school link never pauses a pass: the
-- link is the school's view of the learner, the pass is what unlocks.
--
-- Written by settle_payment (source payment, with its payment_id) or by
-- DriveRush staff (source grant) only.
create table public.learner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null default 'payment' check (source in ('payment', 'grant')),
  payment_id uuid unique references public.payments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (source = 'grant' or payment_id is not null or status = 'cancelled')
);

create index learner_subscriptions_user_idx on public.learner_subscriptions (user_id, ends_at);
create index learner_subscriptions_plan_idx on public.learner_subscriptions (plan_id);

comment on table public.learner_subscriptions is
  'A learner''s passes (60 days, or a 30-day extension), back to back. Payment flow or staff grants only.';
