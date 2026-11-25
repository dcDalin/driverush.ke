/**
 * The learner's school, in the account menu: the school they are linked to
 * this month, and any school waiting for them to say yes. With two schools
 * waiting, or one while already linked, the learner chooses (switching ends
 * the current school's month early; that school sees why).
 */
import * as React from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { refreshEntitlement, useEntitlement } from "~/lib/auth/entitlement";
import { loadClient } from "~/lib/auth/session";

type Invite = { id: string; school: string; branch: string };

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
});

export function MySchool({ userId }: { userId: string }) {
  const entitlement = useEntitlement();
  const [invites, setInvites] = React.useState<Invite[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const supabase = await loadClient();
    const { data } = await supabase
      .from("school_student_links")
      .select("id, schools(name), school_branches(name)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("added_at");
    setInvites(
      (data ?? []).map((row) => ({
        id: row.id,
        school: row.schools?.name ?? "A school",
        branch: row.school_branches?.name ?? "",
      })),
    );
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function answer(id: string, accept: boolean) {
    setBusy(id);
    const supabase = await loadClient();
    const { error } = accept
      ? await supabase.rpc("learner_accept_school_link", { p_link_id: id })
      : await supabase.rpc("learner_decline_school_link", { p_link_id: id });
    setBusy(null);
    if (error) {
      toast.error("That did not work. Try again.");
      return;
    }
    toast.success(
      accept ? "You are now with this school for a month." : "Declined.",
    );
    await Promise.all([load(), refreshEntitlement(userId)]);
  }

  const linked = entitlement?.tier === "school" && entitlement.school_name;
  if (!linked && !invites?.length) return null;

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
      {invites?.map((invite) => (
        <div key={invite.id} className="flex flex-col gap-1.5">
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
              disabled={busy !== null}
              onClick={() => answer(invite.id, true)}
            >
              Join
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => answer(invite.id, false)}
            >
              No thanks
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
