/**
 * `/console/schools/:schoolId/status`: active, suspended or archived, a
 * modal over Set-up. Set-up itself ends only by handing the school over;
 * making it active from here puts it live with no owner.
 */
import * as React from "react";
import { useFetcher } from "react-router";

import {
  RouteModal,
  RouteModalBody,
  RouteModalFooter,
  RouteModalHeader,
  useCloseWhenDone,
} from "~/components/console/route-modal";
import { STATUS_LABEL } from "~/components/console/school-status";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import type { SchoolStatus } from "~/database/types";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  consoleSchoolPath,
  useConsoleSchool,
} from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-status";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

const CHOICES = ["active", "suspended", "archived"] as const;

const MEANS: Record<(typeof CHOICES)[number], string> = {
  active: "On the site and the board; its owner and admins can work.",
  suspended: "Off the site and the board; nobody can add students.",
  archived: "Put away: off everything, and out of the console's list.",
};

export default function SchoolStatusModal() {
  const { school } = useConsoleSchool();
  const { id, status, name } = school.school;
  const here = consoleSchoolPath(id, "status");
  const closeTo = consoleSchoolPath(id);
  const fetcher = useFetcher({ key: `school-status:${id}` });
  const busy = fetcher.state !== "idle";
  useCloseWhenDone(fetcher, closeTo);
  const [next, setNext] = React.useState<SchoolStatus>(
    status === "setup" ? "active" : status,
  );
  return (
    <RouteModal closeTo={closeTo} label={name}>
      <RouteModalHeader
        title="Change status"
        description={`Now: ${STATUS_LABEL[status]}.`}
      />
      <RouteModalBody className="flex flex-col gap-3 pt-4">
        <Label id="status-label">New status</Label>
        <ToggleGroup
          type="single"
          value={next}
          onValueChange={(value) => value && setNext(value as SchoolStatus)}
          aria-labelledby="status-label"
          disabled={busy}
        >
          {CHOICES.map((choice) => (
            <ToggleGroupItem key={choice} value={choice}>
              {STATUS_LABEL[choice]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="m-0 text-[14px] text-ink-2">
          {MEANS[next as (typeof CHOICES)[number]]}
        </p>
        {status === "setup" && next === "active" ? (
          <Alert>
            <AlertBody>
              <AlertTitle>It goes live with no owner</AlertTitle>
              <AlertDescription>
                Handing it over makes it live and gives it an owner in one go.
              </AlertDescription>
            </AlertBody>
          </Alert>
        ) : null}
      </RouteModalBody>
      <RouteModalFooter closeTo={closeTo} busy={busy}>
        <Button
          type="button"
          variant="rush"
          isLoading={busy}
          disabled={next === status}
          onClick={() =>
            void fetcher.submit(
              { intent: "set-status", schoolId: id, status: next },
              { method: "POST", action: here },
            )
          }
        >
          Save status
        </Button>
      </RouteModalFooter>
    </RouteModal>
  );
}
