/**
 * The local CLI stack (supabase/config.toml ports 54721 api, 54722 db) and the
 * clients the seed writes through. The URLs are fixed to loopback on purpose,
 * as in thinkrush: no environment variable can point the seed at a hosted
 * project. The keys are read from `supabase status`, which only knows the
 * local stack.
 */
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import type { Database } from "~/database/types";

import { LOCAL_DB_URL } from "../seed.config";

export const LOCAL_API_URL = "http://127.0.0.1:54721";
export { LOCAL_DB_URL };

/** Every seeded account's password (the same as supabase/seeds/local_demo.sql). */
export const DEMO_PASSWORD = "driverush-local-1";

export type Client = ReturnType<typeof createClient<Database>>;

type LocalKeys = { publishableKey: string; serviceRoleKey: string };

function readKeys(): LocalKeys {
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
  const env = new Map(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
  if (env.get("API_URL") !== LOCAL_API_URL) {
    throw new Error(
      `supabase status reports API ${env.get("API_URL")}, expected ${LOCAL_API_URL}.`,
    );
  }
  const publishableKey = env.get("PUBLISHABLE_KEY") || env.get("ANON_KEY");
  const serviceRoleKey = env.get("SERVICE_ROLE_KEY");
  if (!publishableKey || !serviceRoleKey) {
    throw new Error("supabase status gave no keys for the local stack.");
  }
  return { publishableKey, serviceRoleKey };
}

let keys: LocalKeys | undefined;
function localKeys() {
  keys ??= readKeys();
  return keys;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** The service role: the auth admin API (accounts) only. */
export function serviceClient(): Client {
  return createClient<Database>(
    LOCAL_API_URL,
    localKeys().serviceRoleKey,
    noSession,
  );
}

/** A signed-out client, as the app's browser has. */
export function anonClient(): Client {
  return createClient<Database>(
    LOCAL_API_URL,
    localKeys().publishableKey,
    noSession,
  );
}

/** One connection: the SQL steps run in order, and pg_temp lives per session. */
export const sql = postgres(LOCAL_DB_URL, { max: 1, onnotice: () => {} });

const sessions = new Map<string, Client>();

/**
 * Signs in with a password, as a person would in the app, so the RPCs run
 * with that person's rights and their own guards. A password session is also
 * what DriveRush staff roles need (private.signed_in_with_password).
 */
export async function signInAs(email: string, password = DEMO_PASSWORD) {
  const known = sessions.get(email);
  if (known) return known;
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in as ${email} failed: ${error.message}`);
  sessions.set(email, client);
  return client;
}

/** Throws with the RPC's name when a call fails. */
export function must<T>(
  what: string,
  result: { data: T; error: { message: string } | null },
): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

/** Like `must`, for an RPC whose answer the seed goes on to use (an id). */
export function mustValue<T>(
  what: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  const data = must(what, result);
  if (data === null) throw new Error(`${what}: no value returned`);
  return data;
}
