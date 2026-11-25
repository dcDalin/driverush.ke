import * as React from "react";
import { useLocation, useMatches } from "react-router";

import { gaEvent, type GaLanding, gaPageView } from "./ga";
import {
  cleanPath,
  INTERNAL_PATH_RE,
  NOT_FOUND_GROUP,
  pageMeta,
} from "./page-meta";
import { getPostHog, initPostHog } from "./posthog";

/**
 * Two sinks, one taxonomy.
 *
 * PostHog is the product-analytics system of record: it is initialised in
 * `entry.client.tsx` before hydration and handles pageviews, autocapture,
 * replay, heatmaps and exceptions on its own. Everything below adds the
 * *semantic* events autocapture can't infer — was the answer right, did the
 * lesson finish, did the learner hit a locked node.
 *
 * Google Analytics 4 gets the same events through `ga.ts`, with two
 * differences: where GA4 has a recommended event for the same thing
 * (`level_start`, `share`) it gets that name, so its built-in reports work,
 * and the few very high-volume events stay in PostHog only. GA page views
 * are sent by the `<head>` script (the landing page) and {@link usePageviews}
 * (every navigation after it). GA only measures driverush.ke; see `ga.ts`.
 *
 * Custom events go through {@link analytics} — a typed dispatch object so
 * call sites can't typo event names or invent ad-hoc params.
 */

/** Make sure PostHog is up. Safe to call repeatedly. */
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  // Normally already done in `entry.client.tsx`; this covers call sites that
  // can run before hydration finishes (e.g. the root ErrorBoundary).
  initPostHog();
}

export { getPostHog };

/**
 * The page being shown, labelled for GA: its cleaned path, content group and
 * route template. Works on the server, which is how the landing page view in
 * `<head>` gets its labels.
 */
export function useGaPage(): GaLanding {
  const location = useLocation();
  const matches = useMatches();
  const leaf = matches[matches.length - 1]?.id;
  return {
    path: cleanPath(location.pathname, location.search),
    ...pageMeta(leaf, location.pathname),
  };
}

/** The last page sent to GA, as a full cleaned URL: the next one's referrer. */
let lastPage: { pathname: string; url: string } | undefined;

/**
 * Sends a GA `page_view` for every in-app navigation to a new path. The
 * landing page is already sent by the `<head>` script, so the first run only
 * records it. A change of query alone (the next level inside the game) is
 * not a new page: level events cover it. Call once, from the root `Layout`,
 * so the error page is counted too.
 */
export function usePageviews() {
  const location = useLocation();
  const page = useGaPage();
  // A layout effect, so the page view is sent before any effect in the new
  // page runs: an event a page sends as it opens (`level_start`) is then
  // reported against that page, not the one before it. By now React has
  // already put the new page's <title> in place.
  React.useLayoutEffect(() => {
    const url = window.location.origin + page.path;
    const previous = lastPage;
    lastPage = { pathname: location.pathname, url };
    if (!previous || previous.pathname === location.pathname) return;
    if (INTERNAL_PATH_RE.test(location.pathname)) return;
    gaPageView({
      page_location: url,
      page_referrer: previous.url,
      page_title: document.title,
      content_group: page.content_group,
      page_template: page.page_template,
    });
    if (page.content_group === NOT_FOUND_GROUP) {
      gaEvent("page_not_found", { missing_path: location.pathname });
    }
  }, [location.pathname, page]);
}

/**
 * What GA gets for an event: `false` keeps it in PostHog only, an object
 * sends it under GA4's recommended name and parameters instead.
 */
type GaMapping = false | { name: string; params: Record<string, unknown> };

function emit(name: string, params?: Record<string, unknown>, ga?: GaMapping) {
  // In DEV, mirror the event to the console so we can verify dispatch
  // without digging through the network tab.
  if (import.meta.env.DEV) {
    console.log(`[analytics] ${name}`, params ?? {});
  }
  // PostHog is initialised before hydration, so this is normally a straight
  // capture; `initPostHog()` is the belt-and-braces path for anything that
  // fires earlier.
  (getPostHog() ?? initPostHog())?.capture(name, params);
  if (ga === false) return;
  if (ga) gaEvent(ga.name, ga.params);
  else gaEvent(name, params);
}

type RunStarted = {
  signsTotal: number;
  categories: readonly string[];
  scope: string;
};

function startedProps(args: RunStarted) {
  return {
    signs_total: args.signsTotal,
    categories: args.categories.length ? args.categories.join(",") : "all",
    scope: args.scope,
  };
}

type RunCompleted = {
  signsTotal: number;
  scope: string;
  /** Only known when the learner graded themselves. */
  graded?: { knewFirstTry: number; missCount: number };
};

function completedProps(args: RunCompleted) {
  return {
    signs_total: args.signsTotal,
    scope: args.scope,
    self_graded: args.graded != null,
    ...(args.graded
      ? {
          knew_first_try: args.graded.knewFirstTry,
          miss_count: args.graded.missCount,
        }
      : {}),
  };
}

type Level = {
  level: string;
  number: number;
  kind: "warmup" | "slides" | "lanes" | "watch" | "drive";
  unit: string;
};

/** GA4's `level_start` / `level_end` parameters for a course level. */
function gaLevel(args: Level) {
  return {
    level_name: args.level,
    level_number: args.number,
    level_kind: args.kind,
    unit: args.unit,
  };
}

/**
 * Typed event dispatcher. One method per event we care about; the keys are
 * the only names that should ever land in reports. If you need a new
 * event, add a method here rather than calling `emit` directly — it keeps
 * the report taxonomy stable and surfaces the full event list in one place.
 */
export const analytics = {
  // ----- top of funnel -----
  // The homepage sign check. Started → answered → completed → trainer is one
  // activation funnel; going straight to a trainer is the other.

  /** A sign question appeared in the homepage check. */
  signChallengeStarted: (args: { sign_id: string; category: string }) =>
    // One per question shown: PostHog only, the answers say more in GA.
    emit("sign_challenge_started", args, false),

  /** Visitor answered a homepage sign question. */
  signChallengeAnswered: (args: {
    sign_id: string;
    category: string;
    correct: boolean;
    /** 1-based index within this page visit — measures how many they play. */
    question_index: number;
  }) => emit("sign_challenge_answered", args),

  /** Visitor finished the ten-sign check on the homepage. */
  signCheckCompleted: (args: { correct: number; total: number }) =>
    emit("sign_check_completed", args),

  // ----- sign trainers -----

  /** Pelican chart run kicked off. */
  pelicanStarted: (args: RunStarted) =>
    emit("pelican_started", startedProps(args)),

  /** Pelican chart run finished. Hands-free runs have no grades to report. */
  pelicanCompleted: (args: RunCompleted) =>
    emit("pelican_completed", completedProps(args)),

  /** 3D signs run kicked off. */
  signs3dStarted: (args: RunStarted) =>
    emit("signs3d_started", startedProps(args)),

  /** 3D signs run finished. Hands-free runs have no grades to report. */
  signs3dCompleted: (args: RunCompleted) =>
    emit("signs3d_completed", completedProps(args)),

  /**
   * The 3D sign trainer could not show something, even after asking twice.
   * `model`: one sign's model (the learner is offered "Try again").
   * `logo`: the Pelican sticker's picture (the sign shows without it).
   * `download`: the trainer's own code (the learner is offered "Try again").
   */
  signs3dLoadFailed: (args: {
    reason: "model" | "logo" | "download";
    model?: string;
  }) => emit("signs3d_load_failed", args),

  /**
   * One "Knew it" or "Missed it" tap. Higher volume than the rest of this file,
   * and deliberately so: it's the only way to see which signs people actually
   * get wrong. PostHog only: in GA it would bury every other event.
   */
  signGraded: (args: {
    trainer: "pelican" | "3d";
    sign_code: string;
    category: string;
    result: "knew" | "missed";
    box_before: number;
    box_after: number;
    first_try: boolean;
    scope: string;
    /** On a miss: whether the tip was the sign's own guide or its class rule. */
    miss_tip?: "guide" | "class_rule";
  }) => emit("sign_graded", args, false),

  // ----- Model Town Board -----

  /**
   * A board round kicked off. A `round` with no tasks asked for is the mock
   * test (`mock: true`); a `drill` is one task or a chosen few.
   */
  boardStarted: (args: {
    challenges: number;
    scope: "round" | "drill";
    mock: boolean;
  }) => emit("board_started", args),

  /** The referee called a mistake. Shows which rules trip people up. PostHog only. */
  boardFaulted: (args: {
    challenge_id: string;
    rule: string;
    /**
     * Small mistakes cost a star; serious ones end the attempt. "route" is
     * leaving the task's route with no rule broken: the drive goes on, but it
     * cannot pass.
     */
    severity: "small" | "serious" | "route";
    /** 1 for the first fault on this challenge, and so on. */
    fault_number: number;
  }) => emit("board_faulted", args, false),

  /** A challenge was passed, cleanly or after faults. */
  boardChallengePassed: (args: {
    challenge_id: string;
    clean: boolean;
    faults: number;
    stars: number;
    seconds: number;
    /** Which attempt at the task it was passed on, from 1. */
    tries: number;
    /** Out of 1,000, from the mistakes and the time against par. */
    score: number;
    score_version: number;
    par_seconds: number;
    /** The score is the learner's best yet on this task. */
    best: boolean;
  }) =>
    emit("board_challenge_passed", args, {
      name: "post_score",
      params: { ...args, level_name: args.challenge_id },
    }),

  /** The learner stopped in the box after leaving the route: not a pass. */
  boardChallengeMissed: (args: {
    challenge_id: string;
    /** How the car left the route. */
    rule: string;
    tries: number;
    seconds: number;
    score: number;
    score_version: number;
  }) => emit("board_challenge_missed", args),

  /**
   * The learner opened a locked level after the "Skip ahead?" ask, from the
   * levels list or the arrows in the game. `next_level` is where Continue
   * would have taken them.
   */
  boardSkipAhead: (args: {
    to_level: string;
    next_level: string;
    surface: "levels_page" | "levels_sheet";
  }) => emit("board_skip_ahead", args),

  /** The learner left a round before the end. Shows where people give up. */
  boardAbandoned: (args: {
    challenge_id: string;
    /** What was on screen: driving, the examiner's card, the replay. */
    phase: string;
    /** The task's place in the round, from 1, and the round's length. */
    task: number;
    of: number;
    tries: number;
    /** False when they left without ever pushing the joystick. */
    moved: boolean;
    /** The car had left the task's route, so the attempt could not pass. */
    off_route: boolean;
  }) => emit("board_abandoned", args),

  /**
   * A board round finished. For the mock test, `best_before` is the most
   * clean tasks in an earlier mock (0 for the first) and `new_best` says this
   * one beat it.
   */
  boardCompleted: (args: {
    challenges: number;
    clean: number;
    fault_count: number;
    scope: "round" | "drill";
    mock: boolean;
    best_before?: number;
    new_best?: boolean;
  }) => emit("board_completed", args),

  /**
   * The board is drawn and on screen: `ms` from the viewer opening, so it
   * covers the scene download, the car models and the first paint. Shows
   * how long a learner on a cheap phone waits. PostHog only.
   */
  boardLoaded: (args: {
    ms: number;
    tier: "low" | "high";
    start_rung: number;
    weak_gpu: boolean;
  }) => emit("board_loaded", args, false),

  /**
   * The board could not be shown as it should. `no_webgl`: this browser can't
   * draw it at all. `download`: the scene failed to download. `models`: the
   * car models failed, so the plain built car is used.
   */
  boardLoadFailed: (args: {
    reason: "no_webgl" | "download" | "models";
    tier?: "low" | "high";
  }) => emit("board_load_failed", args),

  /** A slow phone gave up some picture quality, one rung down. PostHog only. */
  boardQualityDropped: (args: {
    tier: "low" | "high";
    from: number;
    to: number;
  }) => emit("board_quality_dropped", args, false),

  /** A board setting was changed in the settings sheet. PostHog only. */
  boardSettingChanged: (args: { setting: string; value: string }) =>
    emit("board_setting_changed", args, false),

  /** Learn mode opened on the board. */
  boardLearnOpened: () => emit("board_learn_opened", {}),

  /** Free drive was opened: the board with no task, every rule still judged. */
  boardFreeDriveStarted: (args: { surface: string }) =>
    emit("board_free_drive_started", args),

  /**
   * A free drive was left. How long it went on, how far the car went, and
   * which rules were broken (unique ids, comma-joined), to see what learners
   * get wrong when nobody tells them where to go.
   */
  boardFreeDriveEnded: (args: {
    seconds: number;
    metres: number;
    rules_broken: number;
    set_backs: number;
    rules: string;
    moved: boolean;
  }) => emit("board_free_drive_ended", args),

  /** A lesson's route was played back, or a board feature looked at. */
  boardLessonViewed: (args: {
    kind: "lane" | "feature" | "route" | "parking";
    lesson_id: string;
    /** Which of the lesson's correct ways was played, where it has more than one. */
    way?: number;
    ways?: number;
    way_kind?: "answer" | "also" | "longer" | "wrong_parking";
  }) => emit("board_lesson_viewed", args),

  /** A tab in the phone's bottom bar was tapped. Shows how people move about. */
  navTabClicked: (args: { tab: string; from: string }) =>
    emit("nav_tab_clicked", args),

  /** A level of the board course was opened, from the list or from Continue. */
  boardLevelStarted: (args: {
    level: string;
    number: number;
    kind: "warmup" | "slides" | "lanes" | "watch" | "drive";
    unit: string;
  }) =>
    emit("board_level_started", args, {
      name: "level_start",
      params: gaLevel(args),
    }),

  /** A level was finished: read or watched for the first time, or passed. */
  boardLevelCompleted: (args: {
    level: string;
    number: number;
    kind: "warmup" | "slides" | "lanes" | "watch" | "drive";
    unit: string;
  }) =>
    emit("board_level_completed", args, {
      name: "level_end",
      params: { ...gaLevel(args), success: true },
    }),

  /** A hint was used on a driving task. */
  boardHintUsed: (args: {
    challenge_id: string;
    kind: "next_step" | "show_me" | "after_fault";
  }) => emit("board_hint_used", args),

  /**
   * The first push of the stick on the first drive. `ms` is from the stick
   * coming alive (after the opening turn round the car) to that push;
   * `nudged` says the stick had started showing how to push it. PostHog only.
   */
  boardFirstMove: (args: {
    challenge_id: string;
    ms: number;
    input: "touch" | "keys";
    nudged: boolean;
  }) => emit("board_first_move", args, false),

  // ----- driving-school sponsors (see ~/lib/board/school-catalog) -----

  /**
   * A sponsoring school was on screen in one place, once per place per
   * visit. What schools are shown when we sell to them. PostHog only.
   */
  sponsorShown: (args: { school: string; place: string }) =>
    emit("sponsor_shown", args, false),

  /** Learner tapped through to a sponsoring school. */
  sponsorLinkClicked: (args: { school: string; place: string }) =>
    emit("sponsor_link_clicked", args),

  /** Outbound click to a credited source site. */
  partnerClicked: (args: { name: string; url: string }) =>
    emit("partner_clicked", {
      partner_name: args.name,
      partner_url: args.url,
    }),

  /**
   * Learner tapped a contact channel in the footer. Small numbers by design;
   * it's a direct-intent signal, so worth its own event rather than digging
   * it out of autocaptured link clicks.
   */
  contactClicked: (args: { channel: "phone" | "email"; location: string }) =>
    emit("contact_clicked", args, {
      name: "generate_lead",
      params: { method: args.channel, location: args.location },
    }),

  // ----- sharing -----
  // opened → completed measures how many people who reach for share actually
  // send something; `share_landing_viewed` closes the loop on the other side.

  /** Share affordance tapped (before any channel is chosen). */
  shareOpened: (args: { kind: string; surface: string }) =>
    emit("share_opened", args),

  /**
   * A proud moment was offered for sharing (`proud-share.tsx`): a unit or the
   * course finished, a run of days, a passed test. Once per moment. PostHog only.
   */
  proudShareShown: (args: { moment: string; n: number }) =>
    emit("proud_share_shown", args, false),

  /** A share was actually dispatched to a channel. */
  shareCompleted: (args: { kind: string; channel: string }) =>
    emit("share_completed", args, {
      name: "share",
      params: { method: args.channel, content_type: args.kind },
    }),

  /**
   * Someone opened a shared link. `valid: false` means the payload was junk.
   * A valid one also marks this browser, once and for good, with the kind of
   * share that brought it (`arrived_via_share`, a super property: no person
   * profile), so everything they do later can be tied back to the share.
   */
  shareLandingViewed: (args: { kind: string; valid: boolean }) => {
    if (args.valid) {
      (getPostHog() ?? initPostHog())?.register_once({
        arrived_via_share: args.kind,
      });
    }
    emit("share_landing_viewed", args);
  },

  // ----- the NTSA test itself -----
  // The card on the course page asks when the test is and, once that day has
  // passed, how it went. The result is the number that says DriveRush works.

  /** The learner gave their test date, or said it isn't booked yet. */
  testDateSet: (args: {
    booked: boolean;
    /** Days from today to the test; left out when not booked. */
    days_until?: number;
    /** Where it was asked. */
    surface: "course_page" | "level_done";
  }) => emit("test_date_set", args),

  /** The test card asked its question. PostHog only. */
  testCardShown: (args: {
    stage: "date" | "result";
    surface: "course_page" | "level_done";
  }) => emit("test_card_shown", args, false),

  /** A daily practice reminder was added to the learner's own calendar. */
  testReminderAdded: (args: {
    calendar: "google" | "ics";
    days_until: number;
  }) => emit("test_reminder_added", args),

  // ----- today's drive (one task a day, the same for everyone) -----

  /** A "Today's drive" row or link was tapped. */
  dailyDriveOpened: (args: {
    challenge_id: string;
    surface: "home" | "course_page" | "level_done" | "level_passed";
    /** It had already been passed today. */
    done_today: boolean;
  }) => emit("daily_drive_opened", args),

  /** The game opened on today's drive. */
  dailyDriveStarted: (args: { challenge_id: string }) =>
    emit("daily_drive_started", args),

  /** Today's drive was passed. `streak_days` counts today. */
  dailyDrivePassed: (args: {
    challenge_id: string;
    clean: boolean;
    stars: number;
    tries: number;
    streak_days: number;
  }) => emit("daily_drive_passed", args),

  /** The learner said how their NTSA test went. */
  testResultReported: (args: {
    result: "passed" | "failed" | "not_yet";
    days_after_test: number;
    levels_done: number;
    readiness: number;
    mock_best_clean: number;
  }) => emit("test_result_reported", args),

  /** "Not now" on the test card. PostHog only. */
  testCardDismissed: (args: { stage: "date" | "result" }) =>
    emit("test_card_dismissed", args, false),

  // ----- installing the app -----
  // shown → answered → installed. On iPhone there is no prompt to answer, so
  // only `shown` and a `closed` answer are ever seen there.

  /** The "add to home screen" card appeared. */
  installPromptShown: (args: { platform: "prompt" | "ios"; surface: string }) =>
    emit("install_prompt_shown", args),

  /** The learner answered it: the browser's own prompt, or Not now. */
  installPromptAnswered: (args: {
    platform: "prompt" | "ios";
    surface: string;
    outcome: "accepted" | "dismissed" | "closed";
  }) => emit("install_prompt_answered", args),

  /** The browser reports the app was installed, from our card or its menu. */
  appInstalled: () => emit("app_installed", {}),
};
