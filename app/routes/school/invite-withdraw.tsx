/**
 * `/school/:schoolId/team/invites/:inviteId/withdraw`: take back an admin
 * invite that has not been taken up, asked first in a modal over the team.
 */
import { Navigate, useParams } from "react-router";

import { ConfirmModal } from "~/components/console/route-modal";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/invite-withdraw";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function InviteWithdraw() {
  const d = useSchool();
  const { inviteId = "" } = useParams();
  const closeTo = schoolPath(d.school.id, "team");
  const invite = d.invites.find((i) => i.id === inviteId);
  if (!invite) return <Navigate to={closeTo} replace />;
  return (
    <ConfirmModal
      here={schoolPath(d.school.id, `team/invites/${inviteId}/withdraw`)}
      closeTo={closeTo}
      label="Team"
      title={`Withdraw the invite to ${invite.email}?`}
      body="The link in their email stops working. You can add them again later."
      confirm="Withdraw"
      fields={{ intent: "cancel-invite", inviteId }}
    />
  );
}
