/**
 * The console's schools: search, filters and pages, all in the address
 * (`?q=&status=&livery=&sponsoring=&page=`), so a filtered page can be shared
 * and reloaded, and the database does the searching (`admin_list_schools`).
 * Each row opens the school's own page.
 */
import { Link, useLocation, useNavigation } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ChevronRightIcon } from "~/components/brand/icons";
import { FilterBar } from "~/components/list/filter-bar";
import { FilterSelect } from "~/components/list/filter-select";
import { SearchInput } from "~/components/list/search-input";
import { Badge } from "~/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "~/components/ui/item";
import type { ConsoleSchoolRow } from "~/database/console/queries";

import { STATUS_BADGE, STATUS_LABEL } from "./school-status";

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "setup", label: "Setting up" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
] as const;
const LIVERY_OPTIONS = [
  { value: "all", label: "Any livery" },
  { value: "live", label: "Livery live" },
  { value: "draft", label: "Draft only" },
  { value: "none", label: "No livery" },
] as const;
const SPONSORING_OPTIONS = [
  { value: "all", label: "Sponsoring or not" },
  { value: "yes", label: "Sponsoring now" },
  { value: "no", label: "Not sponsoring" },
] as const;

/** Search box and filters; the count and "Clear filters" under them. */
export function SchoolFilters({ total }: { total: number }) {
  return (
    <FilterBar
      params={["q", "status", "livery", "sponsoring"]}
      search={
        <SearchInput
          label="Search schools"
          placeholder="Search by name, short name or owner's email"
        />
      }
      summary={`${total} ${total === 1 ? "school" : "schools"}`}
    >
      <FilterSelect param="status" label="Status" options={STATUS_OPTIONS} />
      <FilterSelect param="livery" label="Livery" options={LIVERY_OPTIONS} />
      <FilterSelect
        param="sponsoring"
        label="Sponsoring"
        options={SPONSORING_OPTIONS}
      />
    </FilterBar>
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

export function SchoolList({ schools }: { schools: ConsoleSchoolRow[] }) {
  const navigation = useNavigation();
  // The school page keeps the list's filters for its "All schools" link.
  const { pathname, search } = useLocation();
  const keep = pathname.startsWith("/console/schools") ? search : "";
  const loading =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/console/schools";
  if (schools.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
        No school matches. Clear the filters, or create one.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" aria-busy={loading}>
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
            <Link to={`/console/schools/${school.id}${keep}`}>
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
