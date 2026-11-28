import type { Config } from "@react-router/dev/config";

import { prerenderPaths } from "./app/lib/prerender-paths";

/**
 * React Router 8: middleware, split route modules, Vite's environment API and
 * pass-through requests are the defaults, so there are no `future` flags.
 * Loaders read `url` (the clean address), never `new URL(request.url)`: on a
 * data request the raw request keeps its `.data` suffix.
 */
export default {
  ssr: true,
  // Every public page that is the same for every visitor is built as a file
  // (`.html` for a visit, `.data` for a move from another page). The rest are
  // rendered on request. See `app/lib/prerender-paths.ts`.
  prerender: {
    paths: ({ getStaticPaths }) =>
      prerenderPaths(getStaticPaths(), process.cwd()),
    concurrency: 4,
  },
} satisfies Config;
