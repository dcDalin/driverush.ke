/**
 * GET /api/board-schools: the board's schools (public profiles and live
 * liveries, as URLs) for the browser to refresh its list without a page
 * load. Public and the same for everyone, so Vercel's CDN keeps it
 * (s-maxage) and serves a stale copy while it fetches the next; the service
 * worker keeps one for offline.
 */
import { data } from "react-router";

import { loadBoardSchools } from "~/lib/board/school-catalog.server";

export async function loader() {
  const schools = await loadBoardSchools();
  return data(
    { schools },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
