/**
 * A school's first tab, Set-up, and the frame for the two modals that are
 * about the school itself (`hand-over`, `status`): they open over it
 * through the `<Outlet />`.
 */
import { Outlet } from "react-router";

import { SetupChecklist } from "~/components/console/school-setup";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { useConsoleSchool } from "~/lib/console/use-console-school";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/school-setup";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolSetup() {
  const { school } = useConsoleSchool();
  const inside = useSchool();
  const open = inside.branches.filter((b) => b.is_active).length;
  const active = inside.students.filter((s) => s.status === "active");
  const waiting = inside.students.filter((s) => s.status === "pending").length;
  const paid = active.filter((s) => s.passEndsAt).length;
  return (
    <>
      <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Total
          label="Branches"
          value={open}
          note={
            inside.branches.length > open
              ? `${inside.branches.length - open} closed`
              : "all open"
          }
        />
        <Total
          label="Team"
          value={inside.team.length}
          note={`${inside.invites.length} invited`}
        />
        <Total
          label="Students"
          value={active.length}
          note={`${waiting} waiting`}
        />
        <Total label="With a pass" value={paid} note={`of ${active.length}`} />
      </dl>
      <SetupChecklist school={school} />
      <Outlet />
    </>
  );
}

/** One total in the strip: small enough that two fit a phone's width. */
function Total({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface px-3 py-2.5">
      <dt className="truncate text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        {label}
      </dt>
      <dd className="m-0 font-display text-[20px] leading-none font-bold tabular-nums">
        {value}
      </dd>
      <dd className="m-0 truncate text-[12px] text-ink-3">{note}</dd>
    </div>
  );
}
