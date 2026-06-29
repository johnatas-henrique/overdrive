import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "playwright/artifacts",
  timeout: 30_000,
  retries: 1,
  reporter: [["html", { outputFolder: "playwright/report" }]],
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
