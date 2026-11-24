import * as React from "react";

import { cn } from "~/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-y border border-input bg-surface px-3.5 py-2.5 text-[14.5px] font-medium text-ink rounded-lg",
        "shadow-xs outline-none transition-[border-color,box-shadow] duration-150 ease-snap",
        "placeholder:text-ink-4 placeholder:font-normal",
        "selection:bg-rush selection:text-white",
        "focus-visible:border-rush focus-visible:ring-4 focus-visible:ring-rush/15",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:bg-[color-mix(in_oklab,var(--rush)_6%,var(--surface))] aria-invalid:border-rush aria-invalid:ring-4 aria-invalid:ring-rush/15",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
