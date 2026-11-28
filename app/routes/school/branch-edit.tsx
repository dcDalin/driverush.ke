/**
 * `/school/:schoolId/branches/:branchId/edit`: rename or move a branch,
 * close or reopen it, in a modal over the branches list (owner).
 */
import { Navigate, useParams } from "react-router";

import { ModalForm } from "~/components/console/route-modal";
import { InputField, SwitchField } from "~/components/ui/forms/server";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { useSchool, useSchoolPath } from "~/lib/school/use-school";
import { UpdateBranchSchema } from "~/schemas/school";

import type { Route } from "./+types/branch-edit";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function BranchEdit() {
  const path = useSchoolPath();
  const d = useSchool();
  const { branchId = "" } = useParams();
  const closeTo = path("branches");
  const here = path(`branches/${branchId}/edit`);
  const branch = d.branches.find((b) => b.id === branchId);
  const form = useServerForm({
    schema: UpdateBranchSchema,
    key: `branch:${branchId}`,
    action: here,
    defaultValues: {
      intent: "update-branch",
      branchId,
      name: branch?.name ?? "",
      town: branch?.town ?? "",
      isActive: branch?.is_active ?? true,
    },
  });
  if (!branch) return <Navigate to={closeTo} replace />;
  return (
    <ModalForm
      form={form}
      here={here}
      closeTo={closeTo}
      label="Branches"
      title={`Edit ${branch.name}`}
      description="A closed branch keeps its students' history but takes no new students."
      submit="Save branch"
    >
      <InputField
        name="name"
        label="Branch name"
        disabled={form.busy}
        inputProps={{ autoFocus: true }}
      />
      <InputField name="town" label="Town" disabled={form.busy} />
      <SwitchField name="isActive" label="Open" disabled={form.busy} />
    </ModalForm>
  );
}
