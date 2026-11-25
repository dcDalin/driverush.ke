/**
 * The paywall in the browser: `levelPaywalled` (what is locked) asked with
 * the learner's entitlement, once it is known.
 *
 * Off unless the build says `VITE_PASSES=on` (owner's launch switch: nothing
 * locks in production until payments are verified and the copy is changed),
 * and off when accounts are off (nobody could pay).
 *
 * While a signed-in learner's entitlement loads, `ready` is false and the
 * game waits before starting a level that might be locked. If it never
 * comes (offline, a hiccup), the gate opens after a few seconds rather than
 * keep a paying learner out: the board is client-side anyway.
 */
import * as React from "react";

import { useEntitlement } from "~/lib/auth/entitlement";
import { useSession } from "~/lib/auth/session";

import type { Level } from "./curriculum";
import { FREE_LEVELS, levelPaywalled } from "./paywall";

const MOCK_TRIES_KEY = "driverush:mock-tries";
const WAIT_MS = 4000;

export function passesOn(
  env: Record<string, string | undefined> = import.meta.env,
): boolean {
  return env.VITE_PASSES === "on";
}

/** Where a locked level sends the learner: the pass page, coming back here. */
export function passHref(level?: Pick<Level, "id" | "kind">) {
  return level && level.kind !== "mock" ? `/pass?level=${level.id}` : "/pass";
}

export function mockTriesUsed(): number {
  try {
    return Number(window.localStorage.getItem(MOCK_TRIES_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** One more mock test started without a pass. */
export function countMockTry() {
  try {
    window.localStorage.setItem(MOCK_TRIES_KEY, String(mockTriesUsed() + 1));
  } catch {
    // Private mode: the free try is not counted. The board is client-side.
  }
}

/** Whether a level could be locked at all (so the game waits for the answer). */
export function mightBeLocked(level: Pick<Level, "n" | "kind">) {
  return level.kind === "mock" || level.n > FREE_LEVELS;
}

export type Paywall = {
  on: boolean;
  /** The answer is known (or waited out). */
  ready: boolean;
  /** `mockTries`: the free mock tries used, as counted when the page opened. */
  walled: (level: Pick<Level, "n" | "kind">, mockTries?: number) => boolean;
};

export function usePaywall(): Paywall {
  const session = useSession();
  const entitlement = useEntitlement();
  const on = passesOn() && session.status !== "off";
  const [waitedOut, setWaitedOut] = React.useState(false);
  const known =
    session.status === "signed-out" ||
    (session.status === "signed-in" && entitlement !== null);

  React.useEffect(() => {
    if (!on || known) return;
    const timer = window.setTimeout(() => setWaitedOut(true), WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [on, known]);

  const ready = !on || known || waitedOut;
  return {
    on,
    ready,
    walled: (level, mockTries = mockTriesUsed()) =>
      on &&
      known &&
      levelPaywalled(level, entitlement, { mockTriesUsed: mockTries }),
  };
}
