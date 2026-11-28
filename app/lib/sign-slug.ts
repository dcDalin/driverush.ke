/**
 * A sign's address piece, from its name: "Bend to the left" → "bend-to-the-left".
 * No imports, so the prerender list (`prerender-paths.ts`, read by
 * `react-router.config.ts` outside the app's build) can use it too.
 */
export function signSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
