/**
 * What to do with each store when a signed-in learner's phone syncs: the
 * pure half of `sync.ts`, so the rules are tested on their own.
 *
 *   - Only the phone has it: upload it.
 *   - Only the account has it: bring it down.
 *   - Both, and they differ:
 *       - this phone was already syncing for this account, so the phone's
 *         copy is the newer one: upload it;
 *       - otherwise (first sign-in on this phone): the account wins and the
 *         phone's copy is replaced.
 *   - Old progress set aside before accounts (legacy) fills a store only when
 *     neither the phone nor the account has it.
 */
import type { Json } from "~/database/types";

import type { ProgressStore } from "./keys";

export type StoreAction = "upload" | "download" | "none";

export type SyncPlan = {
  actions: Record<ProgressStore, StoreAction>;
  /** Values to write to the phone before acting (from legacy or the account). */
  writes: Partial<Record<ProgressStore, string>>;
};

/**
 * The same saved value? Compared as data, not text: the database (jsonb)
 * hands objects back with their keys reordered, which is the same progress.
 */
export function sameValue(a: string, b: string): boolean {
  if (a === b) return true;
  return canonical(a) === canonical(b);
}

function canonical(raw: string): string {
  try {
    return JSON.stringify(sortKeys(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function planSync(input: {
  stores: readonly ProgressStore[];
  local: Partial<Record<ProgressStore, string>>;
  cloud: Partial<Record<ProgressStore, string>>;
  legacy: Partial<Record<ProgressStore, string>>;
  alreadySyncing: boolean;
}): SyncPlan {
  const actions = {} as Record<ProgressStore, StoreAction>;
  const writes: SyncPlan["writes"] = {};
  for (const store of input.stores) {
    const local = input.local[store];
    const cloud = input.cloud[store];
    const legacy = input.legacy[store];
    if (local == null) {
      if (cloud != null) {
        actions[store] = "download";
        writes[store] = cloud;
      } else if (legacy != null) {
        actions[store] = "upload";
        writes[store] = legacy;
      } else {
        actions[store] = "none";
      }
    } else if (cloud == null) {
      actions[store] = "upload";
    } else if (sameValue(local, cloud)) {
      actions[store] = "none";
    } else if (input.alreadySyncing) {
      actions[store] = "upload";
    } else {
      actions[store] = "download";
      writes[store] = cloud;
    }
  }
  return { actions, writes };
}

/** The row stored for a localStorage value (lossless: the parsed JSON, wrapped). */
export function toRow(raw: string): {
  data: { json: Json };
  version: number;
} {
  let parsed: Json;
  try {
    parsed = JSON.parse(raw) as Json;
  } catch {
    parsed = raw;
  }
  const version =
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { version?: unknown }).version === "number"
      ? Math.max(0, Math.floor((parsed as { version: number }).version))
      : 1;
  return { data: { json: parsed }, version };
}

/** The localStorage value for a stored row. */
export function fromRow(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("json" in data)) return null;
  const json = (data as { json: unknown }).json;
  return typeof json === "string" ? json : JSON.stringify(json);
}
