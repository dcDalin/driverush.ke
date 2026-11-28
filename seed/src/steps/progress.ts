/**
 * Saved progress for the demo learners with an account, in the shape the app
 * saves (`{ json: <the store's saved value> }`, version 1). A few have none,
 * so the dashboards show empty rows too.
 */
import type { LearnerSpec } from "../data/people";
import { progressFor } from "../data/progress";
import { sql } from "../local";

export async function seedProgress(
  learners: { spec: LearnerSpec; ordinal: number }[],
) {
  let rows = 0;
  for (const { spec, ordinal } of learners) {
    if (spec.noProgress) continue;
    for (const [store, value] of Object.entries(progressFor(ordinal))) {
      await sql`
        insert into public.learner_progress (user_id, store, data, version)
        select u.id, ${store}, ${sql.json({ json: value } as never)}, 1
          from auth.users as u where u.email = ${spec.email}`;
      rows += 1;
    }
  }
  return rows;
}
