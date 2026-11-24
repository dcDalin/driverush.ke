/**
 * shadcn's Item, in DriveRush's clothes: one row of a list, with something to
 * look at (ItemMedia), what it is (ItemContent: ItemTitle, ItemDescription)
 * and what it does (ItemActions). Give it `asChild` with a button or a link
 * when the whole row is the thing to tap. The game variants sit on the
 * game's dark ground in both themes. The parts are spans, so a row can be a
 * button and stay valid HTML.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "~/lib/utils";

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<"hr">) {
  return (
    <hr
      data-slot="item-separator"
      className={cn("my-0 border-0 border-t border-line", className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  [
    "group/item flex w-full flex-wrap items-center rounded-md border border-transparent text-left outline-none",
    "transition-colors duration-100",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush",
    "disabled:cursor-default",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-transparent text-ink [a&]:hover:bg-paper-2 [button&]:hover:bg-paper-2",
        outline:
          "border-line bg-surface text-ink [a&]:hover:bg-paper-2 [button&]:hover:bg-paper-2",
        muted: "bg-paper-2 text-ink",
        // A card on the game's dark panel, like a lesson to play
        game: "border-2 border-white/15 bg-white/5 text-white focus-visible:outline-white [a&]:hover:bg-white/10 [button&]:enabled:hover:bg-white/10",
        // A plain line on the game's dark panel, like a step of a route
        "game-ghost":
          "border-2 text-white focus-visible:outline-white [a&]:hover:bg-white/5 [button&]:hover:bg-white/5",
      },
      size: {
        default: "gap-4 p-4",
        // A thumb high, for lists a learner taps through
        sm: "min-h-11 gap-3 px-3 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 rounded-full border border-line bg-paper-2",
        image:
          "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <span
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="item-content"
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5 [&+[data-slot=item-content]]:flex-none",
        className,
      )}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="item-title"
      className={cn("text-[13.5px] font-semibold leading-snug", className)}
      {...props}
    />
  );
}

function ItemDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="item-description"
      className={cn(
        "block text-[12px] font-normal leading-snug text-ink-3 group-data-[variant^=game]/item:text-white/60",
        className,
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="item-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="item-header"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="item-footer"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
};
