/**
 * `/console/schools`: every school, a page at a time. Search by name, short
 * name or owner's email; filter by status, livery and sponsorship (all in
 * the address). Each row opens the school's own page. "New school" is a
 * modal route over this list (`schools/new`), drawn through the `<Outlet />`.
 */
import { data, Link, Outlet, useLocation } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { SchoolFilters, SchoolList } from "~/components/console/school-list";
import { PageHeader } from "~/components/console/shell";
import { PaginationBar } from "~/components/list/pagination-bar";
import { Button } from "~/components/ui/button";
import {
  CONSOLE_PAGE_SIZE,
  listConsoleSchools,
} from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import { SchoolFiltersSchema } from "~/schemas/console";

import type { Route } from "./+types/schools";

export function meta() {
  return [
    { title: "Schools | Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, url }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { supabase, headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  const filters = SchoolFiltersSchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const list = await listConsoleSchools(supabase, {
    search: filters.q,
    status: filters.status,
    livery: filters.livery,
    sponsoring: filters.sponsoring,
    page: filters.page,
  });
  return data(
    { ...list, page: Math.min(filters.page, list.pages) },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function ConsoleSchools({ loaderData }: Route.ComponentProps) {
  const { search } = useLocation();
  if ("gated" in loaderData) return null;
  return (
    <>
      <PageHeader
        title="Schools"
        description="Create a school, set it up, hand it to its owner. A row opens the school."
        actions={
          <Button asChild variant="rush">
            <Link to={`/console/schools/new${search}`} preventScrollReset>
              <Icon icon={PlusIcon} size={18} />
              New school
            </Link>
          </Button>
        }
      />
      <SchoolFilters total={loaderData.total} />
      <SchoolList schools={loaderData.schools} />
      <PaginationBar
        page={loaderData.page}
        pageSize={CONSOLE_PAGE_SIZE}
        totalCount={loaderData.total}
        noun={["school", "schools"]}
      />
      <Outlet />
    </>
  );
}
