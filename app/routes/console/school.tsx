/**
 * `/console/schools/:schoolId`: one school for DriveRush staff, as a layout
 * route (owner, 2026-11-28: "use react router 7 features like layout ... that
 * doesn't involve full modal rendering when we switch tabs"). The header
 * (which school, its status and owner, and the two changes about the school
 * itself) and the tabs are drawn once; each tab is a child route in the
 * `<Outlet />`, and every change opens as a modal route over its tab:
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

import { Icon } from "~/components/brand/icon";
import { ArrowLeftIcon } from "~/components/brand/icons";
import { STATUS_BADGE, STATUS_LABEL } from "~/components/console/school-status";
import { PageHeader, RouteTabs } from "~/components/console/shell";
import { FrameError } from "~/components/school/frame-error";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getConsoleSchool } from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import {
  listSearch,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { loadSchool } from "~/lib/school/load.server";
import { SchoolScopeProvider } from "~/lib/school/use-school";
import { frameShouldRevalidate } from "~/lib/ui/frame-revalidate";

import type { Route } from "./+types/school";

export function meta({ loaderData: loaded }: Route.MetaArgs) {
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
  const [school, inside] = await Promise.all([
    getConsoleSchool(supabase, params.schoolId),
    // The school as its owner sees it: for the tabs where staff help it
    // set up (profile, branches, team) and read its students. Its earnings
    // and bank list serve the payments tab too.
    loadSchool(context, params.schoolId, { asStaff: true }),
  ]);
  if (!school || inside.state !== "ok")
    return data({ state: "missing" as const }, { headers, status: 404 });
  return data(
    {
      state: "ok" as const,
      school,
      inside,
      earnings: inside.earnings,
      banks: inside.banks,
      paymentsOn: inside.paymentsOn,
    },
    { headers },
  );
}

/** Moving about inside the frame reads nothing again (`frameShouldRevalidate`). */
export const shouldRevalidate = frameShouldRevalidate;

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
  const listTo = useListTo();
  if ("gated" in loaderData) return null;
  if (loaderData.state === "missing") {
    return (
      <>
        <BackToList to={listTo} />
        <PageHeader
          title="No such school"
          description="It may have been removed. Go back to the list."
        />
      </>
    );
  }
  return <SchoolPage {...loaderData} listTo={listTo} />;
}

function BackToList({ to }: { to: string }) {
  return (
    <Button variant="ghost" size="sm" asChild className="-mb-3 self-start">
      <Link to={to}>
        <Icon icon={ArrowLeftIcon} size={16} />
        All schools
      </Link>
    </Button>
  );
}

/**
 * The layout: the school's header and its tabs, drawn once and kept while
 * the tabs change. Only the `<Outlet />` (the open tab, and over it the
 * modal of a change in progress) swaps.
 */
function SchoolPage({
  school,
  inside,
  listTo,
}: Extract<Route.ComponentProps["loaderData"], { state: "ok" }> & {
  listTo: string;
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
    <>
      <BackToList to={listTo} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {name}
            <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
          </span>
        }
        description={
          <>
            /{slug} ·{" "}
            {school.ownerEmail
              ? `Owner ${school.ownerEmail}`
              : school.invitedOwnerEmail
                ? `Invited ${school.invitedOwnerEmail}`
                : "No owner yet"}
          </>
        }
        actions={
          <>
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
          </>
        }
      />
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
      {/* The owner's own pages and modals (profile, branches, team) work
          here too, as staff, with links that stay in the console. */}
      <SchoolScopeProvider data={inside} path={to}>
        <div className="flex flex-col gap-5 sm:gap-6">
          <Outlet />
        </div>
      </SchoolScopeProvider>
    </>
  );
}

/** A failed tab or change, inside the console's frame (`FrameError`). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <FrameError error={error} />;
}
