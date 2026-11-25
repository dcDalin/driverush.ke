import { defineConfig } from "vitest/config";

// Kept apart from `vite.config.ts` so the React Router plugin never loads
// under test. Three projects:
//   unit    pure logic and components beside the code, `npm test`
//   db      database functions through the real API (local stack), `npm run test:db`
//   routes  route loaders and actions called directly with persona cookies
//           (local stack), `npm run test:routes`
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["app/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["test/db/**/*.test.ts"],
          environment: "node",
          globalSetup: ["test/db/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: "routes",
          include: ["test/routes/**/*.test.ts"],
          environment: "node",
          globalSetup: ["test/db/global-setup.ts"],
          setupFiles: ["test/routes/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
