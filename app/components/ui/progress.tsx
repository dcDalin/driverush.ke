import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "~/lib/utils";

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Show 25/50/75% tick marks across the rail. */
  showTicks?: boolean;
  /** Render the diagonal-stripe rush fill (default) or a flat green fill. */
  tone?: "rush" | "green";
  /** Extra classes for the fill — e.g. swap the easing for a live countdown. */
  indicatorClassName?: string;
};

function Progress({
  className,
  value,
  showTicks = true,
  tone = "rush",
  indicatorClassName,
  ...props
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={pct}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-paper-2",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-snap",
          tone === "rush" ? "bg-rush" : "bg-kenya-green",
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
      {showTicks && (
        <>
          <span className="pointer-events-none absolute inset-y-0 left-1/4 w-0.5 bg-surface" />
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-surface" />
          <span className="pointer-events-none absolute inset-y-0 left-3/4 w-0.5 bg-surface" />
        </>
      )}
    </ProgressPrimitive.Root>
  );
}

function ProgressIndeterminate({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="progress-indeterminate"
      role="progressbar"
      aria-busy
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-paper-2",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full w-full",
          "bg-[repeating-linear-gradient(90deg,transparent_0_25%,var(--rush)_25%_50%,transparent_50%_100%)] bg-[length:200%_100%]",
          "animate-[dr-stripe-move_1.4s_linear_infinite]",
        )}
      />
    </div>
  );
}

export { Progress, ProgressIndeterminate };
