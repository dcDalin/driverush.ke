import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Icon } from "~/components/brand/icon";
import { CloseIcon } from "~/components/brand/icons";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
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

const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col gap-0 border border-line bg-surface text-foreground shadow-xl",
    "duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in",
  ].join(" "),
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 h-auto max-h-[80vh] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 h-auto max-h-[80vh] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 w-3/4 max-w-sm data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 w-3/4 max-w-sm data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: { side: "right" },
  },
);

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof sheetVariants> & {
    showCloseButton?: boolean;
    /** Skip the dimmed backdrop — pair with `<Sheet modal={false}>` for a
     *  non-blocking sheet (e.g. an answer panel that leaves the page usable). */
    hideOverlay?: boolean;
  };

function SheetContent({
  className,
  side,
  children,
  showCloseButton = true,
  hideOverlay = false,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      {!hideOverlay && <SheetOverlay />}
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            aria-label="Close"
            className={cn(
              "absolute top-3 right-3 inline-flex size-8 items-center justify-center",
              "rounded-md text-ink-3 outline-none",
              "transition-colors duration-100 hover:bg-paper-2 hover:text-ink",
              "focus-visible:ring-4 focus-visible:ring-rush/15",
            )}
          >
            <Icon icon={CloseIcon} size={14} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex items-center justify-between border-b border-line px-5 py-4 text-[12px] font-medium text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-display text-[17px] font-semibold tracking-tight text-ink",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-[13px] leading-relaxed text-ink-3", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto p-5", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex items-center justify-end gap-2.5 border-t border-line p-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
};
