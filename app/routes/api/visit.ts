/**
 * GET /api/visit: should Google Analytics measure this visit? Pages are
 * prerendered, the same for every visitor, so the address check that keeps
 * bots and data-centre browsers out of GA (`bot-traffic.ts`) happens here;
 * the GA head script asks once a visit (`ga.ts`). Never cached: the answer
 * is about this request.
 */
import { data } from "react-router";

import { shouldMeasure } from "~/lib/bot-traffic";

import type { Route } from "./+types/visit";

export function loader({ request }: Route.LoaderArgs) {
  return data(
    { measure: shouldMeasure(request) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
