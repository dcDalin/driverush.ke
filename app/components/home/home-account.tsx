/**
 * Under the home page's course card, for a learner who has started: what
 * stands between them and keeping their progress, or what their account
 * gives them.
 *
 *   a guest     "Keep your progress": the levels live on this phone only,
 *               and one button opens the sign-in sheet (Google first).
 *   signed in   their pass or their school, in one quiet line; with passes
 *               on sale and no pass, the way to the full course.
 *
 * Nothing for a first visit: nobody is asked for anything before they have
 * driven (`lead-with-the-product`).
 */
import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import {
  CheckIcon,
  ChevronRightIcon,
  GoogleIcon,
  StarIcon,
} from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { useEntitlement } from "~/lib/auth/entitlement";
import { useSession } from "~/lib/auth/session";
import { googleEnabled } from "~/lib/auth/sign-in";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";
import { passesOn } from "~/lib/board/use-paywall";

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
});

const row =
  "flex min-h-16 items-center gap-3 rounded-lg border border-ink/25 bg-surface px-4 py-3 text-ink";

export function HomeAccount({ levelsDone }: { levelsDone: number }) {
  const session = useSession();
  const entitlement = useEntitlement();
  const show = useSignInSheet((s) => s.show);

  if (session.status === "signed-out" && levelsDone > 0) {
    return (
      <div className={row}>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] leading-tight font-bold tracking-tight">
            Keep your progress
          </span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">
            {levelsDone} {levelsDone === 1 ? "level is" : "levels are"} saved on
            this phone only. Sign in and{" "}
            {levelsDone === 1 ? "it follows" : "they follow"} you to any phone.
          </span>
        </span>
        <Button
          type="button"
          variant="paper"
          size="sm"
          className="shrink-0"
          onClick={() => show("save-progress")}
        >
          {googleEnabled() && <Icon icon={GoogleIcon} size={14} />}
          Save it
        </Button>
      </div>
    );
  }

  if (session.status !== "signed-in" || !entitlement) return null;

  if (entitlement.full_access && entitlement.pass_ends_at) {
    return (
      <p className={`${row} m-0 text-[14px]`}>
        <Icon icon={StarIcon} size={18} className="shrink-0 text-amber" />
        <span>
          Full course until{" "}
          <strong>{DATE.format(new Date(entitlement.pass_ends_at))}</strong>.
          Your progress is saved to your account.
        </span>
      </p>
    );
  }
  if (passesOn()) {
    return (
      <Link
        to="/pass"
        className={`${row} no-underline transition-colors outline-none hover:bg-paper-2 focus-visible:bg-paper-2`}
      >
        <Icon icon={StarIcon} size={18} className="shrink-0 text-amber" />
        <span className="min-w-0 flex-1 text-[14px]">
          <strong className="block">Get the full course</strong>
          <span className="text-ink-2">
            Every level and the mock test, for 60 days.
          </span>
        </span>
        <Icon icon={ChevronRightIcon} size={18} className="shrink-0" />
      </Link>
    );
  }
  return (
    <p className={`${row} m-0 text-[14px] text-ink-2`}>
      <Icon
        icon={CheckIcon}
        size={18}
        className="shrink-0 text-success-strong"
      />
      Your progress is saved to your account, on any phone you sign in on.
    </p>
  );
}
