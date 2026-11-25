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
-- Reads:  anyone, guests included: an active school's profile is public
--         (what learners read about it). The school's owner and admins and
--         DriveRush staff also read it while the school is suspended or
--         archived. `updated_by` (who edited) is granted to nobody.
-- Writes: No client: school_update_profile (owner, staff: the words,
--         contacts and colours); school_set_logo (the server, after
--         uploading the file). No client ever writes a media path.
-- Grants: anon: SELECT (public columns); authenticated: SELECT (public columns)
alter table public.school_profiles enable row level security;

create policy "school_profiles: anyone reads active schools"
  on public.school_profiles for select to anon
  using (private.is_active_school(school_id));

create policy "school_profiles: public if active; members and staff"
  on public.school_profiles for select to authenticated
  using (
    private.is_active_school(school_id)
    or private.is_school_member(school_id)
    or (select private.is_staff())
  );

-- ===================================================
-- ACCESS: public.school_liveries
-- ===================================================
-- Reads:  anyone, guests included: the live livery of an active school
--         (the board shows it to everyone). DriveRush staff read every
--         livery: drafts, live and retired. `created_by` is granted to nobody.
-- Writes: DriveRush staff only (password session, private.is_staff):
--           insert  a draft (status draft, published_at null: the table's
--                   defaults; the columns are not granted)
--           update  a livery's content (label, colours, media paths)
--           delete  a livery that is not live
--         Going live or retiring is admin_publish_livery and
--         admin_retire_livery (staff), which keep one live livery per
--         school. `npm run livery:publish` signs in as staff and goes
--         through these same policies.
-- Grants: anon: SELECT (content columns);
--         authenticated: SELECT (content columns), INSERT and UPDATE (content
--         columns), DELETE
alter table public.school_liveries enable row level security;

create policy "school_liveries: anyone reads live liveries"
  on public.school_liveries for select to anon
  using (status = 'live' and private.is_active_school(school_id));

create policy "school_liveries: anyone reads live liveries, staff read all"
  on public.school_liveries for select to authenticated
  using (
    (status = 'live' and private.is_active_school(school_id))
    or (select private.is_staff())
  );

create policy "school_liveries: staff insert drafts"
  on public.school_liveries for insert to authenticated
  with check ((select private.is_staff()) and status = 'draft');

create policy "school_liveries: staff update"
  on public.school_liveries for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "school_liveries: staff delete all but the live one"
  on public.school_liveries for delete to authenticated
  using ((select private.is_staff()) and status <> 'live');

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
