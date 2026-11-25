/** Route modules read the Supabase settings from process.env, as on the server. */
import { inject } from "vitest";

const local = inject("supabase");
process.env.SUPABASE_URL = local.url;
process.env.SUPABASE_PUBLISHABLE_KEY = local.publishableKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = local.serviceRoleKey;
