/**
 * `/school/:schoolId/students/:linkId/:verb`: one change to one student, in
 * a modal over the students list (its filters kept):
 *
 *   move      to another open branch the person works in
 *   release   end their month with the school now
 *   withdraw  take back an invite they have not taken up
 */
import * as React from "react";
import { Navigate, useFetcher, useParams } from "react-router";

import {
  ConfirmModal,
  RouteModal,
  RouteModalBody,
  RouteModalFooter,
  RouteModalHeader,
  useCloseTo,
  useCloseWhenDone,
} from "~/components/console/route-modal";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/student-change";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function StudentChange() {
  const d = useSchool();
  const { linkId = "", verb = "" } = useParams();
  const closeTo = useCloseTo(schoolPath(d.school.id, "students"));
  const here = schoolPath(d.school.id, `students/${linkId}/${verb}`);
  const student = d.students.find((s) => s.id === linkId);
  const elsewhere = d.branches.filter(
    (b) =>
      b.is_active && d.myBranchIds.includes(b.id) && b.id !== student?.branchId,
  );
  // Gone (released or withdrawn a moment ago), or not a change we know.
  if (!student) return <Navigate to={closeTo} replace />;
  const who = student.name ?? student.email;

  if (verb === "move" && elsewhere.length > 0 && student.status !== "ended") {
    return (
      <MoveModal
        here={here}
        closeTo={closeTo}
        who={who}
        linkId={linkId}
        branches={elsewhere}
      />
    );
  }
  if (verb === "release" && student.status === "active") {
    return (
      <ConfirmModal
        here={here}
        closeTo={closeTo}
        label="Students"
        title={`Release ${who}?`}
        body="Their month with your school ends now: you stop seeing their progress and your cars leave their board. A pass they paid for stays theirs."
        confirm="Release"
        fields={{ intent: "release-student", linkId }}
      />
    );
  }
  if (verb === "withdraw" && student.status === "pending") {
    return (
      <ConfirmModal
        here={here}
        closeTo={closeTo}
        label="Students"
        title={`Withdraw the invite to ${student.email}?`}
        body="The link in their email stops working. You can add them again later."
        confirm="Withdraw"
        fields={{ intent: "cancel-student", linkId }}
      />
    );
  }
  return <Navigate to={closeTo} replace />;
}

function MoveModal({
  here,
  closeTo,
  who,
  linkId,
  branches,
}: {
  here: string;
  closeTo: string;
  who: string;
  linkId: string;
  branches: { id: string; name: string }[];
}) {
  const fetcher = useFetcher({ key: `move-student:${linkId}` });
  const busy = fetcher.state !== "idle";
  useCloseWhenDone(fetcher, closeTo);
  const [target, setTarget] = React.useState(branches[0]?.id ?? "");
  return (
    <RouteModal closeTo={closeTo} label="Students">
      <RouteModalHeader
        title={`Move ${who}`}
        description="Their month and progress carry over. The new branch's admins see them from now on."
      />
      <RouteModalBody className="flex flex-col gap-2 pt-4">
        <Label id="move-to-label">To branch</Label>
        <Select value={target} onValueChange={setTarget} disabled={busy}>
          <SelectTrigger aria-labelledby="move-to-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </RouteModalBody>
      <RouteModalFooter closeTo={closeTo} busy={busy}>
        <Button
          type="button"
          variant="rush"
          isLoading={busy}
          disabled={!target}
          onClick={() =>
            void fetcher.submit(
              { intent: "move-student", linkId, branchId: target },
              { method: "POST", action: here },
            )
          }
        >
          Move
        </Button>
      </RouteModalFooter>
    </RouteModal>
  );
}
