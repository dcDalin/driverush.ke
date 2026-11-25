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

import type { Entitlement } from "~/lib/supabase/types";

import { loadClient, useSession } from "./session";

const REFRESH_MS = 10 * 60 * 1000;

let cache: { userId: string; value: Entitlement; at: number } | null = null;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

async function fetchEntitlement(userId: string) {
  const supabase = await loadClient();
  const { data, error } = await supabase.rpc("my_entitlement");
  if (error || !data?.[0]) return;
  cache = { userId, value: data[0] as unknown as Entitlement, at: Date.now() };
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
    return entitlement.sponsor_id
      ? { kind: "school", sponsorId: entitlement.sponsor_id }
      : { kind: "plain" };
  }
  if (entitlement?.tier === "paid") return { kind: "plain" };
  return { kind: "rotate" };
}
