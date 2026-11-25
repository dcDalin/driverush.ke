/**
 * The service-role client. It bypasses row level security, so it is only for
 * trusted server code (payment callbacks, admin jobs), never for anything a
 * browser controls. Stateless: no session is kept or refreshed.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabaseServerEnv } from "./env.server";

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseServiceClient() {
  if (!cached) {
    const env = getSupabaseServerEnv();
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required for the service client",
      );
    }
    cached = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return cached;
}
