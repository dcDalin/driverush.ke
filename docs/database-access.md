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

## A learner's tier (`my_entitlement()`)

| Tier     | When                                                    | Content                   | Cars                                |
| -------- | ------------------------------------------------------- | ------------------------- | ----------------------------------- |
| `school` | a current link (inside its month) with an active school | full                      | that school's livery (`sponsor_id`) |
| `paid`   | their own subscription is running                       | full                      | plain                               |
| `free`   | signed in, neither of the above                         | free tier, progress saved | sponsor schools take turns          |
| guest    | not signed in                                           | free tier, nothing saved  | sponsor schools take turns          |

A school link beats paid time. While it runs, the learner's paid time pauses:
the subscription moves forward by the school month, and back by any unused
part if the link ends early.

## School links (`school_student_links`)

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

| Function                                                                                                                                              | Who                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `my_entitlement()`                                                                                                                                    | the learner                       |
| `learner_accept_school_link`, `learner_decline_school_link`                                                                                           | the learner the link is for       |
| `school_add_student`, `school_release_student`, `school_cancel_student_invite`, `school_move_student_branch`, `school_student_progress`               | owner, admin of the branch, staff |
| `school_members_list`                                                                                                                                 | owner, admins, staff              |
| `school_create_branch`, `school_update_branch`, `school_add_admin`, `school_set_admin_branches`, `school_remove_admin`, `school_cancel_member_invite` | owner, staff                      |
| `admin_create_school`, `admin_set_school_status`, `admin_transfer_school_owner`                                                                       | DriveRush su or admin             |
| `grant_platform_role`, `revoke_platform_role`                                                                                                         | DriveRush su                      |

## Tables a client can read

| Table                                      | Rows a client sees                                              | Client writes                 |
| ------------------------------------------ | --------------------------------------------------------------- | ----------------------------- |
| `profiles`                                 | own; staff all                                                  | own `full_name`, `avatar_url` |
| `user_roles`                               | own; su all                                                     | none                          |
| `schools`, `school_branches`               | staff; the school's members; learners it has added              | none                          |
| `school_members`, `school_member_branches` | staff; the school's members                                     | none                          |
| `school_member_invites`                    | staff; the school owner                                         | none                          |
| `school_student_links`                     | own; the owner (whole school); an admin (their branches); staff | none                          |
| `learner_progress`                         | own                                                             | own rows                      |
| `plans`                                    | anyone (active); staff all                                      | none                          |
| `learner_subscriptions`                    | own; staff                                                      | none                          |
| `school_subscriptions`                     | the school owner; staff                                         | none                          |
| `payments`                                 | the payer; the school owner; staff                              | none                          |
| `subscription_pauses`                      | nobody                                                          | none                          |

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
