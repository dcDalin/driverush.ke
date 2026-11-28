/**
 * `shouldRevalidate` for a dashboard frame (a school's dashboard, the
 * console, one school in the console): what it reads is the school and the
 * caller, never the address's search. So moving about inside it (its tabs, a
 * modal over a tab, a list's search, filters and pages kept in the address)
 * reads nothing again. A saved form (unless it failed, `defaultShouldRevalidate`),
 * a live update or `revalidate()` (the same address) and another school do.
 */
import type { ShouldRevalidateFunctionArgs } from "react-router";

export function frameShouldRevalidate({
  currentUrl,
  nextUrl,
  currentParams,
  nextParams,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  const movingInside =
    !formMethod &&
    currentParams.schoolId === nextParams.schoolId &&
    currentUrl.href !== nextUrl.href;
  return movingInside ? false : defaultShouldRevalidate;
}
