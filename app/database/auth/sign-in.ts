/**
 * Signing in with the browser's client: an emailed 6-digit code (the main
 * way, and how accounts are made), an email and password, or Google. Each
 * returns a Result whose error is a sentence for the sign-in sheet.
 */
import type { AuthError } from "@supabase/supabase-js";

import { fail, ok, type Result } from "../result";
import type { TypedSupabaseClient } from "../types";

type AuthFailure = Pick<AuthError, "code" | "status" | "message">;

/** A plain sentence for a sign-in failure. */
export function signInErrorMessage(
  error: AuthFailure | null | undefined,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "otp_expired" || code === "otp_disabled") {
    return "That code has expired or is wrong. Ask for a new one.";
  }
  if (code === "invalid_credentials")
    return "That email and password do not match.";
  if (code === "email_not_confirmed") {
    return "Confirm your email first. Sign in with a code instead.";
  }
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

function settle(error: AuthFailure | null): Result<null> {
  return error ? fail(signInErrorMessage(error)) : ok(null);
}

export async function sendEmailCode(
  supabase: TypedSupabaseClient,
  email: string,
) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return settle(error);
}

export async function verifyEmailCode(
  supabase: TypedSupabaseClient,
  email: string,
  token: string,
) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  return settle(error);
}

export async function signInWithPassword(
  supabase: TypedSupabaseClient,
  email: string,
  password: string,
) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return settle(error);
}

export async function signInWithGoogle(
  supabase: TypedSupabaseClient,
  redirectTo: string,
) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return settle(error);
}

export async function signOut(supabase: TypedSupabaseClient) {
  const { error } = await supabase.auth.signOut();
  return settle(error);
}
