-- ===================================================
-- TABLE: public.learner_subscriptions
-- ===================================================
-- A learner's own paid time. Written by the payment flow (service role) only.
-- While a school link is current, the paid time pauses: the subscription's
-- dates move forward by the school month (subscription_pauses records each
-- move) and back by any unused part if the link ends early.
create table public.learner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null default 'payment' check (source in ('payment', 'grant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index learner_subscriptions_user_idx on public.learner_subscriptions (user_id, ends_at);
create index learner_subscriptions_plan_idx on public.learner_subscriptions (plan_id);

comment on table public.learner_subscriptions is
  'A learner''s own paid time. Pauses (dates move forward) while a school link is current.';
