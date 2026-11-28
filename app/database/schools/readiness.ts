/**
 * Whether a school is ready to be public (owner, 2026-11-28). DriveRush
 * staff hand a school over with its name and livery; it shows on the site
 * and the board only once its owner has given it a logo, a tagline or about
 * text, and at least one open branch.
 *
 * The database decides (`private.is_active_school`); this says the same to
 * the owner's "Get your school ready" list and to the console, so keep the
 * two in step.
 */
export type SchoolReadiness = {
  logo: boolean;
  profile: boolean;
  branch: boolean;
  /** All three: an active school with these is public. */
  ready: boolean;
};

export function schoolReadiness({
  logo,
  tagline,
  about,
  openBranches,
}: {
  logo: unknown;
  tagline: string | null | undefined;
  about: string | null | undefined;
  openBranches: number;
}): SchoolReadiness {
  const has = {
    logo: Boolean(logo),
    profile: Boolean(tagline || about),
    branch: openBranches > 0,
  };
  return { ...has, ready: has.logo && has.profile && has.branch };
}
