/**
 * A Kenyan bank account's three fields (bank, account number, account name),
 * for a form whose schema has them: the owner's bank request and the staff
 * console's checked bank. Rendered inside that form's ServerFormProvider.
 */
import { InputField, SelectField } from "~/components/ui/forms/server";

export function BankFields({
  banks,
  disabled,
}: {
  banks: { name: string; code: string }[];
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SelectField
        name="bankCode"
        label="Bank"
        placeholder="Pick the bank"
        disabled={disabled}
        options={banks.map((b) => ({ label: b.name, value: b.code }))}
      />
      <InputField
        name="accountNumber"
        label="Account number"
        disabled={disabled}
        inputProps={{ inputMode: "numeric", autoComplete: "off" }}
      />
      <InputField
        name="accountName"
        label="Account name"
        description="As on the bank letter."
        disabled={disabled}
        inputProps={{ autoComplete: "organization" }}
      />
    </div>
  );
}
