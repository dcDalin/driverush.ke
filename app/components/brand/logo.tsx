import type * as React from "react";

import { cn } from "~/lib/utils";

/*
 * The DR mark, drawn from the vector master in `app/lib/brand-mark.ts` by
 * `npm run build:brand`. Two files, one per background: on light, the
 * original slate D and red R; on dark, a cream D and a brighter R. The red R
 * stays red in both (the old PNG was inverted for dark mode, which turned the
 * R white). Two small cached files rather than the paths inline, so the
 * header and footer do not each add the mark to every page's HTML.
 */
const LIGHT = "/logo.svg";
const DARK = "/logo-dark.svg";

/**
 * Where the mark sits in the logo's box. The box keeps the old PNG's 3:2
 * shape and margin (384x256 with the 202x111 mark at 106,70), so every call
 * site keeps its size and spacing.
 */
const ASPECT = 1.5;
/** The mark alone: 202x111. */
const MARK_ASPECT = 202 / 111;
const FULL_BOX = { left: 0, top: 0, width: "100%", height: "100%" };
const MARK_BOX = {
  left: `${(106 / 384) * 100}%`,
  top: `${(70 / 256) * 100}%`,
  width: `${(202 / 384) * 100}%`,
  height: `${(111 / 256) * 100}%`,
};

type LogoProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Only the DR monogram exists. Kept so call sites read clearly. */
  variant?: "plain";
  /** Height in pixels. Width follows from the box's shape. */
  height?: number;
  /**
   * The box is the mark itself, with no margin: `height` is the letters'
   * height. Without it, the box keeps the old PNG's 3:2 shape and margin.
   */
  tight?: boolean;
  /** Always the dark-background colours, whatever the theme. */
  knockout?: boolean;
  /**
   * Follow the theme on a theme-aware surface:
   *
   * - `"on-paper"` (or `true`): paper in light mode, ink in dark mode (e.g.
   *   `bg-surface`). Light colours, dark ones in dark mode.
   * - `"on-ink"`: ink in light mode, paper in dark mode (e.g. `bg-ink`, the
   *   footer band). Dark colours, light ones in dark mode.
   */
  themed?: boolean | "on-paper" | "on-ink";
  /** Load before anything else: the logo is above the fold. */
  priority?: boolean;
  /** Override the default "DriveRush" alt text. */
  alt?: string;
};

/** The DriveRush logo. Always prefer this over CSS-drawn marks. */
function Logo({
  variant = "plain",
  height = 36,
  tight = false,
  knockout = false,
  themed = false,
  priority = false,
  alt,
  className,
  style,
  ...props
}: LogoProps) {
  const width = Math.round(height * (tight ? MARK_ASPECT : ASPECT));
  const box = tight ? FULL_BOX : MARK_BOX;
  // Which file shows in light mode and which in dark mode.
  const [lightMode, darkMode]: ["light" | "dark", "light" | "dark"] = knockout
    ? ["dark", "dark"]
    : themed === true || themed === "on-paper"
      ? ["light", "dark"]
      : themed === "on-ink"
        ? ["dark", "light"]
        : ["light", "light"];
  const img = (which: "light" | "dark", visible: string) => (
    <img
      src={which === "light" ? LIGHT : DARK}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // React 19 renders the lowercase `fetchpriority` attribute from this.
      fetchPriority={priority ? "high" : "auto"}
      className={cn("absolute max-w-none", visible)}
      style={box}
      draggable={false}
    />
  );
  return (
    <span
      role="img"
      aria-label={alt ?? "DriveRush"}
      data-slot="logo"
      data-variant={variant}
      className={cn("relative block shrink-0 select-none", className)}
      style={{ width, height, ...style }}
      {...props}
    >
      {lightMode === darkMode ? (
        img(lightMode, "")
      ) : (
        <>
          {img(lightMode, "dark:hidden")}
          {/* Hidden in light mode, and lazy, so it is only fetched in dark. */}
          {img(darkMode, "hidden dark:block")}
        </>
      )}
    </span>
  );
}

export { Logo };
export type { LogoProps };
