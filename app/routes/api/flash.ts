/**
 * GET /api/flash: the one-time message an action left (remix-toast's
 * cookie), read and cleared. The root loader is the same for every visitor
 * (pages are prerendered), so it no longer reads the cookie; the shell asks
 * here after a form it sent settles (`useFlashToasts`). Never cached.
 */
import { data } from "react-router";

import { getToast } from "~/lib/forms/toast.server";

import type { Route } from "./+types/flash";

export async function loader({ request }: Route.LoaderArgs) {
  const { toast, headers } = await getToast(request);
  headers.set("Cache-Control", "private, no-store");
  return data({ flash: toast ?? null }, { headers });
}
