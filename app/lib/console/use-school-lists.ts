/**
 * The console's lists inside one school (branches, team, students): the
 * school as its owner sees it (`useSchool()`, fed by the console's school
 * modal), the lists' address params (`iq`, `ibranch`, `istatus`, `irole`,
 * `iopen`, `ipage`, kept apart from the schools list's own), and paging.
 */
import { useSearchParams } from "react-router";

import { useSchool } from "~/lib/school/use-school";
import { pageFrom } from "~/lib/ui/use-list-params";

export const LIST_PAGE = 25;

export function useSchoolLists() {
  const school = useSchool();
  const [params] = useSearchParams();
  return { ...school, schoolId: school.school.id, params };
}

/** One page of `rows`, from the address's `ipage`. */
export function usePaged<T>(rows: T[]) {
  const [params] = useSearchParams();
  const pages = Math.max(1, Math.ceil(rows.length / LIST_PAGE));
  const page = Math.min(pages, pageFrom(params, "ipage"));
  return {
    page,
    shown: rows.slice((page - 1) * LIST_PAGE, page * LIST_PAGE),
  };
}

/** Adds a list's own filters to a path that may already carry a search. */
export function withQuery(path: string, query: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}
