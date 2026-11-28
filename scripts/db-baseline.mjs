// Rebuilds supabase/migrations/20261124080000_baseline.sql from
// supabase/schemas, in config.toml schema_paths order (`npm run db:baseline`).
//
// Only while no hosted database exists: until the first `supabase db push`,
// supabase/schemas is the whole truth and the baseline is just its copy, so
// a schema change resets the local stack instead of adding a migration.
// Once a hosted project has run the baseline, never run this again: every
// change becomes a new migration (supabase/schemas/README.md).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const config = readFileSync(join(root, "supabase/config.toml"), "utf8");
const block = config.match(/schema_paths\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const paths = block
  .split("\n")
  .map((line) => line.replace(/#.*$/, "").trim())
  .flatMap((line) => [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]));
if (paths.length === 0)
  throw new Error("No schema_paths found in supabase/config.toml");

const parts = [
  "-- Baseline: every file in supabase/schemas, in config.toml schema_paths order.",
  "-- Rebuilt by `npm run db:baseline` while no hosted database exists; after",
  "-- the first hosted push, never edit it: every change gets its own migration.",
  "",
];
for (const path of paths) {
  const rel = path.replace(/^\.\//, "supabase/");
  parts.push(
    `-- ── ${rel}`,
    readFileSync(join(root, rel), "utf8").trimEnd(),
    "",
  );
}
const out = join(root, "supabase/migrations/20261124080000_baseline.sql");
writeFileSync(out, parts.join("\n"));
console.log(`Wrote ${out} from ${paths.length} schema files.`);
