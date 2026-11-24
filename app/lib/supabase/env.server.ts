/**
 * Server-side Supabase settings, checked once on first use. The service role
 * key bypasses row level security, so it lives only here: never in a VITE_
 * variable, never in code that reaches the browser.
 *
 * Local values come from `npx supabase status -o env` (see `.env.example`).
 */
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url("SUPABASE_URL must be a URL"),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

export type SupabaseServerEnv = z.infer<typeof serverEnvSchema>;

let cached: SupabaseServerEnv | null = null;

export function getSupabaseServerEnv(
  source: Record<string, string | undefined> = process.env,
): SupabaseServerEnv {
  if (!cached) cached = serverEnvSchema.parse(source);
  return cached;
}
