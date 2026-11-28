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
 * the tab is visible (never while hidden, never stacked), only while a topic
 * is not joined. Coming back to a tab hidden a while, or a topic joining
 * again after a drop, re-reads once: events may have been missed meanwhile.
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

    // Which topics are joined right now; the poll covers any that are not.
    const topicList = key.split("|");
    const joined = new Set<string>();
    const dropped = new Set<string>();
    const onStatus = (topic: string) => (status: string) => {
      if (status === "SUBSCRIBED") {
        joined.add(topic);
        // Joined again after a drop: catch up on what was missed.
        if (dropped.delete(topic)) revalidate();
      } else if (joined.delete(topic)) {
        dropped.add(topic);
      }
    };

    void (async () => {
      client = await loadClient();
      const { data } = await client.auth.getSession();
      if (cancelled || !data.session) return;
      await client.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      for (const topic of topicList) {
        channels.push(
          client
            .channel(topic, { config: { private: true } })
            .on("broadcast", { event: "*" }, revalidate)
            .subscribe(onStatus(topic)),
        );
      }
    })().catch(() => {
      // No realtime (local stack without it, a dropped socket): the poll below.
    });

    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (joined.size < topicList.length) revalidate();
    }, POLL_MS);

    // A phone puts a hidden tab's socket to sleep: back after a while, read
    // once rather than trust that nothing happened.
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > POLL_MS) revalidate();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const channel of channels) void client?.removeChannel(channel);
    };
  }, [key]);
}
