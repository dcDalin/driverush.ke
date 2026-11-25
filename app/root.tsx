import { TabBar } from "~/components/brand/tab-bar";
import { AccountShell } from "~/components/account/account-shell";
import { ProgressSync } from "~/components/account/progress-sync";
import { guestVisitScript } from "~/lib/progress/guest-visit";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import * as React from "react";

import type { Route } from "./+types/root";
import "./app.css";
import "./motion.css";
import "./pwa.css";
import { Toaster } from "~/components/ui/sonner";
import { Button } from "~/components/ui/button";
import { NavigationProgressBar } from "~/components/brand/navigation-progress-bar";
import { RoadClosedScene, ScenePlate } from "~/components/brand/art/scenes";
import {
  THEME_COLOR_SCRIPT,
  THEME_INIT_SCRIPT,
  useThemeColorSync,
  useThemeSync,
} from "~/lib/theme";
import { SITE, absUrl, appMeta } from "~/lib/site";
import {
  getPostHog,
  initAnalytics,
  useGaPage,
  usePageviews,
} from "~/lib/analytics";
import { shouldMeasure } from "~/lib/bot-traffic";
import { loadWhole, shouldLoadWhole, useFreshBuild } from "~/lib/fresh-build";
import { TrafficLoader } from "~/components/brand/traffic-loader";
import { GA_MEASUREMENT_ID, gaHeadScript } from "~/lib/ga";
import { useLearnerAnalytics } from "~/lib/use-learner-analytics";
// Catches the browser's install prompt from the first load.
import "~/lib/install";

const GUEST_VISIT_SCRIPT = guestVisitScript(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? import.meta.env.VITE_SUPABASE_URL
    : undefined,
);

const BOARD_INIT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("driverush:board")||"{}").state;if(s&&((s.learned&&s.learned.length)||(s.bestStars&&Object.keys(s.bestStars).length)))document.documentElement.dataset.board="started"}catch(e){}`;

/**
 * Whether Google Analytics measures this visit: not for a bot, or for a
 * browser run from a data centre (`bot-traffic.ts`). Decided once, from the
 * request that loads the page, and kept for every navigation after it.
 */
export function loader({ request }: Route.LoaderArgs) {
  return { measure: shouldMeasure(request) };
}

export function shouldRevalidate() {
  return false;
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
  },
  // Favicons. Explicit links so browsers and crawlers pick the right size
  // instead of guessing from /favicon.ico alone.
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  // Sharp at any size and any screen density; browsers that read SVG
  // favicons prefer it to the PNGs below. All drawn by `npm run build:brand`.
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon-16x16.png",
  },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/manifest.webmanifest" },
];

/**
 * Site-wide meta defaults. Route-level `meta()` exports merge with these and
 * override by `name` / `property` / `title`. The default OG/Twitter image is
 * the DriveRush lockup; routes with a better card override `og:image`.
 */
export function meta() {
  const ogImage = absUrl(SITE.ogImage);
  return [
    ...appMeta(),
    { name: "robots", content: "index, follow" },
    { name: "format-detection", content: "telephone=no" },
    { property: "og:site_name", content: SITE.name },
    { property: "og:locale", content: SITE.locale },
    { property: "og:type", content: "website" },
    { property: "og:image", content: ogImage },
    { property: "og:image:width", content: String(SITE.ogImageWidth) },
    { property: "og:image:height", content: String(SITE.ogImageHeight) },
    { property: "og:image:alt", content: SITE.ogImageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
    { name: "twitter:image:alt", content: SITE.ogImageAlt },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Track live OS changes / cross-tab choices. The toggle itself lives in the
  // main nav (see <AppBar>) — it used to float over every page, which got in
  // the way of the games on mobile.
  useThemeSync();
  useThemeColorSync();
  // Google Analytics: the landing page is sent from <head> (below), every
  // navigation after it from here. In Layout, not App, so the error page is
  // counted too. The landing labels are kept from the first render: the
  // script has run by then, and its text must not change.
  const gaPage = useGaPage();
  const [gaLanding] = React.useState(gaPage);
  // Missing on the error page when the root itself failed: measure then.
  const measure = useRouteLoaderData<typeof loader>("root")?.measure ?? true;
  usePageviews();
  // An app left open loads a newer deploy on its next move to another page.
  useFreshBuild();
  // The service worker (`public/sw.js`) keeps opened pages and the board's
  // files for when there is no connection. Not in development, where it would
  // serve stale files.
  React.useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    let checked = Date.now();
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((r) => {
          registration = r;
          // After a deploy: the worker saves the new game files if the build
          // changed them (see `refresh` in `public/sw.js`).
          r.active?.postMessage("refresh");
        })
        .catch(() => {
          // No worker only means no offline copy.
        });
    };
    // Opened from the home screen, the app can stay open for days and moves
    // between pages without loading a new document, so the browser seldom
    // asks for a new worker. Ask when it comes back to the front, at most
    // hourly. The worker takes over by itself, and pages are always fetched
    // fresh, so no "new version" notice is needed.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      if (Date.now() - checked < 60 * 60 * 1000) return;
      checked = Date.now();
      registration.update().catch(() => {});
      registration.active?.postMessage("refresh");
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return (
    // The theme init script writes `style="color-scheme: …"` on <html> before
    // React hydrates (so light/dark settles without a flash). That edit comes
    // from outside React's tree, so suppress the hydration diff on this node.
    <html lang={SITE.lang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {/* `viewport-fit=cover` lets the page run under the notch and the
            home bar, so the `env(safe-area-inset-*)` padding on the tab bar,
            the top bar and the game's controls takes effect. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Settle light/dark before first paint — no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* The status bar's colour, by the same theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SCRIPT }} />
        {/* A guest's progress lasts one visit: cleared before any store
            reads it (`~/lib/progress/guest-visit.ts`). Before the board
            marker below, which reads the same key. */}
        {GUEST_VISIT_SCRIPT && (
          <script dangerouslySetInnerHTML={{ __html: GUEST_VISIT_SCRIPT }} />
        )}
        {/* A learner who has started the board course: marked before first
            paint, so the page opens as theirs (`course-label.css`). */}
        <script dangerouslySetInnerHTML={{ __html: BOARD_INIT_SCRIPT }} />
        <Meta />
        {/* After <Meta />, so the landing page view has the page's title. */}
        {GA_MEASUREMENT_ID && measure && (
          <script
            dangerouslySetInnerHTML={{ __html: gaHeadScript(gaLanding) }}
          />
        )}
        <Links />
      </head>
      <body>
        <NavigationProgressBar />
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();
  const firstPath = React.useRef(location.pathname);
  const navigated = React.useRef(false);
  if (location.pathname !== firstPath.current) navigated.current = true;
  // Keeps PostHog person properties (signs mastered) in step with the local
  // progress stores. PostHog itself is initialised in
  // `entry.client.tsx`, before hydration.
  useLearnerAnalytics();
  return (
    <>
      {/* Keyed so each new page gets a fresh entrance. There's no exit, so a tap
          never waits on the old page, and the first load isn't animated. */}
      <div
        key={location.pathname}
        className={navigated.current ? "dr-page" : undefined}
      >
        <Outlet />
      </div>
      <TabBar />
      {/* The sign-in sheet, loaded the first time something opens it. */}
      <AccountShell />
      {/* Saves a signed-in learner's progress; nudges a guest to sign in. */}
      <ProgressSync />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // A real page this build could not find after a move: load it whole
  // instead of saying it is missing (see `shouldLoadWhole`).
  const reloading = React.useMemo(() => shouldLoadWhole(error), [error]);
  React.useEffect(() => {
    if (reloading) {
      loadWhole();
      return;
    }
    void initAnalytics().then(() => {
      getPostHog()?.captureException(error);
    });
  }, [error, reloading]);

  if (reloading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <TrafficLoader size="md" aria-label="Loading the page" />
      </main>
    );
  }

  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Road closed." : "Something broke.";
    details =
      error.status === 404
        ? "There is no page at this address. The board and the signs are still open."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-5 pb-16 pt-12 text-ink">
      {/* Read by the tab and by Google Analytics' page title report. */}
      <title>{`${
        isRouteErrorResponse(error) && error.status === 404
          ? "Page not found"
          : "Something went wrong"
      } · ${SITE.name}`}</title>
      <ScenePlate>
        <RoadClosedScene title="A road barrier with a number plate reading KDR 404" />
      </ScenePlate>
      <div className="grid gap-3">
        <h1 className="m-0 font-display text-[clamp(30px,7vw,48px)] font-semibold leading-[0.95] tracking-tighter">
          {message}
        </h1>
        <p className="m-0 font-serif text-lg leading-snug text-ink-2">
          {details}
        </p>
        <Button variant="rush" size="lg" asChild className="mt-2 w-fit">
          <Link to="/model-town-board">Go to the Model Town Board</Link>
        </Button>
      </div>
      {stack && (
        <pre className="w-full overflow-x-auto border border-line bg-paper-3 p-4 text-xs rounded-lg">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
