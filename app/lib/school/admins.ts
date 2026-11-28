/** A school has at most 50 admins; invites not yet taken up count too. */
export const MAX_ADMINS = 50;

/** Admins and admin invites, counted against `MAX_ADMINS`. */
export function adminCount(
  team: { role: string }[],
  invites: { role: string }[],
) {
  return (
    team.filter((m) => m.role === "admin").length +
    invites.filter((i) => i.role === "admin").length
  );
}
