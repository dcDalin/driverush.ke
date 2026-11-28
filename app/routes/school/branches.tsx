/**
 * `/school/:schoolId/branches`: (owner) every branch with its admins and
 * students (`BranchList`, the same list DriveRush staff see), searched and
 * filtered open or closed; rename or move a branch, close or reopen it in
 * its own modal. "Add branch" is a modal route over the list
 * (`branches/add`).
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { PageHeader } from "~/components/console/shell";
import { BranchList } from "~/components/school/branch-list";
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
      <section className="flex flex-col gap-4">
        <h2 className="sr-only">Branches</h2>
        {d.branches.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
            No branch yet. Add your first one, then add students to it.
          </p>
        ) : (
          <BranchList students={{ branch: "sbranch", status: "sstatus" }} />
        )}
      </section>
      <Outlet />
    </>
  );
}
