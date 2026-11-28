/**
 * `/school/:schoolId/team/:memberId/:verb`: one change to one admin, in a
 * modal over the team list (owner): `branches` (which branches they work
 * in) or `remove`.
 */
import { Navigate, useParams } from "react-router";

import { ConfirmModal, ModalForm } from "~/components/console/route-modal";
import { CheckboxGroupField } from "~/components/ui/forms/server";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";
import { SetAdminBranchesSchema } from "~/schemas/school";

import type { Route } from "./+types/admin-change";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function AdminChange() {
  const d = useSchool();
  const { memberId = "", verb = "" } = useParams();
  const closeTo = schoolPath(d.school.id, "team");
  const here = schoolPath(d.school.id, `team/${memberId}/${verb}`);
  const member = d.team.find(
    (m) => m.member_id === memberId && m.role === "admin",
  );
  const form = useServerForm({
    schema: SetAdminBranchesSchema,
    key: `admin-branches:${memberId}`,
    action: here,
    defaultValues: {
      intent: "set-admin-branches",
      memberId,
      branchIds: member?.branch_ids ?? [],
    },
  });
  if (!member) return <Navigate to={closeTo} replace />;
  const who = member.full_name ?? member.email;

  if (verb === "branches") {
    return (
      <ModalForm
        form={form}
        here={here}
        closeTo={closeTo}
        label="Team"
        title={`${who}'s branches`}
        description="They add students to these branches and see only these branches' students."
        submit="Save branches"
      >
        <CheckboxGroupField
          name="branchIds"
          label="Branches"
          options={d.branches.map((b) => ({ label: b.name, value: b.id }))}
          disabled={form.busy}
        />
      </ModalForm>
    );
  }
  if (verb === "remove") {
    return (
      <ConfirmModal
        here={here}
        closeTo={closeTo}
        label="Team"
        title={`Remove ${who}?`}
        body="They lose the school's dashboard at once. Students they added stay with the school."
        confirm="Remove"
        fields={{ intent: "remove-admin", memberId }}
      />
    );
  }
  return <Navigate to={closeTo} replace />;
}
