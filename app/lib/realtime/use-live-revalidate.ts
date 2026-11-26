/**
 * Keeps a dashboard current, as thinkrush's admin console does: the page
 * joins private broadcast topics (`school:<id>`, `console`; who may join is
 * the policy in `supabase/schemas/realtime/school_broadcasts.sql`), and once
 * changes have been quiet for a moment it re-runs the page's loaders
 * (`revalidator.revalidate()`). A learner paying through the school, a
 * student joining, an owner sending a bank: the page shows it without a
 * reload. The messages carry no data; the loaders re-read through row level
 * security.
 *
 * A fallback for when realtime is off or the socket drops: a slow poll while
 * the tab is visible (never while hidden, never stacked).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import * as React from "react";
import { useRevalidator } from "react-router";

import { loadClient } from "~/lib/auth/session";

/** Re-read once events have been quiet this long. */
const QUIET_MS = 1500;
/** The fallback poll while the tab is visible. */
const POLL_MS = 60_000;

export function useLiveRevalidate(topics: string[]) {
  const revalidator = useRevalidator();
  const revalidateRef = React.useRef(revalidator);
  revalidateRef.current = revalidator;
  const key = topics.join("|");

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channels: RealtimeChannel[] = [];
    let client: Awaited<ReturnType<typeof loadClient>> | null = null;

    const revalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (revalidateRef.current.state === "idle") {
          void revalidateRef.current.revalidate();
        }
      }, QUIET_MS);
    };

    void (async () => {
      client = await loadClient();
      const { data } = await client.auth.getSession();
      if (cancelled || !data.session) return;
      await client.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      for (const topic of key.split("|")) {
        channels.push(
          client
            .channel(topic, { config: { private: true } })
            .on("broadcast", { event: "*" }, revalidate)
            .subscribe(),
        );
      }
    })().catch(() => {
      // No realtime (local stack without it, a dropped socket): the poll below.
    });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") revalidate();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      for (const channel of channels) void client?.removeChannel(channel);
    };
  }, [key]);
}
