import { Icon } from "~/components/brand/icon";
import { MoonIcon, SunIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { toggleTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

/**
 * Light/dark switcher — a single stamped icon button sized to sit beside the
 * `sm` buttons in {@link AppBar}. Shows the sun in light mode, the moon in
 * dark; one tap flips it. Both glyphs are rendered and CSS reveals the live
 * one off the `dark` class on <html> (set by `THEME_INIT_SCRIPT`), so there's
 * no hydration flash and no React state to keep in sync. See `lib/theme`.
 */
function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="paper"
      size="sm"
      data-slot="theme-toggle"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={() => toggleTheme()}
      className={cn("w-9 px-0", className)}
    >
      <Icon icon={SunIcon} size={16} className="dark:hidden" />
      <Icon icon={MoonIcon} size={16} className="hidden dark:block" />
    </Button>
  );
}

export { ThemeToggle };
