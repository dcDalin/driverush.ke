/**
 * A sign's long-form write-up (`data/road-sign-guides.ts`): how it looks,
 * where it stands, the mistakes, the memory cue and its look-alikes. Kept
 * apart from `road-sign-pages.ts` because it is most of the signs' text
 * (about 25 KB compressed): the sign pages read it in their loader, so it
 * stays on the server and in their prerendered data, and only the trainers'
 * "Missed it" tips (`miss-tips.ts`) bring it to the browser. The board and
 * the sign lists never load it.
 */
import { SIGN_GUIDES, type SignGuide } from "~/data/road-sign-guides";
import { isSignConfirmed } from "~/lib/road-sign-pages";

export type { SignGuide };

/** The long-form write-up, for signs that are in search. */
export function signGuide(sign: { code?: string }): SignGuide | undefined {
  return sign.code && isSignConfirmed(sign)
    ? SIGN_GUIDES[sign.code]
    : undefined;
}
