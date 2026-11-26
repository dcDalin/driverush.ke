/**
 * List state kept in the address, as thinkrush's admin console keeps it:
 * search, filters and page are search params, so a reload, the back button
 * and a shared link land on the same view. Changing any filter drops the
 * page (a narrower filter never lands on an empty page 7). The value "all"
 * (or an empty one) removes the param. A page with two lists gives each its
 * own names (`q`/`page` for schools, `pq`/`ppage` for payments).
 */
import { useCallback } from "react";
import { useSearchParams } from "react-router";

export function useListParams(pageKey = "page") {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParams = useCallback(
    (
      updates: Record<string, string | null | undefined>,
      { keepPage = false } = {},
    ) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (
              value === null ||
              value === undefined ||
              value === "" ||
              value === "all"
            ) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          if (!keepPage && !(pageKey in updates)) next.delete(pageKey);
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams, pageKey],
  );

  return { searchParams, setParams };
}

/** The page asked for in the address (1 when missing or not a number). */
export function pageFrom(searchParams: URLSearchParams, key = "page") {
  const n = Number(searchParams.get(key));
  return Number.isInteger(n) && n > 0 ? n : 1;
}
