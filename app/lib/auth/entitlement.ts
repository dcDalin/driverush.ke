/**
 * What the signed-in learner gets (`my_entitlement()` in the database).
 * Two separate things (owner, 2026-11-25):
 *
 *   tier         whose cars they see
 *     school     linked to a school (free for the school): that school's livery
 *     paid       a pass and no school: sponsor schools take turns
 *     free       neither: sponsor schools take turns
 *   full_access  a pass is running (bought alone or through their school):
 *                the course past the free levels opens (`~/lib/board/paywall`)
 *
 * Guests have no entitlement (null): free, no pass.
 * `hasFullAccess` is the one gate for locked content.
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

/** Whether locked content is open: a pass is running. A school link alone does not open it. */
export function hasFullAccess(entitlement: Entitlement | null): boolean {
  return entitlement?.full_access === true;
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
  // A pass without a school: the sponsor schools take turns (owner, 2026-11-25).
  return { kind: "rotate" };
}
