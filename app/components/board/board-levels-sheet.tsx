/**
 * Every level, over the game: the same picker as the levels page, opened from
 * inside a level so a learner can move to any other without leaving. On top,
 * one button goes on with the course (the first level not done), with the
 * level before and the level after as arrows either side. Picking a
 * level takes the place of the one that was open, so Close still leaves the
 * game in one step.
 */
import type * as React from "react";
import { Link, useNavigate } from "react-router";

import {
  COURSE_LEVELS,
  levelAfter,
  levelBefore,
  levelState,
  nextLevel,
  type CourseProgress,
  type Level,
} from "~/lib/board/curriculum";
import { useCourseProgress } from "~/lib/use-course-progress";

import { LevelPicker } from "~/components/board/level-picker";
import { hrefOfLevel, useSkipAhead } from "~/components/board/skip-ahead";
import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "~/components/brand/icons";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";

const arrow =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-soft border border-ink/25 bg-surface text-ink no-underline outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2 disabled:opacity-30";
const go =
  "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-soft bg-rush px-3 text-[14px] font-bold text-white no-underline outline-none transition-[filter] hover:brightness-90 focus-visible:ring-2 focus-visible:ring-ink";

const EMPTY: CourseProgress = { learned: [], bestStars: {} };

/** The level before or after, one tap away; a locked one asks first. */
function ArrowStep({
  to,
  label,
  onGo,
  children,
}: {
  to: Level | undefined;
  label: string;
  onGo: (level: Level) => void;
  children: React.ReactNode;
}) {
  if (!to) {
    return (
      <button type="button" disabled aria-label={label} className={arrow}>
        {children}
      </button>
    );
  }
  const name = to.kind === "mock" ? "Mock test" : `level ${to.n}, ${to.title}`;
  return (
    <button
      type="button"
      aria-label={`${label}: ${name}`}
      title={to.kind === "mock" ? "Mock test" : `${to.n}. ${to.title}`}
      onClick={() => onGo(to)}
      className={arrow}
    >
      {children}
    </button>
  );
}

export default function BoardLevelsSheet({
  open,
  onOpenChange,
  level,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The level the game is on. */
  level: Level;
}) {
  const before = levelBefore(level);
  const after = levelAfter(level);
  const close = () => onOpenChange(false);
  const saved = useCourseProgress();
  const next = nextLevel(saved ?? EMPTY);
  // Continue goes to the first level not done; if that is this one, it only
  // closes the sheet.
  const here = next.id === level.id;
  const navigate = useNavigate();
  const skip = useSkipAhead({
    next,
    replace: true,
    surface: "levels_sheet",
    dark: true,
    onGo: close,
  });
  const goTo = (to: Level) => {
    if (saved && levelState(to, saved) === "locked") {
      skip.ask(to);
      return;
    }
    close();
    navigate(hrefOfLevel(to), { replace: true });
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        // `dark` turns the brand's colours over, as on every popup in the game.
        className="dark h-[92dvh] max-h-[92dvh] border-x-0 border-b-0 border-white/20 bg-background text-ink shadow-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink/15 px-4 py-2.5">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-3">
              {level.kind === "mock"
                ? "Mock test"
                : `Level ${level.n} of ${COURSE_LEVELS.length}`}
            </p>
            <SheetTitle className="text-[19px] leading-tight tracking-tight text-ink">
              All levels
            </SheetTitle>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-soft border border-ink/25 text-ink outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2"
          >
            <Icon icon={CloseIcon} size={20} />
          </button>
        </header>
        <nav
          aria-label="Where to go"
          className="flex items-stretch gap-2 border-b border-ink/15 px-4 py-2.5"
        >
          <ArrowStep to={before} label="Level before" onGo={goTo}>
            <Icon icon={ChevronLeftIcon} size={18} />
          </ArrowStep>
          {here ? (
            <button type="button" onClick={close} className={go}>
              <span className="min-w-0 truncate">
                Back to level {level.n}, {level.title}
              </span>
              <Icon icon={ArrowRightIcon} size={16} className="shrink-0" />
            </button>
          ) : (
            <Link to={hrefOfLevel(next)} replace onClick={close} className={go}>
              <span className="min-w-0 truncate">
                {next.kind === "mock"
                  ? "Take the mock test"
                  : `Continue: level ${next.n}, ${next.title}`}
              </span>
              <Icon icon={ArrowRightIcon} size={16} className="shrink-0" />
            </Link>
          )}
          <ArrowStep to={after} label="Level after" onGo={goTo}>
            <Icon icon={ChevronRightIcon} size={18} />
          </ArrowStep>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <LevelPicker
            current={level.id}
            replace
            reveal
            onPick={close}
            className="mx-auto max-w-5xl"
          />
        </div>
        {skip.dialog}
      </SheetContent>
    </Sheet>
  );
}
