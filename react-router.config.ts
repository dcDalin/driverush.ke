import type { Config } from "@react-router/dev/config";

/**
 * React Router 8: middleware, split route modules, Vite's environment API and
 * pass-through requests are the defaults, so there are no `future` flags.
 * Loaders read `url` (the clean address), never `new URL(request.url)`: on a
 * data request the raw request keeps its `.data` suffix.
 */
export default {
  ssr: true,
} satisfies Config;
