-- Clears the Supabase advisors (Security and Performance):
--   multiple_permissive_policies  plans: one SELECT policy per role
--   rls_enabled_no_policy         subscription_pauses: an explicit deny policy
--   unindexed_foreign_keys        a covering index for every foreign key
-- From supabase/schemas/billing/rls/billing_rls.sql and the tables files.

drop policy "plans: anyone reads active" on "public"."plans";

drop policy "plans: staff read all" on "public"."plans";

drop index if exists "public"."school_member_branches_branch_idx";

drop index if exists "public"."school_student_links_branch_idx";

CREATE INDEX learner_subscriptions_plan_idx ON public.learner_subscriptions USING btree (plan_id);

CREATE INDEX payments_plan_idx ON public.payments USING btree (plan_id);

CREATE INDEX school_member_branches_member_idx ON public.school_member_branches USING btree (member_id, school_id);

CREATE INDEX school_member_invites_invited_by_idx ON public.school_member_invites USING btree (invited_by);

CREATE INDEX school_members_added_by_idx ON public.school_members USING btree (added_by);

CREATE INDEX school_student_links_added_by_idx ON public.school_student_links USING btree (added_by);

CREATE INDEX school_subscriptions_plan_idx ON public.school_subscriptions USING btree (plan_id);

CREATE INDEX schools_created_by_idx ON public.schools USING btree (created_by);

CREATE INDEX school_member_branches_branch_idx ON public.school_member_branches USING btree (branch_id, school_id);

CREATE INDEX school_student_links_branch_idx ON public.school_student_links USING btree (branch_id, school_id, status);


  create policy "plans: guests read active"
  on "public"."plans"
  as permissive
  for select
  to anon
using (is_active);



  create policy "plans: signed-in read active, staff read all"
  on "public"."plans"
  as permissive
  for select
  to authenticated
using ((is_active OR ( SELECT private.is_staff() AS is_staff)));



  create policy "subscription_pauses: clients no access"
  on "public"."subscription_pauses"
  as permissive
  for all
  to anon, authenticated
using (false)
with check (false);



