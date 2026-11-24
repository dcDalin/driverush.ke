import { defineConfig } from "vitest/config";

// Kept apart from `vite.config.ts` so the React Router plugin never loads
// under test. Two projects:
//   unit  pure logic (the board's rules), `npm test`
//   db    the database through the real API; needs the local Supabase stack
//         (`npm run db:start`), `npm run test:db`
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["app/**/*.test.ts"],
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
    ],
  },
});
