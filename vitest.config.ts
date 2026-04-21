import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

const pkg = (name: string): string =>
  resolve(rootDir, "packages", name, "src", "index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@acts/core": pkg("core"),
      "@acts/compress": pkg("compress"),
      "@acts/sandbox": pkg("sandbox"),
      "@acts/memory": pkg("memory"),
      "@acts/observe": pkg("observe"),
      "@acts/mcp": pkg("mcp"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/**/*.d.ts", "packages/*/src/**/index.ts"],
    },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
