/**
 * `/console/schools/:schoolId/livery/upload`: upload the school's livery
 * folder as a draft, a modal over the livery list. The files go straight to
 * Storage from the browser; the draft row is posted here.
 */
import { useNavigate } from "react-router";

import {
  RouteModal,
  RouteModalBody,
  RouteModalHeader,
} from "~/components/console/route-modal";
import { LiveryUploader } from "~/components/console/school-liveries";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-livery-upload";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolLiveryUpload() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school } = useConsoleSchool();
  const id = school.school.id;
  const closeTo = consoleSchoolPath(id, "livery");
  const navigate = useNavigate();
  return (
    <RouteModal closeTo={closeTo} label={school.school.name} size="md">
      <RouteModalHeader
        title="Upload a livery"
        description="Choose the school's livery folder (the art pipeline's seed/fixtures/liveries/<slug>). Only files the bucket does not have yet are sent. It is saved as a draft for you to preview."
      />
      <RouteModalBody className="pt-4 pb-6">
        <LiveryUploader
          schoolId={id}
          action={consoleSchoolPath(id, "livery/upload")}
          onSaved={() =>
            void navigate(closeTo, { replace: true, preventScrollReset: true })
          }
        />
      </RouteModalBody>
    </RouteModal>
  );
}
