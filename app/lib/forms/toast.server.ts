/**
 * Flash toasts set by actions (remix-toast): `dataWithSuccess`,
 * `dataWithError`, `redirectWithSuccess` and the rest put a one-time message
 * in a cookie; the root loader reads it and the shell shows it with sonner.
 * The cookie is signed with SESSION_SECRET when it is set.
 */
import { setToastCookieOptions } from "remix-toast";

if (process.env.SESSION_SECRET) {
  setToastCookieOptions({
    secrets: [process.env.SESSION_SECRET],
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export {
  dataWithError,
  dataWithSuccess,
  getToast,
  redirectWithError,
  redirectWithSuccess,
} from "remix-toast";
