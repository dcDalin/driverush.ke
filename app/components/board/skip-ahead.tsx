/**
 * The ask before a locked level opens. Levels past where the learner is look
 * locked, but they are never shut: this says which level comes first and lets
 * them go on anyway. Links straight to a level (guides, `?level=`) skip it.
 */
import * as React from "react";
import { useNavigate } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ArrowRightIcon, LockIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { analytics } from "~/lib/analytics";
import { type Level } from "~/lib/board/curriculum";
import { BOARD_PLAY_PATH, levelHref } from "~/lib/board-guides";
import { cn } from "~/lib/utils";

export const hrefOfLevel = (level: Level) =>
  level.kind === "mock" ? BOARD_PLAY_PATH : levelHref(level.id);

/** Room for a long level name to wrap, at least a thumb high. */
const choice =
  "h-auto min-h-12 w-full whitespace-normal px-4 py-2.5 text-center font-bold leading-snug";

export function useSkipAhead({
  next,
  replace,
  surface,
  dark,
  onGo,
}: {
  /** The learner's next level: where they are pointed first. */
  next: Level;
  replace?: boolean;
  surface: "levels_page" | "levels_sheet";
  /** Over the game, the ask is dark like every popup there. */
  dark?: boolean;
  /** Called once either choice is taken, before the move. */
  onGo?: (level: Level) => void;
}) {
  const navigate = useNavigate();
  const [asked, setAsked] = React.useState<Level | null>(null);

  const go = (level: Level, skipped: boolean) => {
    if (skipped)
      analytics.boardSkipAhead({
        to_level: level.id,
        next_level: next.id,
        surface,
      });
    setAsked(null);
    onGo?.(level);
    navigate(hrefOfLevel(level), { replace });
  };

  const dialog = (
    <Dialog open={asked != null} onOpenChange={(o) => !o && setAsked(null)}>
      <DialogContent
        titlebarLabel="Skip ahead?"
        closeAriaLabel="Close"
        // The dialog's stamp shadow outranks a `shadow-none` class; flat here,
        // like every other button and card in the game.
        style={{ boxShadow: "none" }}
        className={cn(
          "rounded-soft border shadow-none",
          dark && "dark border-white/20 bg-background text-ink",
        )}
      >
        {asked && (
          <div className="grid gap-4 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-soft bg-paper-2 text-ink-2">
                <Icon icon={LockIcon} size={20} />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-[19px] leading-tight">
                  Level {asked.n} is ahead of you
                </DialogTitle>
                <DialogDescription className="mt-1 text-ink-2">
                  Level {next.n}, {next.title}, comes first. The levels build on
                  each other, but you can skip ahead if you know this part.
                </DialogDescription>
              </div>
            </div>
            <div className="grid gap-2">
              <Button
                variant="rush"
                onClick={() => go(next, false)}
                className={choice}
              >
                Go to level {next.n}
                <Icon icon={ArrowRightIcon} size={16} />
              </Button>
              <Button
                variant="paper"
                onClick={() => go(asked, true)}
                className={choice}
              >
                Skip ahead to level {asked.n}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  return { ask: setAsked, dialog };
}
