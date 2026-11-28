/**
 * `/console/schools/:schoolId/team`: the owner, the admins and the invites
 * not yet taken up (`TeamList`, the same list the owner sees). Staff help a
 * school set up its team: "Add admin", and each admin's "Change branches"
 * and "Remove" and each invite's "Withdraw", open the owner's own modals
 * over this list. While the school is being set up, nobody is emailed:
 * invites go out when it is handed over.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { Section } from "~/components/console/shell";
import { TeamList } from "~/components/school/team-list";
import { Button } from "~/components/ui/button";
import { useSchool, useSchoolPath } from "~/lib/school/use-school";

export default function SchoolTeam() {
  const { school, branches } = useSchool();
  const path = useSchoolPath();
  const inSetup = school.status === "setup";
  return (
    <Section
      title="Team"
      description={
        inSetup
          ? "Add the school's admins for it. Nobody is emailed until you hand the school over."
          : "Add and change the school's admins for it; its owner can too."
      }
      actions={
        branches.length > 0 ? (
          <Button asChild variant="rush" size="sm">
            <Link to={path("team/add")} preventScrollReset>
              <Icon icon={PlusIcon} size={16} />
              Add admin
            </Link>
          </Button>
        ) : null
      }
    >
      {branches.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-3">
          Add a branch first: every admin works in one or more branches.
        </p>
      ) : null}
      <TeamList empty="Nobody yet: it has not been handed over." />
      <Outlet />
    </Section>
  );
}
