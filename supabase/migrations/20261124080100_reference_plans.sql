-- Reference rows every database needs: the plans. Prices are placeholders
-- (0 KES) and the plans stay inactive (hidden from the pricing page) until the
-- owner sets real prices in a later migration.
insert into public.plans (code, audience, name, price_kes, period, limits, is_active) values
  ('learner_monthly', 'learner', 'Learner monthly', 0, interval '1 month', '{}'::jsonb, false),
  ('school_standard', 'school', 'School standard', 0, interval '1 month',
   '{"max_admins": 50, "max_branches": null, "monthly_student_links": null}'::jsonb, false)
on conflict (code) do nothing;
