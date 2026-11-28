/**
 * Everything a school's dashboard shows, read once by its frame
 * (`layouts/school-layout.tsx`) and shared with the pages under it: the
 * school, the caller's place in it, branches, team, invites, students with
 * their progress, the pass set-up and earnings, and (owner and staff) the
 * profile and logos. Earnings (up to 1,000 payments) are a promise the
 * pages show with `<Await>`: the frame draws without waiting for them. `signed-out`, `not-member` and `staff` are drawn by the
 * frame.
 *
 * DriveRush staff are not let in (owner, 2026-11-28): they create a school,
 * give it its livery and hand it over; the dashboard belongs to the school.
 * Their read-only look inside is in the console (`school-inside.tsx`).
 */
import {
  type EarningRow,
  getSchoolPassInfo,
  listSchoolEarnings,
} from "~/database/billing/school";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import { getSchoolProfile } from "~/database/schools/queries";
import type { RequestContext } from "~/lib/auth/require.server";
import { mediaUrl } from "~/lib/board/school-catalog";
import { kenyanBanks } from "~/lib/payments/banks.server";
import { paymentsEnabled } from "~/lib/payments/env.server";

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** A read whose error is held, to be raised only if its answer is used. */
function settle<T>(read: Promise<T>): Promise<Settled<T>> {
  return read.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

function unwrap<T>(read: Settled<T>): T {
  if (!read.ok) throw read.error;
  return read.value;
}

export async function loadSchool(
  { supabase, caller }: RequestContext,
  schoolId: string,
  /** The console helping a school set up: staff get the school, managing it. */
  { asStaff = false }: { asStaff?: boolean } = {},
) {
  if (!caller.signedIn) return { state: "signed-out" as const };
  const paymentsOn = paymentsEnabled();
  // All in one round trip: the school's pass set-up and profile are read
  // alongside the dashboard instead of after it, and earnings start with
  // them but are not waited for (streamed). Their errors are held until the
  // caller is known to belong (a stranger gets "not a member", not an
  // error), and the profile and bank list are dropped for anyone who does
  // not manage the school.
  const earningsRead = settle(listSchoolEarnings(supabase, schoolId));
  const [dashboard, profileRead, passInfoRead, bankList] = await Promise.all([
    getSchoolDashboard(supabase, {
      schoolId,
      userId: caller.userId,
      role: caller.role,
    }),
    settle(getSchoolProfile(supabase, schoolId)),
    settle(getSchoolPassInfo(supabase, schoolId)),
    paymentsOn ? kenyanBanks() : Promise.resolve([]),
  ]);
  if (!dashboard) return { state: "not-member" as const };
  const { role, ...school } = dashboard;
  if (role === "staff" && !asStaff) {
    return { state: "staff" as const, schoolId };
  }
  // The owner manages; so do staff, in the console only (structure, not
  // students: `schoolAction` and the database hold that line).
  const canManage = role === "owner" || role === "staff";
  const profile = canManage ? unwrap(profileRead) : null;
  const passInfo = unwrap(passInfoRead);
  const earnings: Promise<EarningRow[]> = earningsRead.then(unwrap);
  const banks = canManage ? bankList : [];
  // Logos are shown from Storage by their public URL.
  const base = process.env.SUPABASE_URL ?? "";
  const logoUrl = (ref: unknown) => {
    const path = (ref as { path?: unknown } | null)?.path;
    return typeof path === "string" ? mediaUrl(base, path) : null;
  };
  return {
    state: "ok" as const,
    ...school,
    role,
    canManage,
    profile,
    passInfo,
    earnings,
    paymentsOn,
    banks,
    logos: {
      logo: logoUrl(profile?.logo),
      logo_mono: logoUrl(profile?.logo_mono),
    },
  };
}

export type SchoolData = Extract<
  Awaited<ReturnType<typeof loadSchool>>,
  { state: "ok" }
>;
