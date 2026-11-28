import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { Icon } from "~/components/brand/icon";
import { CheckIcon, MinusIcon } from "~/components/brand/icons";
import { cn } from "~/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer inline-flex size-[22px] shrink-0 items-center justify-center rounded-md border border-input bg-surface",
        "shadow-xs transition-[border-color,box-shadow,background] duration-150 ease-snap outline-none",
        "focus-visible:ring-4 focus-visible:ring-rush/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-rush data-[state=checked]:bg-rush data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:bg-ink data-[state=indeterminate]:text-paper",
        "aria-invalid:border-rush aria-invalid:ring-4 aria-invalid:ring-rush/15",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center"
      >
        {props.checked === "indeterminate" ? (
          <Icon icon={MinusIcon} size={14} />
        ) : (
          <Icon icon={CheckIcon} size={14} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
