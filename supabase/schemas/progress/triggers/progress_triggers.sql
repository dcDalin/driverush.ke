-- ===================================================
-- TRIGGERS: progress
-- ===================================================
create or replace trigger learner_progress_set_updated_at
  before update on public.learner_progress
  for each row execute function private.set_updated_at();
