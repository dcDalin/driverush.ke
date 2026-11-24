/**
 * The NTSA test, at the end of a level in the game: where a learner is when
 * they feel they are getting somewhere. With no date yet, and from the third
 * finished level, it asks for one (once a visit, and the course page's rules
 * for putting it off still hold). With a date, it says the plan: the days
 * left and today's share, and "See you tomorrow" once today's share is in.
 * With nothing to say about the test, the install nudge has the place.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";

import {
  COURSE_LEVELS,
  doneCount,
  readiness,
  type CourseProgress,
} from "~/lib/board/curriculum";
import { useBoardStore } from "~/lib/board-store";
import { dayKey } from "~/lib/practice-streak";
import { cardStage, today, useTestRecord } from "~/lib/test-date";
import { planLine, testPlan } from "~/lib/test-plan";
import { cn } from "~/lib/utils";

import { TestCard } from "~/components/board/test-card";
import { InstallNudge } from "~/components/brand/install-nudge";

/** The date is asked at the end of one level a visit, not every level. */
let askedThisVisit: string | null = null;

/** The course as the game's store has it, live as levels finish. */
function useGameCourse(): CourseProgress {
  return useBoardStore(
    useShallow((s) => ({
      learned: s.learned,
      bestStars: s.bestStars,
      daily: s.daily,
      mockBest: s.mockBest,
    })),
  );
}

export function LevelTestNote({
  levelId,
  surface,
  tone = "game",
  onDark = true,
  className,
}: {
  /** The level just finished: the one visit-long ask belongs to it. */
  levelId: string;
  /** For the install nudge's analytics, when it is shown instead. */
  surface: string;
  tone?: "game" | "page";
  /** The plan line sits on a dark panel (the level's), not a light card. */
  onDark?: boolean;
  className?: string;
}) {
  const saved = useGameCourse();
  const [test, updateTest] = useTestRecord();
  const now = today();
  const done = doneCount(saved);
  const doneToday =
    saved.daily?.day === dayKey(Date.now()) ? saved.daily.done : 0;
  const due =
    test != null &&
    cardStage(test, done, now) === "date" &&
    (askedThisVisit == null || askedThisVisit === levelId);
  // Once asked, the card stays, so its answer (the plan and the calendar
  // links) can be read after the date is saved.
  const [asking, setAsking] = React.useState(false);
  React.useEffect(() => {
    if (!due) return;
    askedThisVisit = levelId;
    setAsking(true);
  }, [due, levelId]);

  if (!test) return null;
  if (asking) {
    return (
      <TestCard
        stage="date"
        record={test}
        update={updateTest}
        levelsDone={done}
        doneToday={doneToday}
        readiness={readiness(saved)}
        mockBestClean={saved.mockBest?.clean ?? 0}
        surface="level_done"
        tone={tone}
        className={className}
      />
    );
  }

  const line = planLine(
    testPlan(test, done, COURSE_LEVELS.length, doneToday, now),
  );
  return (
    <>
      {line && (
        <p
          className={cn(
            "m-0 text-[13.5px] font-semibold leading-snug",
            onDark ? "text-white/85" : "text-ink-2",
            className,
          )}
        >
          {line}
        </p>
      )}
      {!due && <InstallNudge surface={surface} tone={tone} />}
    </>
  );
}
