/**
 * Learner profile sync: turns the localStorage progress this app already keeps
 * into PostHog person properties.
 *
 * There are no accounts, so without this every learner is a shapeless anonymous
 * id and questions like "do people who know 20 signs come back?" can't be asked.
 * These properties make them segmentable instead: break trends down by
 * `learner_stage`, build cohorts on `board_levels_done` or
 * `signs_mastered_pelican`.
 *
 * Cost control: the project runs `person_profiles: 'identified_only'`, and
 * `setPersonProperties` is what creates a profile. We therefore hold off until
 * the visitor has actually done something (`learner_stage` past `visitor`), so
 * SEO drive-by traffic stays anonymous — cheaper events, and a person list
 * that means something. `learner_stage` is registered as a super property for
 * everyone either way, so funnels can still be split by it from the first
 * pageview.
 *
 * Deliberately reads the persisted JSON rather than importing the zustand
 * stores (the curriculum is only names and order, so it is cheap to import): this runs from the root component, and importing the stores there
 * would drag their dependency graphs into the entry chunk.
 */
import * as React from "react";
import { useLocation } from "react-router";

import {
  COURSE_LEVELS,
  type CourseProgress,
  doneCount,
  readiness,
} from "./board/curriculum";
import { gaSetUserProperties } from "./ga";
import {
  masteredCount,
  parsePersistedProgress,
  type SignProgress,
  TRAINER_STORAGE_KEYS,
} from "./pelican-progress";
import { getPostHog } from "./posthog";
import { liveStreak, readPracticeStreak } from "./practice-streak";
import { readTestRecord, testBucket, today } from "./test-date";
import { testPlan } from "./test-plan";

const FIRST_SEEN_KEY = "driverush:first-seen";
/** Where `board-store.ts` keeps the board course's saved state. */
const BOARD_KEY = "driverush:board";

function readProgress(key: string): SignProgress {
  return parsePersistedProgress(window.localStorage.getItem(key));
}

function readCourse(): CourseProgress {
  try {
    const state = (
      JSON.parse(window.localStorage.getItem(BOARD_KEY) || "{}") as {
        state?: CourseProgress;
      }
    ).state;
    return {
      learned: Array.isArray(state?.learned) ? state.learned : [],
      bestStars: state?.bestStars ?? {},
      mockBest: state?.mockBest,
    };
  } catch {
    return { learned: [], bestStars: {} };
  }
}

function masteredSigns(progress: SignProgress): number {
  return masteredCount(progress, Object.keys(progress));
}

/**
 * Coarse lifecycle bucket across both halves of the app: board levels done
 * (the main product) and signs mastered. Low cardinality on purpose: it's
 * registered as a super property, so it lands on every event and shows up as
 * a breakdown. Whichever half is further along sets the stage.
 */
function learnerStage(
  signsMastered: number,
  boardLevelsDone: number,
): "visitor" | "sampler" | "practising" | "committed" {
  if (signsMastered >= 40 || boardLevelsDone >= 26) return "committed";
  if (signsMastered >= 5 || boardLevelsDone >= 5) return "practising";
  if (signsMastered > 0 || boardLevelsDone > 0) return "sampler";
  return "visitor";
}

type LearnerProfile = Record<string, string | number | boolean>;

function perDay(
  test: ReturnType<typeof readTestRecord>,
  levelsDone: number,
  course: ReturnType<typeof readCourse>,
): number {
  const day = today();
  const doneToday = course.daily?.day === day ? course.daily.done : 0;
  const plan = testPlan(test, levelsDone, COURSE_LEVELS.length, doneToday, day);
  return plan.kind === "levels" ? plan.perDay : 0;
}

function buildProfile(): LearnerProfile {
  const pelican = readProgress(TRAINER_STORAGE_KEYS.pelican);
  const signs3d = readProgress(TRAINER_STORAGE_KEYS["3d"]);

  const course = readCourse();

  const pelicanMastered = masteredSigns(pelican);
  const signs3dMastered = masteredSigns(signs3d);
  const boardLevelsDone = doneCount(course);
  const test = readTestRecord();

  return {
    signs_mastered_pelican: pelicanMastered,
    signs_mastered_3d: signs3dMastered,
    board_levels_done: boardLevelsDone,
    board_levels_total: COURSE_LEVELS.length,
    /** 0 to 100: the same "ready for the test" figure the course page shows. */
    board_readiness: readiness(course),
    board_mock_best_clean: course.mockBest?.clean ?? 0,
    learner_stage: learnerStage(
      pelicanMastered + signs3dMastered,
      boardLevelsDone,
    ),
    practice_streak_days: liveStreak(readPracticeStreak()).days,
    // The NTSA test, from the course page's card: when, and how it went.
    test_date: test.date ?? "",
    test_days_left_bucket: testBucket(test, today()),
    // Levels a day the test plan asks for (0 with no plan, or every level done).
    test_per_day: perDay(test, boardLevelsDone, course),
    test_result: test.result ?? "",
  };
}

/** Stable stamp for `$set_once`, so "days since first visit" is answerable. */
function firstSeenAt(): string {
  const existing = window.localStorage.getItem(FIRST_SEEN_KEY);
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    window.localStorage.setItem(FIRST_SEEN_KEY, now);
  } catch {
    // Private mode / storage full — the property just won't stick.
  }
  return now;
}

/** Board course progress in a few bands, for a GA user property. */
function levelsBucket(done: number): string {
  if (done >= COURSE_LEVELS.length) return "all";
  if (done >= 26) return "26+";
  if (done >= 5) return "5-25";
  if (done >= 1) return "1-4";
  return "0";
}

/**
 * Push the learner profile to PostHog (and the coarse part of it to Google
 * Analytics) on mount, on every route change, and
 * when the tab regains focus (a run finished in another tab counts).
 * Writes only when something actually changed, so it costs one `$set` at most
 * per navigation.
 */
export function useLearnerAnalytics() {
  const { pathname } = useLocation();
  const lastSent = React.useRef<string | null>(null);

  React.useEffect(() => {
    const sync = () => {
      const profile = buildProfile();
      // GA user properties: buckets only, GA reports can't use raw counts.
      gaSetUserProperties({
        learner_stage: profile.learner_stage,
        board_levels_bucket: levelsBucket(Number(profile.board_levels_done)),
        test_booked: profile.test_date ? "yes" : "no",
      });

      const posthog = getPostHog();
      if (!posthog) return;

      // Free for everyone: super properties don't create a person profile, so
      // even a bouncing visitor's events carry their stage.
      posthog.register({ learner_stage: profile.learner_stage });

      // Billable: `setPersonProperties` creates the profile under
      // `identified_only`. Hold off until they've done something real.
      if (profile.learner_stage === "visitor") return;

      const fingerprint = JSON.stringify(profile);
      if (fingerprint === lastSent.current) return;
      lastSent.current = fingerprint;

      posthog.setPersonProperties(profile, { first_seen_at: firstSeenAt() });
    };

    const syncOnHide = () => {
      // Leaving the tab is the last chance to record what someone did on the
      // page they're on — otherwise a learner who opens one lesson and closes
      // the tab never gets a profile, since the write is deferred to the next
      // navigation.
      if (document.visibilityState === "hidden") sync();
    };

    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", syncOnHide);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", syncOnHide);
    };
  }, [pathname]);
}
