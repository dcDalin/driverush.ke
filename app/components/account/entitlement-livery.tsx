/**
 * Dresses the board for the signed-in learner (mounted once in the shell):
 * their school's livery, plain cars for a paying learner with no school, or
 * the sponsor schools in turn for everyone else. See `liveryRule`.
 */
import * as React from "react";

import { liveryRule, useEntitlement } from "~/lib/auth/entitlement";
import { useSession } from "~/lib/auth/session";

export function EntitlementLivery() {
  const session = useSession();
  const entitlement = useEntitlement();
  const rule =
    session.status === "signed-in"
      ? liveryRule(entitlement)
      : ({ kind: "rotate" } as const);
  const key = rule.kind === "school" ? `school:${rule.sponsorId}` : rule.kind;

  React.useEffect(() => {
    if (session.status === "loading") return;
    if (session.status === "signed-in" && !entitlement) return;
    let live = true;
    void import("~/lib/board/sponsor-visit").then(({ applyLiveryRule }) => {
      if (live) applyLiveryRule(rule);
    });
    return () => {
      live = false;
    };
    // `key` stands for `rule`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, session.status, entitlement]);

  return null;
}
