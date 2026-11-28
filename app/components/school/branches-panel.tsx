/**
 * The owner's branches ("Add branch" is the `branches/add` modal route):
 * rename or move one, close or reopen it. A
 * closed branch keeps its students' history but takes no new students.
 */
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  InputField,
  ServerFormProvider,
  SwitchField,
} from "~/components/ui/forms/server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { UpdateBranchSchema } from "~/schemas/school";

type Branch = {
  id: string;
  name: string;
  town: string | null;
  is_active: boolean;
};

export function BranchesPanel({ branches }: { branches: Branch[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Branches</h2>
      {branches.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
          No branch yet. Add your first one, then add students to it.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {branches.map((b) => (
            // Keyed by what it shows, so a saved branch starts from its new values.
            <BranchItem
              key={`${b.id}:${b.name}:${b.town}:${b.is_active}`}
              branch={b}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BranchItem({ branch }: { branch: Branch }) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: UpdateBranchSchema,
    key: `branch:${branch.id}`,
    defaultValues: {
      intent: "update-branch",
      branchId: branch.id,
      name: branch.name,
      town: branch.town ?? "",
      isActive: branch.is_active,
    },
  });
  return (
    <li className="px-4 py-3">
      <ServerFormProvider methods={methods}>
        <fetcher.Form
          ref={formRef}
          method="post"
          onSubmit={methods.handleSubmit}
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <HoneypotInputs />
          <InputField
            name="name"
            label="Branch name"
            className="sm:w-56"
            disabled={busy}
          />
          <InputField
            name="town"
            label="Town"
            className="sm:w-40"
            disabled={busy}
          />
          <SwitchField
            name="isActive"
            label="Open"
            className="sm:mt-6"
            disabled={busy}
          />
          {!branch.is_active && (
            <Badge variant="amber" className="sm:mt-7">
              Closed
            </Badge>
          )}
          <Button
            type="submit"
            size="sm"
            variant="paper"
            isLoading={busy}
            className="sm:mt-6 sm:ml-auto"
          >
            Save
          </Button>
        </fetcher.Form>
      </ServerFormProvider>
    </li>
  );
}
