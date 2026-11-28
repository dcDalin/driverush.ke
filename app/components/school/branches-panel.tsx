/**
 * The owner's branches ("Add branch" is the `branches/add` modal route): a
 * branch is renamed, moved, closed or reopened in its own modal
 * (`branches/:branchId/edit`). A closed branch keeps its students' history
 * but takes no new students.
 */
import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import { EditIcon } from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { schoolPath } from "~/lib/school/nav";

type Branch = {
  id: string;
  name: string;
  town: string | null;
  is_active: boolean;
};

export function BranchesPanel({
  schoolId,
  branches,
}: {
  schoolId: string;
  branches: Branch[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Branches</h2>
      {branches.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
          No branch yet. Add your first one, then add students to it.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
          {branches.map((branch) => (
            <li
              key={branch.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {branch.name}
                  {!branch.is_active && <Badge variant="amber">Closed</Badge>}
                </span>
                <span className="block text-[13px] text-ink-3">
                  {branch.town || "No town yet"}
                </span>
              </span>
              <Button asChild size="sm" variant="paper">
                <Link
                  to={schoolPath(schoolId, `branches/${branch.id}/edit`)}
                  preventScrollReset
                >
                  <Icon icon={EditIcon} size={14} />
                  Edit
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
