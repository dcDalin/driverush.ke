/**
 * Free drive, as one quiet row under Today's drive, on home and on the Board
 * page: the whole board with no task, every rule still said and counted.
 * Start or Continue stays the one big button on both.
 */
import { Link } from "react-router";

import { BOARD_PLAY_PATH } from "~/lib/board-guides";
import { cn } from "~/lib/utils";

import { Icon } from "~/components/brand/icon";
import { ChevronRightIcon, GoIcon } from "~/components/brand/icons";

/** Where free drive was opened from. */
export type FreeDriveSurface = "home" | "course_page" | "more_menu";

/** `from` says where it was opened, for analytics: the play page passes it on. */
export const freeDriveHref = (from: FreeDriveSurface) =>
  `${BOARD_PLAY_PATH}?free=1&from=${from}`;

export function FreeDriveRow({
  surface,
  className,
}: {
  /** Where it sits, for analytics. */
  surface: "home" | "course_page";
  className?: string;
}) {
  return (
    <Link
      to={freeDriveHref(surface)}
      data-free-drive-row
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-lg border border-ink/25 bg-surface px-4 py-3 text-ink no-underline outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-soft border border-ink/25 bg-paper-2 text-ink">
        <Icon icon={GoIcon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-bold leading-tight tracking-tight">
          Free drive
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">
          Drive anywhere on the board. Every rule you break is called out.
        </span>
      </span>
      <Icon icon={ChevronRightIcon} size={18} className="shrink-0 text-ink-3" />
    </Link>
  );
}
