import mdx from "@mdx-js/rollup";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig, type Plugin } from "vite";

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

/**
 * The release every PostHog event and error is stamped with: the commit Vercel
 * is building, or `dev`. Set on `process.env` here because Vite reads `VITE_*`
 * variables from it after loading this file.
 */
process.env.VITE_APP_VERSION ??= (
  process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"
).slice(0, 7);

/**
 * `build.txt`: the release above, so an app that stays open can see that a
 * newer deploy is live and load it on its next move (`app/lib/fresh-build.ts`).
 */
function buildStamp(): Plugin {
  return {
    name: "driverush:build-stamp",
    apply: "build",
    generateBundle() {
      if (this.environment?.name !== "client") return;
      this.emitFile({
        type: "asset",
        fileName: "build.txt",
        source: `${process.env.VITE_APP_VERSION}\n`,
      });
    },
  };
}

/**
 * Source maps are only built when they will be sent to PostHog error tracking
 * (`scripts/upload-sourcemaps.mjs` uploads them, then deletes them so they are
 * never served).
 */
const UPLOAD_SOURCEMAPS = Boolean(process.env.POSTHOG_CLI_API_KEY);

export default defineConfig({
  build: {
    sourcemap: UPLOAD_SOURCEMAPS,
  },
  // DriveRush's own port block (573x dev, 574x built previews): 5173 is
  // Vite's default and other projects on this Mac use it. Supabase's
  // site_url and redirect list (supabase/config.toml) follow this port.
  server: { port: 5730, strictPort: true },
  // Dev server only: pre-bundle what lazily loaded code imports (the sign-in
  // sheet, the board game, the 3D trainers), so opening one never makes Vite
  // re-bundle mid-session, which loads a second React and breaks its hooks.
  optimizeDeps: {
    include: [
      "@hookform/resolvers/zod",
      "@posthog/react",
      "class-variance-authority",
      "clsx",
      "posthog-js",
      "radix-ui",
      "remix-toast",
      "sonner",
      "tailwind-merge",
      "three/examples/jsm/environments/RoomEnvironment.js",
      "three/examples/jsm/geometries/RoundedBoxGeometry.js",
      "three/examples/jsm/libs/meshopt_decoder.module.js",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/examples/jsm/loaders/SVGLoader.js",
      "three/examples/jsm/utils/BufferGeometryUtils.js",
      "@react-three/drei",
      "@react-three/fiber",
      "framer-motion",
      "matter-js",
      "nipplejs",
      "react-day-picker",
      "three",
      "three-stdlib",
      "zustand",
      "zustand/middleware",
      "zustand/react/shallow",
      "@supabase/ssr",
      "@supabase/supabase-js",
      "input-otp",
      "react-hook-form",
      "remix-hook-form",
      "remix-utils/honeypot/react",
      "zod",
    ],
  },
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
    buildStamp(),
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
