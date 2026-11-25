-- ===================================================
-- ACCESS: public.plans
-- ===================================================
-- Reads:  Anyone reads active plans (the pricing page); staff read all.
-- Writes: No client: a migration (reference rows).
-- Grants: anon: SELECT; authenticated: SELECT
alter table public.plans enable row level security;

-- One policy per role and command, so Postgres never evaluates two
-- permissive policies for the same read (advisor: multiple_permissive_policies).
-- anon gets its own: it cannot call private.is_staff().
create policy "plans: guests read active"
  on public.plans for select to anon
  using (is_active);

create policy "plans: signed-in read active, staff read all"
  on public.plans for select to authenticated
  using (is_active or (select private.is_staff()));

-- ===================================================
-- ACCESS: public.learner_subscriptions
-- ===================================================
-- Reads:  A learner reads their own; DriveRush staff read all.
-- Writes: No client: the payment flow (service role); dates move through
--         the pause functions while a school link is current.
-- Grants: anon: none; authenticated: SELECT
alter table public.learner_subscriptions enable row level security;

create policy "learner_subscriptions: read own or staff"
  on public.learner_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- ===================================================
-- ACCESS: public.school_subscriptions
-- ===================================================
-- Reads:  The school's owner; DriveRush staff.
-- Writes: No client: the payment flow or staff (service role).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_subscriptions enable row level security;

create policy "school_subscriptions: owner or staff read"
  on public.school_subscriptions for select to authenticated
  using ((select private.is_staff()) or private.is_school_owner(school_id));

-- ===================================================
-- ACCESS: public.payments
-- ===================================================
-- Reads:  The learner who paid; the owner of the school paid for; staff.
-- Writes: No client: the payment flow (service role).
-- Grants: anon: none; authenticated: SELECT
alter table public.payments enable row level security;

create policy "payments: payer, school owner or staff read"
  on public.payments for select to authenticated
  using (
    payer_user_id = (select auth.uid())
    or (select private.is_staff())
    or (school_id is not null and private.is_school_owner(school_id))
  );

-- ===================================================
-- ACCESS: public.subscription_pauses
-- ===================================================
-- Reads:  No client (internal bookkeeping of the pause functions).
-- Writes: No client: private.pause_subscription, resume_subscriptions_for_link.
-- Grants: anon: none; authenticated: none
alter table public.subscription_pauses enable row level security;

-- Said out loud rather than left to "no policy" (advisor: rls_enabled_no_policy).
create policy "subscription_pauses: clients no access"
  on public.subscription_pauses for all to anon, authenticated
  using (false)
  with check (false);
