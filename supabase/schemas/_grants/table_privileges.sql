-- ===================================================
-- GRANTS: who may read and write our tables
-- ===================================================
-- The only place that grants table privileges to anon or authenticated.
-- Row level security then decides which rows; a privilege missing here means
-- the API refuses the statement before any policy runs. The declared intent
-- per table is tests.table_access in
-- supabase/tests/database/000_security_manifest.test.sql.
--
-- Listed last in supabase/config.toml schema_paths and copied verbatim into a
-- migration whenever it changes.

-- ── 1. Nothing is readable or writable by clients by default ────────────
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ── 2. Start from nothing ───────────────────────────────────────────────
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ── 3. anon: the plans (pricing page) ───────────────────────────────────
grant select on public.plans to anon;

-- ── 4. authenticated: reads (row level security picks the rows) ─────────
grant select on public.learner_progress to authenticated;
grant select on public.learner_subscriptions to authenticated;
grant select on public.payments to authenticated;
grant select on public.plans to authenticated;
grant select on public.profiles to authenticated;
grant select on public.school_branches to authenticated;
grant select on public.school_liveries to authenticated;
grant select on public.school_member_branches to authenticated;
grant select on public.school_member_invites to authenticated;
grant select on public.school_members to authenticated;
grant select on public.school_profiles to authenticated;
grant select on public.school_sponsorships to authenticated;
grant select on public.school_student_links to authenticated;
grant select on public.school_subscriptions to authenticated;
grant select on public.schools to authenticated;
grant select on public.user_roles to authenticated;

-- ── 5. authenticated: the only direct writes ────────────────────────────
-- A learner's own profile fields.
grant update (full_name, avatar_url) on public.profiles to authenticated;
-- A learner's own saved progress (the app upserts one row per store). An
-- upsert's DO UPDATE sets every column it sends, user_id and store included;
-- the policies keep user_id the caller's own.
grant insert (user_id, store, data, version) on public.learner_progress to authenticated;
grant update (user_id, store, data, version) on public.learner_progress to authenticated;
grant delete on public.learner_progress to authenticated;
