import * as React from "react";

import { SITE } from "~/lib/site";

/**
 * Light/dark theme — a deliberately tiny system. There's no provider and no
 * library: the active theme is just a `dark` class on <html>, stamped before
 * the first paint by {@link THEME_INIT_SCRIPT} so there's never a flash. The
 * OS setting is the default; the moment the user picks a side we remember it
 * in localStorage and stop following the OS.
 */

export type Theme = "light" | "dark";

/** localStorage key holding the user's explicit choice (`"light"` | `"dark"`). */
export const THEME_STORAGE_KEY = "dr-theme";

const MEDIA = "(prefers-color-scheme: dark)";

/**
 * Inline `<head>` script. Runs synchronously before the first paint: honours a
 * saved choice, otherwise the OS `prefers-color-scheme`, then stamps both the
 * `dark` class and `color-scheme` onto <html> so the brand tokens flip *and*
 * native chrome (scrollbars, date pickers) matches.
 *
 * @example
 *   // in root.tsx <head>:
 *   <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
 */
export const THEME_INIT_SCRIPT = `try{var k='${THEME_STORAGE_KEY}',s=localStorage.getItem(k),d=s?s==='dark':matchMedia('${MEDIA}').matches,e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}`;

/** The theme currently applied to the document (read off the <html> class). */
export function getActiveTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Reactively track the theme applied to the document (the `dark` class on
 * <html>). Updates when the user toggles, the OS changes, or another tab flips
 * it — all of which ultimately mutate that class. SSR-safe: renders `"light"`
 * on the server, then corrects on mount.
 */
export function useActiveTheme(): Theme {
  const [theme, setTheme] = React.useState<Theme>(() => getActiveTheme());
  React.useEffect(() => {
    const sync = () => setTheme(getActiveTheme());
    sync(); // catch any flip between first render and this effect
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return theme;
}

/** The OS preference, or `"light"` when it can't be read. */
function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia(MEDIA).matches
    ? "dark"
    : "light";
}

/** True once the user has explicitly chosen — then we stop tracking the OS. */
function hasStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

/** Apply a theme to the document. `persist: false` skips writing localStorage. */
export function applyTheme(theme: Theme, { persist = true } = {}) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.style.colorScheme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // private mode / storage off — the choice just won't survive a reload.
    }
  }
}

/** Flip light↔dark, remember the new choice, and return it. */
export function toggleTheme(): Theme {
  const next: Theme = getActiveTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

/**
 * Keep the document theme in step with the world while a page is open: follow
 * live OS changes (until the user makes a choice) and mirror choices made in
 * other tabs. Mount once, high in the tree — see `root.tsx`.
 */
export function useThemeSync() {
  React.useEffect(() => {
    const mq = window.matchMedia(MEDIA);

    const onOSChange = () => {
      if (!hasStoredTheme()) {
        applyTheme(mq.matches ? "dark" : "light", { persist: false });
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== THEME_STORAGE_KEY) return;
      const v = e.newValue;
      applyTheme(v === "dark" || v === "light" ? v : systemTheme(), {
        persist: false,
      });
    };

    mq.addEventListener("change", onOSChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onOSChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}

/*
 * The status bar. A phone colours it from the first `<meta name="theme-color">`
 * that applies. The server sends two, one per OS colour scheme (see
 * `themeColorMeta` in `app/lib/site.ts`), but the theme toggle can disagree
 * with the OS and the game wants its own dark. So the page puts one more tag of
 * its own first in <head>, with no `media`, and keeps that one right. React's
 * tags are never edited: a changed tag no longer matches at hydration, and
 * React adds a second copy.
 */

/** Set on <html> while something (the game) wants its own status bar colour. */
const COLOR_OVERRIDE = "themeColor";
const LIVE_ID = "dr-theme-color";

/**
 * Inline script for <head>, after {@link THEME_INIT_SCRIPT}: adds the page's
 * own tag before first paint, for a learner whose saved theme differs from
 * their OS.
 */
export const THEME_COLOR_SCRIPT = `try{var m=document.createElement('meta');m.name='theme-color';m.id='${LIVE_ID}';m.content=document.documentElement.classList.contains('dark')?'${SITE.themeColors.dark}':'${SITE.themeColors.light}';document.head.prepend(m)}catch(e){}`;

function writeThemeColor() {
  const el = document.documentElement;
  const color =
    el.dataset[COLOR_OVERRIDE] ||
    (el.classList.contains("dark")
      ? SITE.themeColors.dark
      : SITE.themeColors.light);
  let meta = document.getElementById(LIVE_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.id = LIVE_ID;
  }
  // First in <head>, so it is the tag the browser reads.
  if (document.head.firstElementChild !== meta) document.head.prepend(meta);
  if (meta.content !== color) meta.content = color;
}

/**
 * Keep the status bar colour right while the page is open: on a theme change
 * and when a page asks for its own colour. Mount once.
 */
export function useThemeColorSync() {
  React.useEffect(() => {
    writeThemeColor();
    const obs = new MutationObserver(writeThemeColor);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme-color"],
    });
    return () => obs.disconnect();
  }, []);
}

/**
 * Give the status bar this colour while the calling component is mounted (the
 * game: its dark board runs to the top edge). Back to the theme's on unmount.
 */
export function useThemeColor(color: string) {
  React.useEffect(() => {
    const el = document.documentElement;
    el.dataset[COLOR_OVERRIDE] = color;
    return () => {
      delete el.dataset[COLOR_OVERRIDE];
    };
  }, [color]);
}
