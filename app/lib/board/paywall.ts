/**
 * Which board levels need a pass (owner, 2026-11-25).
 *
 * Free for everyone: levels 1 to 16, through the first graded drive, so a
 * learner drives a real task before being asked to pay. The mock test gets
 * one free try. Everything else in the course needs full access: a pass of
 * their own or one bought through their driving school (`hasFullAccess`).
 *
 * Left open on purpose: free drive, today's drive, `?task=` links, the mixed
 * round, `?learn=1`, the sign trainers and the guides.
 *
 * This only decides; the game asks it before starting a level and the level
 * lists ask it before opening one (the pass sheet opens instead).
 */
import type { Entitlement } from "~/database/types";
import { hasFullAccess } from "~/lib/auth/entitlement";

import type { Level } from "./curriculum";

/** The last level anyone can play without a pass. */
export const FREE_LEVELS = 16;

/** Free tries at the mock test before it needs a pass. */
export const FREE_MOCK_TRIES = 1;

export function levelPaywalled(
  level: Pick<Level, "n" | "kind">,
  entitlement: Entitlement | null,
  { mockTriesUsed = 0 }: { mockTriesUsed?: number } = {},
): boolean {
  if (hasFullAccess(entitlement)) return false;
  if (level.kind === "mock") return mockTriesUsed >= FREE_MOCK_TRIES;
  return level.n > FREE_LEVELS;
}
