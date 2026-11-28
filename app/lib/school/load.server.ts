/**
 * Everything a school's dashboard shows, read once by its frame
 * (`layouts/school-layout.tsx`) and shared with the pages under it: the
 * school, the caller's place in it, branches, team, invites, students with
 * their progress, the pass set-up and earnings, and (owner and staff) the
 * profile and logos. `signed-out` and `not-member` are drawn by the frame.
 */
import {
  getSchoolPassInfo,
  listSchoolEarnings,
} from "~/database/billing/school";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import { getSchoolProfile } from "~/database/schools/queries";
import type { RequestContext } from "~/lib/auth/require.server";
import { mediaUrl } from "~/lib/board/school-catalog";
import { kenyanBanks } from "~/lib/payments/banks.server";
import { paymentsEnabled } from "~/lib/payments/env.server";

export async function loadSchool(
  { supabase, caller }: RequestContext,
  schoolId: string,
) {
  if (!caller.signedIn) return { state: "signed-out" as const };
  const dashboard = await getSchoolDashboard(supabase, {
    schoolId,
    userId: caller.userId,
    role: caller.role,
  });
  if (!dashboard) return { state: "not-member" as const };
  const paymentsOn = paymentsEnabled();
  const [profile, passInfo, earnings, banks] = await Promise.all([
    dashboard.canManage
      ? getSchoolProfile(supabase, schoolId)
      : Promise.resolve(null),
    getSchoolPassInfo(supabase, schoolId),
    listSchoolEarnings(supabase, schoolId),
    dashboard.canManage && paymentsOn ? kenyanBanks() : Promise.resolve([]),
  ]);
  // Logos are shown from Storage by their public URL.
  const base = process.env.SUPABASE_URL ?? "";
  const logoUrl = (ref: unknown) => {
    const path = (ref as { path?: unknown } | null)?.path;
    return typeof path === "string" ? mediaUrl(base, path) : null;
  };
  return {
    state: "ok" as const,
    ...dashboard,
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
