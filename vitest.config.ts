import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["scripts/generate-schema.ts", "src/storage/validate-migrations.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    environment: "node",
    include: ["test/**/*.test.ts"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
