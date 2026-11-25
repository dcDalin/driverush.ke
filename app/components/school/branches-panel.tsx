/**
 * The owner's branches: add one, rename or move it, close or reopen it. A
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
import { AddBranchSchema, UpdateBranchSchema } from "~/schemas/school";

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

function AddBranch() {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: AddBranchSchema,
    key: "add-branch",
    resetOnSuccess: true,
    defaultValues: { intent: "add-branch", name: "", town: "" },
  });
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-start"
      >
        <HoneypotInputs />
        <InputField
          name="name"
          label="Branch name"
          className="flex-1"
          disabled={busy}
          inputProps={{ placeholder: "Nairobi CBD" }}
        />
        <InputField
          name="town"
          label="Town"
          className="flex-1"
          disabled={busy}
          inputProps={{ placeholder: "Nairobi" }}
        />
        <Button
          type="submit"
          variant="rush"
          isLoading={busy}
          className="sm:mt-6"
        >
          Add branch
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
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
