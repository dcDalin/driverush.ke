/**
 * The full demo seed (`npm run db:seed`). Wipes the LOCAL database and fills
 * it: the reference rows, the test fixture (supabase/seeds/local_demo.sql),
 * your own su (SEED_SU_EMAIL), three more schools and ~30 learners in every
 * state, and their progress. See seed/README.md.
 *
 *   npm run db:seed            asks first when run in a terminal
 *   npm run db:seed -- --yes   no question (CI)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { assertLocalStack } from "./src/guard";
import { summary } from "./src/ledger";
import { sql } from "./src/local";
import { seedFixture } from "./src/steps/fixture";
import { seedLearners } from "./src/steps/learners";
import { seedMedia } from "./src/steps/media";
import { seedOwnerSu } from "./src/steps/owner-su";
import { seedProgress } from "./src/steps/progress";
import { resetDatabase } from "./src/steps/reset";
import { seedSchools } from "./src/steps/schools";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const HELP = `npm run db:seed [-- options]

Wipes the local Supabase database (127.0.0.1:54722) and fills it with the demo.

  -y, --yes   don't ask before wiping
  -h, --help  this text

SEED_SU_EMAIL / SEED_SU_PASSWORD in .env.local add your own DriveRush su.`;

async function confirm(yes: boolean) {
  if (yes || !process.stdin.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "Wipe the local database and seed the demo? (y/N) ",
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function step<T>(label: string, run: () => Promise<T>) {
  const started = Date.now();
  const result = await run();
  console.log(`  ${label} (${Date.now() - started} ms)`);
  return result;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("-h") || args.has("--help")) {
    console.log(HELP);
    return;
  }
  const envFile = join(ROOT, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  await assertLocalStack();
  if (!(await confirm(args.has("-y") || args.has("--yes")))) {
    console.log("Nothing changed.");
    return;
  }

  console.log("Seeding the local database:");
  await step("reset, reference rows", () => resetDatabase(ROOT));
  await step("test fixture (local_demo.sql)", () => seedFixture(ROOT));
  const su = await step("your su", () => seedOwnerSu());
  const schools = await step("schools, branches, admins", () => seedSchools());
  const learners = await step("learners", () => seedLearners(schools));
  const rows = await step("progress", () => seedProgress(learners));
  const media = await step("profiles, liveries, sponsorships", () =>
    seedMedia(ROOT),
  );

  console.table(summary);
  console.log(
    `${summary.length} people, ${schools.size + 2} schools, ${rows} progress rows, ` +
      `${media.uploaded} files uploaded (${media.kept} already in Storage, ` +
      `${media.pruned ?? 0} old ones removed). ` +
      "Every demo account's password: driverush-local-1.",
  );
  if (!su)
    console.log("No SEED_SU_EMAIL in .env.local: su@driverush.test is the su.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
    // Snaplet's own connection (seed.config.ts) stays open; nothing else is pending.
    process.exit();
  });
