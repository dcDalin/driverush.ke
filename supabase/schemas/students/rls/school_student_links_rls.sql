-- ===================================================
-- ACCESS: public.school_student_links
-- ===================================================
-- Reads:  A learner reads their own links (pending invites included); the
--         school owner reads every link of the school; an admin reads links
--         in their branches; DriveRush staff read all.
-- Writes: No client: school_add_student, school_release_student,
--         school_cancel_student_invite, school_move_student_branch (school),
--         learner_accept_school_link, learner_decline_school_link (learner),
--         match_pending_invites on confirmation.
-- Grants: anon: none; authenticated: SELECT
alter table public.school_student_links enable row level security;

create policy "school_student_links: learner, branch staff or staff read"
  on public.school_student_links for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_staff())
    or private.can_see_branch(branch_id)
  );
