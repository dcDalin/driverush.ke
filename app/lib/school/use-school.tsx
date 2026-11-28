/**
 * The school a page is about, and how to link within it. Two homes:
 *
 *   the school's own dashboard  the frame's loader data
 *                               (`layouts/school-layout.tsx`), paths under
 *                               `/school/:id`
 *   the console                 DriveRush staff helping a school set up
 *                               (`routes/console/school.tsx`) put the same
 *                               data in a `SchoolScope`, with paths under
 *                               `/console/schools/:id`
 *
 * So one set of pages and modals (add a branch, edit the profile, add an
 * admin) serves both, and the console never sends staff into the school's
 * own dashboard. A page here has no loader of its own.
 */
import * as React from "react";
import { useRouteLoaderData } from "react-router";

import type { SchoolData } from "~/lib/school/load.server";
import { schoolPath } from "~/lib/school/nav";

export const SCHOOL_LAYOUT_ID = "school-layout";

type Scope = {
  data: SchoolData;
  /** A page or modal of this school, e.g. `path("branches/add")`. */
  path: (page?: string) => string;
};

const SchoolScope = React.createContext<Scope | null>(null);

export function SchoolScopeProvider({
  data,
  path,
  children,
}: Scope & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ data, path }), [data, path]);
  return <SchoolScope.Provider value={value}>{children}</SchoolScope.Provider>;
}

export function useSchool(): SchoolData {
  const scope = React.useContext(SchoolScope);
  const loaded = useRouteLoaderData(SCHOOL_LAYOUT_ID) as
    SchoolData | { state: "signed-out" | "not-member" | "staff" } | undefined;
  if (scope) return scope.data;
  if (!loaded || loaded.state !== "ok") {
    throw new Error("A school page was drawn outside its dashboard.");
  }
  return loaded;
}

/** Links within the school, wherever it is shown. */
export function useSchoolPath(): (page?: string) => string {
  const scope = React.useContext(SchoolScope);
  const loaded = useRouteLoaderData(SCHOOL_LAYOUT_ID) as
    { state: string; school?: { id: string } } | undefined;
  const id = loaded?.school?.id ?? "";
  return React.useCallback(
    (page = "") => (scope ? scope.path(page) : schoolPath(id, page)),
    [scope, id],
  );
}

/** Owner only: the pages a branch admin's menu leaves out. */
export const MANAGE_ONLY = {
  title: "For the school's owner",
  body: "Only the owner can see and change this. Ask them, or open Students.",
} as const;
