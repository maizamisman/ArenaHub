import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
// The e2e server gets its own database and upload folder, and a test-only reset endpoint.
const env = {
  ARENAHUB_DB: "data/e2e.db",
  ARENAHUB_UPLOADS: "data/e2e-uploads",
  ARENAHUB_E2E: "1",
  ARENAHUB_TOTP_SECRET: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `node scripts/reset-db.ts && npx next build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/live`,
    timeout: 240_000,
    reuseExistingServer: false,
    env,
    stdout: "ignore",
    stderr: "pipe",
  },
});
