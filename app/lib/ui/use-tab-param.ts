/**
 * A tab kept in the address (`?tab=students`), so a reload, the back button
 * and a shared link land on the same tab. The first tab is the default and
 * leaves the address clean; an unknown value falls back to it.
 */
import * as React from "react";
import { useSearchParams } from "react-router";

export function useTabParam<const T extends readonly string[]>(
  tabs: T,
  fallback: T[number] = tabs[0]!,
  key = "tab",
) {
  const [params, setParams] = useSearchParams();
  const asked = params.get(key);
  const tab = (tabs as readonly string[]).includes(asked ?? "")
    ? (asked as T[number])
    : fallback;
  const setTab = React.useCallback(
    (next: string) =>
      setParams(
        (before) => {
          const after = new URLSearchParams(before);
          if (next === fallback) after.delete(key);
          else after.set(key, next);
          return after;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams, fallback, key],
  );
  return [tab, setTab] as const;
}
