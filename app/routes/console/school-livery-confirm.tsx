/**
 * `/console/schools/:schoolId/livery/:liveryId/:verb`: publish, retire or
 * delete one livery, asked first in a modal over the livery list.
 */
import { Navigate, useParams } from "react-router";

import { ConfirmModal } from "~/components/console/route-modal";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-livery-confirm";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

const ASK = {
  publish: {
    intent: "publish-livery",
    title: "Publish this livery?",
    body: "Everyone sees it on the board within a few minutes. The school's current livery is retired.",
    confirm: "Publish",
  },
  retire: {
    intent: "retire-livery",
    title: "Take this livery off the board?",
    body: "The school's learners see plain cars and it stops taking turns until another livery is published.",
    confirm: "Retire",
  },
  delete: {
    intent: "delete-livery",
    title: "Delete this livery?",
    body: "Its row goes; its files stay in storage (other liveries may share them).",
    confirm: "Delete",
  },
} as const;

export default function SchoolLiveryConfirm() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school } = useConsoleSchool();
  const { liveryId = "", verb = "" } = useParams();
  const id = school.school.id;
  const closeTo = consoleSchoolPath(id, "livery");
  const ask = ASK[verb as keyof typeof ASK];
  const livery = school.liveries.find((l) => l.id === liveryId);
  // An unknown verb, or a livery that has gone: back to the list.
  if (!ask || !livery) return <Navigate to={closeTo} replace />;
  return (
    <ConfirmModal
      here={consoleSchoolPath(id, `livery/${liveryId}/${verb}`)}
      closeTo={closeTo}
      label={livery.label}
      title={ask.title}
      body={ask.body}
      confirm={ask.confirm}
      fields={{ intent: ask.intent, liveryId }}
    />
  );
}
