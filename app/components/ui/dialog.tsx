import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Icon } from "~/components/brand/icon";
import {
  CloseIcon,
} from "~/components/brand/icons";

import { cn } from "~/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/45 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  titlebarLabel = "DR · DIALOG",
  closeAriaLabel = "Close dialog",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** Tiny stamped label in the titlebar. Override per surface. */
  titlebarLabel?: string;
  /** Accessible name for the close button. Override for context-specific copy. */
  closeAriaLabel?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col",
          "max-h-[calc(100dvh-2rem)] overflow-hidden",
          "border border-line bg-surface text-foreground shadow-xl rounded-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1",
          className,
        )}
        {...props}
      >
        <DialogTitleBar
          showClose={showCloseButton}
          label={titlebarLabel}
          closeAriaLabel={closeAriaLabel}
        />
        <div className="contents">{children}</div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogTitleBar({
  showClose,
  label,
  closeAriaLabel,
}: {
  showClose: boolean;
  label: string;
  closeAriaLabel: string;
}) {
  return (
    <div
      data-slot="dialog-titlebar"
      className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5 text-[12px] font-medium text-ink-3"
    >
      <span>{label}</span>
      {showClose && (
        <DialogPrimitive.Close
          aria-label={closeAriaLabel}
          className={cn(
            "-my-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center",
            "rounded-md text-ink-3 outline-none",
            "transition-colors duration-100",
            "hover:bg-paper-2 hover:text-ink",
            "focus-visible:ring-4 focus-visible:ring-rush/15",
          )}
        >
          <Icon
            icon={CloseIcon}
            size={13}
          />
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2 px-6 pt-6", className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "min-h-0 overflow-y-auto px-6 pb-3 text-[14px] leading-relaxed text-ink-2",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-line px-6 py-4",
        "sm:flex-row sm:justify-end sm:gap-2.5",
        "[&>button]:w-full sm:[&>button]:w-auto",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-display text-[20px] font-semibold tracking-tight text-ink",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[14px] leading-relaxed text-ink-3", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
