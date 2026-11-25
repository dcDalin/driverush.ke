-- ===================================================
-- pgTAP: the security manifest (runs first)
-- ===================================================
-- The declared access for every function, table and policy we own. The
-- security_*.test.sql files compare the live database against these rows.
-- The grants that enforce it live in supabase/schemas/_grants/. How to add a
-- row: supabase/schemas/README.md.
--
-- The manifest and the helpers are committed (no transaction around them)
-- because the other files read them; zzz_security_teardown drops them again.
--
-- access: who may execute the function
--   anon           anon, authenticated and service_role
--   authenticated  authenticated and service_role (a signed-in caller)
--   service_role   service_role only (other functions, the payment flow)
--   trigger        a trigger function
--   auth_hook      supabase_auth_admin and service_role (the token hook)
-- guard: the check inside the body
--   none     the grant is the gate (service_role only)
--   public   safe for any caller: answers only for the caller
--   self     acts only on the caller's own rows (auth.uid())
--   school   the caller's school role (owner, branch admin) or DriveRush staff
--   admin    DriveRush su or admin (private.is_staff)
--   su       DriveRush su only (private.is_su)
-- fn is `name(argument types)` as format('%s(%s)', proname,
-- oidvectortypes(proargtypes)) prints it with search_path public, and
-- `private.name(argument types)` for a function in schema private.
-- ===================================================

drop schema if exists tests cascade;
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create table tests.function_access (
  fn text primary key,
  access text not null check (access in ('anon', 'authenticated', 'service_role', 'trigger', 'auth_hook')),
  guard text not null check (guard in ('none', 'public', 'self', 'school', 'admin', 'su')),
  guard_detail text not null,
  callers text not null
);

insert into tests.function_access (fn, access, guard, guard_detail, callers) values
  -- DriveRush console
  ('admin_create_school(text, text, text)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_create_school(text, text, text)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('admin_set_school_status(uuid, school_status)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_set_school_status(uuid, school_status)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('admin_transfer_school_owner(uuid, text)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_transfer_school_owner(uuid, text)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('admin_livery_draft_get(uuid)', 'authenticated', 'admin', 'private.is_staff', 'board ?livery= preview (staff session)'),
  ('private.admin_livery_draft_get(uuid)', 'authenticated', 'admin', 'private.is_staff', 'board ?livery= preview (staff session)'),
  ('admin_publish_livery(uuid)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session); livery:publish --live (staff session)'),
  ('private.admin_publish_livery(uuid)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session); livery:publish --live (staff session)'),
  ('admin_retire_livery(uuid)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_retire_livery(uuid)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('admin_set_sponsorship(uuid, date, date, text)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_set_sponsorship(uuid, date, date, text)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('admin_end_sponsorship(uuid)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_end_sponsorship(uuid)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('admin_set_school_payments(uuid, text, text, text, boolean)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('private.admin_set_school_payments(uuid, text, text, text, boolean)', 'authenticated', 'admin', 'private.is_staff', 'DriveRush console (session)'),
  ('grant_platform_role(uuid, app_role)', 'authenticated', 'su', 'private.is_su', 'DriveRush console (session)'),
  ('private.grant_platform_role(uuid, app_role)', 'authenticated', 'su', 'private.is_su', 'DriveRush console (session)'),
  ('revoke_platform_role(uuid, app_role)', 'authenticated', 'su', 'private.is_su', 'DriveRush console (session)'),
  ('private.revoke_platform_role(uuid, app_role)', 'authenticated', 'su', 'private.is_su', 'DriveRush console (session)'),
  -- School owners
  ('school_create_branch(uuid, text, text)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_create_branch(uuid, text, text)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_update_branch(uuid, text, text, boolean)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_update_branch(uuid, text, text, boolean)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_update_branch_details(uuid, text, double precision, double precision, text, jsonb)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_update_branch_details(uuid, text, double precision, double precision, text, jsonb)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard, DriveRush console (session)'),
  ('private.school_update_profile(uuid, text, text, text, text, text, text, jsonb, text, text)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard, DriveRush console (session)'),
  ('school_add_admin(uuid, text, uuid[])', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_add_admin(uuid, text, uuid[])', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_set_admin_branches(uuid, uuid[])', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_set_admin_branches(uuid, uuid[])', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_remove_admin(uuid)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_remove_admin(uuid)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_cancel_member_invite(uuid)', 'authenticated', 'school', 'private.can_manage_school (owner or staff; owner invites staff only)', 'school dashboard (session)'),
  ('private.school_cancel_member_invite(uuid)', 'authenticated', 'school', 'private.can_manage_school (owner or staff; owner invites staff only)', 'school dashboard (session)'),
  ('school_members_list(uuid)', 'authenticated', 'school', 'is_school_member or is_staff', 'school dashboard (session)'),
  ('private.school_members_list(uuid)', 'authenticated', 'school', 'is_school_member or is_staff', 'school dashboard (session)'),
  ('school_set_pass_price(uuid, integer)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('private.school_set_pass_price(uuid, integer)', 'authenticated', 'school', 'private.can_manage_school (owner or staff)', 'school dashboard (session)'),
  ('school_pass_info(uuid)', 'authenticated', 'school', 'is_school_member or is_staff; bank label to owner and staff', 'school dashboard (session)'),
  ('private.school_pass_info(uuid)', 'authenticated', 'school', 'is_school_member or is_staff; bank label to owner and staff', 'school dashboard (session)'),
  ('school_earnings(uuid, uuid)', 'authenticated', 'school', 'is_school_member or is_staff; rows by can_see_branch', 'school dashboard (session)'),
  ('private.school_earnings(uuid, uuid)', 'authenticated', 'school', 'is_school_member or is_staff; rows by can_see_branch', 'school dashboard (session)'),
  -- School owners and branch admins
  ('school_add_student(uuid, text)', 'authenticated', 'school', 'private.can_manage_branch (owner, branch admin or staff)', 'school dashboard (session)'),
  ('private.school_add_student(uuid, text)', 'authenticated', 'school', 'private.can_manage_branch (owner, branch admin or staff)', 'school dashboard (session)'),
  ('school_release_student(uuid)', 'authenticated', 'school', 'private.can_manage_branch (owner, branch admin or staff)', 'school dashboard (session)'),
  ('private.school_release_student(uuid)', 'authenticated', 'school', 'private.can_manage_branch (owner, branch admin or staff)', 'school dashboard (session)'),
  ('school_cancel_student_invite(uuid)', 'authenticated', 'school', 'private.can_manage_branch (owner, branch admin or staff)', 'school dashboard (session)'),
  ('private.school_cancel_student_invite(uuid)', 'authenticated', 'school', 'private.can_manage_branch (owner, branch admin or staff)', 'school dashboard (session)'),
  ('school_move_student_branch(uuid, uuid)', 'authenticated', 'school', 'private.can_manage_branch on both branches', 'school dashboard (session)'),
  ('private.school_move_student_branch(uuid, uuid)', 'authenticated', 'school', 'private.can_manage_branch on both branches', 'school dashboard (session)'),
  ('school_student_progress(uuid, uuid)', 'authenticated', 'school', 'is_school_member or is_staff; rows by can_see_branch', 'school dashboard (session)'),
  ('private.school_student_progress(uuid, uuid)', 'authenticated', 'school', 'is_school_member or is_staff; rows by can_see_branch', 'school dashboard (session)'),
  -- Learners
  ('learner_accept_school_link(uuid)', 'authenticated', 'self', 'link.user_id = auth.uid()', 'web (learner session)'),
  ('private.learner_accept_school_link(uuid)', 'authenticated', 'self', 'link.user_id = auth.uid()', 'web (learner session)'),
  ('learner_decline_school_link(uuid)', 'authenticated', 'self', 'link.user_id = auth.uid()', 'web (learner session)'),
  ('private.learner_decline_school_link(uuid)', 'authenticated', 'self', 'link.user_id = auth.uid()', 'web (learner session)'),
  ('my_entitlement()', 'authenticated', 'self', 'answers for auth.uid() only', 'web (learner session)'),
  ('private.my_entitlement()', 'authenticated', 'self', 'answers for auth.uid() only', 'web (learner session)'),
  ('start_pass_checkout(text, text, uuid)', 'authenticated', 'self', 'writes a payment for auth.uid() only', '/pass action (server, learner session)'),
  ('private.start_pass_checkout(text, text, uuid)', 'authenticated', 'self', 'writes a payment for auth.uid() only', '/pass action (server, learner session)'),
  ('my_pass_offers()', 'authenticated', 'self', 'answers for auth.uid() only', '/pass (server, learner session)'),
  ('private.my_pass_offers()', 'authenticated', 'self', 'answers for auth.uid() only', '/pass (server, learner session)'),
  ('pass_school_by_code(text)', 'authenticated', 'public', 'a school''s public price and branch names only', '/pass (server, learner session)'),
  ('private.pass_school_by_code(text)', 'authenticated', 'public', 'a school''s public price and branch names only', '/pass (server, learner session)'),
  -- Anyone, guests included
  ('board_schools()', 'anon', 'public', 'active schools'' public profile and live livery only', 'web root loader, /api/board-schools (server)'),
  ('private.board_schools()', 'anon', 'public', 'active schools'' public profile and live livery only', 'web root loader, /api/board-schools (server)'),
  -- Row level security helpers (answer for the caller)
  ('private.is_staff()', 'authenticated', 'public', 'answers for the caller', 'RLS policies; admin_* functions'),
  ('private.is_su()', 'authenticated', 'public', 'answers for the caller', 'RLS policies; grant_platform_role, revoke_platform_role'),
  ('private.is_school_owner(uuid)', 'authenticated', 'public', 'answers for the caller', 'RLS policies; school_* functions'),
  ('private.is_school_member(uuid)', 'authenticated', 'public', 'answers for the caller', 'RLS policies; school_student_progress'),
  ('private.can_see_branch(uuid)', 'authenticated', 'public', 'answers for the caller', 'RLS policies; can_manage_branch, school_student_progress'),
  ('private.has_school_link(uuid)', 'authenticated', 'public', 'answers for the caller', 'RLS policies (schools, school_branches)'),
  ('private.is_active_school(uuid)', 'anon', 'public', 'a public fact (is the school active); returns no row', 'RLS policies (school_profiles, school_liveries)'),
  -- Supabase Auth
  ('custom_access_token_hook(jsonb)', 'auth_hook', 'none', '', 'Supabase Auth (access token hook)'),
  -- Internal
  ('private.activate_link(uuid, uuid)', 'service_role', 'none', '', 'called by match_pending_invites, school_add_student, learner_accept_school_link, settle_payment'),
  ('private.assert_admin_room(uuid)', 'service_role', 'none', '', 'called by enforce_member_admin_limit, enforce_invite_admin_limit'),
  ('private.assert_school_branches(uuid, uuid[])', 'service_role', 'none', '', 'called by school_add_admin, school_set_admin_branches'),
  ('private.can_manage_branch(uuid)', 'service_role', 'none', '', 'called by the school student functions'),
  ('private.can_manage_school(uuid)', 'service_role', 'none', '', 'called by the school branch and admin functions'),
  ('private.close_expired_links(uuid, citext)', 'service_role', 'none', '', 'called by activate_link, match_pending_invites, school_add_student, learner_accept_school_link'),
  ('private.confirmed_user_id(citext)', 'service_role', 'none', '', 'called by school_add_student, school_add_admin, set_school_owner'),
  ('private.current_link_id(uuid)', 'service_role', 'none', '', 'called by match_pending_invites, school_add_student, learner_accept_school_link, my_entitlement'),
  ('private.end_link(uuid, link_end_reason)', 'service_role', 'none', '', 'called by school_release_student, learner_accept_school_link, settle_payment'),
  ('private.has_platform_role(app_role[])', 'service_role', 'none', '', 'called by is_staff, is_su'),
  ('private.is_local_stack()', 'service_role', 'none', '', 'the local seed'),
  ('private.match_pending_invites(uuid)', 'service_role', 'none', '', 'called by handle_new_user, handle_auth_user_updated'),
  ('settle_payment(text, integer, numeric, jsonb)', 'service_role', 'none', '', '/api/webhooks/paystack, /pass/done (server, service role); the seed'),
  ('fail_payment(text, jsonb)', 'service_role', 'none', '', '/api/webhooks/paystack, /pass/done (server, service role)'),
  ('refund_payment(text, jsonb)', 'service_role', 'none', '', '/api/webhooks/paystack (server, service role)'),
  ('private.settle_payment(text, integer, numeric, jsonb)', 'service_role', 'none', '', '/webhooks/paystack, /pass/done (server, after verifying with Paystack); the seed'),
  ('private.fail_payment(text, jsonb)', 'service_role', 'none', '', '/webhooks/paystack, /pass/done (server)'),
  ('private.refund_payment(text, jsonb)', 'service_role', 'none', '', '/webhooks/paystack (server)'),
  ('private.set_school_owner(uuid, citext, uuid)', 'service_role', 'none', '', 'called by admin_create_school, admin_transfer_school_owner'),
  ('private.signed_in_with_password()', 'service_role', 'none', '', 'called by has_platform_role'),
  ('school_set_logo(uuid, text, jsonb, uuid)', 'service_role', 'none', '', 'logo upload (server, after the owner gate); the seed'),
  ('private.school_set_logo(uuid, text, jsonb, uuid)', 'service_role', 'none', '', 'called by school_set_logo'),
  ('private.board_school_json(schools, school_liveries)', 'service_role', 'none', '', 'called by board_schools, admin_livery_draft_get'),
  ('private.kenya_today()', 'service_role', 'none', '', 'called by board_school_json, admin_end_sponsorship'),
  ('private.valid_branch_hours(jsonb)', 'service_role', 'none', '', 'CHECK on school_branches'),
  ('private.valid_hex_colour(text)', 'authenticated', 'public', 'a pure check of its arguments; reads no table', 'CHECK on school_profiles, school_liveries (staff write liveries directly)'),
  ('private.valid_media_path(text, uuid)', 'authenticated', 'public', 'a pure check of its arguments; reads no table', 'CHECK on school_profiles, school_liveries (staff write liveries directly)'),
  ('private.valid_media_paths(jsonb, uuid)', 'authenticated', 'public', 'a pure check of its arguments; reads no table', 'CHECK on school_liveries (staff write liveries directly)'),
  ('private.valid_media_ref(jsonb, uuid)', 'authenticated', 'public', 'a pure check of its arguments; reads no table', 'CHECK on school_profiles, school_liveries (staff write liveries directly)'),
  ('private.valid_paint(jsonb, uuid)', 'authenticated', 'public', 'a pure check of its arguments; reads no table', 'CHECK on school_liveries (staff write liveries directly)'),
  ('private.valid_socials(jsonb)', 'service_role', 'none', '', 'CHECK on school_profiles'),
  -- Triggers
  ('private.enforce_invite_admin_limit()', 'trigger', 'none', '', 'trigger on school_member_invites'),
  ('private.enforce_member_admin_limit()', 'trigger', 'none', '', 'trigger on school_members'),
  ('private.handle_auth_user_updated()', 'trigger', 'none', '', 'trigger on auth.users'),
  ('private.handle_new_user()', 'trigger', 'none', '', 'trigger on auth.users'),
  ('private.set_updated_at()', 'trigger', 'none', '', 'triggers on profiles, schools, school_branches, school_profiles, subscriptions, school_payment_settings, learner_progress');

-- ── Tables ─────────────────────────────────────────────────────────────
-- anon / authenticated: the privileges the role holds, as 'SELECT' or
-- 'SELECT, UPDATE(col, col)' ('' for none). The grants live in
-- supabase/schemas/_grants/table_privileges.sql; each table's rls file opens
-- with the same reads/writes block.
create table tests.table_access (
  tbl text primary key,
  anon text not null,
  authenticated text not null,
  reads text not null,
  writes text not null
);

insert into tests.table_access (tbl, anon, authenticated, reads, writes) values
  ('learner_progress', '', 'SELECT, INSERT(data, store, user_id, version), UPDATE(data, store, user_id, version), DELETE', 'own rows; schools via school_student_progress', 'own rows'),
  ('learner_subscriptions', '', 'SELECT', 'own rows; staff', 'settle_payment, refund_payment (service role); staff grants'),
  ('payments', '', 'SELECT', 'payer; school owner; staff (admins via school_earnings)', 'start_pass_checkout; settle/fail/refund_payment (service role)'),
  ('plans', 'SELECT', 'SELECT', 'anyone (active); staff (all)', 'migrations'),
  ('profiles', '', 'SELECT, UPDATE(avatar_url, full_name)', 'own; staff', 'own name and avatar; handle_new_user'),
  ('school_branches', '', 'SELECT', 'staff; school members; linked learners', 'school_create_branch, school_update_branch, school_update_branch_details'),
  ('school_member_branches', '', 'SELECT', 'staff; school members', 'school_add_admin, school_set_admin_branches'),
  ('school_member_invites', '', 'SELECT', 'staff; school owner', 'school_add_admin, admin_* functions, match_pending_invites'),
  ('school_liveries', 'SELECT(banner, base_color, created_at, id, label, marks, paint, posters, published_at, rail, school_id, status, stills, thumbs, top_board)', 'SELECT(banner, base_color, created_at, id, label, marks, paint, posters, published_at, rail, school_id, status, stills, thumbs, top_board), INSERT(banner, base_color, label, marks, paint, posters, rail, school_id, stills, thumbs, top_board), UPDATE(banner, base_color, label, marks, paint, posters, rail, stills, thumbs, top_board), DELETE', 'anyone: live liveries of active schools; staff: all', 'staff only (policies + admin_publish_livery, admin_retire_livery), livery:publish included'),
  ('school_members', '', 'SELECT', 'staff; school members', 'admin_* functions, school_add_admin, school_remove_admin'),
  ('school_payment_settings', '', 'SELECT', 'school owner; staff', 'admin_set_school_payments, school_set_pass_price'),
  ('school_profiles', 'SELECT(about, brand_ink, brand_paint, email, logo, logo_mono, phone, school_id, socials, tagline, updated_at, website_url, whatsapp)', 'SELECT(about, brand_ink, brand_paint, email, logo, logo_mono, phone, school_id, socials, tagline, updated_at, website_url, whatsapp)', 'anyone: active schools; members and staff: their own', 'school_update_profile (owner, staff); school_set_logo (server)'),
  ('school_sponsorships', '', 'SELECT', 'staff', 'admin_set_sponsorship, admin_end_sponsorship'),
  ('school_student_links', '', 'SELECT', 'own links; owner; branch admins; staff', 'school_* and learner_* link functions'),
  ('school_subscriptions', '', 'SELECT', 'school owner; staff', 'service role'),
  ('schools', '', 'SELECT', 'staff; members; linked learners', 'admin_create_school, admin_set_school_status'),
  ('user_roles', '', 'SELECT', 'own; su', 'handle_new_user; grant/revoke_platform_role');

create table tests.policy_access (
  tbl text not null,
  policy text not null,
  cmd text not null,
  roles text not null,
  primary key (tbl, policy)
);

insert into tests.policy_access (tbl, policy, cmd, roles) values
  ('learner_progress', 'learner_progress: delete own', 'DELETE', 'authenticated'),
  ('learner_progress', 'learner_progress: insert own', 'INSERT', 'authenticated'),
  ('learner_progress', 'learner_progress: read own', 'SELECT', 'authenticated'),
  ('learner_progress', 'learner_progress: update own', 'UPDATE', 'authenticated'),
  ('learner_subscriptions', 'learner_subscriptions: read own or staff', 'SELECT', 'authenticated'),
  ('payments', 'payments: payer, school owner or staff read', 'SELECT', 'authenticated'),
  ('plans', 'plans: guests read active', 'SELECT', 'anon'),
  ('plans', 'plans: signed-in read active, staff read all', 'SELECT', 'authenticated'),
  ('profiles', 'profiles: read own or staff', 'SELECT', 'authenticated'),
  ('profiles', 'profiles: update own', 'UPDATE', 'authenticated'),
  ('school_branches', 'school_branches: staff, members and linked learners read', 'SELECT', 'authenticated'),
  ('school_member_branches', 'school_member_branches: staff and members read', 'SELECT', 'authenticated'),
  ('school_member_invites', 'school_member_invites: staff and owner read', 'SELECT', 'authenticated'),
  ('school_liveries', 'school_liveries: anyone reads live liveries', 'SELECT', 'anon'),
  ('school_liveries', 'school_liveries: anyone reads live liveries, staff read all', 'SELECT', 'authenticated'),
  ('school_liveries', 'school_liveries: staff insert drafts', 'INSERT', 'authenticated'),
  ('school_liveries', 'school_liveries: staff update', 'UPDATE', 'authenticated'),
  ('school_liveries', 'school_liveries: staff delete all but the live one', 'DELETE', 'authenticated'),
  ('school_members', 'school_members: staff and members read', 'SELECT', 'authenticated'),
  ('school_payment_settings', 'school_payment_settings: owner or staff read', 'SELECT', 'authenticated'),
  ('school_profiles', 'school_profiles: anyone reads active schools', 'SELECT', 'anon'),
  ('school_profiles', 'school_profiles: public if active; members and staff', 'SELECT', 'authenticated'),
  ('school_sponsorships', 'school_sponsorships: staff read', 'SELECT', 'authenticated'),
  ('school_student_links', 'school_student_links: learner, branch staff or staff read', 'SELECT', 'authenticated'),
  ('school_subscriptions', 'school_subscriptions: owner or staff read', 'SELECT', 'authenticated'),
  ('schools', 'schools: staff, members and linked learners read', 'SELECT', 'authenticated'),
  ('user_roles', 'user_roles: read own or su', 'SELECT', 'authenticated');

grant select on all tables in schema tests to anon, authenticated, service_role;

-- ── Personas ───────────────────────────────────────────────────────────
-- tests.make_persona creates an account the way Supabase Auth does
-- (auth.users; handle_new_user adds the profile and `user` role), confirmed
-- unless p_confirmed is false, optionally with a platform role.
-- tests.become switches the transaction to a caller: 'anon', 'service', a
-- user id (password session) or 'otp:<user id>' (emailed-code session).
-- tests.sqlstate_as and tests.value_as run one statement as that caller and
-- return the SQLSTATE it raised or the value it returned; the statement is
-- always rolled back.
create sequence tests.persona_seq;

create function tests.make_persona(
  p_label text,
  p_role public.app_role default null,
  p_confirmed boolean default true,
  p_email text default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_n bigint := nextval('tests.persona_seq');
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (
    v_id,
    coalesce(p_email, format('%s-%s@security.test', lower(p_label), v_n)),
    'authenticated',
    'authenticated',
    jsonb_build_object('full_name', initcap(p_label)),
    case when p_confirmed then now() end
  );
  if p_role is not null then
    insert into public.user_roles (user_id, role) values (v_id, p_role) on conflict do nothing;
  end if;
  return v_id;
end;
$$;

-- The claims Supabase Auth signs for this user. amr says how they signed in
-- ('password' or 'otp'); user_role is what custom_access_token_hook adds.
create function tests.claims_for(p_user uuid, p_method text default 'password')
returns jsonb
language sql
stable
as $$
  select public.custom_access_token_hook(jsonb_build_object(
    'user_id', p_user,
    'claims', jsonb_build_object(
      'sub', p_user,
      'role', 'authenticated',
      'aal', 'aal1',
      'amr', jsonb_build_array(jsonb_build_object('method', p_method, 'timestamp', 0))
    )
  )) -> 'claims';
$$;

create function tests.become(p_who text)
returns void
language plpgsql
as $$
declare
  v_claims jsonb;
  v_role text;
begin
  if p_who = 'anon' then
    v_claims := '{"role": "anon"}';
    v_role := 'anon';
  elsif p_who = 'service' then
    v_claims := '{"role": "service_role"}';
    v_role := 'service_role';
  elsif p_who like 'otp:%' then
    v_claims := tests.claims_for(substr(p_who, 5)::uuid, 'otp');
    v_role := 'authenticated';
  else
    v_claims := tests.claims_for(p_who::uuid);
    v_role := 'authenticated';
  end if;
  perform set_config('request.jwt.claims', v_claims::text, true);
  perform set_config('role', v_role, true);
end;
$$;

-- Back to the test runner's own role (postgres).
create function tests.unbecome()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function tests.sqlstate_as(p_who text, p_sql text)
returns text
language plpgsql
as $$
begin
  begin
    perform tests.become(p_who);
    execute p_sql;
    raise exception using errcode = 'P9999';
  exception when others then
    if sqlstate = 'P9999' then
      return 'ok';
    end if;
    return sqlstate;
  end;
end;
$$;

create function tests.value_as(p_who text, p_sql text)
returns text
language plpgsql
as $$
declare
  v text;
begin
  begin
    perform tests.become(p_who);
    execute p_sql into v;
    raise exception using errcode = 'P9998', message = coalesce(v, '<null>');
  exception when others then
    if sqlstate = 'P9998' then
      return sqlerrm;
    end if;
    return 'ERROR ' || sqlstate;
  end;
end;
$$;

-- Runs one statement as that caller and keeps its effects (unlike
-- sqlstate_as and value_as), returning its single value as text ('' for
-- none, as from a void function). Errors
-- propagate, so use it only for calls that must succeed.
create function tests.run_as(p_who text, p_sql text)
returns text
language plpgsql
as $$
declare
  v text;
begin
  perform tests.become(p_who);
  execute p_sql into v;
  perform tests.unbecome();
  return coalesce(v, '');
end;
$$;

-- ── A small world ──────────────────────────────────────────────────────
-- Two schools, their staff and learners, made directly (the guards are tested
-- separately). Returns every id by name:
--   su, staff                 DriveRush su and admin
--   school_a (a1, a2), school_b (b1)
--   owner_a, admin_a1 (branch a1), admin_a2 (branch a2), owner_b
--   learner_a1, learner_a2    current links with school A
--   learner_b                 current link with school B
--   learner_free              no link
--   link_a1, link_a2, link_b
create function tests.make_world()
returns jsonb
language plpgsql
as $$
declare
  w jsonb := '{}'::jsonb;
  v uuid;
  v_member uuid;
begin
  w := w || jsonb_build_object('su', tests.make_persona('su', 'driverush_su'));
  w := w || jsonb_build_object('staff', tests.make_persona('staff', 'driverush_admin'));

  insert into public.schools (slug, name)
  values ('test-a-' || nextval('tests.persona_seq'), 'Test School A')
  returning id into v;
  w := w || jsonb_build_object('school_a', v);
  insert into public.schools (slug, name)
  values ('test-b-' || nextval('tests.persona_seq'), 'Test School B') returning id into v;
  w := w || jsonb_build_object('school_b', v);

  insert into public.school_branches (school_id, name) values ((w ->> 'school_a')::uuid, 'Branch A1') returning id into v;
  w := w || jsonb_build_object('a1', v);
  insert into public.school_branches (school_id, name) values ((w ->> 'school_a')::uuid, 'Branch A2') returning id into v;
  w := w || jsonb_build_object('a2', v);
  insert into public.school_branches (school_id, name) values ((w ->> 'school_b')::uuid, 'Branch B1') returning id into v;
  w := w || jsonb_build_object('b1', v);

  w := w || jsonb_build_object('owner_a', tests.make_persona('owner_a'));
  w := w || jsonb_build_object('admin_a1', tests.make_persona('admin_a1'));
  w := w || jsonb_build_object('admin_a2', tests.make_persona('admin_a2'));
  w := w || jsonb_build_object('owner_b', tests.make_persona('owner_b'));

  insert into public.school_members (school_id, user_id, role) values
    ((w ->> 'school_a')::uuid, (w ->> 'owner_a')::uuid, 'owner'),
    ((w ->> 'school_b')::uuid, (w ->> 'owner_b')::uuid, 'owner');
  insert into public.school_members (school_id, user_id, role)
  values ((w ->> 'school_a')::uuid, (w ->> 'admin_a1')::uuid, 'admin') returning id into v_member;
  w := w || jsonb_build_object('member_a1', v_member);
  insert into public.school_member_branches (member_id, branch_id, school_id)
  values (v_member, (w ->> 'a1')::uuid, (w ->> 'school_a')::uuid);
  insert into public.school_members (school_id, user_id, role)
  values ((w ->> 'school_a')::uuid, (w ->> 'admin_a2')::uuid, 'admin') returning id into v_member;
  w := w || jsonb_build_object('member_a2', v_member);
  insert into public.school_member_branches (member_id, branch_id, school_id)
  values (v_member, (w ->> 'a2')::uuid, (w ->> 'school_a')::uuid);

  w := w || jsonb_build_object('learner_a1', tests.make_persona('learner_a1'));
  w := w || jsonb_build_object('learner_a2', tests.make_persona('learner_a2'));
  w := w || jsonb_build_object('learner_b', tests.make_persona('learner_b'));
  w := w || jsonb_build_object('learner_free', tests.make_persona('learner_free'));

  insert into public.school_student_links (school_id, branch_id, email, user_id)
  select (w ->> 'school_a')::uuid, (w ->> 'a1')::uuid, u.email, u.id from auth.users as u
   where u.id = (w ->> 'learner_a1')::uuid returning id into v;
  perform private.activate_link(v, (w ->> 'learner_a1')::uuid);
  w := w || jsonb_build_object('link_a1', v);
  insert into public.school_student_links (school_id, branch_id, email, user_id)
  select (w ->> 'school_a')::uuid, (w ->> 'a2')::uuid, u.email, u.id from auth.users as u
   where u.id = (w ->> 'learner_a2')::uuid returning id into v;
  perform private.activate_link(v, (w ->> 'learner_a2')::uuid);
  w := w || jsonb_build_object('link_a2', v);
  insert into public.school_student_links (school_id, branch_id, email, user_id)
  select (w ->> 'school_b')::uuid, (w ->> 'b1')::uuid, u.email, u.id from auth.users as u
   where u.id = (w ->> 'learner_b')::uuid returning id into v;
  perform private.activate_link(v, (w ->> 'learner_b')::uuid);
  w := w || jsonb_build_object('link_b', v);

  insert into public.learner_progress (user_id, store, data)
  select (w ->> k)::uuid, 'streak', jsonb_build_object('who', k)
    from unnest(array['learner_a1', 'learner_a2', 'learner_b', 'learner_free']) as k;

  return w;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select ok(
  (select count(*) from tests.function_access) > 0,
  'the function access manifest is loaded'
);

select is_empty(
  $$ select fn from tests.function_access
      where access in ('anon', 'authenticated') and guard = 'none' $$,
  'no client-callable function is declared without a guard'
);

select * from finish();
rollback;
