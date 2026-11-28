/**
 * The account entry in the top bar: "Sign in" for a guest; once signed in,
 * the learner's picture (Google's, or their initial) and first name, so it
 * is plain at a glance that they are in (owner, 2026-11-28). Its menu: who
 * they are, schools waiting for them, their course, their pass, the schools
 * they run and the console (staff), and sign-out.
 * Nothing at all when this build has accounts off, and an empty slot of the
 * same size while the browser reads the session, so the bar never jumps.
 */
import * as React from "react";
import { toast } from "sonner";

import { Icon } from "~/components/brand/icon";
import { ChevronDownIcon, LearnerIcon } from "~/components/brand/icons";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { signOut, useSession } from "~/lib/auth/session";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";
import { whoIs } from "~/lib/auth/who-is";

import { MyPlaces } from "./my-places";
import { MySchool } from "./my-school";

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
  const { fullName, firstName, initial, picture } = whoIs(user);
  const face = (
    <Avatar>
      {picture && (
        <AvatarImage src={picture} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="paper"
          size="sm"
          className="gap-1.5 rounded-full py-0 pr-2 pl-1"
          aria-label="Your account"
          title={user.email ?? "Your account"}
        >
          {face}
          <span className="max-w-20 truncate sm:max-w-24">{firstName}</span>
          <Icon icon={ChevronDownIcon} size={14} className="text-ink-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
          <Avatar className="size-10">
            {picture && (
              <AvatarImage src={picture} alt="" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="text-[16px]">{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="m-0 truncate text-[14px] font-semibold text-ink">
              {fullName ?? "Signed in"}
            </p>
            <p className="m-0 truncate text-[12.5px] text-ink-3">
              {user.email}
            </p>
          </div>
        </div>
        <MySchool userId={user.id} />
        <MyPlaces onGo={() => setMenuOpen(false)} />
        <Button
          type="button"
          variant="paper"
          size="sm"
          className="w-full"
          onClick={async () => {
            setMenuOpen(false);
            const { flushProgress } = await import("~/lib/progress/sync");
            await flushProgress();
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
