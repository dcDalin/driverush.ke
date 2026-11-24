/**
 * The end of a free drive: how long it went on, and which rules were broken,
 * each with how often. Nothing here is saved. From it the learner drives on,
 * starts a new drive with a clean count, or closes the board.
 */
import { Icon } from "~/components/brand/icon";
import { PlayIcon, RefreshIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { faultRule, faultTip } from "~/lib/board/board-rules";
import type { FaultId } from "~/lib/board/referee";
import { rulesBroken, type FreeEntry } from "~/lib/board-store";

import { BoardSheet } from "./board-sheet";

function clockTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The rules broken, most often first, then in the order they were broken. */
export function brokenCounts(
  log: readonly FreeEntry[],
): { id: FaultId; serious: boolean; times: number }[] {
  const counts = new Map<
    FaultId,
    { id: FaultId; serious: boolean; times: number }
  >();
  for (const entry of rulesBroken(log)) {
    const seen = counts.get(entry.id);
    if (seen) seen.times += 1;
    else
      counts.set(entry.id, { id: entry.id, serious: entry.serious, times: 1 });
  }
  return [...counts.values()].sort((a, b) => b.times - a.times);
}

export function BoardFreeSummary({
  log,
  seconds,
  onKeepDriving,
  onNewDrive,
  onClose,
}: {
  log: readonly FreeEntry[];
  seconds: number;
  onKeepDriving: () => void;
  onNewDrive: () => void;
  onClose: () => void;
}) {
  const counts = brokenCounts(log);
  const total = counts.reduce((sum, one) => sum + one.times, 0);
  return (
    <BoardSheet
      tone={total ? "fault" : "pass"}
      strip={`Free drive · ${clockTime(seconds)}`}
      role="dialog"
      aria-labelledby="board-free-title"
    >
      <h2
        id="board-free-title"
        className="m-0 font-display text-[clamp(22px,5.5vw,28px)] font-extrabold uppercase leading-none tracking-tight"
      >
        {total === 0
          ? "No rules broken"
          : `${total} ${total === 1 ? "rule" : "rules"} broken`}
      </h2>
      {total === 0 ? (
        <p className="m-0 text-[13.5px] leading-snug text-ink-2">
          Clean driving. Nothing here is saved: the levels are where the course
          counts.
        </p>
      ) : (
        <ul
          data-free-summary
          className="m-0 grid max-h-[38vh] list-none gap-1.5 overflow-y-auto p-0 text-left"
        >
          {counts.map((one) => (
            <li
              key={one.id}
              className="border-2 border-ink bg-paper-2 px-3 py-2 text-[13px] leading-snug text-ink"
            >
              <span className="flex items-baseline justify-between gap-3 font-bold">
                {faultTip({ id: one.id, serious: one.serious }).title}
                <span className="shrink-0 font-mono text-[12px] tabular-nums">
                  ×{one.times}
                </span>
              </span>
              <span className="mt-0.5 block font-semibold text-ink-2">
                {faultRule(one.id)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="rush"
        size="lg"
        className="w-full"
        onClick={onKeepDriving}
        autoFocus
      >
        <Icon icon={PlayIcon} size={16} />
        Keep driving
      </Button>
      <Button variant="ink" className="w-full" onClick={onNewDrive}>
        <Icon icon={RefreshIcon} size={14} />
        New drive
      </Button>
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 w-full text-center text-[13.5px] font-semibold text-ink-2 underline underline-offset-4 outline-none hover:text-ink focus-visible:text-ink"
      >
        Close
      </button>
    </BoardSheet>
  );
}
