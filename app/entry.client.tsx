/**
 * Client entry. React Router ships a default version of this file; we own it
 * to start PostHog at the same moment as the page: posthog-js is fetched by a
 * dynamic import while React hydrates, so the page never waits for it
 * (owner, 2026-11-28). Autocapture, replay, the first pageview and exception
 * capture begin when it arrives; app events sent before then wait in a queue
 * (`withPostHog`, `lib/posthog.ts`). A missing token or a blocked request
 * means no analytics, never a blank page.
 */
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { startPostHog } from "~/lib/posthog";

void startPostHog();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
