/**
 * `/school/:schoolId/profile/branches/:branchId`: one branch's address,
 * map pin, phone and opening hours, in a modal over the profile page.
 */
import { Navigate, useParams } from "react-router";

import {
  RouteModal,
  RouteModalBody,
  RouteModalHeader,
} from "~/components/console/route-modal";
import { BranchDetails } from "~/components/school/profile-panel";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/profile-branch";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function ProfileBranch() {
  const d = useSchool();
  const { branchId = "" } = useParams();
  const closeTo = schoolPath(d.school.id, "profile");
  const branch = d.branches.find((b) => b.id === branchId);
  if (!d.canManage || !branch) return <Navigate to={closeTo} replace />;
  return (
    <RouteModal closeTo={closeTo} label="Profile" size="md">
      <RouteModalHeader
        title={branch.name}
        description="Where it is, how to reach it and when it is open."
      />
      <RouteModalBody className="pt-4 pb-6">
        <BranchDetails
          branch={branch}
          action={schoolPath(d.school.id, `profile/branches/${branch.id}`)}
          closeTo={closeTo}
        />
      </RouteModalBody>
    </RouteModal>
  );
}
