/**
 * The console's schools: search, filters and pages, all in the address
 * (`?q=&status=&livery=&sponsoring=&page=`), so a filtered page can be shared
 * and reloaded, and the database does the searching (`admin_list_schools`).
 * Each row opens the school's own page.
 */
import * as React from "react";
import { Link, useNavigation, useSearchParams } from "react-router";

import { Icon } from "~/components/brand/icon";
import {
  ChevronRightIcon,
  CloseIcon,
  SearchIcon,
} from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "~/components/ui/item";
import { Label } from "~/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ConsoleSchoolRow } from "~/database/console/queries";

import { STATUS_BADGE, STATUS_LABEL } from "./school-status";

const FILTERS = {
  status: {
    label: "Status",
    options: [
      ["any", "Any status"],
      ["setup", "Setting up"],
      ["active", "Active"],
      ["suspended", "Suspended"],
      ["archived", "Archived"],
    ],
  },
  livery: {
    label: "Livery",
    options: [
      ["any", "Any livery"],
      ["live", "Livery live"],
      ["draft", "Draft only"],
      ["none", "No livery"],
    ],
  },
  sponsoring: {
    label: "Sponsoring",
    options: [
      ["any", "Sponsoring or not"],
      ["yes", "Sponsoring now"],
      ["no", "Not sponsoring"],
    ],
  },
} as const;

type FilterName = keyof typeof FILTERS;

/** Search box and filters. Changing one goes back to page 1. */
export function SchoolFilters() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const set = React.useCallback(
    (changes: Record<string, string>) =>
      setParams(
        (before) => {
          const next = new URLSearchParams(before);
          for (const [key, value] of Object.entries(changes)) {
            if (!value || value === "any") next.delete(key);
            else next.set(key, value);
          }
          next.delete("page");
          return next;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  // Search as they type, once they pause.
  React.useEffect(() => {
    if ((params.get("q") ?? "") === query.trim()) return;
    const timer = window.setTimeout(() => set({ q: query.trim() }), 300);
    return () => window.clearTimeout(timer);
  }, [query, params, set]);

  const filtered =
    params.has("q") ||
    params.has("status") ||
    params.has("livery") ||
    params.has("sponsoring");

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Label htmlFor="school-search" className="sr-only">
          Search schools
        </Label>
        <Icon
          icon={SearchIcon}
          size={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3"
        />
        <Input
          id="school-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, short name or owner's email"
          className="pl-10"
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {(Object.keys(FILTERS) as FilterName[]).map((name) => {
          const value = params.get(name) ?? "any";
          const options = FILTERS[name].options as readonly (readonly [
            string,
            string,
          ])[];
          // The label is given, not looked up: Radix only knows an option's
          // text once the menu has opened, so a fresh page showed nothing.
          const label =
            options.find(([v]) => v === value)?.[1] ?? options[0]![1];
          return (
            <Select
              key={name}
              value={value}
              onValueChange={(next) => set({ [name]: next })}
            >
              <SelectTrigger aria-label={FILTERS[name].label}>
                <SelectValue>{label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.map(([v, text]) => (
                  <SelectItem key={v} value={v}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
        {filtered ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            <Icon icon={CloseIcon} size={16} />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ownerLine(school: ConsoleSchoolRow) {
  if (school.owner_email) return `Owner ${school.owner_email}`;
  if (school.invited_owner_email)
    return `Invited ${school.invited_owner_email}`;
  return "No owner yet";
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function SchoolList({
  schools,
  total,
}: {
  schools: ConsoleSchoolRow[];
  total: number;
}) {
  const navigation = useNavigation();
  const loading =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/console";
  if (schools.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
        No school matches. Clear the filters, or create one.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" aria-busy={loading}>
      <p className="m-0 text-[13px] text-ink-3">{count(total, "school")}</p>
      <ItemGroup
        className={
          loading
            ? "rounded-lg border border-line bg-surface opacity-60 transition-opacity"
            : "rounded-lg border border-line bg-surface"
        }
      >
        {schools.map((school, i) => (
          <Item
            key={school.id}
            asChild
            className={
              i > 0 ? "rounded-none border-t border-line" : "rounded-none"
            }
          >
            <Link to={`/console/schools/${school.id}`}>
              <ItemContent>
                <ItemTitle className="flex flex-wrap items-center gap-2">
                  {school.name}
                  <Badge variant={STATUS_BADGE[school.status]}>
                    {STATUS_LABEL[school.status]}
                  </Badge>
                  {school.livery === "live" ? (
                    <Badge variant="outline">livery live</Badge>
                  ) : school.livery === "draft" ? (
                    <Badge variant="outline">draft livery</Badge>
                  ) : null}
                  {school.sponsoring ? (
                    <Badge variant="blue">sponsoring</Badge>
                  ) : null}
                </ItemTitle>
                <ItemDescription>
                  /{school.slug} · {ownerLine(school)} ·{" "}
                  {count(school.branches, "branch", "branches")} ·{" "}
                  {count(school.admins, "admin")} ·{" "}
                  {count(school.students, "student")} this month
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Icon
                  icon={ChevronRightIcon}
                  size={18}
                  className="text-ink-3"
                />
              </ItemActions>
            </Link>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}

/** Page links that keep the search and filters. */
export function SchoolPager({ page, pages }: { page: number; pages: number }) {
  const [params] = useSearchParams();
  if (pages <= 1) return null;
  const to = (p: number) => {
    const next = new URLSearchParams(params);
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    const query = next.toString();
    return query ? `?${query}` : "?";
  };
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious to={to(page - 1)} disabled={page <= 1} />
        </PaginationItem>
        {pageWindow(page, pages).map((p, i) =>
          p === "gap" ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink to={to(p)} isActive={p === page}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext to={to(page + 1)} disabled={page >= pages} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
