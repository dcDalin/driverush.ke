/**
 * `/school/:schoolId/passes/price`: what the school's learners pay, set by
 * its owner in a modal over the passes page. At least DriveRush's share
 * plus a little; no ceiling.
 */
import { Navigate } from "react-router";

import { kes } from "~/components/account/pass-offers";
import { ModalForm } from "~/components/console/route-modal";
import { InputField } from "~/components/ui/forms/server";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";
import { SetPassPriceSchema } from "~/schemas/billing";

import type { Route } from "./+types/pass-price";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function PassPrice() {
  const d = useSchool();
  const closeTo = schoolPath(d.school.id, "passes");
  const here = schoolPath(d.school.id, "passes/price");
  const info = d.passInfo;
  const form = useServerForm({
    schema: SetPassPriceSchema,
    key: "set-pass-price",
    action: here,
    defaultValues: {
      intent: "set-pass-price" as const,
      priceKes: info?.price_kes ?? 0,
    },
  });
  if (!info || !d.canManage) return <Navigate to={closeTo} replace />;
  const share = info.driverush_share_kes;
  const min = info.min_price_kes;
  const typed = Number(form.methods.watch("priceKes"));
  const earns = Number.isFinite(typed) && typed >= min ? typed - share : null;
  return (
    <ModalForm
      form={form}
      here={here}
      closeTo={closeTo}
      label="Passes"
      title="Change your price"
      description="What a learner pays for 60 days of the full course through your school. New payments use it at once."
      submit="Save price"
    >
      <InputField
        name="priceKes"
        label="Price for your learners (KES)"
        description={
          earns !== null
            ? `You earn ${kes(earns)} per learner, less Paystack's fee. At least ${kes(min)}.`
            : `At least ${kes(min)}: DriveRush keeps ${kes(share)}.`
        }
        disabled={form.busy}
        inputProps={{
          type: "number",
          inputMode: "numeric",
          min,
          step: 1,
          autoFocus: true,
        }}
      />
    </ModalForm>
  );
}
