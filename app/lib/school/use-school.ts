/**
 * The school a dashboard page is about: the frame's loader data
 * (`layouts/school-layout.tsx`), read by the pages under it, which have no
 * loader of their own. The frame only draws a page when the school loaded,
 * so a page can rely on it.
 */
import { useRouteLoaderData } from "react-router";

import type { SchoolData } from "~/lib/school/load.server";

export const SCHOOL_LAYOUT_ID = "school-layout";

export function useSchool(): SchoolData {
  const loaded = useRouteLoaderData(SCHOOL_LAYOUT_ID) as
    SchoolData | { state: "signed-out" | "not-member" | "staff" } | undefined;
  if (!loaded || loaded.state !== "ok") {
    throw new Error("A school page was drawn outside its dashboard.");
  }
  return loaded;
}

/** Owner only: the pages a branch admin's menu leaves out. */
export const MANAGE_ONLY = {
  title: "For the school's owner",
  body: "Only the owner can see and change this. Ask them, or open Students.",
} as const;
