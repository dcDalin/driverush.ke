/**
 * `/school/:schoolId/profile/logo/:kind`: upload the colour logo (`logo`)
 * or the white one (`logo_mono`), in a modal over the profile page.
 */
import { Navigate, useParams } from "react-router";

import {
  RouteModal,
  RouteModalBody,
  RouteModalHeader,
} from "~/components/console/route-modal";
import {
  type LogoKind,
  LOGOS,
  LogoUpload,
} from "~/components/school/profile-panel";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { useSchool, useSchoolPath } from "~/lib/school/use-school";

import type { Route } from "./+types/profile-logo";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function ProfileLogo() {
  const path = useSchoolPath();
  const d = useSchool();
  const { kind = "" } = useParams();
  const closeTo = path("profile");
  if (!d.canManage || !(kind in LOGOS)) {
    return <Navigate to={closeTo} replace />;
  }
  const which = kind as LogoKind;
  return (
    <RouteModal closeTo={closeTo} label="Profile">
      <RouteModalHeader
        title={LOGOS[which].label}
        description="A PNG, JPEG or WebP picture, at most 5 MB."
      />
      <RouteModalBody className="pt-4 pb-6">
        <LogoUpload
          kind={which}
          current={d.logos[which]}
          action={path(`profile/logo/${which}`)}
          closeTo={closeTo}
        />
      </RouteModalBody>
    </RouteModal>
  );
}
