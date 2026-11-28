/**
 * The strip above a list: the search on its own line, the filters under it
 * (two a row on a phone, an odd last one across both),
 * then the count and "Clear filters" (only when something is set).
 */
import type * as React from "react";

import { Icon } from "~/components/brand/icon";
import { CloseIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { useListParams } from "~/lib/ui/use-list-params";

export function FilterBar({
  search,
  children,
  params,
  pageKey = "page",
  summary,
}: {
  search?: React.ReactNode;
  children?: React.ReactNode;
  /** Address params this bar owns, cleared together by "Clear filters". */
  params: string[];
  pageKey?: string;
  summary?: React.ReactNode;
}) {
  const { searchParams, setParams } = useListParams(pageKey);
  const active = params.some((p) => searchParams.has(p));
  return (
    <div className="flex flex-col gap-2">
      {search}
      {children ? (
        <div className="grid grid-cols-2 gap-2 *:last:odd:col-span-2 sm:auto-cols-[minmax(10rem,16rem)] sm:grid-flow-col sm:grid-cols-none sm:justify-start sm:*:last:odd:col-span-1">
          {children}
        </div>
      ) : null}
      {summary || active ? (
        <div className="flex min-h-8 items-center justify-between gap-2">
          <span className="text-[13px] text-ink-3 tabular-nums">{summary}</span>
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setParams(Object.fromEntries(params.map((p) => [p, null])))
              }
            >
              <Icon icon={CloseIcon} size={14} />
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
