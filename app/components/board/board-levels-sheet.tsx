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
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";

/** A square paper Button, a thumb wide. */
const square = "size-11 p-0 disabled:opacity-30";
/** The rush Button that takes the rest of the row. */
const go = "min-w-0 flex-1 px-3 text-[14px] font-bold no-underline";

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
      <Button variant="paper" disabled aria-label={label} className={square}>
        {children}
      </Button>
    );
  }
  const name = to.kind === "mock" ? "Mock test" : `level ${to.n}, ${to.title}`;
  return (
    <Button
      variant="paper"
      aria-label={`${label}: ${name}`}
      title={to.kind === "mock" ? "Mock test" : `${to.n}. ${to.title}`}
      onClick={() => onGo(to)}
      className={square}
    >
      {children}
    </Button>
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
          <Button
            variant="paper"
            aria-label="Close"
            onClick={close}
            className={square}
          >
            <Icon icon={CloseIcon} size={20} />
          </Button>
        </header>
        <nav
          aria-label="Where to go"
          className="flex items-stretch gap-2 border-b border-ink/15 px-4 py-2.5"
        >
          <ArrowStep to={before} label="Level before" onGo={goTo}>
            <Icon icon={ChevronLeftIcon} size={18} />
          </ArrowStep>
          {here ? (
            <Button variant="rush" onClick={close} className={go}>
              <span className="min-w-0 truncate">
                Back to level {level.n}, {level.title}
              </span>
              <Icon icon={ArrowRightIcon} size={16} className="shrink-0" />
            </Button>
          ) : (
            <Button variant="rush" asChild className={go}>
              <Link to={hrefOfLevel(next)} replace onClick={close}>
                <span className="min-w-0 truncate">
                  {next.kind === "mock"
                    ? "Take the mock test"
                    : `Continue: level ${next.n}, ${next.title}`}
                </span>
                <Icon icon={ArrowRightIcon} size={16} className="shrink-0" />
              </Link>
            </Button>
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
