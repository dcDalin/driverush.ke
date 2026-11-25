# DriveRush

## Database (Supabase, schema first)

- The database is defined in `supabase/schemas/` (source of truth) and loaded
  in the order of `supabase/config.toml` `schema_paths`. House rules:
  `supabase/schemas/README.md`. Who can do what: `docs/database-access.md`.
- Local stack: `npm run db:start` (ports 54720-54729), `npm run db:reset`
  (migrations plus the demo seed; every demo password is `driverush-local-1`).
- A schema change: edit `supabase/schemas/`, `npm run db:diff <name>`, copy
  any function bodies, grants or CHECKs the diff missed into the migration,
  `npm run db:reset`, `npm run db:gen-types`, `npm run test:db`, and
  `npm run db:diff:check` must pass.
- Every new function or table gets a row in
  `supabase/tests/database/000_security_manifest.test.sql`, and client grants
  only in `supabase/schemas/_grants/`.
- Clients: `app/lib/supabase/` (`server.ts` for loaders, `browser.ts`,
  `service.server.ts` for trusted server code only, `caller.server.ts` for who
  is signed in). `database.types.ts` is generated; never edit it.
- `npm test` runs unit tests only; `npm run test:db` needs the local stack.

## Accounts (sign-in)

- Optional: guests use everything free. Sign-in is an emailed 6-digit code
  (also how accounts are made), email and password, or Google
  (`VITE_AUTH_GOOGLE=on`). The code emails are `supabase/templates/`; the
  hosted project needs the same templates.
- `app/lib/auth/session.ts` (`useSession`, loads the Supabase client lazily),
  `app/lib/auth/sign-in.ts`, the one sheet `app/components/account/` opened
  with `useSignInSheet().show()`. Google returns to `/auth/callback`.
- Pages render as a guest on the server; the session is read in the browser.
  A build without the `VITE_SUPABASE_*` settings has accounts off.
- Local codes land in Mailpit at http://127.0.0.1:54724.

## Progress, entitlements, schools

- Signed in: progress stores sync to `learner_progress` (`app/lib/progress/`).
  Guests' progress lasts one visit (owner decision): the head script in
  `guest-visit.ts` clears it on a new visit; `GUEST_PROGRESS_KEPT` reverses it.
- `useEntitlement()` / `liveryRule()` (`app/lib/auth/entitlement.ts`): school
  livery, plain cars (paid) or the usual turns. `hasFullAccess()` is the one
  gate for locked content; nothing is locked yet.
- `/school/:schoolId` (owners, branch admins) and `/console` (staff) call the
  database functions as the signed-in person (`app/lib/school/server.ts`).
  The service worker and robots.txt leave `/school`, `/console`, `/auth` alone.
- Payments: not built. Provider undecided; tables are provider-neutral.
