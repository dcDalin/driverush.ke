import mdx from "@mdx-js/rollup";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

/**
 * Writes `sw-board.json` into the client build: every file the board game
 * needs, found by walking the play route's chunk through its imports,
 * including the lazy ones (the 3D table, three.js). The page's HTML only lists
 * what loads first, so without this the service worker could not make the
 * game ready to drive offline before it was ever opened. See `public/sw.js`.
 */
function boardOfflineList(): Plugin {
  return {
    name: "driverush:board-offline-list",
    apply: "build",
    generateBundle(_, bundle) {
      if (this.environment?.name !== "client") return;
      const start = Object.values(bundle).find(
        (item) =>
          item.type === "chunk" &&
          item.facadeModuleId?.includes("/app/routes/board-play.tsx"),
      );
      if (!start) {
        this.warn(
          "No chunk for app/routes/board-play.tsx: sw-board.json not written",
        );
        return;
      }
      const files = new Set<string>();
      const walk = (fileName: string) => {
        if (files.has(fileName)) return;
        const item = bundle[fileName];
        if (!item || item.type !== "chunk") return;
        files.add(fileName);
        for (const css of item.viteMetadata?.importedCss ?? []) files.add(css);
        for (const next of [...item.imports, ...item.dynamicImports])
          walk(next);
      };
      walk(start.fileName);
      this.emitFile({
        type: "asset",
        fileName: "sw-board.json",
        source: JSON.stringify([...files].sort().map((file) => `/${file}`)),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    // MDX must run before reactRouter so .mdx files are JSX by the time the
    // router plugin sees them. `frontmatter` is exported as a named export so
    // routes can pluck `title`, `description`, `slug`, etc.
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [
          remarkGfm,
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: "frontmatter" }],
        ],
        providerImportSource: "~/components/brand/mdx-components",
      }),
    },
    tailwindcss(),
    reactRouter(),
    boardOfflineList(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  // PostHog ships browser-only ESM; bundling it into the SSR build (rather
  // than letting Node resolve it) avoids "document is not defined" style
  // errors during server rendering.
  ssr: {
    noExternal: ["posthog-js", "@posthog/react"],
  },
});
