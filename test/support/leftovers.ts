/**
 * Removes what the test suites made in the shared local database, so the
 * seeded demo (Heltz, Top Gear, their learners) looks the way the seed left
 * it after `npm run test:db` or `npm run test:e2e`. Only test-made things:
 * schools whose short names the tests use (`route-…`, `e2e-…`, `journey-…`)
 * and accounts on the tests' own email domains (`@routes.test`,
 * `@vitest.test`, `@e2e.test`), with their links and payments. Run as the
 * last step of each suite (vitest's global setup teardown, Playwright's
 * global teardown); never against anything but the local stack.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "~/database/types";

export const TEST_SLUG =
  /^(setup|db|journey|route|route-setup|e2e|e2e-setup)-[a-z0-9]+$/;
export const TEST_EMAIL = /@(routes|vitest|e2e)\.test$/i;
const DOMAINS = ["routes.test", "vitest.test", "e2e.test"];

export async function removeTestLeftovers(url: string, serviceRoleKey: string) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`Refusing to clean anything but the local stack (${url}).`);
  }
  const db = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: schools } = await db.from("schools").select("id, slug");
  const testSchools = (schools ?? []).filter((s) => TEST_SLUG.test(s.slug));
  if (testSchools.length) {
    await db
      .from("schools")
      .delete()
      .in(
        "id",
        testSchools.map((s) => s.id),
      );
  }

  await db
    .from("school_student_links")
    .delete()
    .or(DOMAINS.map((d) => `email.ilike.%@${d}`).join(","));
  await db
    .from("school_member_invites")
    .delete()
    .or(DOMAINS.map((d) => `email.ilike.%@${d}`).join(","));

  const users: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = data?.users ?? [];
    for (const u of batch)
      if (u.email && TEST_EMAIL.test(u.email)) users.push(u.id);
    if (batch.length < 1000) break;
  }
  if (users.length) {
    await db.from("payments").delete().in("payer_user_id", users);
    for (const id of users) await db.auth.admin.deleteUser(id);
  }
  return { schools: testSchools.length, users: users.length };
}
