import { defineConfig, devices } from "@playwright/test";
import { E2E_BACKEND_PORT, E2E_BASE_URL, E2E_PORT, prepareE2eWorkspace } from "./tests/e2e/global-setup";

const workspace = prepareE2eWorkspace();

// One server and one database for the whole run, so the specs run one at a time and each one
// starts by clearing the data it depends on (tests/e2e/support/fixtures.ts).
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    // A new installation: no company, no preference (AC-dm-01, AC-dm-02, AC-dm-03)
    { name: "fresh-db", testMatch: /firstRun\.spec\.ts/ },
    { name: "main", testIgnore: /firstRun\.spec\.ts/, dependencies: ["fresh-db"] },
  ],
  webServer: {
    command: "pnpm dev",
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(E2E_PORT),
      BACKEND_PORT: String(E2E_BACKEND_PORT),
      DATABASE_URL: workspace.databaseUrl,
      HOME: workspace.homeDir,
      USERPROFILE: workspace.homeDir,
    },
  },
});
