/**
 * `/console`: DriveRush staff (su and admin, on a password session).
 *
 *   Schools  every school, a page at a time: search by name, short name or
 *            owner's email; filter by status, livery and sponsorship (all in
 *            the address). "New school" creates one for an owner's email,
 *            or with none to set it up privately first. Each row opens the
 *            school's page (`/console/schools/:schoolId`): set-up, hand-over,
 *            liveries, sponsorship, payments.
 *   Staff    (su only) who holds a staff role; grant or revoke by email.
 *
 * Changes go through `consoleAction` (shared with the school's page); the
 * database checks every call again (private.is_staff, private.is_su).
 */
import { data, useSearchParams } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { StaffPanel } from "~/components/console/console-panels";
import { CreateSchoolDialog } from "~/components/console/create-school-dialog";
import {
  SchoolFilters,
  SchoolList,
  SchoolPager,
} from "~/components/console/school-list";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { isStaffRole, isSuRole } from "~/database/auth/roles";
import { listConsoleSchools, listStaff } from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { SchoolFiltersSchema } from "~/schemas/console";

import type { Route } from "./+types/console";

export function meta() {
  return [
    { title: "Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  if (!caller.signedIn)
    return data({ state: "signed-out" as const }, { headers });
  if (!isStaffRole(caller.role))
    return data({ state: "not-staff" as const }, { headers });
  const su = isSuRole(caller.role);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = SchoolFiltersSchema.parse(params);
  const [list, staff] = await Promise.all([
    listConsoleSchools(supabase, {
      search: filters.q,
      status: filters.status,
      livery: filters.livery,
      sponsoring: filters.sponsoring,
      page: filters.page,
    }),
    su ? listStaff(supabase) : Promise.resolve([]),
  ]);
  return data(
    {
      state: "ok" as const,
      su,
      me: caller.userId,
      page: Math.min(filters.page, list.pages),
      ...list,
      staff,
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData());
}

export default function Console({ loaderData }: Route.ComponentProps) {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "staff" ? "staff" : "schools";
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {loaderData.state === "signed-out" ? (
          <NeedsSignIn
            title="Console"
            body="For DriveRush staff. Sign in with your email and password."
          />
        ) : loaderData.state === "not-staff" ? (
          <NothingHere
            title="Staff only"
            body="This account has no DriveRush staff role, or signed in with a code. Staff sign in with a password."
          />
        ) : (
          <div className="flex flex-col gap-6 py-10">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-[28px] font-bold tracking-tight">
                Console
              </h1>
              <CreateSchoolDialog />
            </header>
            <Tabs
              value={tab}
              onValueChange={(value) =>
                setParams(
                  value === "staff" ? { tab: "staff" } : new URLSearchParams(),
                  { replace: true },
                )
              }
            >
              <TabsList>
                <TabsTrigger value="schools">Schools</TabsTrigger>
                {loaderData.su ? (
                  <TabsTrigger value="staff">Staff</TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="schools" className="flex flex-col gap-4 pt-4">
                <SchoolFilters />
                <SchoolList
                  schools={loaderData.schools}
                  total={loaderData.total}
                />
                <SchoolPager page={loaderData.page} pages={loaderData.pages} />
              </TabsContent>
              {loaderData.su ? (
                <TabsContent value="staff" className="pt-4">
                  <StaffPanel staff={loaderData.staff} me={loaderData.me} />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        )}
      </main>
    </>
  );
}
