/**
 * A small form that posts one action to the page's route action without
 * leaving the page, and shows the result as a toast. The page's loader runs
 * again afterwards, so the lists update by themselves.
 */
import * as React from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import type { ActionResult } from "~/lib/school/server";

export function useActionForm() {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;
  React.useEffect(() => {
    if (fetcher.state !== "idle" || !result) return;
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }, [fetcher.state, result]);
  return {
    Form: fetcher.Form,
    busy,
    ok: result?.ok === true && fetcher.state === "idle",
  };
}
