import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "~/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-[2px]",
        "transition-[background] duration-150 ease-snap outline-none",
        "bg-neutral-line data-[state=checked]:bg-kenya-green",
        "focus-visible:ring-4 focus-visible:ring-rush/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[22px] rounded-full bg-white shadow-sm",
          "transition-transform duration-150 ease-snap",
          "translate-x-px",
          "data-[state=checked]:translate-x-[28px] data-[state=checked]:bg-white",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
