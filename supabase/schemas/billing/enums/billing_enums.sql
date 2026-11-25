-- ===================================================
-- ENUMS: billing
-- ===================================================
create type public.plan_audience as enum ('learner', 'school');

comment on type public.plan_audience is
  'Who buys the plan: a learner (a pass, public or through their school) or a school (unused: schools pay nothing).';

create type public.subscription_status as enum ('active', 'cancelled');

comment on type public.subscription_status is
  'active: counts while now() is between starts_at and ends_at. cancelled: never counts.';

create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

comment on type public.payment_status is
  'A payment attempt''s state, whatever the provider.';
