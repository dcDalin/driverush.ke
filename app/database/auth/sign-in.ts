/**
 * Signing in with the browser's client: Google (the first choice), or an
 * email and password. A new password account confirms its email with a
 * 6-digit code, and a forgotten password is replaced with one. Each returns
 * a Result whose error is a sentence for the sign-in sheet.
 */
import type { AuthError } from "@supabase/supabase-js";

import { fail, ok, type Result } from "../result";
import type { TypedSupabaseClient } from "../types";

type AuthFailure = Pick<AuthError, "code" | "status" | "message">;

/** The sheet moves on to the code step when a sign-in ends with this. */
export const EMAIL_NOT_CONFIRMED =
  "Confirm your email first. We sent you a code.";

const EMAIL_TAKEN =
  "That email already has an account. Sign in, or set a new password.";

/** A plain sentence for a sign-in failure. */
export function signInErrorMessage(
  error: AuthFailure | null | undefined,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "otp_expired" || code === "otp_disabled") {
    return "That code has expired or is wrong. Ask for a new one.";
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return EMAIL_TAKEN;
  }
  if (code === "weak_password") {
    return "Use at least 8 characters, with letters and numbers.";
  }
  if (code === "invalid_credentials")
    return "That email and password do not match.";
  if (code === "email_not_confirmed") return EMAIL_NOT_CONFIRMED;
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
    return "Google sign-in is not available yet. Use your email and password.";
  }
  if (code === "signup_disabled") return "New accounts are closed right now.";
  if (/fetch|network/i.test(message))
    return "No connection. Check your data and try again.";
  return "Something went wrong. Try again.";
}

function settle(error: AuthFailure | null): Result<null> {
  return error ? fail(signInErrorMessage(error)) : ok(null);
}

/**
 * A new account. The confirmation email carries a 6-digit code for
 * `verifyEmailCode`; nobody is signed in until it is typed.
 */
export async function signUpWithPassword(
  supabase: TypedSupabaseClient,
  email: string,
  password: string,
) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return settle(error);
  // An address that already has a confirmed account comes back as a user
  // with no identities, and no email is sent.
  if (data.user?.identities?.length === 0) return fail(EMAIL_TAKEN);
  return ok(null);
}

/** Sends the confirmation code again. */
export async function resendSignUpCode(
  supabase: TypedSupabaseClient,
  email: string,
) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return settle(error);
}

/** Confirms a new account's email with its code, and signs it in. */
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

/** Emails a 6-digit code for `verifyResetCode`. */
export async function sendPasswordReset(
  supabase: TypedSupabaseClient,
  email: string,
) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return settle(error);
}

/** Signs in with a reset code (once only), so the password can be set. */
export async function verifyResetCode(
  supabase: TypedSupabaseClient,
  email: string,
  token: string,
) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });
  return settle(error);
}

/** The signed-in person's new password. Their old one again is fine. */
export async function setPassword(
  supabase: TypedSupabaseClient,
  password: string,
) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error?.code === "same_password") return ok(null);
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
