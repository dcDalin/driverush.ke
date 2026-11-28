/**
 * Browser-safe Supabase settings: the project URL and the publishable key.
 * Both are public by design; row level security is what protects the data.
 */
import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.url("VITE_SUPABASE_URL must be a URL"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "VITE_SUPABASE_PUBLISHABLE_KEY is required"),
});

export type SupabaseClientEnv = z.infer<typeof clientEnvSchema>;

export function getSupabaseClientEnv(
  source: Record<string, string | undefined> = import.meta.env,
): SupabaseClientEnv {
  return clientEnvSchema.parse(source);
}
