/**
 * `/school/:schoolId/branches`: (owner) rename or move a branch, close or
 * reopen it. "Add branch" is a modal route over the list (`branches/add`).
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { PageHeader } from "~/components/console/shell";
import { BranchesPanel } from "~/components/school/branches-panel";
import { NothingHere } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { MANAGE_ONLY, useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/branches";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function SchoolBranches() {
  const d = useSchool();
  if (!d.canManage) return <NothingHere {...MANAGE_ONLY} />;
  return (
    <>
      <PageHeader
        title="Branches"
        description="Students and admins belong to a branch. A closed branch keeps its history but takes no new students."
        actions={
          <Button asChild variant="rush">
            <Link
              to={schoolPath(d.school.id, "branches/add")}
              preventScrollReset
            >
              <Icon icon={PlusIcon} size={18} />
              Add branch
            </Link>
          </Button>
        }
      />
      <BranchesPanel branches={d.branches} />
      <Outlet />
    </>
  );
}
