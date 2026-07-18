import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173/prompts/",
    serviceWorkers: "block",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    },
    {
      name: "mobile-430",
      use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: "npm run preview -- --host 0.0.0.0",
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
});
