-- ===================================================
-- TABLE: public.plans
-- ===================================================
-- What a learner or a school can buy. Reference rows are a migration
-- (supabase/migrations/*_reference_plans.sql), changed by a new migration.
-- limits (school plans): max_branches, max_admins (never above 50),
-- monthly_student_links.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  audience public.plan_audience not null,
  name text not null check (char_length(name) between 2 and 80),
  price_kes integer not null check (price_kes >= 0),
  period interval not null check (period > interval '0'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.plans is
  'Learner and school plans: price in KES, billing period and (for schools) limits.';
