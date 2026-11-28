/**
 * Route modals (thinkrush `route-modal.tsx`): create, edit and confirm views
 * are child routes drawn as a dialog over the list that owns them. The list
 * keeps rendering underneath through its `<Outlet />`, the address can be
 * shared, and closing (Escape, the backdrop, the X, Cancel) is a navigation
 * back to `closeTo`.
 *
 * Keep the list's search in both the link that opens the modal and
 * `closeTo`, so its filters and page survive the round trip.
 */
import * as React from "react";
import { Link, useFetcher, useLocation, useNavigate } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ServerFormProvider } from "~/components/ui/forms/server";
import { cn } from "~/lib/utils";

const SIZE = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

/** Where a modal under `base` closes to: the list, with its filters kept. */
export function useCloseTo(base: string) {
  const { search } = useLocation();
  return `${base}${search}`;
}

export function RouteModal({
  closeTo,
  label,
  size = "sm",
  children,
}: {
  closeTo: string;
  /** The small label in the dialog's title bar. */
  label: string;
  size?: keyof typeof SIZE;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open)
          void navigate(closeTo, { replace: true, preventScrollReset: true });
      }}
    >
      <DialogContent titlebarLabel={label} className={cn(SIZE[size])}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function RouteModalHeader({
  title,
  description,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      {description ? (
        <DialogDescription>{description}</DialogDescription>
      ) : null}
    </DialogHeader>
  );
}

export const RouteModalBody = DialogBody;

/** The modal's buttons: Cancel (a link back to the list), then the action. */
export function RouteModalFooter({
  closeTo,
  busy,
  children,
}: {
  closeTo: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DialogFooter>
      <Button asChild variant="ghost" disabled={busy}>
        <Link to={closeTo} replace preventScrollReset>
          Cancel
        </Link>
      </Button>
      {children}
    </DialogFooter>
  );
}

/** Back to `closeTo` once a fetcher's action answered `{ ok: true }`. */
export function useCloseWhenDone(
  fetcher: { state: string; data?: unknown },
  closeTo: string,
) {
  const navigate = useNavigate();
  const done =
    fetcher.state === "idle" &&
    (fetcher.data as { ok?: boolean } | undefined)?.ok === true;
  React.useEffect(() => {
    if (done)
      void navigate(closeTo, { replace: true, preventScrollReset: true });
  }, [done, navigate, closeTo]);
}

/**
 * A whole form as a route modal: a `useServerForm` posted to the modal's own
 * route (`here`), with the title, the fields, Cancel and one submit button.
 * It closes back to `closeTo` once the action accepts it.
 */
export function ModalForm({
  form,
  here,
  closeTo,
  label,
  title,
  description,
  submit,
  size,
  children,
}: {
  /** What `useServerForm` returned (its types are the form's own). */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  form: { methods: any; fetcher: any; formRef: any; busy: boolean };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  /** This modal's own address: where the form posts. */
  here: string;
  closeTo: string;
  label: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The submit button's words. */
  submit: string;
  size?: keyof typeof SIZE;
  children: React.ReactNode;
}) {
  const { methods, fetcher, formRef, busy } = form;
  useCloseWhenDone(fetcher, closeTo);
  return (
    <RouteModal closeTo={closeTo} label={label} size={size}>
      <ServerFormProvider methods={methods}>
        <fetcher.Form
          ref={formRef}
          method="post"
          action={here}
          onSubmit={methods.handleSubmit}
          noValidate
          className="contents"
        >
          <RouteModalHeader title={title} description={description} />
          <RouteModalBody className="flex flex-col gap-3 pt-4">
            <HoneypotInputs />
            {children}
          </RouteModalBody>
          <RouteModalFooter closeTo={closeTo} busy={busy}>
            <Button type="submit" variant="rush" isLoading={busy}>
              {submit}
            </Button>
          </RouteModalFooter>
        </fetcher.Form>
      </ServerFormProvider>
    </RouteModal>
  );
}

/**
 * A yes-or-no as a route modal, for a change that is hard to take back: it
 * posts `fields` to its own route and closes once the action accepts it.
 */
export function ConfirmModal({
  here,
  closeTo,
  label,
  title,
  body,
  confirm,
  fields,
}: {
  here: string;
  closeTo: string;
  label: string;
  title: string;
  body: React.ReactNode;
  confirm: string;
  fields: Record<string, string>;
}) {
  const fetcher = useFetcher({ key: `confirm:${here}` });
  const busy = fetcher.state !== "idle";
  useCloseWhenDone(fetcher, closeTo);
  return (
    <RouteModal closeTo={closeTo} label={label}>
      <RouteModalHeader title={title} description={body} />
      <RouteModalBody className="pt-2">{null}</RouteModalBody>
      <RouteModalFooter closeTo={closeTo} busy={busy}>
        <Button
          type="button"
          variant="rush"
          isLoading={busy}
          onClick={() =>
            void fetcher.submit(fields, { method: "POST", action: here })
          }
        >
          {confirm}
        </Button>
      </RouteModalFooter>
    </RouteModal>
  );
}
