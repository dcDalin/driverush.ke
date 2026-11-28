# supabase/schemas

The declarative source of truth for the database, copied from the
thinkrush-monorepo pattern. Every `.sql` file here is listed, in load order, in
`supabase/config.toml` `[db.migrations] schema_paths`; that list is all
`supabase db diff` reads.

## The workflow

Until a hosted database exists (owner, 2026-11-25), there is no migration
history to keep:

1. Edit the files here (never the database by hand).
2. `npm run db:baseline` rebuilds `migrations/20261124080000_baseline.sql`
   from these files in `schema_paths` order.
3. `npm run db:reset`, `npm run db:gen-types`, `npm run db:sync` (the seed).
4. `npm run test:db` (pgTAP, then the Vitest database suite) and
   `npm run db:diff:check` (must report no changes).

From the first hosted push on, step 2 becomes `npm run db:diff <name>`: a
new migration for tables and columns, with any function bodies, grants,
comments and CHECK changes it misses copied in verbatim under a
`-- ── supabase/schemas/<path>` header.

CI (`.github/workflows/db.yml`) runs the same checks and fails on a schema
change without a migration or with stale types.

The baseline migration (`20261124080000_baseline.sql`) is every file here
concatenated in `schema_paths` order (`npm run db:baseline`). Once a hosted
database exists, never rebuild it: every change is a new migration.

## Layout

- One folder per domain (`profiles/`, `schools/`, `students/`, `billing/`,
  `progress/`), each with `enums/ tables/ functions/ triggers/ rls/` as needed.
- `_private/` creates schema `private` and the helpers everything else uses.
  Listed first.
- `_grants/` holds the only client grants. Listed last, followed only by
  `storage/` (bucket rows: `db diff` does not read the storage schema, so
  they are idempotent inserts here and land in the baseline).
- Order in `schema_paths`: extensions and `private`, every enum and table, then
  functions, triggers and policies, then grants. A `language sql` function is
  checked against the tables it reads when it is created, so tables come first.
- Reference rows every database needs (the plans) are a migration, not a seed:
  `*_reference_*.sql`, idempotent, so the full seed can re-run it after its
  reset. `seeds/local_demo.sql` is the test personas and refuses to run
  anywhere but a CLI stack (`private.is_local_stack()`). The full demo is the
  Snaplet seed in `seed/` (`npm run db:seed`, `seed/README.md`); run
  `npm run db:sync` after a schema change so it sees the new shape.

## Who can call a function

Each function opens with a header directly above `create or replace function`:

```sql
-- Adds a learner's email to a branch and returns the link id.
--
-- Access:  authenticated (school owner, branch admin or DriveRush staff)
-- Guard:   admin (private.can_manage_branch: owner, admin of the branch, or staff)
-- Callers: school dashboard (session)
```

- **Access**: `anon`, `authenticated (who)`, `service_role`, `trigger` or
  `auth_hook`.
- **Guard**: `none` (the grant is the gate), `public` (answers only for the
  caller), `self`, `school`, `admin` or `su`, with the check in brackets.
- **Callers**: where it is called from.

Rules:

1. `set search_path = ''`, every reference schema-qualified, and a one-line
   `comment on function`. pgTAP fails without them.
2. An owner-rights (`security definer`) function a client calls lives in
   `private`, with a `security invoker` wrapper of the same name in `public`
   (Supabase lints 0028 and 0029). Both get a header, a manifest row and a
   grant.
3. The owner-rights body checks the caller and raises SQLSTATE `42501`
   (`forbidden`) when it refuses. Business rules raise `P0001` with a short
   token (`admin_limit`, `not_pending`, `school_inactive`, ...); a missing row
   raises `P0002` (`not_found`).
4. Add its row to `tests.function_access` in
   `supabase/tests/database/000_security_manifest.test.sql`, and a refusal
   probe to `security_function_guards.test.sql` (the file fails on a guarded
   function without one).
5. Grant it in `_grants/function_privileges.sql`. A file's own trailer only
   revokes from `public` and grants to `service_role`.

A new function starts closed: default privileges give it to `postgres` and
`service_role` only.

## Who can read and write a table

Each table's `rls/` file opens with an access block:

```sql
-- ===================================================
-- ACCESS: public.school_student_links
-- ===================================================
-- Reads:  ...
-- Writes: No client: school_add_student, ...
-- Grants: anon: none; authenticated: SELECT
```

1. Row level security on, one policy per client read, named
   `"<table>: <what>"`, calling helpers as `(select private.is_staff())`.
2. A policy that needs to ask about school membership calls a `private`
   owner-rights helper (`is_school_member`, `can_see_branch`, ...), never the
   membership table directly (that would recurse through its own policy).
3. Add the table to `tests.table_access` and each policy to
   `tests.policy_access`; grant in `_grants/table_privileges.sql`.
4. Clients write directly only a learner's own profile name and avatar,
   their own `learner_progress`, and (DriveRush staff only) the content of
   `school_liveries` and the `school-media` bucket. Everything else goes
   through a function.
5. A CHECK runs its function as the writer: a table a client writes needs
   its CHECK helpers granted to that role (`_grants/`, section 3c).
6. Public data is public by row and by column: a policy for `anon` picks the
   rows, a column grant leaves out who made or edited them.

## Roles in one paragraph

Platform roles (`user_roles`, `app_role`): `driverush_su`, `driverush_admin`,
`user`. They count only on a password or Google session (`private.is_staff`, `is_su`,
and the `user_role` claim from `custom_access_token_hook`). School roles
(`school_members`, `school_role`): one `owner` per school, set by DriveRush
staff, and up to 50 `admin`s tied to branches by the owner. Learners are tied
to a school through `school_student_links`, a month at a time. The full matrix
is `docs/database-access.md`.

## The dashboard's advisors

Supabase's Security and Performance advisors (the warnings in the
dashboard) must stay empty at WARN and above: `npm run db:advisors` runs them
on the local stack and CI fails on any warning. `npm run db:lint` type-checks
every function body. `supabase/tests/database/security_advisors.test.sql`
holds the schema to the same rules, so a change fails pgTAP first:

- every foreign key has a covering index;
- every table with row level security has a policy (a table no client may
  touch gets an explicit `"<table>: clients no access"` policy, `using
(false) with check (false)`);
- one permissive policy per table, role and command (split by role, or fold
  the conditions into one `using`);
- `auth.uid()` / `auth.jwt()` in a policy are wrapped in a `SELECT`.

`unused_index` (INFO) counts index scans since the statistics were reset, so
on a fresh or local database every index shows as unused until queries use
it. It is not a warning; drop an index only if production traffic never uses
it.

Hosted-only advisors to settle when the project is created: leaked password
protection (Auth > Passwords) and the MFA options.
