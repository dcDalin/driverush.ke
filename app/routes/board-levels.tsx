/**
 * `/model-town-board/levels`: every level of the board course as a picture to
 * pick from. The Board page starts the course or carries on with it. This is
 * where a learner looks over all of it and jumps to any level.
 */
import { Link } from "react-router";

import { LevelPicker } from "~/components/board/level-picker";
import { SiteFooter } from "~/components/brand/site-footer";
import { SiteNav } from "~/components/brand/site-nav";
import { Button } from "~/components/ui/button";
import { COURSE_LEVELS, doneCount, UNITS } from "~/lib/board/curriculum";
import {
  BOARD_LEVELS_DESCRIPTION,
  BOARD_LEVELS_PATH,
  BOARD_LEVELS_TITLE,
  BOARD_PATH,
  BOARD_PLAY_PATH,
} from "~/lib/board-guides";
import { ogCardAlt, ogCardPath } from "~/lib/og-cards";
import { BOARD_KEYWORDS, breadcrumbLd, graphLd, pageMeta } from "~/lib/site";
import { useCourseProgress } from "~/lib/use-course-progress";

import type { Route } from "./+types/board-levels";

const TOTAL = COURSE_LEVELS.length;
const UNIT_COUNT = UNITS.filter((unit) => unit.id !== "mock").length;

export function meta(_: Route.MetaArgs) {
  return [
    ...pageMeta({
      title: BOARD_LEVELS_TITLE,
      description: BOARD_LEVELS_DESCRIPTION,
      path: BOARD_LEVELS_PATH,
      extraKeywords: BOARD_KEYWORDS,
      ogImage: ogCardPath("board"),
      ogImageAlt: ogCardAlt("board"),
    }),
    graphLd(
      breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Model Town Board", url: BOARD_PATH },
        { name: "All levels", url: BOARD_LEVELS_PATH },
      ]),
    ),
  ];
}

export default function BoardLevelsPage() {
  const saved = useCourseProgress();
  const done = saved ? doneCount(saved) : 0;

  return (
    <>
      <SiteNav />
      <main className="min-h-screen text-ink">
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-20 sm:px-9 sm:pt-10">
          <header className="mb-2">
            <p className="m-0 font-mono text-[10.5px] tracking-widest text-ink-3 uppercase">
              <Link
                to={BOARD_PATH}
                className="text-ink-3 no-underline hover:text-ink hover:underline"
              >
                Model Town Board
              </Link>
            </p>
            <h1 className="m-0 mt-2 font-display text-[clamp(30px,6vw,52px)] leading-[0.96] font-extrabold tracking-tighter uppercase">
              All levels
            </h1>
            <p className="m-0 mt-2 text-[15px] leading-snug text-ink-2">
              {TOTAL} levels in {UNIT_COUNT} units, in the order you learn them.
              Tap a picture to play that level; you can skip ahead.
              {saved && done > 0 && (
                <>
                  {" "}
                  <strong className="text-ink">
                    {done} of {TOTAL} done.
                  </strong>
                </>
              )}
            </p>
          </header>

          <LevelPicker reveal stripClassName="top-16" />

          <p className="m-0 mt-8">
            <Button variant="quiet-rush" asChild>
              <Link to={`${BOARD_PLAY_PATH}?learn=1`}>Explore the board</Link>
            </Button>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
