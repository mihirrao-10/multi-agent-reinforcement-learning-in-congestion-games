import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Chromium uses software WebGL on the hosted Linux runner. Keep the browser
  // performance measurement isolated from another CPU-bound browser process so
  // its frame-cadence assertion measures the story rather than runner contention.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL:
      "http://127.0.0.1:4187/multi-agent-reinforcement-learning-in-congestion-games/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4187 --strictPort",
    url: "http://127.0.0.1:4187/multi-agent-reinforcement-learning-in-congestion-games/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "test-results",
});
