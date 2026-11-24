/**
 * "Add to home screen", offered once a learner has finished a level. Two ways
 * in, one card:
 *  - Chrome, Edge and Samsung Internet hand over an install prompt, and "Add
 *    it" opens it.
 *  - Safari on an iPhone or iPad has no prompt, so the card says where the
 *    button is: Share, then Add to Home Screen.
 * Never shown in the installed app itself, and never again once it has been
 * used or closed, wherever that happened (one key for every place it sits).
 */
import * as React from "react";

import { analytics } from "~/lib/analytics";
import {
  heldPrompt,
  installSettled,
  isInstalled,
  onPromptChange,
  settleInstall,
  forgetPrompt,
  type InstallEvent,
} from "~/lib/install";
import { cn } from "~/lib/utils";

import { Icon } from "~/components/brand/icon";
import { ShareIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";

/**
 * Safari on an iPhone or iPad, where Share has "Add to Home Screen". Other
 * iOS browsers and the apps' own browsers (Instagram, TikTok, Facebook) are
 * left out: their share menus differ or lack it, so the note would mislead.
 */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios || !/Safari/.test(ua)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\/|musical_ly|TikTok|Snapchat|Twitter/.test(
    ua,
  );
}

type Way = { kind: "prompt"; event: InstallEvent } | { kind: "ios" };

export function InstallNudge({
  surface,
  tone = "page",
  className,
}: {
  /** Where it sits, for analytics: `levels_page`, `level_passed`, … */
  surface: string;
  /** `game` sits on the board's dark cards. */
  tone?: "page" | "game";
  className?: string;
}) {
  const [way, setWay] = React.useState<Way | null>(null);

  React.useEffect(() => {
    if (installSettled() || isInstalled()) return;
    if (isIosSafari()) {
      setWay({ kind: "ios" });
      return;
    }
    const tell = (e: InstallEvent | null) =>
      setWay(e ? { kind: "prompt", event: e } : null);
    tell(heldPrompt());
    return onPromptChange(tell);
  }, []);

  const shownFor = way?.kind;
  React.useEffect(() => {
    if (shownFor) analytics.installPromptShown({ platform: shownFor, surface });
  }, [shownFor, surface]);

  if (!way) return null;

  const close = () => {
    settleInstall("closed");
    analytics.installPromptAnswered({
      platform: way.kind,
      surface,
      outcome: "closed",
    });
    setWay(null);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-ink/25 bg-surface px-4 py-3 text-left",
        // On the game's cards the tokens take their dark values.
        tone === "game" && "dark bg-paper-2",
        className,
      )}
    >
      {way.kind === "prompt" ? (
        <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] font-semibold leading-snug text-ink">
          Keep DriveRush on your home screen, one tap from your next level.
        </p>
      ) : (
        <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] leading-snug text-ink">
          <span className="font-semibold">
            Keep DriveRush on your home screen.
          </span>{" "}
          Tap{" "}
          <span className="inline-flex translate-y-0.5 items-center gap-0.5 font-semibold">
            <Icon icon={ShareIcon} size={16} aria-label="Share" />
            Share
          </span>{" "}
          in Safari, then Add to Home Screen.
        </p>
      )}
      <span className="flex items-center gap-1">
        {way.kind === "prompt" && (
          <Button
            variant="ink"
            onClick={async () => {
              const { event } = way;
              await event.prompt();
              const choice = await event.userChoice;
              forgetPrompt();
              settleInstall(choice.outcome);
              analytics.installPromptAnswered({
                platform: "prompt",
                surface,
                outcome: choice.outcome,
              });
              setWay(null);
            }}
          >
            Add it
          </Button>
        )}
        <Button variant="quiet" onClick={close} className="px-3 text-[13.5px]">
          {way.kind === "prompt" ? "Not now" : "Got it"}
        </Button>
      </span>
    </div>
  );
}
