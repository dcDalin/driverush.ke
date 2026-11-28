/**
 * `/school/:schoolId/profile`: (owner, staff) what learners read about the
 * school, the logos (uploaded through the server to Supabase Storage) and
 * each branch's address, map pin, phone and hours.
 */
import { Outlet } from "react-router";

import { PageHeader } from "~/components/console/shell";
import { ProfilePanel } from "~/components/school/profile-panel";
import { NothingHere } from "~/components/school/signed-out";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { MANAGE_ONLY, useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/profile";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function SchoolProfile() {
  const d = useSchool();
  if (!d.canManage) return <NothingHere {...MANAGE_ONLY} />;
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your school's page on DriveRush: what learners read before they choose you. Your cars on the board are made by DriveRush from your real ones: ask us to change them."
      />
      <ProfilePanel profile={d.profile} logos={d.logos} branches={d.branches} />
      <Outlet />
    </>
  );
}
