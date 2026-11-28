/**
 * A school's branches as one list: each with its admins, students this
 * month, those waiting and those with a pass, the busiest first, searched
 * and filtered open or closed, a page at a time. The owner's Branches page
 * and the console's Branches tab both show it. Each count opens the team or
 * students list filtered to that branch; "Edit" opens the branch's modal.
 */
import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import { EditIcon } from "~/components/brand/icons";
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

/** The students list's own params for its branch and status filters. */
export type StudentParams = { branch: string; status: string };

export function BranchList({ students: sp }: { students: StudentParams }) {
  const { branches, team, invites, students, params } = useSchoolLists();
  const path = useSchoolPath();
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
  const toTeam = (branchId: string) =>
    withQuery(path("team"), `ibranch=${branchId}`);
  const toStudents = (branchId: string, status: string) =>
    withQuery(
      path("students"),
      `${sp.branch}=${branchId}&${sp.status}=${status}`,
    );
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

  return (
    <>
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
              <TableHead className="hidden text-right sm:table-cell">
                Admins
              </TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Students
              </TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Waiting
              </TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                With a pass
              </TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Change</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.branch.id}>
                <TableCell className="sm:min-w-40">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.branch.name}
                    {!r.branch.is_active && (
                      <Badge variant="amber">Closed</Badge>
                    )}
                  </span>
                  <span className="block text-[12.5px] text-ink-3">
                    {r.branch.town || "No town"}
                  </span>
                  {/* On a phone the counts sit here, so Edit stays in view. */}
                  <span className="flex flex-wrap gap-x-1.5 text-[12.5px] text-ink-2 sm:hidden">
                    {[
                      `${r.admins} admins`,
                      `${r.active} students`,
                      `${r.waiting} waiting`,
                      `${r.paid} with a pass`,
                    ].map((part, i) => (
                      <span key={part} className="whitespace-nowrap">
                        {i > 0 ? "· " : ""}
                        {part}
                      </span>
                    ))}
                  </span>
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {count(r.admins, toTeam(r.branch.id))}
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {count(r.active, toStudents(r.branch.id, "active"))}
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {count(r.waiting, toStudents(r.branch.id, "pending"))}
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {count(r.paid, toStudents(r.branch.id, "paid"))}
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
    </>
  );
}
