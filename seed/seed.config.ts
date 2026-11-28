/**
 * Snaplet's view of the local database. The seed uses Snaplet only for
 * `$resetDatabase` (thinkrush `packages/db-seed` does the same): every row is
 * written through the auth admin API, the app's own RPCs, or SQL.
 *
 * The URL is the local CLI stack's (supabase/config.toml, db port 54722) and
 * nothing else: no environment variable can point this at a hosted project.
 *
 * `public.plans` is selected too (Snaplet refuses to leave out a table others
 * point at), so the reset empties it and the seed re-runs the reference-rows
 * migrations (`supabase/migrations/*_reference_*.sql`) straight after.
 */
import { SeedPostgres } from "@snaplet/seed/adapter-postgres";
import { defineConfig } from "@snaplet/seed/config";
import postgres from "postgres";

export const LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54722/postgres";

export default defineConfig({
  adapter: () =>
    new SeedPostgres(postgres(LOCAL_DB_URL, { onnotice: () => {} })),
  alias: { inflection: true },
  select: [
    "!*",
    "public*",
    "auth.users",
    "auth.identities",
    // Supabase's own bookkeeping: left for auth to manage.
    "!auth.sessions",
    "!auth.refresh_tokens",
    "!auth.mfa_factors",
    "!auth.oauth_clients",
  ],
});
