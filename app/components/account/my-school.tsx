/**
 * The learner's school, in the account menu: the school they are linked to
 * this month, and any school waiting for them to say yes. With two schools
 * waiting, or one while already linked, the learner chooses (joining ends the
 * current school's month early; that school sees why).
 *
 * Data comes from the `/api/me/school-invites` resource route through typed
 * fetchers: one loads the list, one per invite posts the answer.
 */
import * as React from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { refreshEntitlement, useEntitlement } from "~/lib/auth/entitlement";
import type { action, loader } from "~/routes/api/me.school-invites";

export const SCHOOL_INVITES_PATH = "/api/me/school-invites";

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
});

export function MySchool({ userId }: { userId: string }) {
  const entitlement = useEntitlement();
  const list = useFetcher<typeof loader>({ key: "school-invites" });

  React.useEffect(() => {
    if (list.state === "idle" && !list.data) list.load(SCHOOL_INVITES_PATH);
  }, [list]);

  const invites = list.data?.invites ?? [];
  const linked = entitlement?.tier === "school" && entitlement.school_name;
  if (!linked && invites.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-2 border-b border-line pb-3">
      {linked && (
        <p className="text-[13px] text-ink-2">
          With{" "}
          <span className="font-semibold text-ink">
            {entitlement.school_name}
          </span>
          {entitlement.ends_at &&
            ` until ${DATE.format(new Date(entitlement.ends_at))}`}
        </p>
      )}
      {invites.map((invite) => (
        <InviteRow
          key={invite.id}
          invite={invite}
          linked={Boolean(linked)}
          onAnswered={() => {
            list.load(SCHOOL_INVITES_PATH);
            void refreshEntitlement(userId);
          }}
        />
      ))}
    </div>
  );
}

function InviteRow({
  invite,
  linked,
  onAnswered,
}: {
  invite: { id: string; school: string; branch: string };
  linked: boolean;
  onAnswered: () => void;
}) {
  const answer = useFetcher<typeof action>({
    key: `school-invite:${invite.id}`,
  });
  const busy = answer.state !== "idle";
  const sent = answer.formData?.get("intent");

  React.useEffect(() => {
    if (answer.state !== "idle" || !answer.data) return;
    if (answer.data.ok) {
      toast.success(answer.data.message);
      onAnswered();
    } else {
      toast.error(answer.data.message);
    }
    // Only when this answer settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.state, answer.data]);

  const submit = (intent: "join" | "decline") =>
    answer.submit(
      { intent, linkId: invite.id },
      { method: "POST", action: SCHOOL_INVITES_PATH },
    );

  return (
    <div className="flex flex-col gap-1.5" aria-busy={busy || undefined}>
      <p className="text-[13px] text-ink-2">
        <span className="font-semibold text-ink">{invite.school}</span>
        {invite.branch && ` (${invite.branch})`} added you.
        {linked && " Joining ends your month with your current school."}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="rush"
          isLoading={sent === "join"}
          disabled={busy}
          onClick={() => submit("join")}
        >
          Join
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          isLoading={sent === "decline"}
          disabled={busy}
          onClick={() => submit("decline")}
        >
          No thanks
        </Button>
      </div>
    </div>
  );
}
