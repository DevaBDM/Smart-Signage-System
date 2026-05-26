import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config dedicated to generating user-manual screenshots.
 *
 * Unlike the default config, this one:
 *   • Targets the *running* dev backend on port 5000 (not a separate test server on 5001)
 *   • Reuses an existing Vite dev server on 5173 if present, instead of spawning one
 *   • Runs only `tests/generate_docs.spec.js`
 *
 * Usage:
 *   npx playwright test --config playwright.docs.config.js
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /generate_docs\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        VITE_PROXY_TARGET: "http://127.0.0.1:5000",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
