/**
 * One inline change (release a student, remove an admin, set a status),
 * thinkrush's keyed-fetcher pattern: keyed by the thing it changes so every
 * button for it shares one submission, `pending` says which intent is in
 * flight, and the page's loader brings the new state once it settles. Posts
 * to the owning route's action; its flash message shows as a toast.
 */
import { useFetcher } from "react-router";

export function useInlineAction(key: string, action?: string) {
  const fetcher = useFetcher({ key });
  const pending =
    fetcher.state !== "idle"
      ? String(fetcher.formData?.get("intent") ?? "")
      : null;
  return {
    pending,
    busy: fetcher.state !== "idle",
    submit: (fields: Record<string, string>) =>
      fetcher.submit(fields, { method: "POST", action }),
  };
}
