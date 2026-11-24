-- ===================================================
-- ACCESS: public.profiles
-- ===================================================
-- Reads:  A learner reads their own profile; DriveRush staff read all.
--         Schools see their learners' names through school_student_progress.
-- Writes: A learner updates their own full_name and avatar_url. Rows are
--         created by handle_new_user; email follows auth.users.
-- Grants: anon: none; authenticated: SELECT, UPDATE(avatar_url, full_name)
--         (supabase/schemas/_grants/table_privileges.sql)
alter table public.profiles enable row level security;

create policy "profiles: read own or staff"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
