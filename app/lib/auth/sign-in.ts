/**
 * Signing in: an emailed 6-digit code (the main way, and how new accounts are
 * made), Google, or an email and password (for people who set one, such as
 * school and DriveRush staff). The wording rules live here, apart from the
 * sheet, so they can be tested.
 */
import type { AuthError } from "@supabase/supabase-js";

import { loadClient } from "./session";

export const CODE_LENGTH = 6;

/** Trimmed and lower-cased, or null when it is not an email address. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

/** Digits only, at most six, so a pasted "123 456" still works. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** Where the Google round trip comes back to, then carries on to `next`. */
export function callbackUrl(origin: string, next: string): string {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

/** A plain sentence for a sign-in failure. */
export function signInErrorMessage(
  error: Pick<AuthError, "code" | "status" | "message"> | null | undefined,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "otp_expired" || code === "otp_disabled") {
    return "That code has expired or is wrong. Ask for a new one.";
  }
  if (code === "invalid_credentials")
    return "That email and password do not match.";
  if (code === "email_not_confirmed")
    return "Confirm your email first. Sign in with a code instead.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    error?.status === 429
  ) {
    return "Too many tries. Wait a minute, then try again.";
  }
  if (
    code === "provider_disabled" ||
    (code === "validation_failed" && /provider/i.test(message))
  ) {
    return "Google sign-in is not available yet. Use an email code.";
  }
  if (code === "signup_disabled") return "New accounts are closed right now.";
  if (/fetch|network/i.test(message))
    return "No connection. Check your data and try again.";
  return "Something went wrong. Try again.";
}

export async function sendEmailCode(email: string) {
  const { error } = await (await loadClient()).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return error;
}

export async function verifyEmailCode(email: string, token: string) {
  const { error } = await (await loadClient()).auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  return error;
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await (await loadClient()).auth.signInWithPassword({
    email,
    password,
  });
  return error;
}

export async function signInWithGoogle(next: string) {
  const { error } = await (await loadClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(window.location.origin, next) },
  });
  return error;
}

/** Google shows only when this build turns it on (the provider needs keys). */
export function googleEnabled(
  env: Record<string, string | undefined> = import.meta.env,
) {
  return env.VITE_AUTH_GOOGLE === "on";
}
