/**
 * `/console/schools/:schoolId/branches`: one row per branch with its
 * admins, students this month, those waiting and those with a pass, the
 * busiest first. Each count opens the team or students tab filtered to that
 * branch. Staff help a school set up: "Add branch" and each row's "Edit"
 * open the owner's own modals over this list. Built for a school with many
 * branches: search, an open filter, a page at a time.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { EditIcon, PlusIcon } from "~/components/brand/icons";
import { Section } from "~/components/console/shell";
import { FilterBar } from "~/components/list/filter-bar";
import { FilterSelect } from "~/components/list/filter-select";
import { PaginationBar } from "~/components/list/pagination-bar";
import { SearchInput } from "~/components/list/search-input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  LIST_PAGE,
  usePaged,
  useSchoolLists,
  withQuery,
} from "~/lib/console/use-school-lists";
import { useSchoolPath } from "~/lib/school/use-school";

const OPEN_OPTIONS = [
  { value: "all", label: "Open and closed" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
] as const;

export default function SchoolBranches() {
  const { branches, team, invites, students, params } = useSchoolLists();
  const q = (params.get("iq") ?? "").trim().toLowerCase();
  const open = params.get("iopen") ?? "all";
  const rows = branches
    .filter((b) =>
      open === "open" ? b.is_active : open === "closed" ? !b.is_active : true,
    )
    .filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.town ?? "").toLowerCase().includes(q),
    )
    .map((b) => {
      const mine = students.filter((s) => s.branchId === b.id);
      const active = mine.filter((s) => s.status === "active");
      return {
        branch: b,
        admins:
          team.filter((m) => m.role === "admin" && m.branch_ids.includes(b.id))
            .length + invites.filter((i) => i.branch_ids.includes(b.id)).length,
        active: active.length,
        waiting: mine.filter((s) => s.status === "pending").length,
        paid: active.filter((s) => s.passEndsAt).length,
      };
    })
    // The busiest branches first.
    .sort(
      (a, b) =>
        b.active - a.active || a.branch.name.localeCompare(b.branch.name),
    );
  const { page, shown } = usePaged(rows);
  const path = useSchoolPath();
  const to = (view: "students" | "team", branchId: string, extra = "") =>
    withQuery(path(view), `ibranch=${branchId}${extra}`);
  const count = (n: number, href: string) =>
    n === 0 ? (
      <span className="text-ink-4">0</span>
    ) : (
      <Link
        to={href}
        preventScrollReset
        className="font-semibold text-ink tabular-nums underline-offset-2 hover:text-rush hover:underline"
      >
        {n}
      </Link>
    );

  const add = (
    <Button asChild variant="rush" size="sm">
      <Link to={path("branches/add")} preventScrollReset>
        <Icon icon={PlusIcon} size={16} />
        Add branch
      </Link>
    </Button>
  );
  if (branches.length === 0) {
    return (
      <Section
        title="Branches"
        description="Students and admins belong to a branch. Add them for the school, or leave them to its owner."
        actions={add}
      >
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-3">
          No branch yet.
        </p>
        <Outlet />
      </Section>
    );
  }
  return (
    <Section
      title="Branches"
      description="Students and admins belong to a branch. Add and change them for the school; its owner can too."
      actions={add}
    >
      <FilterBar
        params={["iq", "iopen"]}
        pageKey="ipage"
        search={
          <SearchInput
            param="iq"
            pageKey="ipage"
            delay={150}
            placeholder="Search branches by name or town"
          />
        }
        summary={`${rows.length} ${rows.length === 1 ? "branch" : "branches"}`}
      >
        <FilterSelect
          param="iopen"
          pageKey="ipage"
          label="Open"
          options={OPEN_OPTIONS}
        />
      </FilterBar>
      {rows.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-3">
          No branch matches.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Admins</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Waiting</TableHead>
              <TableHead className="text-right">With a pass</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Change</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.branch.id}>
                <TableCell className="min-w-40">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.branch.name}
                    {!r.branch.is_active && (
                      <Badge variant="amber">Closed</Badge>
                    )}
                  </span>
                  <span className="block text-[12.5px] text-ink-3">
                    {r.branch.town || "No town"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {count(r.admins, to("team", r.branch.id))}
                </TableCell>
                <TableCell className="text-right">
                  {count(
                    r.active,
                    to("students", r.branch.id, "&istatus=active"),
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {count(
                    r.waiting,
                    to("students", r.branch.id, "&istatus=pending"),
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {count(r.paid, to("students", r.branch.id, "&istatus=paid"))}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      to={path(`branches/${r.branch.id}/edit`)}
                      preventScrollReset
                      aria-label={`Edit ${r.branch.name}`}
                    >
                      <Icon icon={EditIcon} size={14} />
                      Edit
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <PaginationBar
        page={page}
        pageSize={LIST_PAGE}
        totalCount={rows.length}
        pageKey="ipage"
        noun={["branch", "branches"]}
      />
      <Outlet />
    </Section>
  );
}
