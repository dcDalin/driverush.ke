/**
 * shadcn Pagination in the house look: page links are `Button`s (ink for
 * the current page, ghost for the rest), house chevrons, 44 px targets.
 * Links are real `<Link>`s, so a page of a list is an address that can be
 * shared and reloaded.
 */
import type * as React from "react";
import { Link, type LinkProps } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ChevronLeftIcon, ChevronRightIcon } from "~/components/brand/icons";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Pages"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn(
        "m-0 flex list-none flex-row items-center gap-1 p-0",
        className,
      )}
      {...props}
    />
  );
}

function PaginationItem(props: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = LinkProps & {
  isActive?: boolean;
  disabled?: boolean;
};

function PaginationLink({
  className,
  isActive,
  disabled,
  ...props
}: PaginationLinkProps) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      preventScrollReset
      className={cn(
        buttonVariants({ variant: isActive ? "ink" : "ghost", size: "icon" }),
        disabled && "pointer-events-none opacity-40",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Previous page"
      className={cn("w-auto gap-1 px-3", className)}
      {...props}
    >
      <Icon icon={ChevronLeftIcon} size={18} />
      <span className="hidden sm:inline">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Next page"
      className={cn("w-auto gap-1 px-3", className)}
      {...props}
    >
      <span className="hidden sm:inline">Next</span>
      <Icon icon={ChevronRightIcon} size={18} />
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-11 items-center justify-center text-ink-3",
        className,
      )}
      {...props}
    >
      …
    </span>
  );
}

/** The page numbers to show: the first, the last, and two either side of the current one. */
function pageWindow(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | "gap")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (keep.has(p)) out.push(p);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

export {
  pageWindow,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
