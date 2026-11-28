/**
 * `/api/me/school-invites`: schools waiting for the signed-in learner, for the
 * account menu's fetcher. GET lists them; POST answers one (`join` or
 * `decline`). A resource route: no page of its own.
 */
import { data } from "react-router";
import { z } from "zod";

import {
  acceptSchoolInvite,
  declineSchoolInvite,
  listMySchoolInvites,
} from "~/database/learner/school-invites";
import { requireUser } from "~/lib/auth/require.server";
import { formFields } from "~/lib/forms/form-intent";
import { IdSchema } from "~/schemas/fields";

import type { Route } from "./+types/me.school-invites";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await requireUser(request);
  return data(
    { invites: await listMySchoolInvites(supabase, caller.userId) },
    { headers },
  );
}

const AnswerSchema = z.object({
  intent: z.enum(["join", "decline"]),
  linkId: IdSchema,
});

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = await requireUser(request);
  const parsed = AnswerSchema.safeParse(formFields(await request.formData()));
  if (!parsed.success) {
    return data(
      {
        ok: false as const,
        message: "Something is missing. Reload and try again.",
      },
      { status: 400, headers },
    );
  }
  const { intent, linkId } = parsed.data;
  const result =
    intent === "join"
      ? await acceptSchoolInvite(supabase, linkId)
      : await declineSchoolInvite(supabase, linkId);
  if (result.error)
    return data({ ok: false as const, message: result.error }, { headers });
  return data(
    {
      ok: true as const,
      message:
        intent === "join"
          ? "You are now with this school for a month."
          : "Declined.",
    },
    { headers },
  );
}
