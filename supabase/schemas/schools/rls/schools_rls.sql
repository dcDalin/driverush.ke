-- ===================================================
-- ACCESS: public.schools
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins; a learner the
--         school has added (any link, so a pending invite shows its name).
-- Writes: No client: admin_create_school and admin_set_school_status (staff).
-- Grants: anon: none; authenticated: SELECT
alter table public.schools enable row level security;

create policy "schools: staff, members and linked learners read"
  on public.schools for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(id) or private.has_school_link(id));

-- ===================================================
-- ACCESS: public.school_branches
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins (every branch, so
--         an admin can see where colleagues work); its linked learners.
-- Writes: No client: school_create_branch and school_update_branch (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_branches enable row level security;

create policy "school_branches: staff, members and linked learners read"
  on public.school_branches for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id) or private.has_school_link(school_id));

-- ===================================================
-- ACCESS: public.school_members
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins.
-- Writes: No client: admin_create_school, admin_transfer_school_owner
--         (staff); school_add_admin and school_remove_admin (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_members enable row level security;

create policy "school_members: staff and members read"
  on public.school_members for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id));

-- ===================================================
-- ACCESS: public.school_member_branches
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins.
-- Writes: No client: school_add_admin and school_set_admin_branches (owner).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_member_branches enable row level security;

create policy "school_member_branches: staff and members read"
  on public.school_member_branches for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id));

-- ===================================================
-- ACCESS: public.school_member_invites
-- ===================================================
-- Reads:  DriveRush staff; the school's owner.
-- Writes: No client: school_add_admin, school_cancel_member_invite (owner),
--         admin_create_school, admin_transfer_school_owner (staff);
--         match_pending_invites on confirmation.
-- Grants: anon: none; authenticated: SELECT
alter table public.school_member_invites enable row level security;

create policy "school_member_invites: staff and owner read"
  on public.school_member_invites for select to authenticated
  using ((select private.is_staff()) or private.is_school_owner(school_id));

-- ===================================================
-- ACCESS: public.school_profiles
-- ===================================================
-- Reads:  DriveRush staff; the school's owner and admins. Everyone else
--         (guests included) reads the public fields through board_schools().
-- Writes: No client: school_update_profile (owner, staff); school_set_logo
--         (the server, after uploading the file).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_profiles enable row level security;

create policy "school_profiles: staff and members read"
  on public.school_profiles for select to authenticated
  using ((select private.is_staff()) or private.is_school_member(school_id));

-- ===================================================
-- ACCESS: public.school_liveries
-- ===================================================
-- Reads:  DriveRush staff (drafts included). The live livery reaches
--         everyone through board_schools().
-- Writes: No client: livery:publish (service role) inserts drafts;
--         admin_publish_livery and admin_retire_livery (staff).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_liveries enable row level security;

create policy "school_liveries: staff read"
  on public.school_liveries for select to authenticated
  using ((select private.is_staff()));

-- ===================================================
-- ACCESS: public.school_sponsorships
-- ===================================================
-- Reads:  DriveRush staff. board_schools() says only whether one is current.
-- Writes: No client: admin_set_sponsorship and admin_end_sponsorship (staff).
-- Grants: anon: none; authenticated: SELECT
alter table public.school_sponsorships enable row level security;

create policy "school_sponsorships: staff read"
  on public.school_sponsorships for select to authenticated
  using ((select private.is_staff()));
