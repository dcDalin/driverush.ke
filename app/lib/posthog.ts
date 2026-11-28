/**
 * PostHog browser client — one start, one accessor.
 *
 * Started from `entry.client.tsx` at the same moment as the page, but never
 * in its way (owner, 2026-11-28): posthog-js (about 75 KB compressed) is
 * fetched by a dynamic import while React hydrates, instead of every page
 * waiting for it before it can start. Autocapture, replay, the first
 * pageview and exception capture begin when it arrives, a moment after the
 * page. Anything the app sends before then waits in a queue
 * ({@link withPostHog}) and goes out once it is up, with the time it
 * happened. A missing PostHog config is never allowed to break the app.
 *
 * Config is read from Vite env:
 *   VITE_PUBLIC_POSTHOG_PROJECT_TOKEN   project write key
 *   VITE_PUBLIC_POSTHOG_HOST            https://us.i.posthog.com | eu…
 *
 * In DEV a missing variable throws loudly (silently-missed events are worse
 * than a red screen while wiring things up). In PROD it is a no-op.
 */
import type { PostHog } from "posthog-js";

import { pageMetaForPath } from "./page-meta";

const TOKEN = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

/**
 * Routes that exist for us, not for learners: the internal authoring tools.
 * Their traffic would otherwise inflate every top-of-funnel number we look at.
 */
const INTERNAL_PATH_RE = /^\/tools(\/|$)/;

/**
 * Stamped on every event so localhost and preview traffic can be excluded in
 * PostHog with a single `app_env = production` filter (or kept, when you want
 * to verify an integration).
 */
export const APP_ENV = import.meta.env.PROD ? "production" : "development";

const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "dev";

let client: PostHog | undefined;
let starting: Promise<PostHog | undefined> | undefined;
/** Calls made before the client arrived, run in order once it has. */
const waiting: ((posthog: PostHog) => void)[] = [];

/**
 * Starts loading and initialising the browser client, once. Resolves to the
 * client, or `undefined` when PostHog isn't configured, fails to load (an ad
 * blocker), or this is the server. Never awaited before hydration.
 */
export function startPostHog(): Promise<PostHog | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  starting ??= load().catch((error: unknown) => {
    // Blocked or offline: the app carries on without analytics. In
    // development a missing setting is said out loud.
    if (import.meta.env.DEV) console.error(error);
    waiting.length = 0;
    return undefined;
  });
  return starting;
}

/**
 * Runs `run` with the client: now if it is up, else once it has loaded.
 * Dropped when PostHog is off or never loads.
 */
export function withPostHog(run: (posthog: PostHog) => void) {
  if (client) {
    run(client);
    return;
  }
  if (typeof window === "undefined") return;
  waiting.push(run);
  void startPostHog();
}

async function load(): Promise<PostHog | undefined> {
  if (!TOKEN || !HOST) {
    if (import.meta.env.DEV) {
      const missing = !TOKEN
        ? "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "VITE_PUBLIC_POSTHOG_HOST";
      throw new Error(
        `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`,
      );
    }
    waiting.length = 0;
    return undefined;
  }

  const { default: posthog } = await import("posthog-js");
  posthog.init(TOKEN, {
    // In production events go through our own domain (`/ingest`, rewritten
    // to PostHog in `vercel.json`), so ad blockers that block posthog.com
    // don't silently drop a share of learners. `ui_host` keeps the toolbar
    // and replay links pointing at PostHog itself.
    api_host: import.meta.env.PROD ? "/ingest" : HOST,
    ui_host: HOST.replace(".i.posthog.com", ".posthog.com"),
    // Pins the SDK's default behaviours (SPA pageviews via history_change,
    // strict replay minimum duration, head script injection so SSR hydration
    // stays clean). Bumping this date changes defaults — do it deliberately.
    defaults: "2026-01-30",
    // Most traffic here is SEO drive-by that never touches a lesson, and
    // person-profile events cost several times what anonymous ones do. So:
    // stay anonymous by default, and let `use-learner-analytics.ts` create a
    // profile (via `setPersonProperties`) the moment someone shows real
    // learner intent. Retention and cohorts still work for everyone who
    // matters, without paying for bounces.
    person_profiles: "identified_only",
    // Error tracking for uncaught errors + unhandled rejections. The root
    // ErrorBoundary additionally reports React render errors.
    capture_exceptions: true,
    capture_dead_clicks: true,
    enable_heatmaps: true,
    capture_performance: { web_vitals: true },
    session_recording: {
      // Learners type free text into practice inputs; mask by default and
      // opt individual nodes out with `data-ph-mask` if anything slips.
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
      // Record the 3D board, so a replay shows what the car did and not an
      // empty box. Kept cheap for low-end phones: 2 frames a second, at half
      // resolution, low quality. Only the board takes part: it keeps its
      // drawing buffer (`board-table.tsx`) so a snapshot never wipes it. Any
      // other WebGL canvas must sit inside `.ph-no-capture` (as the 3D sign
      // trainer does), because the recorder clears a WebGL canvas that
      // doesn't keep its buffer before reading it, and that canvas would
      // flicker blank on the learner's screen.
      captureCanvas: {
        recordCanvas: true,
        canvasFps: 2,
        canvasQuality: "0.4",
      },
      canvasCapture: { resolutionScale: 0.5 },
    },
    debug: import.meta.env.DEV,
    before_send: (event) => {
      if (!event) return event;
      const path =
        typeof window !== "undefined" ? window.location.pathname : "/";
      // Drop internal-tool traffic entirely rather than filtering it in every
      // insight later.
      if (INTERNAL_PATH_RE.test(path)) return null;
      // The page's type ("Sign page", "Board game") on every event, as GA
      // has it, so content can be compared with content. Worked out from the
      // path, because PostHog sends a page view before React draws the page.
      const meta = pageMetaForPath(path);
      event.properties = { ...event.properties, ...meta };
      return event;
    },
    loaded: (ph) => {
      ph.register({
        app_env: APP_ENV,
        // The commit this build came from (see `vite.config.ts`), so a spike
        // in errors or a drop in a funnel can be tied to the deploy.
        app_version: APP_VERSION,
        display_mode: displayMode(),
        ...connection(),
      });
    },
  });

  client = posthog;
  for (const run of waiting.splice(0)) run(posthog);
  return client;
}

/** The client if it has loaded, else `undefined`. Prefer {@link withPostHog}. */
export function getPostHog(): PostHog | undefined {
  return client;
}

/**
 * Opened from the home screen (`standalone`) or in a browser tab (`browser`),
 * stamped on every event so installed learners can be compared with the rest.
 */
function displayMode(): "standalone" | "browser" {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? "standalone" : "browser";
}

/**
 * How good this learner's connection is, as the browser judges it (`4g`,
 * `3g`, `2g`, `slow-2g`), and whether they asked for data saving. Most of
 * Kenya is on mobile data, so this splits the numbers by what really slows
 * the board down. Safari doesn't say: `unknown`.
 */
function connection(): { connection: string; save_data: boolean } {
  const info = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  return {
    connection: info?.effectiveType ?? "unknown",
    save_data: info?.saveData === true,
  };
}
