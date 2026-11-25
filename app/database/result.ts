/**
 * How database functions report. Reads throw (a loader's error reaches the
 * route's ErrorBoundary). Writes return a `Result`, whose error is a plain
 * sentence an action can put in a toast, so a refused change never crashes
 * the page.
 */
export type Result<T> =
  { data: T; error: null } | { data: null; error: string };

type DbError = { code?: string; message: string };

/** The plain sentence for a refusal the database raised. */
const REASONS: Record<string, string> = {
  forbidden: "You cannot do that here.",
  admin_limit: "This school already has 50 admins. Remove one first.",
  already_owner: "That email is the school's owner already.",
  invalid_branches: "Pick at least one branch of this school.",
  school_inactive: "This school is not active, so it cannot add students.",
  branch_inactive: "That branch is closed.",
  not_pending: "That has already been answered or started.",
  not_active: "That student's month is already over.",
  not_open: "That link is no longer open.",
  not_found: "We could not find that.",
  not_admin: "That person is not an admin of this school.",
  cannot_revoke_user: "Everyone keeps the user role.",
  cannot_revoke_own_su: "You cannot remove your own su role.",
  // Passes (billing/functions/passes.sql, school_passes.sql).
  email_unconfirmed: "Confirm your email first, then pay.",
  unknown_plan: "That pass is not on sale.",
  extension_not_allowed: "Extensions are for learners who have had a pass.",
  bad_code:
    "That school code does not take payments. Check it with your school.",
  branch_required: "Pick your branch.",
  price_below_share:
    "This school's price is not set up right. Tell your school.",
  price_out_of_range: "Set a price from KES 500 to KES 1,000.",
  payments_not_set_up: "Payments are not set up for this school yet.",
};

export function reasonFor(error: DbError): string {
  const known = REASONS[error.message];
  if (known) return known;
  if (error.code === "42501") return REASONS.forbidden!;
  if (error.code === "23505") return "That already exists.";
  if (error.code === "23514") return "Check the details and try again.";
  return "Something went wrong. Try again.";
}

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail<T = never>(error: string): Result<T> {
  return { data: null, error };
}

/** A Supabase response as a Result (a void function's `null` data is success). */
export function toResult<T>(response: {
  data: T | null;
  error: DbError | null;
}): Result<T | null> {
  if (response.error) return fail(reasonFor(response.error));
  return ok(response.data);
}

/** For reads: the data, or throw the error for the ErrorBoundary. */
export function orThrow<R extends { data: unknown; error: DbError | null }>(
  response: R,
): Exclude<R, { error: DbError }>["data"] {
  if (response.error) throw response.error;
  return response.data as Exclude<R, { error: DbError }>["data"];
}
