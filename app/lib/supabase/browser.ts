/**
 * The browser's Supabase client, one per page. It keeps the session in
 * cookies (not localStorage) so server loaders see the same session.
 */
import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabaseClientEnv } from "./env.client";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!cached) {
    const env = getSupabaseClientEnv();
    cached = createBrowserClient<Database>(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
  }
  return cached;
}
