-- Reference rows every database needs: the plans. Idempotent (the full seed
-- re-runs it after its reset), and it updates a plan that exists, so a price
-- change is an edit here.
--
-- The passes (owner, 2026-11-25): learners pay, schools pay nothing.
--   learner_pass       KES 1,000, 60 days
--   school_pass        the school's own price (school_payment_settings,
--                      KES 500 to 1,000), 60 days; DriveRush keeps
--                      driverush_share_kes, the school the rest
--   learner_extension  KES 300, 30 more days
-- The first two plans from before the model was chosen stay, switched off.
insert into public.plans (code, audience, name, price_kes, period, limits, is_active) values
  ('learner_pass', 'learner', 'DriveRush pass', 1000, interval '60 days', '{}'::jsonb, true),
  ('school_pass', 'learner', 'DriveRush pass through your school', 0, interval '60 days',
   '{"driverush_share_kes": 300}'::jsonb, true),
  ('learner_extension', 'learner', '30 more days', 300, interval '30 days', '{}'::jsonb, true),
  ('learner_monthly', 'learner', 'Learner monthly', 0, interval '1 month', '{}'::jsonb, false),
  ('school_standard', 'school', 'School standard', 0, interval '1 month',
   '{"max_admins": 50, "max_branches": null, "monthly_student_links": null}'::jsonb, false)
on conflict (code) do update
  set audience = excluded.audience,
      name = excluded.name,
      price_kes = excluded.price_kes,
      period = excluded.period,
      limits = excluded.limits,
      is_active = excluded.is_active;
