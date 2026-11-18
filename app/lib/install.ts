/**
 * Installing DriveRush to the home screen. Imported by `root.tsx` so the
 * listeners are up from the first load: browsers fire `beforeinstallprompt`
 * once, early, long before the card that uses it is on screen (it sits at the
 * end of a level, in a part of the app loaded later). See `InstallNudge`.
 */
import { analytics } from "~/lib/analytics";

export type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Remembers that the card was used or closed, so it is never shown again. */
export const INSTALL_KEY = "driverush:install";

let held: InstallEvent | null = null;
const listeners = new Set<(e: InstallEvent | null) => void>();

/** The browser's install prompt, when it has handed one over. */
export function heldPrompt(): InstallEvent | null {
  return held;
}

/** Called with the prompt when one arrives, and with null once it is used. */
export function onPromptChange(tell: (e: InstallEvent | null) => void) {
  listeners.add(tell);
  return () => {
    listeners.delete(tell);
  };
}

/** The prompt can only be shown once; forget it after. */
export function forgetPrompt() {
  held = null;
  for (const tell of listeners) tell(null);
}

export function settleInstall(how: string): void {
  try {
    window.localStorage.setItem(INSTALL_KEY, how);
  } catch {
    // Private mode: it may be offered again, which is harmless.
  }
}

export function installSettled(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_KEY) != null;
  } catch {
    return true;
  }
}

/** Already running from the home screen. */
export function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    held = e as InstallEvent;
    for (const tell of listeners) tell(held);
  });
  // From our card or from the browser's own menu.
  window.addEventListener("appinstalled", () => {
    settleInstall("installed");
    analytics.appInstalled();
    forgetPrompt();
  });
}
