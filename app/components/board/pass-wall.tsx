/**
 * Shown on the play page in place of a locked level: what the pass opens, and
 * the way to it. Guests sign in first (a pass lives on an account). Dark, like
 * every card over the game.
 */
import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ArrowRightIcon, LockIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { useSession } from "~/lib/auth/session";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";
import type { Level } from "~/lib/board/curriculum";
import { FREE_LEVELS } from "~/lib/board/paywall";
import { passHref } from "~/lib/board/use-paywall";
import { BOARD_PATH } from "~/lib/board-guides";

export function PassWall({ level }: { level: Level }) {
  const session = useSession();
  const showSignIn = useSignInSheet((s) => s.show);
  const mock = level.kind === "mock";
  return (
    <div className="dark fixed inset-0 z-50 flex items-center justify-center bg-game/95 p-5 text-ink">
      <div className="grid w-full max-w-sm gap-4 rounded-soft border border-white/20 bg-background p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-soft bg-paper-2 text-ink-2">
            <Icon icon={LockIcon} size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-[19px] leading-tight font-bold">
              {mock
                ? "Another mock test needs a pass"
                : `Level ${level.n} needs a pass`}
            </h1>
            <p className="mt-1 mb-0 text-[14px] text-ink-2">
              Levels 1 to {FREE_LEVELS} and one mock test are free. A pass opens
              all 59 levels and every mock test for 60 days, through your
              driving school or on your own.
            </p>
          </div>
        </div>
        <div className="grid gap-2">
          {session.status === "signed-in" ? (
            <Button asChild variant="rush" className="min-h-12">
              <Link to={passHref(level)}>
                Get a pass
                <Icon icon={ArrowRightIcon} size={16} />
              </Link>
            </Button>
          ) : (
            <Button
              variant="rush"
              className="min-h-12"
              onClick={() => showSignIn("account")}
            >
              Sign in to get a pass
            </Button>
          )}
          <Button asChild variant="paper" className="min-h-12">
            <Link to={`${BOARD_PATH}/levels`} replace>
              Back to the levels
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
