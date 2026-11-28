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
  (migrations plus the test personas in `supabase/seeds/local_demo.sql`;
  every demo password is `driverush-local-1`). Local codes land in Mailpit at
  http://127.0.0.1:54724.
- Full demo: `npm run db:seed` (Snaplet, `seed/`: 6 schools, ~45 learners in
  every state, progress; your own su from `SEED_SU_EMAIL` in `.env.local`,
  never committed: the repo is public). `npm run db:refresh` = `db:sync` +
  `db:seed`. Guide: `seed/README.md`.
- `npm run db:advisors` (Supabase's dashboard advisors; must stay clean at WARN),
  `npm run db:lint` (function bodies).
- `npm run test:db` (pgTAP, database and route suites), `npm run test:e2e`
  (Playwright; reuses the dev server on 5730).

## Database (Supabase, schema first)

- The database is defined in `supabase/schemas/` (source of truth) and loaded
  in the order of `supabase/config.toml` `schema_paths`. House rules:
  `supabase/schemas/README.md`.
- No hosted database yet (owner, 2026-11-25): a schema change edits
  `supabase/schemas/` only, then `npm run db:baseline` (rebuilds the one
  baseline migration from the schemas), `npm run db:reset`,
  `npm run db:gen-types`, `npm run db:sync` (the seed's view of the schema),
  `npm run test:db`, and `npm run db:diff:check` must pass. From the first
  hosted push on, every change is a new migration (`npm run db:diff <name>`).
- Every new function or table gets a row in
  `supabase/tests/database/000_security_manifest.test.sql`, and client grants
  only in `supabase/schemas/_grants/`.

## Accounts, progress, schools

- Accounts are optional. Sign-in: Google first (`VITE_AUTH_GOOGLE=on`; dev
  keys in `supabase/.env`, see `config.toml`), then email and password. A new
  password account confirms its email with a 6-digit code, and a forgotten
  password is replaced with one; there is no code sign-in in the sheet (owner,
  2026-11-28). Code emails are `supabase/templates/`; the hosted project needs
  the same templates.
- Pages render as a guest on the server; the session is read in the browser
  (`app/lib/auth/session.ts`, Supabase client loaded lazily). A build without
  the `VITE_SUPABASE_*` settings has accounts off.
- Signed in: progress stores sync to `learner_progress` (`app/lib/progress/`).
  Guests' progress lasts one visit (owner decision): the head script in
  `guest-visit.ts` clears it on a new visit; `GUEST_PROGRESS_KEPT` reverses it.
- `useEntitlement()` / `liveryRule()` (`app/lib/auth/entitlement.ts`): school
  livery for linked learners, otherwise the usual turns (paid included).
  `hasFullAccess()` (a pass is running) is the one gate for locked content;
  `app/lib/board/paywall.ts` says what is locked (past level 16, a second
  mock test) and `use-paywall.ts` asks it in the game and the level lists,
  only when the build has `VITE_PASSES=on` (the owner's launch switch).
- `/school/:schoolId` (owners, branch admins), `/console` (staff: schools
  searched, filtered and paged; "New school") and `/console/schools/:id`
  (set-up checklist, hand-over, livery folder upload, sponsorship,
  payments). A school created with no owner is `setup` (hidden everywhere)
  until handed over. The
  service worker and robots.txt leave `/school`, `/console`, `/auth`, `/api`
  alone.
- Payments (owner, 2026-11-25/26; `docs/payments.md`): learners buy 60-day
  passes through Paystack (`app/lib/payments/`); schools pay nothing and earn
  through a Paystack subaccount split. A school sets any price at or above
  `private.school_min_price()` (DriveRush's KES 300 + KES 50), no ceiling; the
  school's share pays Paystack's fee (`bearer: "subaccount"`). The owner sends
  the bank, staff approve it (`school_request_bank`, `admin_review_bank`). A
  school link is free; a pass unlocks. `/pass`, `/pass/done`,
  `/api/webhooks/paystack` (signature-gated), the dashboard's Passes tab, the
  console's Payments tabs (every payment, month totals, banks to check). Env:
  `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `VITE_PASSES`.
  `.claude/launch.json` `dev-passes` runs it locally with passes on.
- Emails DriveRush sends itself (invites, hand-overs, "you've been added",
  bank decisions): `app/lib/email/`, Resend with `RESEND_API_KEY` and
  `EMAIL_FROM`, else the local Mailpit (`MAILPIT_URL`). `STAFF_ALERT_EMAIL`
  hears about banks to check.
- Dashboards: tabs and lists keep their state in the address
  (`useTabParam`, `useListParams` and `app/components/list/`, as thinkrush's
  admin); the school dashboard and console update live through private
  realtime topics (`school:<id>`, `console`; `use-live-revalidate.ts`).
  The account menu links to the pass, the person's schools and the console.
  Test suites remove the schools and accounts they made
  (`test/support/leftovers.ts`).
- School profiles and liveries are data, not code (`docs/school-media.md`):
  owners edit their profile and logos on the dashboard; DriveRush makes
  liveries (`scripts/sponsor-art`, `seed/fixtures/liveries/<slug>/`,
  `npm run livery:publish <slug>`) and publishes them from the console.
  The app reads `board_schools()` once per few minutes
  (`app/lib/board/school-catalog.ts`); files live in the public
  `school-media` bucket, named by content, cached a year. Never put a
  school's art back in `public/`.
- Env: `SESSION_SECRET` (flash toasts) and `HONEYPOT_SECRET` (form trap) are
  needed in Vercel once accounts are on.
