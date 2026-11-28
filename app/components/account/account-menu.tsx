/**
 * The signed-in account menu: the learner's picture and first name in the
 * top bar, and under it who they are, schools waiting for them, their
 * course, their pass, the schools they run and the console, and sign-out.
 * Its own chunk (`account-button.tsx` loads it once someone is signed in):
 * the popover and its positioning code are about 15 KB compressed that
 * most visitors, guests, never need.
 */
import * as React from "react";
import { toast } from "sonner";

import { Icon } from "~/components/brand/icon";
import { ChevronDownIcon } from "~/components/brand/icons";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { type SessionState, signOut } from "~/lib/auth/session";
import { whoIs } from "~/lib/auth/who-is";

import { MyPlaces } from "./my-places";
import { MySchool } from "./my-school";

type SignedIn = Extract<SessionState, { status: "signed-in" }>;

export default function AccountMenu({ session }: { session: SignedIn }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
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
