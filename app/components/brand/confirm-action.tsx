/**
 * Asks before something that cannot be undone, like wiping what a learner has
 * marked as known. The house AlertDialog in place of the browser's own
 * confirm box: same look on every phone, and focus starts on the way back out.
 */
import type * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

export function ConfirmAction({
  title,
  description,
  confirm,
  cancel = "Cancel",
  onConfirm,
  children,
}: {
  title: string;
  description?: string;
  /** The words on the button that goes ahead, e.g. "Reset". */
  confirm: string;
  cancel?: string;
  onConfirm: () => void;
  /** The control that opens the question: one element, given its click. */
  children: React.ReactElement;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
