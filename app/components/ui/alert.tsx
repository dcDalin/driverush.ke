import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { SignIcon } from "~/components/brand/art/sign-glyphs";
import { Icon } from "~/components/brand/icon";
import type { IconDef } from "~/components/brand/icons";
import {
  DoneIcon,
  InfoIcon,
  StopIcon,
  WarningIcon,
} from "~/components/brand/icons";
import { cn } from "~/lib/utils";

const alertVariants = cva(
  "grid grid-cols-[48px_1fr_auto] items-center gap-3.5 rounded-xl border border-line px-4 py-3.5",
  {
    variants: {
      variant: {
        info: "bg-[color-mix(in_oklab,var(--plate-blue)_8%,var(--surface))]",
        warn: "bg-[color-mix(in_oklab,var(--amber)_14%,var(--surface))]",
        error: "bg-[color-mix(in_oklab,var(--rush)_10%,var(--surface))]",
        ok: "bg-[color-mix(in_oklab,var(--kenya-green)_12%,var(--surface))]",
        neutral: "bg-surface",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

const iconBoxVariants = cva(
  "flex size-10 items-center justify-center rounded-lg",
  {
    variants: {
      variant: {
        info: "bg-plate-blue text-plate-blue-foreground",
        warn: "bg-amber text-amber-foreground",
        error: "bg-rush text-primary-foreground",
        ok: "bg-kenya-green text-kenya-green-foreground",
        neutral: "bg-paper-3 text-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

const defaultIcon: Record<
  NonNullable<VariantProps<typeof alertVariants>["variant"]>,
  IconDef
> = {
  info: InfoIcon,
  warn: WarningIcon,
  error: StopIcon,
  ok: DoneIcon,
  neutral: InfoIcon,
};

type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    icon?: IconDef;
  };

function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  const v = variant ?? "neutral";
  const def = icon ?? defaultIcon[v];
  return (
    <div
      role="alert"
      data-slot="alert"
      data-variant={v}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {def.sign ? (
        // Status marks are tiny real signs; the sign is its own frame.
        <span className="flex size-11 items-center justify-center" aria-hidden>
          <SignIcon name={def.sign} size={38} />
        </span>
      ) : (
        <span className={cn(iconBoxVariants({ variant }))} aria-hidden>
          <Icon icon={def} size={20} />
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * Title and description are `div`s, not `p`s, because alerts are written from
 * MDX too: MDX wraps a block of text in its own `<p>`, and a paragraph inside
 * a paragraph is invalid HTML that React reports as a hydration error.
 *
 * The nested paragraph also arrives wearing the prose styles from
 * `mdx-components` (17px serif, 16px margins), which is wrong inside a compact
 * alert box, so the description folds any direct child paragraph back into its
 * own type scale.
 */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-display text-[15px] font-semibold tracking-tight text-ink",
        "[&>p]:m-0 [&>p]:font-[inherit] [&>p]:text-[length:inherit] [&>p]:leading-[inherit] [&>p]:text-inherit",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[13px] leading-relaxed text-ink-2",
        "[&>p]:m-0 [&>p]:font-[inherit] [&>p]:text-[length:inherit] [&>p]:leading-[inherit] [&>p]:text-inherit",
        // Two paragraphs in one alert still need air between them.
        "[&>p+p]:mt-2",
        className,
      )}
      {...props}
    />
  );
}

function AlertBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-body"
      className={cn("min-w-0", className)}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="alert-action"
      className={cn(
        "rounded-md border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-ink",
        "transition-colors duration-100 outline-none hover:bg-paper-2",
        "focus-visible:ring-4 focus-visible:ring-rush/15",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertBody, AlertDescription, AlertTitle };
