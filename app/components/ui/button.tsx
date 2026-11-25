import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { TrafficLoader } from "~/components/brand/traffic-loader";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  [
    // Base: a flat block of colour with a soft corner. No ink outline and no
    // offset shadow. The fill says what kind of button it is, and it darkens
    // under the pointer and dips a pixel when pressed.
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-soft border border-transparent font-sans font-semibold tracking-normal",
    "transition-[background-color,border-color,color,transform] duration-150 ease-snap outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:cursor-default disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary action: red, white type
        rush: "bg-rush text-primary-foreground shadow-xs hover:bg-rush-deep dark:hover:brightness-110",
        // Confirming neutral action: ink block, paper type
        ink: "bg-ink text-paper shadow-xs hover:opacity-90",
        // Cautionary, save-for-later
        amber: "bg-amber text-amber-foreground hover:brightness-95",
        // Pass / sawa / success
        green: "bg-kenya-green text-kenya-green-foreground hover:brightness-95",
        // Quiet default: a thin outline on the page's own surface
        paper:
          "border-line bg-surface text-ink shadow-xs hover:border-ink/25 hover:bg-paper-2",
        // No fill, no outline: for in-text cancel / skip
        ghost: "bg-transparent text-ink hover:bg-paper-2 active:translate-y-0",
        // Inline link styling
        link: "bg-transparent text-rush underline-offset-4 hover:underline active:translate-y-0",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        default: "h-11 px-5 text-[14.5px]",
        lg: "h-13 px-7 text-[16px]",
        // Circular icon button
        stamp: "size-14 rounded-full p-0 text-lg [&_svg]:size-5",
        "stamp-sm": "size-10 rounded-full p-0 text-base [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "paper",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Waiting on its action: disabled, marked busy, with the traffic-light loader. */
    isLoading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "paper"}
      data-size={size ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {/* `asChild` hands its one child to Slot untouched (Slot needs exactly one). */}
      {asChild ? (
        children
      ) : (
        <>
          {isLoading && <TrafficLoader size="sm" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
