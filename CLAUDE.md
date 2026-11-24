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
