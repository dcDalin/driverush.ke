-- ===================================================
-- TRIGGERS: billing
-- ===================================================
create or replace trigger learner_subscriptions_set_updated_at
  before update on public.learner_subscriptions
  for each row execute function private.set_updated_at();

create or replace trigger school_subscriptions_set_updated_at
  before update on public.school_subscriptions
  for each row execute function private.set_updated_at();

-- Paid time bought during a school month starts when the month ends.
create or replace trigger learner_subscriptions_pause_new
  after insert on public.learner_subscriptions
  for each row execute function private.pause_new_subscription();
