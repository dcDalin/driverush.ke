/**
 * `/console/schools/:schoolId/livery`: the school's liveries. Uploading one
 * and publishing, retiring or deleting one are modal routes over this list.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { UploadIcon } from "~/components/brand/icons";
import { LiveryList } from "~/components/console/school-liveries";
import { Section } from "~/components/console/shell";
import { Button } from "~/components/ui/button";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-livery";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolLivery() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school } = useConsoleSchool();
  const id = school.school.id;
  return (
    <>
      <Section
        title="Livery"
        description="The colours the school's cars wear on the board. A new one is a draft until you publish it."
        actions={
          <Button asChild variant="rush" size="sm">
            <Link
              to={consoleSchoolPath(id, "livery/upload")}
              preventScrollReset
            >
              <Icon icon={UploadIcon} size={16} />
              Upload livery
            </Link>
          </Button>
        }
      >
        <LiveryList liveries={school.liveries} schoolId={id} />
      </Section>
      <Outlet />
    </>
  );
}
