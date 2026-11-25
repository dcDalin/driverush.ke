# DriveRush

Built like the thinkrush monorepo, as one app: React Router 7 (loaders,
actions, fetchers), Supabase schema first, a typed data layer, zod forms on
remix-hook-form, shadcn everywhere. Guides: `docs/forms-and-data.md`,
`docs/ui.md`, `docs/database-access.md`.

## Layout

- `app/database/`: every Supabase call, one typed function per read or change
  (client first; reads throw, writes return a `Result`). Clients in
  `supabase/`, generated types in `types/database.ts` (never edit; run
  `npm run db:gen-types`), names in `types/index.ts`.
- `app/schemas/`: zod schemas for every form and inline action.
- `app/components/ui/`: shadcn components in the house look; `ui/forms/` is
  the field kit (`server` for route actions, `client` for browser forms).
- `app/lib/forms/`: `useServerForm`, `validateForm`, `useInlineAction`,
  honeypot, flash toasts. `app/lib/auth/require.server.ts`: the gates every
  account loader and action opens with.
- `app/routes/api/`: resource routes for fetchers.

## Rules

- Routes and components never call `supabase.from/rpc`; add a function in
  `app/database/` instead.
- Forms that post: `useServerForm` + `<HoneypotInputs />`; actions validate
  with the same schema (`validateForm`) and answer with
  `dataWithSuccess`/`dataWithError`. One-tap changes: `useInlineAction`.
- Every loader and action of an account route starts with `getRequestClient`,
  `requireUser` or `requireStaff`.
- Every control is a shadcn component (see `docs/ui.md` for the few kept
  custom on purpose). House icons, colour tokens, traffic-light loader.
- Code style: Prettier with semicolons and Tailwind class sorting; ESLint
  (sorted imports, `import type`, `type` over `interface`); full TypeScript
  strictness including `noUncheckedIndexedAccess`.

## Commands

- `npm run check`: typecheck, lint, format check, unit tests.
- `npm run lint:fix`, `npm run format`.
- Local stack: `npm run db:start` (ports 54720-54729), `npm run db:reset`
  (migrations plus the demo seed; every demo password is
  `driverush-local-1`). Local codes land in Mailpit at http://127.0.0.1:54724.
- `npm run test:db` (pgTAP, database and route suites), `npm run test:e2e`
  (Playwright; reuses the dev server on 5730).

## Database (Supabase, schema first)

- The database is defined in `supabase/schemas/` (source of truth) and loaded
  in the order of `supabase/config.toml` `schema_paths`. House rules:
  `supabase/schemas/README.md`.
- A schema change: edit `supabase/schemas/`, `npm run db:diff <name>`, copy
  any function bodies, grants or CHECKs the diff missed into the migration,
  `npm run db:reset`, `npm run db:gen-types`, `npm run test:db`, and
  `npm run db:diff:check` must pass.
- Every new function or table gets a row in
  `supabase/tests/database/000_security_manifest.test.sql`, and client grants
  only in `supabase/schemas/_grants/`.

## Accounts, progress, schools

- Accounts are optional. Sign-in: emailed 6-digit code (also how accounts are
  made), email and password, or Google (`VITE_AUTH_GOOGLE=on`). Code emails
  are `supabase/templates/`; the hosted project needs the same templates.
- Pages render as a guest on the server; the session is read in the browser
  (`app/lib/auth/session.ts`, Supabase client loaded lazily). A build without
  the `VITE_SUPABASE_*` settings has accounts off.
- Signed in: progress stores sync to `learner_progress` (`app/lib/progress/`).
  Guests' progress lasts one visit (owner decision): the head script in
  `guest-visit.ts` clears it on a new visit; `GUEST_PROGRESS_KEPT` reverses it.
- `useEntitlement()` / `liveryRule()` (`app/lib/auth/entitlement.ts`): school
  livery, plain cars (paid) or the usual turns. `hasFullAccess()` is the one
  gate for locked content; nothing is locked yet.
- `/school/:schoolId` (owners, branch admins) and `/console` (staff). The
  service worker and robots.txt leave `/school`, `/console`, `/auth`, `/api`
  alone.
- Payments: not built. Provider undecided; tables are provider-neutral.
- Env: `SESSION_SECRET` (flash toasts) and `HONEYPOT_SECRET` (form trap) are
  needed in Vercel once accounts are on.
