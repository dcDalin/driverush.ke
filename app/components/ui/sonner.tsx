import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      // Project default: ink panel, paper text, rush stamp shadow. Per-toast
      // overrides still work via the `style`/`className` props on toast().
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: [
            "grid w-full max-w-[420px] grid-cols-[auto_1fr_auto] items-center gap-3",
            "border border-line bg-ink px-3.5 py-3 text-paper rounded-lg",
            "shadow-stamp-rush",
          ].join(" "),
          icon: [
            "flex size-8 items-center justify-center border border-paper bg-rush text-white rounded-lg",
            "font-display text-sm font-bold",
          ].join(" "),
          title: [
            "font-display text-[13px] font-bold tracking-tight text-paper",
          ].join(" "),
          description: "text-[12px] text-paper/80",
          actionButton: [
            "ml-auto shrink-0 whitespace-nowrap bg-transparent font-sans text-[11px] font-semibold uppercase tracking-wider text-paper",
            "hover:underline focus-visible:underline outline-none cursor-pointer",
          ].join(" "),
          cancelButton: [
            "bg-transparent font-sans text-[11px] font-semibold uppercase tracking-wider text-paper/70",
            "hover:text-paper focus-visible:text-paper outline-none cursor-pointer",
          ].join(" "),
          closeButton: [
            "border border-paper bg-transparent text-paper rounded-lg",
            "hover:bg-paper hover:text-ink",
          ].join(" "),
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
