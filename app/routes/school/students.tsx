/**
 * `/school/:schoolId/students`: everyone the school has added, in the
 * branches the person works in, with their progress and pass. Search and
 * filters live in the address. "Add student" is a modal route over the list
 * (`students/add`), drawn through the `<Outlet />`.
 */
import { Link, Outlet, useLocation } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { PageHeader } from "~/components/console/shell";
import { StudentsPanel } from "~/components/school/students-panel";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/students";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function SchoolStudents() {
  const d = useSchool();
  const { search } = useLocation();
  const canAdd = d.branches.some(
    (b) => b.is_active && d.myBranchIds.includes(b.id),
  );
  return (
    <>
      <PageHeader
        title="Students"
        description="Add this week's class by email. Each student is emailed a link, and their progress shows here while their month runs."
        actions={
          canAdd ? (
            <Button asChild variant="rush">
              <Link
                to={`${schoolPath(d.school.id, "students/add")}${search}`}
                preventScrollReset
              >
                <Icon icon={PlusIcon} size={18} />
                Add student
              </Link>
            </Button>
          ) : null
        }
      />
      {canAdd ? null : (
        <p className="m-0 text-[14px] text-ink-3">
          Add a branch first, then add students to it.
        </p>
      )}
      <StudentsPanel
        students={d.students}
        branches={d.branches}
        myBranchIds={d.myBranchIds}
      />
      <Outlet />
    </>
  );
}
