/**
 * One inline change (release a student, remove an admin, set a status),
 * thinkrush's keyed-fetcher pattern: keyed by the thing it changes so every
 * button for it shares one submission, `pending` says which intent is in
 * flight, and the page's loader brings the new state once it settles. Posts
 * to the owning route's action; its flash message shows as a toast.
 *
 * `sent(intent)` is true from the tap until the new state is read, unless
 * the action refused it: the row can show the change at once (an invite
 * counted as sent again) instead of waiting for the round trip.
 */
import { useFetcher } from "react-router";

export function useInlineAction(key: string, action?: string) {
  const fetcher = useFetcher({ key });
  const pending =
    fetcher.state !== "idle"
      ? String(fetcher.formData?.get("intent") ?? "")
      : null;
  const refused =
    fetcher.state === "loading" &&
    (fetcher.data as { ok?: boolean } | undefined)?.ok === false;
  return {
    pending,
    busy: fetcher.state !== "idle",
    sent: (intent: string) => pending === intent && !refused,
    submit: (fields: Record<string, string>) =>
      fetcher.submit(fields, { method: "POST", action }),
  };
}
