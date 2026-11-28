/**
 * What a dashboard frame (a school's dashboard, the console, one school in
 * the console) shows when a page or a change in it fails: inside the frame,
 * in its words, instead of the whole site's error page. A lapsed session
 * (401) asks to sign in again, a refused change (403) says so, and anything
 * else offers a reload. Reported to PostHog like the root's.
 */
import * as React from "react";
import { isRouteErrorResponse } from "react-router";

import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { getPostHog, initAnalytics } from "~/lib/analytics";

export function FrameError({ error }: { error: unknown }) {
  const known = isRouteErrorResponse(error);
  React.useEffect(() => {
    if (known && error.status < 500) return;
    void initAnalytics().then(() => {
      getPostHog()?.captureException(error);
    });
  }, [error, known]);

  if (known && error.status === 401) {
    return (
      <NeedsSignIn
        title="Sign in again"
        body="Your session ended. Sign in again and carry on where you were."
      />
    );
  }
  if (known && error.status === 403) {
    return (
      <NothingHere
        title="Not yours to change"
        body="This account can't make that change. Ask the school's owner."
      />
    );
  }
  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <h1 className="font-display text-[28px] font-bold tracking-tight">
        Something broke
      </h1>
      <p className="text-ink-2">
        That didn't load. Nothing you saved is lost: reload the page and try
        again.
      </p>
      <Button
        type="button"
        variant="rush"
        onClick={() => window.location.reload()}
      >
        Reload
      </Button>
    </section>
  );
}
