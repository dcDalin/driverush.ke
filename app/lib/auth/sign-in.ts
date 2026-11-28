/**
 * Signing in from the browser: the sign-in sheet's calls, each the matching
 * `~/database/auth/sign-in` function with the browser's client (loaded on
 * demand). Every call returns a Result whose error is a sentence for the sheet.
 */
import * as auth from "~/database/auth/sign-in";

import { loadClient } from "./session";

export const CODE_LENGTH = 6;

export { EMAIL_NOT_CONFIRMED } from "~/database/auth/sign-in";

/** Where the Google round trip comes back to, then carries on to `next`. */
export function callbackUrl(origin: string, next: string): string {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

/** Google shows only when this build turns it on (the provider needs keys). */
export function googleEnabled(
  env: Record<string, string | undefined> = import.meta.env,
) {
  return env.VITE_AUTH_GOOGLE === "on";
}

export async function signUpWithPassword(email: string, password: string) {
  return auth.signUpWithPassword(await loadClient(), email, password);
}

export async function resendSignUpCode(email: string) {
  return auth.resendSignUpCode(await loadClient(), email);
}

export async function verifyEmailCode(email: string, code: string) {
  return auth.verifyEmailCode(await loadClient(), email, code);
}

export async function sendPasswordReset(email: string) {
  return auth.sendPasswordReset(await loadClient(), email);
}

export async function verifyResetCode(email: string, code: string) {
  return auth.verifyResetCode(await loadClient(), email, code);
}

export async function setPassword(password: string) {
  return auth.setPassword(await loadClient(), password);
}

export async function signInWithPassword(email: string, password: string) {
  return auth.signInWithPassword(await loadClient(), email, password);
}

export async function signInWithGoogle(next: string) {
  return auth.signInWithGoogle(
    await loadClient(),
    callbackUrl(window.location.origin, next),
  );
}
