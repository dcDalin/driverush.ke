/**
 * `/school/:schoolId/team`: (owner) the owner and admins, each admin's
 * branches; change their branches, remove them, re-send an invite. "Add
 * admin" is a modal route over the list (`team/add`). At most 50.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { PageHeader } from "~/components/console/shell";
import { NothingHere } from "~/components/school/signed-out";
import { MAX_ADMINS, TeamPanel } from "~/components/school/team-panel";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
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
  const admins =
    d.team.filter((m) => m.role === "admin").length +
    d.invites.filter((i) => i.role === "admin").length;
  const canAdd = d.branches.length > 0 && admins < MAX_ADMINS;
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
      <TeamPanel
        schoolId={d.school.id}
        team={d.team}
        invites={d.invites}
        branches={d.branches}
      />
      <Outlet />
    </>
  );
}
