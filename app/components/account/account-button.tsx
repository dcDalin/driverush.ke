/**
 * The account entry in the top bar: "Sign in" for a guest; once signed in,
 * the learner's picture (Google's, or their initial) and first name, so it
 * is plain at a glance that they are in (owner, 2026-11-28), with its menu
 * (`account-menu.tsx`, loaded only then: guests never pay for it).
 * Nothing at all when this build has accounts off, and an empty slot of the
 * same size while the browser reads the session or the menu loads, so the
 * bar never jumps.
 */
import * as React from "react";

import { Icon } from "~/components/brand/icon";
import { LearnerIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { useSession } from "~/lib/auth/session";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";

const AccountMenu = React.lazy(() => import("./account-menu"));

const EMPTY_SLOT = <span aria-hidden className="inline-block h-9 w-9" />;

export function AccountButton() {
  const session = useSession();
  const show = useSignInSheet((s) => s.show);

  if (session.status === "off") return null;
  if (session.status === "loading") return EMPTY_SLOT;

  if (session.status === "signed-out") {
    return (
      <Button
        type="button"
        variant="paper"
        size="sm"
        onClick={() => show("account")}
      >
        <Icon icon={LearnerIcon} size={16} />
        Sign in
      </Button>
    );
  }

  return (
    <React.Suspense fallback={EMPTY_SLOT}>
      <AccountMenu session={session} />
    </React.Suspense>
  );
}
