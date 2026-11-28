/**
 * `/school/:schoolId/team`: (owner) the owner, the admins and the invites
 * not yet taken up, searched and filtered by branch and role (`TeamList`,
 * the same list DriveRush staff see); change an admin's branches, remove
 * them, email an invite again. "Add admin" is a modal route over the list
 * (`team/add`). At most 50.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { PageHeader } from "~/components/console/shell";
import { NothingHere } from "~/components/school/signed-out";
import { TeamList } from "~/components/school/team-list";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { adminCount, MAX_ADMINS } from "~/lib/school/admins";
import { schoolPath } from "~/lib/school/nav";
import { MANAGE_ONLY, useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/team";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function SchoolTeam() {
  const d = useSchool();
  if (!d.canManage) return <NothingHere {...MANAGE_ONLY} />;
  const canAdd =
    d.branches.length > 0 && adminCount(d.team, d.invites) < MAX_ADMINS;
  return (
    <>
      <PageHeader
        title="Team"
        description="Admins add students to their own branches and follow their progress. Everyone you add is emailed a link."
        actions={
          canAdd ? (
            <Button asChild variant="rush">
              <Link to={schoolPath(d.school.id, "team/add")} preventScrollReset>
                <Icon icon={PlusIcon} size={18} />
                Add admin
              </Link>
            </Button>
          ) : null
        }
      />
      <section className="flex flex-col gap-4">
        <h2 className="sr-only">Team</h2>
        <TeamList emailAgain empty="Just you so far." />
      </section>
      <Outlet />
    </>
  );
}
