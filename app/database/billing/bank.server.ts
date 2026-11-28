/**
 * A school owner's bank request, recorded with the service role after the
 * route has checked the owner and Paystack has made the subaccount (no client
 * may record a subaccount: `school_request_bank` is granted to the service
 * role only). It waits for DriveRush staff (`reviewBank`).
 */
import { fail, ok, reasonFor, type Result } from "../result";
import { getSupabaseServiceClient } from "../supabase/service.server";

/** Returns the earlier request it replaced (to switch off), or null. */
export async function requestSchoolBank(input: {
  schoolId: string;
  actorId: string;
  subaccountCode: string;
  bankLabel: string;
  accountName: string;
}): Promise<Result<string | null>> {
  const { data, error } = await getSupabaseServiceClient().rpc(
    "school_request_bank",
    {
      p_school_id: input.schoolId,
      p_actor: input.actorId,
      p_subaccount_code: input.subaccountCode,
      p_bank_label: input.bankLabel,
      p_account_name: input.accountName,
    },
  );
  if (error) return fail(reasonFor(error));
  return ok(data ?? null);
}
