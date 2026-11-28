/**
 * `/console/schools/:schoolId/sponsorship`: when the school's cars take
 * turns on the board. A new period is a modal route over this page.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { Sponsorships } from "~/components/console/console-panels";
import { Section } from "~/components/console/shell";
import { Button } from "~/components/ui/button";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  consoleSchoolPath,
  useConsoleSchool,
} from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-sponsorship";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolSponsorship() {
  const { school } = useConsoleSchool();
  const id = school.school.id;
  return (
    <>
      <Section
        title="Sponsorship"
        description="The one paid thing on DriveRush: a sponsoring school's cars are seen by everyone."
        actions={
          <Button asChild variant="rush" size="sm">
            <Link
              to={consoleSchoolPath(id, "sponsorship/new")}
              preventScrollReset
            >
              <Icon icon={PlusIcon} size={16} />
              New period
            </Link>
          </Button>
        }
      >
        <Sponsorships schoolId={id} sponsorships={school.sponsorships} />
      </Section>
      <Outlet />
    </>
  );
}
