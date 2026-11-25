/**
 * Today's drive, as one quiet row: the same task for everyone in Kenya today,
 * and the practice streak it keeps going. On home it sits under the Continue
 * button (still the one big button there) and on the Board page under the
 * course card. Once driven today it says so, and that a new one comes
 * tomorrow. Drawn only in the browser: the day and the streak are the
 * device's.
 */
import { Link } from "react-router";

import { analytics } from "~/lib/analytics";
import { useDailyDrive } from "~/lib/daily-drive";
import { usePracticeStreak } from "~/lib/practice-streak";
import { cn } from "~/lib/utils";

import { Icon } from "~/components/brand/icon";
import {
  CheckIcon,
  ChevronRightIcon,
  RoadIcon,
} from "~/components/brand/icons";

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** What the row says under its title. */
export function dailyLine(
  done: boolean,
  clean: boolean,
  streak: { days: number; practisedToday: boolean } | null,
): string {
  const run = streak?.days ?? 0;
  if (done) {
    return `${clean ? "Clean. " : ""}${days(run)} in a row. A new drive tomorrow.`;
  }
  if (run > 0 && !streak?.practisedToday) {
    return `Drive it to keep your ${days(run)} in a row.`;
  }
  if (run > 0)
    return `${days(run)} in a row. The same task for everyone today.`;
  return "The same task for everyone in Kenya today.";
}

export function DailyDriveRow({
  surface,
  className,
}: {
  /** Where it sits, for analytics. */
  surface: "home" | "course_page";
  className?: string;
}) {
  const drive = useDailyDrive();
  const streak = usePracticeStreak();
  if (!drive) return null;
  return (
    <Link
      to={drive.href}
      onClick={() =>
        analytics.dailyDriveOpened({
          challenge_id: drive.task.id,
          surface,
          done_today: drive.done,
        })
      }
      aria-label={
        drive.done
          ? `Today's drive, ${drive.task.title}, is done. Drive it again.`
          : `Today's drive: ${drive.task.title}`
      }
      className={cn(
        "dr-rise flex min-h-16 items-center gap-3 rounded-lg border border-ink/25 bg-surface px-4 py-3 text-ink no-underline transition-colors outline-none hover:bg-paper-2 focus-visible:bg-paper-2",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-soft border",
          drive.done
            ? "border-kenya-green/50 bg-kenya-green text-kenya-green-foreground"
            : "border-ink/25 bg-paper-2 text-ink",
        )}
      >
        <Icon icon={drive.done ? CheckIcon : RoadIcon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-bold tracking-tight">
          {drive.done ? "Today's drive is done" : "Today's drive"}
          <span className="font-sans font-semibold text-ink-2">
            : {drive.task.title}
          </span>
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">
          {dailyLine(drive.done, drive.clean, streak)}
        </span>
      </span>
      <Icon icon={ChevronRightIcon} size={18} className="shrink-0 text-ink-3" />
    </Link>
  );
}

/**
 * At the end of a level, one quiet line: today's drive, while it is still to
 * do. Gone once it is done, so the card stays short.
 */
export function DailyDriveLink({
  surface,
  onDark = true,
  className,
}: {
  surface: "level_done" | "level_passed";
  /** On the level's dark panel, not a light card. */
  onDark?: boolean;
  className?: string;
}) {
  const drive = useDailyDrive();
  const streak = usePracticeStreak();
  if (!drive || drive.done) return null;
  const run = streak?.days ?? 0;
  return (
    <Link
      to={drive.href}
      replace
      onClick={() =>
        analytics.dailyDriveOpened({
          challenge_id: drive.task.id,
          surface,
          done_today: false,
        })
      }
      className={cn(
        "inline-flex min-h-11 items-center gap-2 text-[13.5px] font-semibold underline underline-offset-4 outline-none",
        onDark
          ? "text-white/85 hover:text-white focus-visible:text-white"
          : "text-ink-2 hover:text-ink focus-visible:text-ink",
        className,
      )}
    >
      <Icon icon={RoadIcon} size={16} className="shrink-0" />
      <span>
        Today's drive: {drive.task.title}
        {run > 0 ? `. Keeps your ${days(run)} in a row.` : "."}
      </span>
    </Link>
  );
}
