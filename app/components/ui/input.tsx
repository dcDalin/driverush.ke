import * as React from "react";

import { cn } from "~/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Stamped, bordered. Soft-line shadow at rest; flips to rush + small
        // translation on focus — the lane-change moment.
        "flex h-11 w-full min-w-0 rounded-lg border border-input bg-surface px-3.5 py-2.5 text-[14.5px] font-medium text-ink",
        "shadow-xs transition-[border-color,box-shadow] duration-150 ease-snap outline-none",
        "placeholder:font-normal placeholder:text-ink-4",
        "selection:bg-rush selection:text-white",
        "focus-visible:border-rush focus-visible:ring-4 focus-visible:ring-rush/15",
        "disabled:pointer-events-none disabled:opacity-50",
        // Invalid state — react-hook-form / aria
        "aria-invalid:border-rush aria-invalid:bg-[color-mix(in_oklab,var(--rush)_6%,var(--surface))] aria-invalid:ring-4 aria-invalid:ring-rush/15",
        // File inputs need a different baseline
        "file:mr-3 file:border-0 file:bg-transparent file:text-[13px] file:font-semibold file:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
