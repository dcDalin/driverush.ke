/**
 * The seed wipes the database, so it first proves it is talking to a local
 * CLI stack: the address is loopback and `private.is_local_stack()` (the
 * CLI's default JWT secret, the guard supabase/seeds/local_demo.sql uses)
 * says yes. Either failing stops the seed before anything is written.
 */
import { LOCAL_API_URL, LOCAL_DB_URL, sql } from "./local";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLoopback(url: string) {
  return LOOPBACK.has(new URL(url).hostname);
}

export async function assertLocalStack() {
  for (const url of [LOCAL_API_URL, LOCAL_DB_URL]) {
    if (!isLoopback(url))
      throw new Error(`Refusing to seed ${url}: not loopback.`);
  }
  let local = false;
  try {
    const [row] = await sql<
      { local: boolean }[]
    >`select private.is_local_stack() as local`;
    local = row?.local === true;
  } catch (error) {
    throw new Error(
      `Could not reach the local database (${LOCAL_DB_URL}). Is \`npm run db:start\` up? ${String(error)}`,
    );
  }
  if (!local) {
    throw new Error(
      "private.is_local_stack() is false: refusing to seed this database.",
    );
  }
}
