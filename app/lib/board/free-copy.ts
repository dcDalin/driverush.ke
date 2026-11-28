/**
 * What the site may say about price, in one place, so no page promises more
 * than the build gives. With passes off (the owner's launch switch) every
 * level is free; with them on, the first levels are and the rest need a
 * pass. Nobody needs an account to start, in either case.
 */
import { FREE_LEVELS } from "./paywall";
import { passesOn } from "./use-paywall";

/** "Free", or "First 16 levels free" once passes are on sale. */
export function freeLabel(on = passesOn()): string {
  return on ? `First ${FREE_LEVELS} levels free` : "Free";
}

/** The same with the account promise: "Free. No account needed to start." */
export function freeLine(on = passesOn()): string {
  return `${freeLabel(on)}. No account needed to start.`;
}
