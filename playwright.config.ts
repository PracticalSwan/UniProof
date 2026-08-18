import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

import {
  phase3dDevHarnessRootFiles,
  resolvePhase3dDevHarness,
} from "./tests/e2e/helpers/playwright-harness";

const port = 3102;
const productionServer = process.env.UNIPROOF_E2E_PRODUCTION === "1";
const inheritedDevHarnessId = process.env.UNIPROOF_E2E_DEV_HARNESS_ID;
const devHarness = productionServer
  ? undefined
  : resolvePhase3dDevHarness({
      projectRoot: process.cwd(),
      processId: process.pid,
      ...(inheritedDevHarnessId === undefined ? {} : { inheritedId: inheritedDevHarnessId }),
    });

if (devHarness !== undefined && inheritedDevHarnessId === undefined) {
  process.env.UNIPROOF_E2E_DEV_HARNESS_ID = devHarness.id;
  const projectRoot = process.cwd();
  rmSync(devHarness.root, { recursive: true, force: true });
  mkdirSync(devHarness.root, { recursive: true });
  for (const directory of ["app", "components", "lib", "public", "types"]) {
    cpSync(path.join(projectRoot, directory), path.join(devHarness.root, directory), { recursive: true });
  }
  for (const file of phase3dDevHarnessRootFiles) {
    cpSync(path.join(projectRoot, file), path.join(devHarness.root, file));
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  outputDir: "test-results/phase3",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: productionServer
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npx next dev ${devHarness!.relative} --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/research`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
