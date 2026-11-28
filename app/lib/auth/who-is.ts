/** A name and picture for the signed-in person: Google's, or made from the email. */
export function whoIs(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata ?? {};
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const fullName = text(meta.full_name) ?? text(meta.name);
  const firstName =
    fullName?.split(/\s+/)[0] ?? user.email?.split("@")[0] ?? "Account";
  return {
    fullName,
    firstName,
    initial: (firstName[0] ?? "?").toUpperCase(),
    picture: text(meta.avatar_url) ?? text(meta.picture),
  };
}
