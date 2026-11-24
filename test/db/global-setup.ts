/**
 * Finds the local Supabase stack (`npx supabase start`) and hands its URL and
 * keys to the db tests. Fails fast with a clear message when it is not up.
 */
import { execFileSync } from "node:child_process";

import type { TestProject } from "vitest/node";

export type LocalSupabase = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
};

declare module "vitest" {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

export default function setup(project: TestProject) {
  let out: string;
  try {
    out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "The local Supabase stack is not running. Start it with `npm run db:start`.",
    );
  }
  const env = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  project.provide("supabase", {
    url: env.API_URL,
    publishableKey: env.PUBLISHABLE_KEY ?? env.ANON_KEY,
    serviceRoleKey: env.SERVICE_ROLE_KEY,
    jwtSecret: env.JWT_SECRET,
  });
}
