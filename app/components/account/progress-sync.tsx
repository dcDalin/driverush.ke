/**
 * Runs progress saving for the whole app (mounted once in the shell):
 *
 *   - signed in: keeps progress on the account (`~/lib/progress/sync`);
 *   - signed out after being signed in: clears the phone and reloads, so the
 *     next person starts clean;
 *   - a guest: once per visit, a quiet toast that their progress is not saved,
 *     the first time they make some (or at once if progress from before
 *     accounts is waiting), with a button that opens the sign-in sheet.
 */
import * as React from "react";
import { toast } from "sonner";

import { useSession } from "~/lib/auth/session";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";
import { LEGACY_KEY, PROGRESS_KEYS } from "~/lib/progress/keys";

const NUDGED_KEY = "driverush:nudged";
const WATCH_EVERY_MS = 3000;

function snapshot() {
  return Object.values(PROGRESS_KEYS)
    .map((key) => window.localStorage.getItem(key) ?? "")
    .join("\u0000");
}

export function ProgressSync() {
  const session = useSession();
  const show = useSignInSheet((s) => s.show);
  const userId = session.status === "signed-in" ? session.user.id : null;
  const wasSignedIn = React.useRef(false);

  // Signed in: sync.
  React.useEffect(() => {
    if (!userId) return;
    wasSignedIn.current = true;
    let stop: (() => void) | undefined;
    let live = true;
    void import("~/lib/progress/sync").then(({ startProgressSync }) => {
      if (!live) return;
      stop = startProgressSync(userId, ({ reloading, downloaded }) => {
        if (!reloading && downloaded === 0) return;
        toast.success("Your saved progress is on this phone.");
      });
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [userId]);

  // Signed out after being signed in: clear the phone.
  React.useEffect(() => {
    if (session.status !== "signed-out" || !wasSignedIn.current) return;
    wasSignedIn.current = false;
    void import("~/lib/progress/sync").then(({ clearAccountProgress }) => {
      clearAccountProgress();
      window.location.reload();
    });
  }, [session.status]);

  // A guest: nudge once per visit.
  React.useEffect(() => {
    if (session.status !== "signed-out") return;
    if (window.sessionStorage.getItem(NUDGED_KEY)) return;
    const nudge = (message: string) => {
      window.sessionStorage.setItem(NUDGED_KEY, "1");
      toast(message, {
        duration: 10000,
        action: { label: "Save it", onClick: () => show("save-progress") },
      });
    };
    if (window.localStorage.getItem(LEGACY_KEY)) {
      nudge(
        "Your progress from before is kept. Sign in to save it to your account.",
      );
      return;
    }
    const start = snapshot();
    const timer = window.setInterval(() => {
      if (snapshot() === start) return;
      window.clearInterval(timer);
      nudge("Your progress is not saved. Sign in to keep it.");
    }, WATCH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [session.status, show]);

  return null;
}
