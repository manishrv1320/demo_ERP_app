import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // server-only throws outside React Server Components; tests run server code directly.
      "server-only": path.resolve(import.meta.dirname, "tests/setup/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // A throwaway embedded PostgreSQL with every migration applied (nothing needs to be running).
    globalSetup: ["tests/setup/global.ts"],
    // PGlite serves one connection at a time, so test files run one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
