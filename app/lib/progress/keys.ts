/**
 * The learner's progress, as the app keeps it in localStorage: one key per
 * store, each saved to the account as one `learner_progress` row. The row
 * names are fixed by the database (`learner_progress.store` CHECK).
 *
 * Settings that belong to the device (theme, install state, board quality)
 * are not progress and never leave the phone.
 */
export const PROGRESS_KEYS = {
  board: "driverush:board",
  pelican: "driverush:pelican",
  signs3d: "driverush:signs3d",
  streak: "driverush:streak",
  "daily-drive": "driverush:daily-drive",
  test: "driverush:test",
  proud: "driverush:proud",
} as const;

export type ProgressStore = keyof typeof PROGRESS_KEYS;

export const PROGRESS_STORES = Object.keys(PROGRESS_KEYS) as ProgressStore[];

/** Progress found on the phone the first time accounts were on, kept for the learner's first sign-in. */
export const LEGACY_KEY = "driverush:legacy-progress";
/** Marks that this phone has seen accounts on (so old progress was set aside once). */
export const ACCOUNTS_SEEN_KEY = "driverush:accounts-seen";
/** The account this phone's progress belongs to (set while signed in). */
export const SYNCED_USER_KEY = "driverush:synced-user";
/** Per tab: this visit has started (guest progress from before is gone). */
export const VISIT_KEY = "driverush:visit";
