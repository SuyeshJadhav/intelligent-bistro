import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for The Intelligent Bistro
 *
 * Test structure:
 * - Unit tests:        tests/unit/
 * - Integration tests: tests/integration/
 * - Performance tests: tests/performance/
 * - Snapshot tests:    tests/snapshots/
 * - Backend tests:     server/__tests__/  (separate vitest.config.ts)
 *
 * Run tests:
 *   npm test               → full suite (CI mode)
 *   npm run test:watch     → watch mode
 *   npm run test:coverage  → with coverage report
 *   npm run test:unit      → unit tests only
 *   npm run test:integration → integration tests only
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // Node environment for pure logic; use 'jsdom' for component tests
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],

    // Test file patterns
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules/", "server/", ".expo/", "dist/"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["lib/**/*.ts", "store/**/*.ts"],
      exclude: [
        "node_modules/",
        "tests/",
        "dist/",
        "dist-*",
        ".expo/",
        "**/*.d.ts",
        "**/types.ts",
      ],
      // Coverage thresholds — CI will fail if these drop below targets
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },

    // Retry flaky tests up to 2 times in CI
    retry: process.env.CI ? 2 : 0,

    // Timeout per test
    testTimeout: 30_000,

    // Reporter config
    reporters: process.env.CI
      ? ["verbose", "json", "github-actions"]
      : ["verbose"],

    outputFile: {
      json: "./test-results/results.json",
    },
  },
  resolve: {
    alias: [
      {
        find: "@/assets/menuAssets",
        replacement: path.resolve(__dirname, "./assets/menuAssets.mock.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./"),
      },
    ],
  },
});
