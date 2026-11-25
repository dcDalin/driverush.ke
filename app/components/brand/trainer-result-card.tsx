/**
 * The end of a run, shared by both trainers. It answers "what next?": the signs
 * you missed, one tap to drill them, and a link to try the same signs in the
 * other trainer. That last one is the moat at work: chart and 3D feed each other.
 */
import { motion, type Variants } from "framer-motion";
import type * as React from "react";
import { Link } from "react-router";

import { RoundDoneScene } from "~/components/brand/art/scenes";
import { CelebrationConfetti } from "~/components/brand/celebration-confetti";
import { ConfirmAction } from "~/components/brand/confirm-action";
import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  CloseIcon,
  RefreshIcon,
} from "~/components/brand/icons";
import { ShareButton } from "~/components/brand/share-button";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import pelican from "~/data/road-signs-pelican.json";
import { type FocusRegion, regionSpriteStyle } from "~/lib/image-focus";
import { ease } from "~/lib/motion";
import type { SignCounts } from "~/lib/pelican-progress";
import { liveStreak, readPracticeStreak } from "~/lib/practice-streak";
import type { SharePayload } from "~/lib/share";
import { signCrop } from "~/lib/sign-crops";
import {
  ROUND_SIZE,
  type RunScopeKind,
  trainerHref,
} from "~/lib/trainer-rounds";

const CARD = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
} satisfies Variants;
const ITEM = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: ease.snap } },
} satisfies Variants;

const CHART_SRC = pelican.imageSrc as string;
const CHART_BY_CODE = new Map(
  (pelican.regions as FocusRegion[]).map((r) => [r.code, r]),
);
const THUMBNAILS_SHOWN = 6;
const THUMB_PAD = 0;

export type MissedSign = { id: string; code?: string; name: string };

function MissedThumbnails({ signs }: { signs: readonly MissedSign[] }) {
  const shown = signs.slice(0, THUMBNAILS_SHOWN);
  const more = signs.length - shown.length;
  return (
    <ul className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
      {shown.map((sign, index) => {
        const region = sign.code ? CHART_BY_CODE.get(sign.code) : undefined;
        return (
          <li
            key={sign.id}
            title={sign.name}
            aria-label={sign.name}
            className="dr-pop size-12 rounded-lg border border-line bg-white"
            style={
              {
                "--i": index + 4,
                ...(region
                  ? regionSpriteStyle(signCrop(region), CHART_SRC, THUMB_PAD)
                  : {}),
              } as React.CSSProperties
            }
          />
        );
      })}
      {more > 0 && (
        <li className="flex size-12 items-center justify-center rounded-lg border border-line bg-paper-3 font-mono text-[11px] font-bold text-ink-2">
          +{more}
        </li>
      )}
    </ul>
  );
}

export function TrainerResultCard({
  trainer,
  selfGraded,
  scope,
  signsTotal,
  recalled,
  firstTry,
  missed,
  poolTotal,
  counts,
  bestStreak = 0,
  share,
  summary,
  missedSlot,
  footerSlot,
  nextLabel: nextLabelOverride,
  crossLink,
  onDrill,
  onNext,
  onResetMastery,
  onExit,
}: {
  trainer: "pelican" | "3d" | "board";
  selfGraded: boolean;
  scope: RunScopeKind;
  /** Distinct signs in this run. */
  signsTotal: number;
  recalled: number;
  firstTry: number;
  missed: readonly MissedSign[];
  poolTotal: number;
  counts: SignCounts;
  /** Longest run of "Knew it" in a row this run. */
  bestStreak?: number;
  /** Left out, the card has no share button. */
  share?: { surface: string; payload: SharePayload };
  /** Replaces the line under the headline. The board talks about rules. */
  summary?: string;
  /** Shown instead of the missed-sign thumbnails. */
  missedSlot?: React.ReactNode;
  /** Shown under the buttons. The board puts its sponsoring school here. */
  footerSlot?: React.ReactNode;
  nextLabel?: string;
  /** Replaces the link to the other sign trainer. */
  crossLink?: { to: string; label: string };
  onDrill: () => void;
  onNext: () => void;
  onResetMastery: () => void;
  onExit: () => void;
}) {
  // Skip can finish a run without recalling everything, so a clean run is more
  // than just reaching the end.
  const flawless = firstTry === signsTotal && signsTotal > 0;
  const allKnown = poolTotal > 0 && counts.known >= poolTotal;
  const other =
    trainer === "pelican"
      ? { path: "/road-signs/3d", label: "in 3D" }
      : { path: "/road-signs/pelican", label: "on the chart" };
  const missedCodes = missed.flatMap((s) => (s.code ? [s.code] : []));
  const headline = !selfGraded
    ? `That's all ${signsTotal} signs.`
    : allKnown
      ? `All ${poolTotal} known.`
      : flawless
        ? "Flawless."
        : `${firstTry} of ${signsTotal} first try.`;
  const nextLabel =
    nextLabelOverride ??
    (scope === "chart" ? "Go again" : `Next ${ROUND_SIZE} signs`);
  // Only mounts on the client (inside the trainer overlay), so reading storage
  // here can't cause a hydration mismatch.
  const days = liveStreak(readPracticeStreak()).days;
  const streakLine = [
    bestStreak >= 2 ? `Best streak ${bestStreak}` : null,
    days >= 1 ? `${days} day${days === 1 ? "" : "s"} in a row` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      key="complete"
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ink/70 px-4 py-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Saved for a flawless round, so it still means something. */}
      {selfGraded && (flawless || allKnown) && (
        <CelebrationConfetti bursts={2} />
      )}
      <motion.div
        variants={CARD}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-sm rounded-lg border border-line bg-surface shadow-stamp-xl"
      >
        <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2.5 font-sans text-[10.5px] font-semibold tracking-wider text-paper uppercase">
          <span>{scope === "chart" ? "Whole chart" : "Round done"}</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onExit}
            className="relative -my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-paper text-paper transition-colors duration-100 outline-none before:absolute before:-inset-2.5 before:content-[''] hover:bg-paper hover:text-ink focus-visible:bg-paper focus-visible:text-ink"
          >
            <Icon icon={CloseIcon} size={13} />
          </button>
        </div>

        <RoundDoneScene crop className="h-24 border-b border-line sm:h-28" />

        <div className="flex flex-col items-center gap-3 px-5 py-6">
          <motion.h2
            variants={ITEM}
            className="m-0 font-display text-[clamp(24px,6vw,32px)] leading-[0.95] font-semibold tracking-tight text-ink"
          >
            {headline}
          </motion.h2>

          {selfGraded && (
            <motion.p
              variants={ITEM}
              className="m-0 text-[13.5px] leading-snug text-ink-2"
            >
              {summary ??
                (missed.length > 0
                  ? `${recalled} of ${signsTotal} recalled. These tripped you up:`
                  : recalled < signsTotal
                    ? `${recalled} of ${signsTotal} recalled. Skipped signs come back later.`
                    : "Every one on the first try.")}
            </motion.p>
          )}

          {missed.length > 0 && (
            <motion.div variants={ITEM}>
              {missedSlot ?? <MissedThumbnails signs={missed} />}
            </motion.div>
          )}

          {selfGraded && (
            <motion.div variants={ITEM} className="dr-fill-in w-full">
              <div className="mb-1.5 flex items-center justify-between gap-2 font-sans text-[10px] font-medium tracking-wider text-ink-3 uppercase">
                <span>
                  {counts.known} known · {counts.learning} learning
                </span>
                <span className="tabular-nums">of {poolTotal}</span>
              </div>
              <Progress
                value={poolTotal > 0 ? (counts.known / poolTotal) * 100 : 0}
                tone="green"
                showTicks={false}
                aria-label={trainer === "board" ? "Tasks known" : "Signs known"}
                className="h-3"
              />
              {streakLine && (
                <p className="m-0 mt-2 font-sans text-[10px] font-semibold tracking-wider text-ink-2 uppercase">
                  {streakLine}
                </p>
              )}
              {allKnown && (
                // It wipes everything learned, so it asks first.
                <ConfirmAction
                  title="Reset your progress?"
                  description="Everything marked as known starts again."
                  confirm="Reset"
                  onConfirm={onResetMastery}
                >
                  <Button
                    variant="quiet"
                    className="mt-1 h-auto min-h-9 gap-1.5 text-[10px] font-medium tracking-wider text-ink-3 uppercase no-underline hover:underline"
                  >
                    <Icon icon={RefreshIcon} size={11} />
                    Reset progress
                  </Button>
                </ConfirmAction>
              )}
            </motion.div>
          )}

          {/* minmax(0,1fr): a long label wraps instead of widening the card. */}
          <motion.div
            variants={ITEM}
            className="mt-1 grid w-full grid-cols-[minmax(0,1fr)] gap-2"
          >
            {missed.length > 0 ? (
              <>
                <Button variant="rush" size="lg" onClick={onDrill}>
                  <Icon icon={RefreshIcon} size={18} />
                  Drill {missed.length === 1
                    ? "it"
                    : `these ${missed.length}`}{" "}
                  again
                </Button>
                <Button variant="paper" onClick={onNext}>
                  {nextLabel}
                </Button>
              </>
            ) : (
              <Button variant="rush" size="lg" onClick={onNext}>
                {nextLabel}
                <Icon icon={ArrowRightIcon} size={16} />
              </Button>
            )}
            <Button
              variant="ink"
              asChild
              className="h-auto min-h-11 py-2 text-center leading-snug whitespace-normal"
            >
              <Link
                to={
                  crossLink?.to ??
                  trainerHref(other.path, { codes: missedCodes, go: true })
                }
                // A link of the caller's own leaves the page, which closes
                // the game. Closing it here as well would send the learner
                // two ways at once.
                onClick={crossLink ? undefined : onExit}
              >
                {crossLink?.label ??
                  `Try ${missed.length > 0 ? "them" : "signs"} ${other.label}`}
              </Link>
            </Button>
            <div className="flex gap-2 [&>*]:flex-1">
              {selfGraded && share && (
                <ShareButton
                  surface={share.surface}
                  payload={share.payload}
                  size="default"
                />
              )}
              <Button variant="paper" onClick={onExit}>
                Done
              </Button>
            </div>
          </motion.div>
          {footerSlot && (
            <motion.div variants={ITEM} className="w-full">
              {footerSlot}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
