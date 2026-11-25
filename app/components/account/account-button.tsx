/**
 * The account entry in the top bar: "Sign in" for a guest, the learner's
 * initial once signed in (with their email and a sign-out in a small menu).
 * Nothing at all when this build has accounts off, and an empty slot of the
 * same size while the browser reads the session, so the bar never jumps.
 */
import * as React from "react";
import { toast } from "sonner";

import { Icon } from "~/components/brand/icon";
import { LearnerIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { signOut, useSession } from "~/lib/auth/session";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";

export function AccountButton() {
  const session = useSession();
  const show = useSignInSheet((s) => s.show);
  const [menuOpen, setMenuOpen] = React.useState(false);

  if (session.status === "off") return null;
  if (session.status === "loading")
    return <span aria-hidden className="inline-block h-9 w-9" />;

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

  const { user } = session;
  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="paper"
          size="sm"
          className="w-9 px-0 font-display text-[14px] font-bold"
          aria-label="Your account"
          title={user.email ?? "Your account"}
        >
          {initial}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-[12px] font-medium text-ink-3">Signed in as</p>
        <p className="mb-3 truncate text-[14px] font-semibold text-ink">
          {user.email}
        </p>
        <Button
          type="button"
          variant="paper"
          size="sm"
          className="w-full"
          onClick={async () => {
            setMenuOpen(false);
            await signOut();
            toast("You are signed out.");
          }}
        >
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
