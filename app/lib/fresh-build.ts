/**
 * Keeps an app that stays open on the newest deploy. A full page load is
 * always fresh (the service worker asks the network for pages first), but the
 * app opened from the home screen can stay in memory for days, moving between
 * pages without loading a new document, so it would keep running the build it
 * started with.
 *
 * When the app comes back to the front, or moves to another page, it asks
 * the server which build is live (`/build.txt`, written by `vite.config.ts`).
 * If it is not this one, the next move to another page is a full load
 * instead, so the learner lands on the new build without a notice and never
 * mid-drive: nothing in a drive changes the address.
 */
import * as React from "react";
import { useLocation } from "react-router";

/** The commit this code was built from (`vite.config.ts`), or `dev`. */
const THIS_BUILD = import.meta.env.VITE_APP_VERSION as string | undefined;
/** Not `.json`: the service worker serves those from its cache first. */
export const BUILD_FILE = "/build.txt";
/** At most this often, so a learner flicking between apps costs nothing. */
const EVERY_MS = 5 * 60 * 1000;
/**
 * The live build a reload was last made for. If the page still runs older
 * code after it (a deploy gone wrong), it is not reloaded again on every move.
 */
const RELOADED_FOR = "driverush:reloaded-for";

function reloadedFor(): string | null {
  try {
    return window.sessionStorage.getItem(RELOADED_FOR);
  } catch {
    return null;
  }
}

export function useFreshBuild(): void {
  const location = useLocation();
  /** The newer build that is live, once seen. */
  const stale = React.useRef<string | null>(null);
  const checked = React.useRef(0);

  const check = React.useCallback(async () => {
    if (!import.meta.env.PROD || !THIS_BUILD || THIS_BUILD === "dev") return;
    if (stale.current || Date.now() - checked.current < EVERY_MS) return;
    checked.current = Date.now();
    try {
      const response = await fetch(BUILD_FILE, { cache: "no-store" });
      if (!response.ok) return;
      const live = (await response.text()).trim();
      if (live && live !== THIS_BUILD && live !== reloadedFor()) {
        stale.current = live;
      }
    } catch {
      // Offline: carry on with the build already running.
    }
  }, []);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  // A move to another page or level (not a #jump on the same page).
  const page = location.pathname + location.search;
  const was = React.useRef(page);
  React.useEffect(() => {
    if (was.current === page) return;
    was.current = page;
    if (stale.current) {
      // The address is already the new page: load it whole, on the new build.
      try {
        window.sessionStorage.setItem(RELOADED_FOR, stale.current);
      } catch {
        // Without storage it may reload once more on a later move. Fine.
      }
      window.location.reload();
      return;
    }
    void check();
  }, [page, check]);
}

/** The address a "No route matches" reload was last made for. */
const RELOADED_404 = "driverush:reloaded-404";

/**
 * A move inside the app that ends on "No route matches", on a page the server
 * has. React Router finds pages it has not loaded yet by asking the server
 * (`/__manifest`). After a deploy, or when an old page comes back from the
 * browser's back cache, it can give up on that and call a real page missing.
 * A whole load lets the server decide: a real page opens, a missing one comes
 * back as the server's own "Road closed", which is then not reloaded again.
 * Never true while rendering on the server or for the document's own address.
 */
export function shouldLoadWhole(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  const response = error as { status?: unknown; internal?: unknown } | null;
  if (response?.status !== 404 || response.internal !== true) return false;
  const here = window.location.pathname;
  const entry = performance.getEntriesByType?.("navigation")[0];
  if (!entry) return false;
  let loaded: string;
  try {
    loaded = new URL(entry.name).pathname;
  } catch {
    return false;
  }
  if (loaded === here) return false;
  try {
    return window.sessionStorage.getItem(RELOADED_404) !== here;
  } catch {
    return true;
  }
}

/** Loads the address whole, once (see `shouldLoadWhole`). */
export function loadWhole(): void {
  try {
    window.sessionStorage.setItem(RELOADED_404, window.location.pathname);
  } catch {
    // The document's own address still stops a second reload.
  }
  window.location.reload();
}
