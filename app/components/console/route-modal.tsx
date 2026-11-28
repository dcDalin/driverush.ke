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
import type * as React from "react";
import { Link, useLocation, useNavigate } from "react-router";

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
