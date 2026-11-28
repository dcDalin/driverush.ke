/**
 * Route modals (thinkrush `route-modal.tsx`): create, edit and confirm views
 * are child routes drawn as a dialog over the list that owns them. So is a
 * whole record (a school in the console): a wide modal with its own tabs,
 * its changes stacking as smaller modals over it through its `<Outlet />`. The list
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

/**
 * On a phone a big modal is the page: edge to edge, no card, its own scroll.
 * A small one (a question, a field or two) stays a card over the list.
 */
const FILL_ON_PHONE =
  "max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0";

const SIZE = {
  sm: "max-w-md",
  md: `max-w-xl ${FILL_ON_PHONE}`,
  lg: `max-w-3xl ${FILL_ON_PHONE}`,
  /** A whole record with its own tabs (thinkrush's "full"). */
  xl: `max-w-5xl ${FILL_ON_PHONE}`,
} as const;

/** Where a modal under `base` closes to: the list, with its filters kept. */
export function useCloseTo(base: string) {
  const { search } = useLocation();
  // A base that already carries a search (a school in the console keeps the
  // schools list's) is used as it is.
  return base.includes("?") ? base : `${base}${search}`;
}

/**
 * A form modal opens with the cursor in its first field. Left alone, the
 * dialog moves focus to its close button as it opens, which blurs the field
 * and makes the form show "required" errors before anything is typed.
 */
function focusFirstField(event: Event) {
  const content = event.currentTarget as HTMLElement | null;
  const field = content
    ? [
        ...content.querySelectorAll<HTMLElement>(
          "[data-slot=dialog-body] input:not([type=hidden]), [data-slot=dialog-body] textarea",
        ),
      ].find((el) => el.tabIndex >= 0 && el.offsetParent !== null)
    : undefined;
  if (!field) return;
  event.preventDefault();
  field.focus();
}

export function RouteModal({
  closeTo,
  label,
  size = "sm",
  busy = false,
  closing = false,
  className,
  children,
}: {
  closeTo: string;
  /** The small label in the dialog's title bar. */
  label: string;
  size?: keyof typeof SIZE;
  /** A form in it is being sent: Escape and the backdrop wait for it. */
  busy?: boolean;
  /** Its action accepted the form (`useCloseWhenDone`): the dialog goes now. */
  closing?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      open={!closing}
      onOpenChange={(open) => {
        if (!open && !busy)
          void navigate(closeTo, { replace: true, preventScrollReset: true });
      }}
    >
      <DialogContent
        titlebarLabel={label}
        className={cn(SIZE[size], className)}
        onOpenAutoFocus={focusFirstField}
      >
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

/** The modal's scrolling middle; it takes the spare height when the modal fills a phone. */
export function RouteModalBody({
  className,
  ...props
}: React.ComponentProps<typeof DialogBody>) {
  return <DialogBody className={cn("flex-1", className)} {...props} />;
}

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
      {busy ? (
        // A link can't be disabled: while the form is sent, a plain button.
        <Button variant="ghost" disabled>
          Cancel
        </Button>
      ) : (
        <Button asChild variant="ghost">
          <Link to={closeTo} replace preventScrollReset>
            Cancel
          </Link>
        </Button>
      )}
      {children}
    </DialogFooter>
  );
}

/**
 * Closes a route modal once its fetcher's action answered `{ ok: true }`:
 * the dialog goes at once (pass the result to `<RouteModal closing>`), while
 * the frame re-reads what changed behind it, and the address goes back to
 * `closeTo` when that is done, so the list under it is already up to date.
 */
export function useCloseWhenDone(
  fetcher: { state: string; data?: unknown },
  closeTo: string,
): boolean {
  const navigate = useNavigate();
  const closing =
    fetcher.state !== "submitting" &&
    (fetcher.data as { ok?: boolean } | undefined)?.ok === true;
  const done = closing && fetcher.state === "idle";
  React.useEffect(() => {
    if (done)
      void navigate(closeTo, { replace: true, preventScrollReset: true });
  }, [done, navigate, closeTo]);
  return closing;
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
  const closing = useCloseWhenDone(fetcher, closeTo);
  return (
    <RouteModal
      closeTo={closeTo}
      label={label}
      size={size}
      busy={busy}
      closing={closing}
    >
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
  // One fetcher per opening, so a modal opened again starts fresh.
  const location = useLocation();
  const [opening] = React.useState(location.key);
  const fetcher = useFetcher({ key: `confirm:${here}:${opening}` });
  const busy = fetcher.state !== "idle";
  const closing = useCloseWhenDone(fetcher, closeTo);
  return (
    <RouteModal closeTo={closeTo} label={label} busy={busy} closing={closing}>
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
