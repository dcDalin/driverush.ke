/**
 * The test personas: re-runs supabase/seeds/local_demo.sql, the file
 * `db:reset` runs, so the pgTAP, db, route and e2e suites see the same Heltz
 * and Top Gear people after `db:seed` as after `db:reset`. That file stays
 * their one source; this step never changes them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { knownAccount, note } from "../ledger";
import { sql } from "../local";

const FIXTURE_ROLES: Record<
  string,
  { who: string; where: string; state: string }
> = {
  "su@driverush.test": {
    who: "DriveRush su",
    where: "/console",
    state: "password session",
  },
  "admin@driverush.test": {
    who: "DriveRush admin",
    where: "/console",
    state: "password session",
  },
  "owner@heltz.test": {
    who: "school owner",
    where: "heltz",
    state: "all branches",
  },
  "cbd.admin@heltz.test": {
    who: "branch admin",
    where: "heltz/Nairobi CBD",
    state: "",
  },
  "westlands.admin@heltz.test": {
    who: "branch admin",
    where: "heltz/Westlands",
    state: "",
  },
  "owner@topgear.test": {
    who: "school owner",
    where: "topgear",
    state: "all branches",
  },
  "amina@learner.test": {
    who: "learner",
    where: "heltz/Nairobi CBD",
    state: "active",
  },
  "brian@learner.test": {
    who: "learner",
    where: "heltz/Westlands",
    state: "active",
  },
  "chebet@learner.test": {
    who: "learner",
    where: "heltz + topgear",
    state: "choosing",
  },
  "dan@learner.test": { who: "learner", where: "-", state: "paid" },
  "esther@learner.test": { who: "learner", where: "-", state: "free" },
};

export async function seedFixture(root: string) {
  await sql.unsafe(
    readFileSync(join(root, "supabase", "seeds", "local_demo.sql"), "utf8"),
  );
  const rows = await sql<{ id: string; email: string }[]>`
    select id, email from auth.users order by created_at`;
  for (const row of rows) {
    knownAccount(row.email, row.id);
    const role = FIXTURE_ROLES[row.email];
    if (role)
      note({
        email: row.email,
        ...role,
        state: `${role.state} (fixture)`.trim(),
      });
  }
  return rows.length;
}
