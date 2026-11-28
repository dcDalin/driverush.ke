/**
 * Shows the one-time message an action left (remix-toast's cookie) with the
 * house toaster. Actions set it (`dataWithSuccess`, `redirectWithSuccess` and
 * the rest); once every form this page sent has settled, its revalidation
 * included, the shell asks `/api/flash` for it. One small GET after a
 * submission, instead of a cookie read in the root loader on every page
 * (which would keep pages from being prerendered and cached).
 */
import * as React from "react";
import { useFetchers, useNavigation } from "react-router";
import { toast } from "sonner";

export const FLASH_PATH = "/api/flash";

type Flash = { type: string; message: string };

function isMutation(method: string | undefined) {
  return method !== undefined && method.toUpperCase() !== "GET";
}

export function showFlash(flash: Flash | null | undefined) {
  if (!flash) return;
  if (flash.type === "error") toast.error(flash.message);
  else if (flash.type === "success") toast.success(flash.message);
  else if (flash.type === "warning") toast.warning(flash.message);
  else toast(flash.message);
}

export function useFlashToasts() {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const sending =
    (navigation.state !== "idle" && isMutation(navigation.formMethod)) ||
    fetchers.some(
      (fetcher) => fetcher.state !== "idle" && isMutation(fetcher.formMethod),
    );
  const wasSending = React.useRef(false);
  React.useEffect(() => {
    if (sending) {
      wasSending.current = true;
      return;
    }
    if (!wasSending.current) return;
    wasSending.current = false;
    const controller = new AbortController();
    fetch(FLASH_PATH, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { flash?: Flash | null } | null) => showFlash(body?.flash))
      .catch(() => {});
    return () => controller.abort();
  }, [sending]);
}
