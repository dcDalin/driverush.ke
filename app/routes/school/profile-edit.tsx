/**
 * `/school/:schoolId/profile/edit`: what learners read about the school
 * (tagline, about, contacts, social links, brand colours), in a modal over
 * the profile page.
 */
import { Navigate } from "react-router";

import {
  RouteModal,
  RouteModalBody,
  RouteModalHeader,
} from "~/components/console/route-modal";
import { ProfileForm } from "~/components/school/profile-panel";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { useSchool, useSchoolPath } from "~/lib/school/use-school";

import type { Route } from "./+types/profile-edit";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function ProfileEdit() {
  const path = useSchoolPath();
  const d = useSchool();
  const closeTo = path("profile");
  if (!d.canManage) return <Navigate to={closeTo} replace />;
  return (
    <RouteModal closeTo={closeTo} label="Profile" size="lg">
      <RouteModalHeader
        title="Edit profile"
        description="The site shows it within a few minutes of saving."
      />
      <RouteModalBody className="pt-4 pb-6">
        <ProfileForm
          profile={d.profile}
          action={path("profile/edit")}
          closeTo={closeTo}
        />
      </RouteModalBody>
    </RouteModal>
  );
}
