/**
 * The first call in every loader and action that touches accounts (thinkrush
 * `require-role.server.ts`): the request's Supabase client acting as the
 * signed-in person, who they are, and the cookies to send back. Called in
 * each route, never only in a parent, because a data request can run a child
 * loader on its own. `test/routes/gate-first.test.ts` checks every route.
 *
 * Read once per request: React Router hands the same `Request` to every
 * loader (and the middleware) of one request, so the layout's and the page's
 * loaders share one client and one session check instead of asking Supabase
 * two or three times. `privatePage` middleware sends the cookies it
 * refreshed and keeps the response out of every cache.
 *
 * The database checks again on every call; these gates only decide what a
 * page shows and turn a refused request away early.
 */
import { data } from "react-router";

import { type Caller, getCaller } from "~/database/auth/get-caller";
import { isStaffRole, isSuRole } from "~/database/auth/roles";
import { createSupabaseServerClient } from "~/database/supabase/server";

export type RequestContext = Awaited<ReturnType<typeof getRequestClient>>;
export type SignedIn = RequestContext & {
  caller: Extract<Caller, { signedIn: true }>;
};

async function readRequestClient(request: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw data("Not found", { status: 404 });
  }
  const { supabase, headers } = createSupabaseServerClient(request);
  // Pages behind sign-in hold people's details: never stored by a cache.
  headers.set("Cache-Control", "private, no-store");
  const caller = await getCaller(supabase);
  return { supabase, headers, caller };
}

const perRequest = new WeakMap<Request, ReturnType<typeof readRequestClient>>();

/** Anyone: the client and caller (who may be signed out). 404 with accounts off. */
export function getRequestClient(request: Request) {
  let pending = perRequest.get(request);
  if (!pending) {
    pending = readRequestClient(request);
    perRequest.set(request, pending);
  }
  return pending;
}

/** The request's client if a loader or action already asked for it. */
export function peekRequestClient(request: Request) {
  return perRequest.get(request);
}

/** A signed-in person, or 401. */
export async function requireUser(request: Request): Promise<SignedIn> {
  const context = await getRequestClient(request);
  if (!context.caller.signedIn) {
    throw data(
      { ok: false, message: "Sign in first." },
      { status: 401, headers: context.headers },
    );
  }
  return context as SignedIn;
}

/** DriveRush su or admin on a password or Google session, or 403. */
export async function requireStaff(request: Request): Promise<SignedIn> {
  const context = await requireUser(request);
  if (!isStaffRole(context.caller.role)) {
    throw data(
      { ok: false, message: "Staff only." },
      { status: 403, headers: context.headers },
    );
  }
  return context;
}

export function isSu(context: SignedIn) {
  return isSuRole(context.caller.role);
}
