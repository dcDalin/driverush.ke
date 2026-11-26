/**
 * "New school": a dialog with the school's name, its short name and, if
 * staff have it, the owner's email. Without an email the school starts in
 * set-up, hidden from everyone until staff hand it over; with one it is
 * live at once. Either way the console opens the new school's page.
 */
import * as React from "react";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { InputField, ServerFormProvider } from "~/components/ui/forms/server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { CreateSchoolSchema } from "~/schemas/console";

/** "Top Gear Driving School" → "top-gear-driving-school". */
function slugOf(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateSchoolDialog() {
  const [open, setOpen] = React.useState(false);
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: CreateSchoolSchema,
    key: "create-school",
    action: "/console",
    defaultValues: {
      intent: "create-school",
      name: "",
      slug: "",
      ownerEmail: "",
    },
  });
  // The short name follows the name until staff type their own.
  const slugTouched = methods.formState.dirtyFields.slug;
  const name = methods.watch("name");
  React.useEffect(() => {
    if (!slugTouched) methods.setValue("slug", slugOf(name ?? ""));
  }, [name, slugTouched, methods]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="rush">
          <Icon icon={PlusIcon} size={18} />
          New school
        </Button>
      </DialogTrigger>
      <DialogContent>
        <ServerFormProvider methods={methods}>
          <fetcher.Form
            ref={formRef}
            method="post"
            action="/console"
            onSubmit={methods.handleSubmit}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>New school</DialogTitle>
              <DialogDescription>
                Leave the owner's email empty to set the school up first: its
                profile, branches and livery stay hidden until you hand it over.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <HoneypotInputs />
              <InputField
                name="name"
                label="School name"
                disabled={busy}
                inputProps={{ placeholder: "Heltz Driving Academy" }}
              />
              <InputField
                name="slug"
                label="Short name (for links)"
                description="Lowercase, like heltz. It is the school's address on DriveRush."
                disabled={busy}
                inputProps={{ placeholder: "heltz" }}
              />
              <InputField
                name="ownerEmail"
                label="Owner's email (optional)"
                disabled={busy}
                inputProps={{
                  type: "email",
                  inputMode: "email",
                  placeholder: "owner@school.co.ke",
                }}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" variant="rush" isLoading={busy}>
                Create school
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </ServerFormProvider>
      </DialogContent>
    </Dialog>
  );
}
