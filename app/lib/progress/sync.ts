/**
 * Keeps a signed-in learner's progress on their account.
 *
 * localStorage stays the working copy (the stores, the offline board and the
 * pages that read keys directly all use it). This module:
 *   1. on sign-in, compares the phone and the account (`planSync`), brings
 *      the account's copy down where it wins, uploads the rest, and reloads
 *      the page once if the phone's copy changed, so every store reads it;
 *   2. while signed in, uploads any store whose saved value changed, every few
 *      seconds and when the page is hidden;
 *   3. on sign-out, clears the progress keys so the next person on the phone
 *      starts clean.
 */
import { listMyProgress, upsertMyProgress } from "~/database/progress/progress";
import { loadClient } from "~/lib/auth/session";

import {
  LEGACY_KEY,
  PROGRESS_KEYS,
  PROGRESS_STORES,
  type ProgressStore,
  SYNCED_USER_KEY,
} from "./keys";
import { fromRow, planSync, toRow } from "./sync-plan";

const PUSH_EVERY_MS = 5000;

let activeFlush: (() => Promise<void>) | null = null;

/** Uploads anything not yet saved (before signing out). */
export async function flushProgress() {
  await activeFlush?.();
}
const RELOADED_KEY = "driverush:sync-reloaded";

function readLocal(): Partial<Record<ProgressStore, string>> {
  const out: Partial<Record<ProgressStore, string>> = {};
  for (const store of PROGRESS_STORES) {
    const value = window.localStorage.getItem(PROGRESS_KEYS[store]);
    if (value != null) out[store] = value;
  }
  return out;
}

function readLegacy(): Partial<Record<ProgressStore, string>> {
  try {
    const byKey = JSON.parse(
      window.localStorage.getItem(LEGACY_KEY) ?? "{}",
    ) as Record<string, string>;
    const out: Partial<Record<ProgressStore, string>> = {};
    for (const store of PROGRESS_STORES) {
      const value = byKey[PROGRESS_KEYS[store]];
      if (typeof value === "string") out[store] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export type SyncResult = {
  reloading: boolean;
  downloaded: number;
  uploaded: number;
};

/**
 * Starts syncing for this account. Returns a stop function, and calls
 * `onFirstSync` once the first comparison is done.
 */
export function startProgressSync(
  userId: string,
  onFirstSync: (result: SyncResult) => void,
): () => void {
  let stopped = false;
  const pushed = new Map<ProgressStore, string>();
  let timer: number | undefined;

  async function upload(
    stores: ProgressStore[],
    values: Partial<Record<ProgressStore, string>>,
  ) {
    const rows = stores
      .filter((s) => values[s] != null)
      .map((store) => ({ store, ...toRow(values[store]!) }));
    if (rows.length === 0) return 0;
    const { error } = await upsertMyProgress(await loadClient(), userId, rows);
    if (error) throw new Error(error);
    for (const row of rows) pushed.set(row.store, values[row.store]!);
    return rows.length;
  }

  async function pushChanges() {
    if (stopped) return;
    const local = readLocal();
    const changed = PROGRESS_STORES.filter(
      (s) => local[s] != null && pushed.get(s) !== local[s],
    );
    try {
      await upload(changed, local);
    } catch {
      // Offline or a hiccup: the next round tries again.
    }
  }

  async function firstSync() {
    let saved: Awaited<ReturnType<typeof listMyProgress>>;
    try {
      saved = await listMyProgress(await loadClient());
    } catch {
      return; // Offline: the phone keeps working; the next sign-in syncs.
    }
    if (stopped) return;

    const cloud: Partial<Record<ProgressStore, string>> = {};
    for (const row of saved) {
      const value = fromRow(row.data);
      if (value != null) cloud[row.store as ProgressStore] = value;
    }

    const plan = planSync({
      stores: PROGRESS_STORES,
      local: readLocal(),
      cloud,
      legacy: readLegacy(),
      alreadySyncing: window.localStorage.getItem(SYNCED_USER_KEY) === userId,
    });

    const phoneBefore = readLocal();
    for (const [store, value] of Object.entries(plan.writes) as [
      ProgressStore,
      string,
    ][]) {
      window.localStorage.setItem(PROGRESS_KEYS[store], value);
    }
    window.localStorage.removeItem(LEGACY_KEY);
    window.localStorage.setItem(SYNCED_USER_KEY, userId);

    const local = readLocal();
    for (const store of PROGRESS_STORES) {
      if (
        plan.actions[store] === "download" ||
        plan.actions[store] === "none"
      ) {
        if (local[store] != null) pushed.set(store, local[store]!);
      }
    }
    const toUpload = PROGRESS_STORES.filter(
      (s) => plan.actions[s] === "upload",
    );
    let uploaded = 0;
    try {
      uploaded = await upload(toUpload, local);
    } catch {
      // Retried by the regular push.
    }

    // The stores already read the old values: reload once so they read the new ones.
    const phoneChanged = PROGRESS_STORES.some(
      (s) => phoneBefore[s] !== local[s],
    );
    const reloading =
      phoneChanged && !window.sessionStorage.getItem(RELOADED_KEY);
    const downloaded = PROGRESS_STORES.filter(
      (s) => plan.actions[s] === "download",
    ).length;
    onFirstSync({ reloading, downloaded, uploaded });
    if (reloading) {
      window.sessionStorage.setItem(RELOADED_KEY, "1");
      window.location.reload();
    }
  }

  const onHide = () => {
    if (document.visibilityState === "hidden") void pushChanges();
  };

  activeFlush = pushChanges;
  void firstSync().then(() => {
    if (stopped) return;
    timer = window.setInterval(() => void pushChanges(), PUSH_EVERY_MS);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
  });

  return () => {
    stopped = true;
    if (activeFlush === pushChanges) activeFlush = null;
    if (timer) window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
  };
}

/** After sign-out: the phone keeps nothing of the account's progress. */
export function clearAccountProgress() {
  for (const key of Object.values(PROGRESS_KEYS))
    window.localStorage.removeItem(key);
  window.localStorage.removeItem(SYNCED_USER_KEY);
  window.sessionStorage.removeItem(RELOADED_KEY);
}
