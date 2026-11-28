/**
 * A bot trap on every server form (remix-utils honeypot, as in thinkrush):
 * `<HoneypotInputs />` adds a hidden field and a sealed timestamp, and each
 * action calls `checkHoneypot` first. A filled trap or an inhumanly quick
 * submit is refused with a 400. `HONEYPOT_SECRET` seals the timestamp.
 */
import { Honeypot, SpamError } from "remix-utils/honeypot/server";

const NAME_FIELD = "name__confirm";

export const honeypot = new Honeypot({
  nameFieldName: NAME_FIELD,
  validFromFieldName: process.env.NODE_ENV === "test" ? null : undefined,
  encryptionSeed: process.env.HONEYPOT_SECRET,
});

/** `required`: refuse a submission that left the trap out entirely. */
export async function checkHoneypot(
  formData: FormData,
  { required = true }: { required?: boolean } = {},
) {
  if (required && !formData.has(NAME_FIELD)) {
    throw new Response("Form not submitted properly.", { status: 400 });
  }
  try {
    await honeypot.check(formData);
  } catch (error) {
    if (error instanceof SpamError)
      throw new Response("Form not submitted properly.", { status: 400 });
    throw error;
  }
}
