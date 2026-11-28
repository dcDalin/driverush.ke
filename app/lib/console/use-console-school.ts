/**
 * The school a console page is about: the loader data of
 * `routes/console/school.tsx`, read by the tabs and modals under it, which
 * have no loader of their own. The frame only draws them once it loaded.
 */
import { useRouteLoaderData } from "react-router";

import type { loader } from "~/routes/console/school";

export const CONSOLE_SCHOOL_ID = "console-school";

type Loaded = Awaited<ReturnType<typeof loader>>["data"];
export type ConsoleSchoolData = Extract<Loaded, { state: "ok" }>;

export function useConsoleSchool(): ConsoleSchoolData {
  const loaded = useRouteLoaderData(CONSOLE_SCHOOL_ID) as Loaded | undefined;
  if (!loaded || !("state" in loaded) || loaded.state !== "ok") {
    throw new Error("A school's console page was drawn outside its frame.");
  }
  return loaded;
}

/** `/console/schools/:id`, and the pages and modals under it. */
export const consoleSchoolPath = (schoolId: string, page = "") =>
  `/console/schools/${schoolId}${page ? `/${page}` : ""}`;
