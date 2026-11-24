/**
 * `/model-town-board/play`: the board game and nothing else. `?level=<id>`
 * opens one level of the course, `?task=<id>` starts one task, `?learn=1`
 * opens the board to explore, and with none of them it is a round of mixed
 * tasks. `?school=<id>` names the driving school on the board, and follows it
 * as it changes. Closing the game goes back to the page it was opened from,
 * or to the Model Town Board page when it was opened cold.
 *
 * Search engines are pointed at that page, not this one: there is nothing here
 * to read.
 */
import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/board-play";

import { analytics } from "~/lib/analytics";
import { BOARD_PATH } from "~/lib/board-guides";
import { challengeById } from "~/lib/board/challenges";
import { useBoardStore } from "~/lib/board-store";
import { isDailyDrive, kenyaDay } from "~/lib/daily-drive";
import {
  enterPlay,
  schoolHeld,
  useVisitSponsor,
} from "~/lib/board/sponsor-visit";
import { ogCardAlt, ogCardPath } from "~/lib/og-cards";
import { BOARD_KEYWORDS, pageMeta, SITE } from "~/lib/site";
import { useThemeColor } from "~/lib/theme";

import { BoardGame } from "~/components/board/board-player";
import { LoadingPanel } from "~/components/brand/traffic-loader";

export function meta(_: Route.MetaArgs) {
  return [
    // No canonical: a page kept out of search should not also point
    // somewhere else. Shared links still preview as the Board page.
    ...pageMeta({
      title: "Drive the Model Town Board",
      description:
        "Drive the Model Town Board online, free. Pick your lane, take the roundabout, and get told which rule you broke. No signup.",
      // The page to index is the guide, which says what the board is.
      path: BOARD_PATH,
      extraKeywords: BOARD_KEYWORDS,
      ogImage: ogCardPath("board"),
      ogImageAlt: ogCardAlt("board"),
    }).filter((tag) => !("rel" in tag && tag.rel === "canonical")),
    { name: "robots", content: "noindex, follow" },
  ];
}

/**
 * Keeps `?school=<id>` in the address in step with the school on the board
 * (`~/lib/board/sponsor-visit`), which changes with every new task. A link
 * with a live school in it starts on that school; a wrong one is written
 * over with the school actually shown. Replaces the address, so it adds
 * nothing to go back through, and the game below does not notice.
 */
function useSchoolInAddress(): void {
  const [params, setParams] = useSearchParams();
  const sponsor = useVisitSponsor();
  const asked = params.get("school");
  // Once, as the page opens: before the game's first task starts.
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    enterPlay(asked);
  }, [asked]);
  React.useEffect(() => {
    // A school held with `?sponsor=` keeps the address as it was given.
    if (!sponsor || schoolHeld() || asked === sponsor.id) return;
    setParams(
      (before) => {
        const next = new URLSearchParams(before);
        next.set("school", sponsor.id);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [sponsor, asked, setParams]);
}

export default function BoardPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Before the effect that starts the game, so a school asked for in the
  // address is on the board for the first task.
  useSchoolInAddress();
  // The board runs to the top edge: the status bar takes its dark.
  useThemeColor(SITE.themeColors.game);
  const learn = params.get("learn") === "1";
  const task = params.get("task");
  const level = params.get("level");
  // Today's drive (`daily-drive.ts`): only today's task, opened as such. An
  // old daily link opened another day is an ordinary drive of that task.
  const daily = isDailyDrive(task, params.get("daily"), kenyaDay(Date.now()));
  /** The game is being shut by this page itself: to change level, or to go. */
  const swapping = React.useRef(false);

  React.useEffect(() => {
    const store = useBoardStore.getState();
    if (!store.overlayOpen) {
      if (level) store.startLevel(level);
      else if (learn) store.learn();
      // A task that doesn't exist (an old or mistyped link) is a round.
      else store.start(task && challengeById(task) ? [task] : undefined);
      if (daily && task) analytics.dailyDriveStarted({ challenge_id: task });
    }
    return () => {
      swapping.current = true;
      useBoardStore.getState().exit();
      swapping.current = false;
    };
  }, [learn, task, level, daily]);

  // Close takes the learner back to the page they opened the game from. The
  // store is listened to directly, not read from a render: moving from one
  // level to another shuts the game and opens it again before the page draws,
  // which a render never sees.
  React.useEffect(
    () =>
      useBoardStore.subscribe((state, before) => {
        if (!before.overlayOpen || state.overlayOpen || swapping.current)
          return;
        // The router numbers the pages visited on the site. Above 0 there is
        // one to go back to. At 0 the game was opened cold (a typed address,
        // a shared link), and back would leave the site. Moving from level to
        // level replaces this entry, so one step back always leaves the game.
        const visited = (window.history.state as { idx?: number } | null)?.idx;
        if (visited && visited > 0) navigate(-1);
        else navigate(BOARD_PATH, { replace: true });
      }),
    [navigate],
  );

  return (
    <main
      data-board-play
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#101114] text-white"
    >
      <LoadingPanel label="Loading the board" size="lg" onDark />
      <Link
        to={BOARD_PATH}
        className="font-mono text-[11px] font-bold uppercase tracking-widest text-white/70 underline underline-offset-4 outline-none hover:text-white focus-visible:text-white"
      >
        Back to the Model Town Board
      </Link>
      <BoardGame />
    </main>
  );
}
