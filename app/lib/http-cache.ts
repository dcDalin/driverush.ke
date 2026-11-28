/**
 * Cache-Control values, in one place. Public pages are the same for every
 * visitor (the session is read in the browser), so Vercel's CDN may keep
 * them; pages about one person never are.
 */

/** A server-rendered public page: the CDN keeps it an hour, then serves it stale while it renders the next. */
export const PUBLIC_PAGE_CACHE =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** Public, but drawn from data that changes (schools' own pages): five minutes. */
export const PUBLIC_DATA_PAGE_CACHE =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

/** Anything about one signed-in person. */
export const PRIVATE_NO_STORE = "private, no-store";
