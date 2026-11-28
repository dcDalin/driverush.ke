/**
 * `/console/schools/:schoolId`: one school for DriveRush staff, opened as a
 * wide modal route over the schools list (thinkrush's detail views: the list
 * keeps rendering underneath, the address can be shared, and closing goes
 * back to the list with its filters). The modal's header says which school,
 * its status and owner, and holds the two changes that are about the school
 * itself; its tabs are child routes, and every change stacks as a smaller
 * modal over the tab it belongs to:
 *
 *   (index)       Set-up: what is done and what is left, each step linking
 *                 to where it is done
 *     hand-over   give it to its owner (a school in set-up goes live)
 *     status      active, suspended or archived
 *   livery        the school's liveries
 *     upload      upload a livery folder as a draft
 *     :id/:verb   publish, retire or delete one
 *   payments      its code, price and bank; what it earned
 *     review/:d   approve or turn down a bank its owner sent
 *     code, bank  change the code; set a checked bank yourself
 *   sponsorship   when its cars take turns
 *     new         a new sponsorship period
 *   profile       its logo, profile and branch details (staff may do them)
 *   branches      by branch, with each branch's people; add, edit
 *   team          the owner, admins and invites; add, change, remove
 *   students      read only: the school's learners are its own
 *
 * Staff never enter the school's own dashboard (owner, 2026-11-28). They
 * help a school that is not tech savvy set up here: its profile, branches
 * and team, its livery and its owner. Students, the price and the bank stay
 * the school's. The profile, branch and team modals are the owner's own,
 * fed through `SchoolScopeProvider`.
 *
 * This loader reads the school once; the routes under it have none and read
 * it through `useConsoleSchool()`. Changes go through `consoleAction`. Every
 * link inside carries the list's search (`useConsoleSchoolPath`).
 */
import * as React from "react";
import { data, Link, Outlet, useLocation } from "react-router";

import { RouteModal } from "~/components/console/route-modal";
import { STATUS_BADGE, STATUS_LABEL } from "~/components/console/school-status";
import { RouteTabs } from "~/components/console/shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { listSchoolEarnings } from "~/database/billing/school";
import { getConsoleSchool } from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import {
  listSearch,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";
import { kenyanBanks } from "~/lib/payments/banks.server";
import { paymentsEnabled } from "~/lib/payments/env.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { loadSchool } from "~/lib/school/load.server";
import { SchoolScopeProvider } from "~/lib/school/use-school";

import type { Route } from "./+types/school";

export function meta({ data: loaded }: Route.MetaArgs) {
  const name =
    loaded && "school" in loaded && loaded.school
      ? loaded.school.school.name
      : "School";
  return [
    { title: `${name} | Console | DriveRush` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { supabase, headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  const [school, earnings, banks, inside] = await Promise.all([
    getConsoleSchool(supabase, params.schoolId),
    listSchoolEarnings(supabase, params.schoolId).catch(() => []),
    kenyanBanks(),
    // The school as its owner sees it: for the tabs where staff help it
    // set up (profile, branches, team) and read its students.
    loadSchool(context, params.schoolId, { asStaff: true }),
  ]);
  if (!school || inside.state !== "ok")
    return data({ state: "missing" as const }, { headers, status: 404 });
  return data(
    {
      state: "ok" as const,
      school,
      inside,
      earnings,
      banks,
      paymentsOn: paymentsEnabled(),
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

/** The schools list, with the filters it had when the school was opened. */
function useListTo() {
  const { search } = useLocation();
  return `/console/schools${listSearch(search)}`;
}

export default function ConsoleSchool({ loaderData }: Route.ComponentProps) {
  const closeTo = useListTo();
  if ("gated" in loaderData) return null;
  if (loaderData.state === "missing") {
    return (
      <RouteModal closeTo={closeTo} label="Schools">
        <div className="flex flex-col gap-2 px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-8">
          <DialogTitle>No such school</DialogTitle>
          <DialogDescription>
            It may have been removed. Close this to go back to the list.
          </DialogDescription>
        </div>
      </RouteModal>
    );
  }
  return <SchoolModal {...loaderData} closeTo={closeTo} />;
}

function SchoolModal({
  school,
  inside,
  closeTo,
}: Extract<Route.ComponentProps["loaderData"], { state: "ok" }> & {
  closeTo: string;
}) {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { id, name, slug, status } = school.school;
  useLiveRevalidate([`school:${id}`]);
  const to = React.useCallback(
    (page = "") => consoleSchoolPath(id, page),
    [consoleSchoolPath, id],
  );
  const inSetup = status === "setup";
  const dot = (
    <Badge variant="amber" className="px-1.5">
      1
    </Badge>
  );
  return (
    <RouteModal
      closeTo={closeTo}
      label="Schools"
      size="xl"
      className="sm:h-[calc(100dvh-2rem)]"
    >
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-3 sm:gap-4 sm:px-6 sm:pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {name}
              <Badge variant={STATUS_BADGE[status]}>
                {STATUS_LABEL[status]}
              </Badge>
            </DialogTitle>
            <DialogDescription className="mt-1">
              /{slug} ·{" "}
              {school.ownerEmail
                ? `Owner ${school.ownerEmail}`
                : school.invitedOwnerEmail
                  ? `Invited ${school.invitedOwnerEmail}`
                  : "No owner yet"}
            </DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="paper" size="sm">
              <Link to={to("status")} preventScrollReset>
                Change status
              </Link>
            </Button>
            <Button asChild variant={inSetup ? "rush" : "paper"} size="sm">
              <Link to={to("hand-over")} preventScrollReset>
                {inSetup ? "Hand over" : "Change owner"}
              </Link>
            </Button>
          </div>
        </div>
        <RouteTabs
          label="This school"
          tabs={[
            { label: "Set-up", to: to(), end: true },
            { label: "Profile", to: to("profile") },
            {
              label: `Branches (${inside.branches.length})`,
              to: to("branches"),
            },
            {
              label: `Team (${inside.team.length + inside.invites.length})`,
              to: to("team"),
            },
            {
              label: `Students (${inside.students.length})`,
              to: to("students"),
            },
            {
              label: "Livery",
              to: to("livery"),
              badge: school.setup.livery === "draft" ? dot : null,
            },
            {
              label: "Payments",
              to: to("payments"),
              badge: school.payments?.pending_bank_label ? dot : null,
            },
            { label: "Sponsorship", to: to("sponsorship") },
          ]}
        />
      </div>
      {/* The open tab, and over it the modal of a change in progress. Its
          parts keep their height: the column scrolls, it does not squeeze. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:gap-6 sm:px-6 sm:py-5 [&>*]:shrink-0">
        {/* The owner's own pages and modals (profile, branches, team) work
            here too, as staff, with links that stay in the console. */}
        <SchoolScopeProvider data={inside} path={to}>
          <Outlet />
        </SchoolScopeProvider>
      </div>
    </RouteModal>
  );
}
