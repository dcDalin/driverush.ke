/**
 * The owner's branches: add one, rename or move it, close or reopen it. A
 * closed branch keeps its students' history but takes no new students.
 */
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { useActionForm } from "./action-form";

type Branch = {
  id: string;
  name: string;
  town: string | null;
  is_active: boolean;
};

export function BranchesPanel({ branches }: { branches: Branch[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] font-bold">Branches</h2>
      <AddBranch />
      {branches.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {branches.map((b) => (
            <BranchItem key={b.id} branch={b} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AddBranch() {
  const { Form, busy } = useActionForm();
  return (
    <Form
      method="post"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="intent" value="add-branch" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="branch-name">Branch name</Label>
        <Input
          id="branch-name"
          name="name"
          required
          minLength={2}
          placeholder="Nairobi CBD"
          disabled={busy}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="branch-town">Town</Label>
        <Input
          id="branch-town"
          name="town"
          placeholder="Nairobi"
          disabled={busy}
        />
      </div>
      <Button type="submit" variant="rush" disabled={busy}>
        Add branch
      </Button>
    </Form>
  );
}

function BranchItem({ branch }: { branch: Branch }) {
  const { Form, busy } = useActionForm();
  return (
    <li className="px-4 py-3">
      <Form
        method="post"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="intent" value="update-branch" />
        <input type="hidden" name="branchId" value={branch.id} />
        <Input
          name="name"
          defaultValue={branch.name}
          aria-label="Branch name"
          className="sm:w-56"
          disabled={busy}
        />
        <Input
          name="town"
          defaultValue={branch.town ?? ""}
          aria-label="Town"
          className="sm:w-40"
          disabled={busy}
        />
        {!branch.is_active && <Badge variant="amber">Closed</Badge>}
        <div className="flex gap-2 sm:ml-auto">
          <Button
            type="submit"
            name="isActive"
            value={String(branch.is_active)}
            size="sm"
            variant="paper"
            disabled={busy}
          >
            Save
          </Button>
          <Button
            type="submit"
            name="isActive"
            value={String(!branch.is_active)}
            size="sm"
            variant="ghost"
            disabled={busy}
          >
            {branch.is_active ? "Close" : "Reopen"}
          </Button>
        </div>
      </Form>
    </li>
  );
}
