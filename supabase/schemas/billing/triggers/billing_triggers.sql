-- ===================================================
-- TRIGGERS: billing
-- ===================================================
create or replace trigger learner_subscriptions_set_updated_at
  before update on public.learner_subscriptions
  for each row execute function private.set_updated_at();

create or replace trigger school_subscriptions_set_updated_at
  before update on public.school_subscriptions
  for each row execute function private.set_updated_at();

create or replace trigger school_payment_settings_set_updated_at
  before update on public.school_payment_settings
  for each row execute function private.set_updated_at();
