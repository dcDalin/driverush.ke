/**
 * Empties the app's tables and auth users (Snaplet `$resetDatabase`), then
 * puts back what every database has: the reference rows, by re-running their
 * migrations (`*_reference_*.sql`, idempotent), so the migration stays their
 * one source.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createSeedClient } from "@snaplet/seed";

import { sql } from "../local";

export async function resetDatabase(root: string) {
  const seed = await createSeedClient();
  await seed.$resetDatabase();

  const migrations = join(root, "supabase", "migrations");
  const reference = readdirSync(migrations)
    .filter((file) => /_reference_.*\.sql$/.test(file))
    .sort();
  for (const file of reference) {
    await sql.unsafe(readFileSync(join(migrations, file), "utf8"));
  }
  return reference;
}
