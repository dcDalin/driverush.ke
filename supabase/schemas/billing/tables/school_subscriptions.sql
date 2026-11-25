-- ===================================================
-- TABLE: public.school_subscriptions
-- ===================================================
-- A school's flat plan for a period. Written by the payment flow or staff
-- (service role) only. Not yet required for a school to link learners.
create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index school_subscriptions_school_idx on public.school_subscriptions (school_id, ends_at);
create index school_subscriptions_plan_idx on public.school_subscriptions (plan_id);

comment on table public.school_subscriptions is
  'A school''s flat plan for a period.';
