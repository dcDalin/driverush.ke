/**
 * A proud moment, and the ask to share it: a unit or the whole course
 * finished, a run of days practising, a passed NTSA test
 * (`lib/proud-moments.ts`). One line that says what they did, one to send it
 * on, and the share sheet with its picture. Shown once per moment, ever: it
 * is marked offered as it appears.
 */
import * as React from "react";

import { ShareButton } from "~/components/brand/share-button";
import { analytics } from "~/lib/analytics";
import { markOffered, type ProudMoment } from "~/lib/proud-moments";
import { cn } from "~/lib/utils";

/**
 * What they did, said to them. A finished unit or course is already cheered
 * just above (`LevelCheer`), so the card goes straight to the ask.
 */
function said({ moment, n }: ProudMoment): string | null {
  switch (moment) {
    case "unit":
    case "course":
      return null;
    case "streak":
      return `${n} days in a row. That's how tests get passed.`;
    case "passed":
      return "You passed. Congratulations!";
  }
}

const ASK: Record<ProudMoment["moment"], string> = {
  unit: "Proud of that? Send it to a friend who's learning too.",
  course: "Proud of that? Tell the friend who's next for the test.",
  streak: "Get a friend practising with you.",
  passed: "Tell the friends still learning how you did it.",
};

export function ProudShare({
  moment,
  tone = "page",
  className,
}: {
  moment: ProudMoment;
  /** `game` sits on the board's dark cards. */
  tone?: "page" | "game";
  className?: string;
}) {
  const { moment: kind, n } = moment;
  React.useEffect(() => {
    markOffered({ moment: kind, n });
    analytics.proudShareShown({ moment: kind, n });
  }, [kind, n]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border-2 border-kenya-gold bg-surface px-4 py-3 text-left",
        // On the game's cards the tokens take their dark values.
        tone === "game" && "dark bg-paper-2",
        className,
      )}
    >
      <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] leading-snug text-ink">
        {said(moment) ? (
          <>
            <span className="block font-bold">{said(moment)}</span>
            <span className="text-ink-2">{ASK[kind]}</span>
          </>
        ) : (
          <span className="font-bold">{ASK[kind]}</span>
        )}
      </p>
      <ShareButton
        surface={`proud_${kind}`}
        payload={{ kind: "milestone", moment: kind, n }}
        label="Share it"
        variant="ink"
        size="default"
      />
    </div>
  );
}
