-- ===================================================
-- ACCESS: public.learner_progress
-- ===================================================
-- Reads:  A learner reads their own rows. Their school (owner, branch admin)
--         and staff read them through school_student_progress.
-- Writes: A learner inserts, updates and deletes their own rows (the app's
--         sync upserts one row per store).
-- Grants: anon: none; authenticated: SELECT, INSERT(data, store, user_id, version),
--         UPDATE(data, store, user_id, version), DELETE
alter table public.learner_progress enable row level security;

create policy "learner_progress: read own"
  on public.learner_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "learner_progress: insert own"
  on public.learner_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "learner_progress: update own"
  on public.learner_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "learner_progress: delete own"
  on public.learner_progress for delete to authenticated
  using (user_id = (select auth.uid()));
