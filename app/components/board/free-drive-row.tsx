/**
 * Free drive, as one quiet row on the Board page, under Today's drive: the
 * whole board with no task, every rule still said and counted. Start or
 * Continue stays the one big button there.
 */
import { Link } from "react-router";

import { BOARD_PLAY_PATH } from "~/lib/board-guides";
import { cn } from "~/lib/utils";

import { Icon } from "~/components/brand/icon";
import { ChevronRightIcon, GoIcon } from "~/components/brand/icons";

/** `from` says where it was opened, for analytics: the play page passes it on. */
export const FREE_DRIVE_HREF = `${BOARD_PLAY_PATH}?free=1&from=course_page`;

export function FreeDriveRow({ className }: { className?: string }) {
  return (
    <Link
      to={FREE_DRIVE_HREF}
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
