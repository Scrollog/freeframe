import { defineConfig } from "vitest/config";

// The extension's Vite config bundles CEP assets and ExtendScript. Unit tests
// exercise domain modules only, so they must not load that packaging config.
export default defineConfig({
  test: {
    include: ["src/js/**/*.test.ts"],
    environment: "node",
  },
});
