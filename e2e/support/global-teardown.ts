/**
 * After the end-to-end run: take out the schools and accounts the specs
 * made, so the seeded demo stays as the seed left it (`test/support/leftovers.ts`).
 */
import { execFileSync } from "node:child_process";

import { removeTestLeftovers } from "../../test/support/leftovers";

export default async function globalTeardown() {
  const out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const env = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  await removeTestLeftovers(env.API_URL!, env.SERVICE_ROLE_KEY!);
}
