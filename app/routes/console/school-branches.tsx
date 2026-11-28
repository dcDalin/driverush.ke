/**
 * `/console/schools/:schoolId/branches`: one row per branch with its
 * counts (`BranchList`, the same list the owner sees). Staff help a school
 * set up: "Add branch" and each row's "Edit" open the owner's own modals
 * over this list.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { Section } from "~/components/console/shell";
import { BranchList } from "~/components/school/branch-list";
import { Button } from "~/components/ui/button";
import { useSchool, useSchoolPath } from "~/lib/school/use-school";

export default function SchoolBranches() {
  const { branches } = useSchool();
  const path = useSchoolPath();
  const none = branches.length === 0;
  return (
    <Section
      title="Branches"
      description={
        none
          ? "Students and admins belong to a branch. Add them for the school, or leave them to its owner."
          : "Students and admins belong to a branch. Add and change them for the school; its owner can too."
      }
      actions={
        <Button asChild variant="rush" size="sm">
          <Link to={path("branches/add")} preventScrollReset>
            <Icon icon={PlusIcon} size={16} />
            Add branch
          </Link>
        </Button>
      }
    >
      {none ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-3">
          No branch yet.
        </p>
      ) : (
        <BranchList students={{ branch: "ibranch", status: "istatus" }} />
      )}
      <Outlet />
    </Section>
  );
}
