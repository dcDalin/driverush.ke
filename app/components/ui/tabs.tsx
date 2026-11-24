/**
 * shadcn's Tabs, in DriveRush's clothes. Arrow keys move between the tabs,
 * and each tab is a thumb high. The list and triggers take their colours
 * from where they sit, so a surface can pass its own.
 */
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "~/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit items-center justify-center gap-1 rounded-md bg-paper-2 p-1 text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-transparent px-3 text-[14px] font-semibold whitespace-nowrap outline-none",
        "transition-[background-color,border-color,color] duration-150 ease-snap",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-xs",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
