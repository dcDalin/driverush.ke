/**
 * shadcn's Toggle, in DriveRush's clothes: a flat chip with a soft corner
 * that fills with ink when it is on. No stamp shadow, no heavy ink border.
 */
import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "~/lib/utils";

const toggleVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-soft border font-sans font-semibold outline-none",
    "transition-[background-color,border-color,color] duration-150 ease-snap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Ink when on, the page's own surface when off
        default:
          "border-transparent bg-transparent text-ink hover:bg-paper-2 data-[state=on]:bg-ink data-[state=on]:text-paper",
        // A thin outline when off, for chips that sit on a plain page
        outline:
          "border-line bg-surface text-ink hover:border-ink/25 hover:bg-paper-2 data-[state=on]:border-transparent data-[state=on]:bg-ink data-[state=on]:text-paper",
        // Kenya gold when chosen: one pick out of a few, like a seat or a car
        gold: "border-line bg-surface text-ink hover:border-ink/25 hover:bg-paper-2 data-[state=on]:border-transparent data-[state=on]:bg-kenya-gold data-[state=on]:text-kenya-gold-foreground",
        // On the game's dark ground: gold when chosen
        game: "border-2 border-white/15 bg-white/5 text-white hover:bg-white/10 focus-visible:outline-white data-[state=on]:border-game-gold data-[state=on]:bg-game-gold data-[state=on]:text-game-gold-foreground",
      },
      size: {
        sm: "h-9 min-w-9 px-2.5 text-[13px]",
        default: "h-11 min-w-11 px-3 text-[14.5px]",
        lg: "h-13 min-w-13 px-4 text-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
