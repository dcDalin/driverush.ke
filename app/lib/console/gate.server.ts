/**
 * Who may see the console, for its layout and every page under it. Each
 * loader opens with `getRequestClient(request)` (a data request can run a
 * child on its own), then asks this what to do with the caller:
 *
 *   signed-out     nobody is signed in
 *   sign-in-again  staff on an emailed-code session (a password reset):
 *                  the role is theirs, the door is not
 *   not-staff      an account with no staff role
 *   ok             DriveRush su or admin, on a password or Google session
 *
 * The layout draws the first three itself and never renders the page, so a
 * page's loader just returns `GATED` for them.
 */
import { holdsStaffRole } from "~/database/auth/held-role";
import { isStaffRole, isSuRole } from "~/database/auth/roles";
import type { RequestContext, SignedIn } from "~/lib/auth/require.server";

export type ConsoleGate =
  | { ok: false; state: "signed-out" | "sign-in-again" | "not-staff" }
  | { ok: true; staff: SignedIn; su: boolean };

export async function consoleGate(
  context: RequestContext,
): Promise<ConsoleGate> {
  const { caller, supabase } = context;
  if (!caller.signedIn) return { ok: false, state: "signed-out" };
  if (!isStaffRole(caller.role)) {
    const onFile = await holdsStaffRole(supabase, caller.userId);
    return { ok: false, state: onFile ? "sign-in-again" : "not-staff" };
  }
  return { ok: true, staff: context as SignedIn, su: isSuRole(caller.role) };
}

/** What a console page's loader returns when the layout will not draw it. */
export const GATED = { gated: true as const };
