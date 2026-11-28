/**
 * Asks the server again when the browser's session changes (a sign-in or
 * a sign-out on the page), so a gated frame opens or closes without a
 * reload. Keyed by who is signed in, not by the session object: an
 * ordinary navigation must not re-read every loader on the page.
 */
import * as React from "react";
import { useRevalidator } from "react-router";

import { useSession } from "~/lib/auth/session";

export function useRevalidateOnSession() {
  const session = useSession();
  const { revalidate } = useRevalidator();
  const revalidateRef = React.useRef(revalidate);
  revalidateRef.current = revalidate;
  const who =
    session.status === "signed-in"
      ? `in:${session.user.id}`
      : session.status === "signed-out"
        ? "out"
        : null;
  const seen = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (who === null) return;
    const first = seen.current === null;
    const changed = seen.current !== who;
    seen.current = who;
    if (!first && changed) void revalidateRef.current();
  }, [who]);
}
