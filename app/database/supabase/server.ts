/**
 * The Supabase client for a request, for React Router loaders and actions.
 * It reads the session from the request's cookies and collects any cookies
 * Supabase refreshes into `headers`, which the loader must return:
 *
 *   const { supabase, headers } = createSupabaseServerClient(request);
 *   ...
 *   return data(result, { headers });
 *
 * It acts as the signed-in learner, so row level security applies. For
 * trusted server work that must bypass it, see `service.server.ts`.
 */
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";

import { getSupabaseServerEnv } from "../env.server";
import type { Database } from "../types";

export function createSupabaseServerClient(request: Request) {
  const env = getSupabaseServerEnv();
  const cookies = parseCookieHeader(request.headers.get("Cookie") ?? "");
  const headers = new Headers();

  const supabase = createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      // HTTPS only in production, and never sent on another site's POST.
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return cookies.map(({ name, value }) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            headers.append(
              "Set-Cookie",
              serializeCookieHeader(name, value, options),
            );
          }
        },
      },
    },
  );

  return { supabase, headers };
}
