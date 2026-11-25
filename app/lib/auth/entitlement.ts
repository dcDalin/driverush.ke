/**
 * What the signed-in learner gets (`my_entitlement()` in the database):
 *
 *   school  linked to a school this month: full access, that school's livery
 *   paid    their own subscription: full access, plain cars
 *   free    a free account: progress saved, sponsor schools take turns
 *
 * Guests have no entitlement (null) and are treated as free.
 * `hasFullAccess` is the one gate for locked content. Nothing is locked yet:
 * which content is locked is the owner's call, and each lock should ask this.
 */
import * as React from "react";

import { getMyEntitlement } from "~/database/entitlement/get-my-entitlement";
import type { Entitlement } from "~/database/types";

import { loadClient, useSession } from "./session";

const REFRESH_MS = 10 * 60 * 1000;

let cache: { userId: string; value: Entitlement; at: number } | null = null;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

async function fetchEntitlement(userId: string) {
  let value: Entitlement | null;
  try {
    value = await getMyEntitlement(await loadClient());
  } catch {
    return; // Offline or a hiccup: the next focus tries again.
  }
  if (!value) return;
  cache = { userId, value, at: Date.now() };
  for (const fn of listeners) fn();
}

/** Ask the database again (after accepting a school, say). */
export function refreshEntitlement(userId: string) {
  inFlight = fetchEntitlement(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useEntitlement(): Entitlement | null {
  const session = useSession();
  const userId = session.status === "signed-in" ? session.user.id : null;
  const value = React.useSyncExternalStore(
    subscribe,
    () => cache,
    () => null,
  );

  React.useEffect(() => {
    if (!userId) return;
    const stale =
      !cache || cache.userId !== userId || Date.now() - cache.at > REFRESH_MS;
    if (stale && !inFlight) void refreshEntitlement(userId);
    const onFocus = () => {
      if (cache && Date.now() - cache.at > REFRESH_MS && !inFlight)
        void refreshEntitlement(userId);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId]);

  if (!userId || !value || value.userId !== userId) return null;
  return value.value;
}

/** Whether locked content is open: a school link or the learner's own subscription. */
export function hasFullAccess(entitlement: Entitlement | null): boolean {
  return entitlement?.tier === "school" || entitlement?.tier === "paid";
}

/** What the board's cars wear for this entitlement. */
export type LiveryRule =
  | { kind: "rotate" }
  | { kind: "school"; sponsorId: string }
  | { kind: "plain" };

export function liveryRule(entitlement: Entitlement | null): LiveryRule {
  if (entitlement?.tier === "school") {
    return entitlement.school_slug
      ? { kind: "school", sponsorId: entitlement.school_slug }
      : { kind: "plain" };
  }
  if (entitlement?.tier === "paid") return { kind: "plain" };
  return { kind: "rotate" };
}
