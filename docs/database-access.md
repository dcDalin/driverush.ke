# Database access

Who can do what in the DriveRush database. The source of truth is the
manifest in `supabase/tests/database/000_security_manifest.test.sql`, which
pgTAP checks against the live grants and policies; this page explains it.

## The people

| Who                      | How they get it                                                               | Notes                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest                    | not signed in                                                                 | Reads active plans only. Progress is not saved.                                                                                                                                   |
| Learner                  | any account (`user`)                                                          | Own profile, own progress, own school links, `my_entitlement()`.                                                                                                                  |
| School owner (school su) | set by DriveRush staff (`admin_create_school`, `admin_transfer_school_owner`) | One per school. Runs branches and admins; sees every branch's students and progress.                                                                                              |
| School admin             | added by the owner (`school_add_admin`)                                       | At most 50 per school (pending invites count). Tied to one or more branches; adds, moves and releases students and reads progress only there. Can be an admin of several schools. |
| DriveRush admin          | `driverush_admin` in `user_roles`                                             | Creates, suspends and re-owns schools; reads everything. Password session only.                                                                                                   |
| DriveRush su             | `driverush_su` in `user_roles`                                                | Everything an admin can, plus granting and revoking platform roles. Password session only.                                                                                        |

## A learner's tier and pass (`my_entitlement()`)

Two separate things (owner, 2026-11-25): the tier says whose cars a learner
sees, and `full_access` says whether a pass is running.

| Tier     | When                                                    | Cars                                 |
| -------- | ------------------------------------------------------- | ------------------------------------ |
| `school` | a current link (inside its month) with an active school | that school's livery (`school_slug`) |
| `paid`   | no school link, a pass running                          | sponsor schools take turns           |
| `free`   | signed in, neither of the above                         | sponsor schools take turns           |
| guest    | not signed in                                           | sponsor schools take turns           |

A school link is free for the school and opens nothing by itself. A pass
(`learner_subscriptions`, 60 days, or a 30-day extension) opens the course
past the free levels: bought alone (KES 1,000) or through the school at the
school's own price (no ceiling; at least DriveRush's KES 300 plus KES 50 for
the school, `private.school_min_price()`). DriveRush keeps KES 300 whole: the
school's share pays Paystack's fee. Passes run back to back; a school pass
keeps the learner linked to that school while it runs. The functions are
`billing/functions/passes.sql` (checkout, settle, fail, refund) and
`school_passes.sql` (code, price, earnings, the bank: the owner asks with
`school_request_bank` through the server, staff approve with
`admin_review_bank`; staff money views). The whole flow and its set-up:
`docs/payments.md`.

## School links (`school_student_links`)

Invites lapse and are sent within limits (owner, 2026-11-26;
`students/functions/invite_resend.sql`). A waiting student link and an owner
or admin invite lapse 30 days after they were last sent: they stay
`pending`, but nothing takes them up at sign-up, offers them to the learner,
lets them be joined or counts them in the 50 admins. Sending one again
(`school_resend_student_invite`, `school_resend_member_invite`, or adding
the same email again) renews it for 30 days, at most 5 times and at least 10
minutes apart (`resend_too_soon`, `resend_limit`). Adding a student whose
month is already running is refused (`already_linked`).

- A school adds an email to a branch (`school_add_student`).
- The month starts when that email belongs to a confirmed account: at once if
  it already does, otherwise when the learner confirms their sign-up.
- One active link per learner. Another school's add waits as `pending`; the
  learner may switch (`learner_accept_school_link`, which ends the current link
  as `switched`) or decline. With two or more schools waiting and no current
  link, nothing starts until the learner picks.
- A school can release a student (`released`), withdraw a pending add, or move
  a student between branches it works in. A month that runs out ends as
  `expired`.
- The school sees a learner's progress only while the link is current.

## Functions a client can call

| Function                                                                                                                                                                       | Who                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `my_entitlement()`                                                                                                                                                             | the learner                             |
| `learner_accept_school_link`, `learner_decline_school_link`                                                                                                                    | the learner the link is for             |
| `school_add_student`, `school_release_student`, `school_cancel_student_invite`, `school_move_student_branch`, `school_student_progress`                                        | owner, admin of the branch, staff       |
| `school_members_list`                                                                                                                                                          | owner, admins, staff                    |
| `school_create_branch`, `school_update_branch`, `school_add_admin`, `school_set_admin_branches`, `school_remove_admin`, `school_cancel_member_invite`                          | owner, staff                            |
| `admin_create_school`, `admin_set_school_status`, `admin_transfer_school_owner`                                                                                                | DriveRush su or admin                   |
| `school_update_profile`, `school_update_branch_details`                                                                                                                        | owner, staff                            |
| `admin_publish_livery`, `admin_retire_livery`, `admin_livery_draft_get`, `admin_set_sponsorship`, `admin_end_sponsorship`                                                      | DriveRush su or admin                   |
| `admin_list_schools` (one page, searched and filtered), `admin_hand_over_school` (owner by email, optionally keeping the old owner as an admin; a school in `setup` goes live) | DriveRush su or admin                   |
| `school_pass_info`, `school_earnings`                                                                                                                                          | owner, admins (their branches), staff   |
| `school_set_pass_price`                                                                                                                                                        | owner, staff                            |
| `school_request_bank`                                                                                                                                                          | the server only (after its owner check) |
| `admin_set_school_payments`, `admin_review_bank`, `admin_list_bank_requests`, `admin_list_payments`, `admin_payment_totals`                                                    | DriveRush su or admin                   |
| `board_schools()`                                                                                                                                                              | anyone, guests included                 |
| `grant_platform_role`, `revoke_platform_role`                                                                                                                                  | DriveRush su                            |

## Tables a client can read

| Table                                      | Rows a client sees                                              | Client writes                                                        |
| ------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `profiles`                                 | own; staff all                                                  | own `full_name`, `avatar_url`                                        |
| `user_roles`                               | own; su all                                                     | none                                                                 |
| `schools`, `school_branches`               | staff; the school's members; learners it has added              | none                                                                 |
| `school_members`, `school_member_branches` | staff; the school's members                                     | none                                                                 |
| `school_member_invites`                    | staff; the school owner                                         | none                                                                 |
| `school_student_links`                     | own; the owner (whole school); an admin (their branches); staff | none                                                                 |
| `learner_progress`                         | own                                                             | own rows                                                             |
| `plans`                                    | anyone (active); staff all                                      | none                                                                 |
| `learner_subscriptions`                    | own; staff                                                      | none                                                                 |
| `school_subscriptions`                     | the school owner; staff                                         | none                                                                 |
| `payments`                                 | the payer; the school owner; staff                              | none                                                                 |
| `school_payment_settings`                  | the school owner; staff                                         | none                                                                 |
| `school_profiles`                          | anyone: active schools; members and staff: their own always     | none (`school_update_profile`)                                       |
| `school_liveries`                          | anyone: live liveries of active schools; staff: all             | staff only: insert drafts, edit content, delete all but the live one |
| `school_sponsorships`                      | staff                                                           | none (`admin_*` functions)                                           |
| storage `school-media`                     | anyone by public URL; listing: staff                            | staff only (and the server)                                          |

Who made or edited a profile or livery (`updated_by`, `created_by`) is
granted to nobody. Going live or retiring a livery is
`admin_publish_livery` / `admin_retire_livery`, which keep one live livery
per school; staff cannot set `status` directly.

Errors: `42501` refused (wrong caller), `P0001` a business rule (`admin_limit`,
`already_owner`, `invalid_branches`, `not_pending`, `not_active`, `not_open`,
`school_inactive`, `branch_inactive`, ...), `P0002` not found.

## Where people use it

| Page                           | Who                                       | What                                                                          |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Account menu (top bar)         | any signed-in learner                     | their school until when; schools waiting for them (Join, No thanks); sign out |
| `/school`, `/school/:schoolId` | school owner, school admins, staff        | students by branch with progress; team and branches (owner, staff)            |
| `/console`                     | DriveRush su and admin (password session) | schools, owners, status; staff roles (su)                                     |

Progress rows (`learner_progress.data`) hold `{ "json": <the store's saved
value> }`, the localStorage value of that store. The app syncs them
(`app/lib/progress/`); `app/lib/school/progress-summary.ts` reads them for the
dashboard.

## Trying it locally

`npm run db:reset` gives the test personas, and `npm run db:seed` the full
demo: 5 schools, their owners and admins, and learners in every link state
(pending, active, choosing, switched, declined, released, moved, expired,
renewed, paid through the school, own pass, free). Every account's password is
`driverush-local-1`. The table of who is who, and how to add your own su
(`SEED_SU_EMAIL` in `.env.local`), is in `seed/README.md`.
