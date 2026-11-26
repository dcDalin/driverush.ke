/**
 * "Showing 26–50 of 96 students" and the page links (nothing on a single
 * page: the filter bar gives the count), bound to the address
 * (`pageKey`, deleted on page 1). The links keep every other param, so the
 * search and filters stay. shadcn's Pagination in the house look.
 */
import { useSearchParams } from "react-router";

import {
  pageWindow,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";

export function PaginationBar({
  page,
  pageSize,
  totalCount,
  pageKey = "page",
  noun = ["row", "rows"],
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  pageKey?: string;
  noun?: readonly [string, string];
}) {
  const [params] = useSearchParams();
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  // One page: the filter bar already gives the count.
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const href = (p: number) => {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete(pageKey);
    else next.set(pageKey, String(p));
    const query = next.toString();
    return query ? `?${query}` : "?";
  };
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="m-0 text-[13px] text-ink-3 tabular-nums">
        Showing {from}–{to} of {totalCount} {noun[1]}
      </p>
      {
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                to={href(page - 1)}
                disabled={page <= 1}
                preventScrollReset
              />
            </PaginationItem>
            {pageWindow(page, pages).map((p, i) =>
              p === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    to={href(p)}
                    isActive={p === page}
                    preventScrollReset
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                to={href(page + 1)}
                disabled={page >= pages}
                preventScrollReset
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      }
    </div>
  );
}
