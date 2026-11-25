/**
 * Guests' progress is not saved (owner, 2026-11-24): a guest's progress lasts
 * for the visit and is gone the next time they open DriveRush. Signing in
 * keeps it.
 *
 * This runs as an inline script in <head>, before any store reads
 * localStorage, so a new guest visit starts clean without a flash of old
 * progress. It does nothing when:
 *   - this build has accounts off (no Supabase settings), or
 *   - someone is signed in (their session cookie is there), or
 *   - this tab's visit has already started (a reload or a move to another page).
 *
 * The first time a phone sees accounts on, progress made before is set aside
 * under LEGACY_KEY, not deleted, so the learner's first sign-in saves it.
 *
 * Written as a literal script (not built from a function's source, which a
 * minifier would rename); `guest-visit.test.ts` runs this exact string.
 * GUEST_PROGRESS_KEPT turns the rule off in one place.
 */
import {
  ACCOUNTS_SEEN_KEY,
  LEGACY_KEY,
  PROGRESS_KEYS,
  VISIT_KEY,
} from "./keys";

export const GUEST_PROGRESS_KEPT = false;

/** The name Supabase gives the session cookie for this project URL. */
export function authCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/** The inline <head> script, or "" when the rule is off or accounts are. */
export function guestVisitScript(supabaseUrl: string | undefined): string {
  if (GUEST_PROGRESS_KEPT || !supabaseUrl) return "";
  const j = JSON.stringify;
  const cookie = authCookieName(supabaseUrl).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  return [
    "try{",
    "var L=localStorage,S=sessionStorage,K=" +
      j(Object.values(PROGRESS_KEYS)) +
      ";",
    // Signed in: keep everything (it is the account's offline copy).
    "if(new RegExp(" +
      j("(^|; )" + cookie + "(\\.\\d+)?=") +
      ").test(document.cookie)){L.setItem(" +
      j(ACCOUNTS_SEEN_KEY) +
      ",'1')}",
    // Same visit (reload, another page): keep it.
    "else if(!S.getItem(" + j(VISIT_KEY) + ")){",
    "S.setItem(" + j(VISIT_KEY) + ",'1');",
    "var f={},a=0,i,v;for(i=0;i<K.length;i++){v=L.getItem(K[i]);if(v!=null){f[K[i]]=v;a=1}}",
    "var first=!L.getItem(" +
      j(ACCOUNTS_SEEN_KEY) +
      ");L.setItem(" +
      j(ACCOUNTS_SEEN_KEY) +
      ",'1');",
    // First time accounts are on: set old progress aside for the first sign-in.
    "if(a&&first&&!L.getItem(" +
      j(LEGACY_KEY) +
      "))L.setItem(" +
      j(LEGACY_KEY) +
      ",JSON.stringify(f));",
    "for(i=0;i<K.length;i++)L.removeItem(K[i])",
    "}",
    "}catch(e){}",
  ].join("");
}
