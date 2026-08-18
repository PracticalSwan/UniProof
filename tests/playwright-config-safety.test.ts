import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import {
  phase3dDevHarnessRootFiles,
  resolvePhase3dDevHarness,
} from "@/tests/e2e/helpers/playwright-harness";

describe("Phase 3D Playwright dev harness path safety", () => {
  const projectRoot = path.resolve("D:/Side Projects/UniProof");

  it("keeps a generated harness inside the ignored output/playwright root", () => {
    const harness = resolvePhase3dDevHarness({
      projectRoot,
      processId: 4242,
    });
    const allowedRoot = path.resolve(projectRoot, "output", "playwright");
    const relativeToAllowed = path.relative(allowedRoot, harness.root);

    expect(harness.id).toBe("4242");
    expect(harness.relative).toBe("output/playwright/phase3d-dev-app-4242");
    expect(relativeToAllowed).not.toBe("");
    expect(relativeToAllowed.startsWith(".." + path.sep)).toBe(false);
    expect(path.isAbsolute(relativeToAllowed)).toBe(false);
  });

  it("copies the root CSP proxy into every isolated dev harness", () => {
    expect(phase3dDevHarnessRootFiles).toContain("proxy.ts");
  });

  it("keeps generated Playwright source snapshots outside the root TypeScript program", () => {
    const tsconfig = JSON.parse(readFileSync(path.resolve(process.cwd(), "tsconfig.json"), "utf8")) as {
      exclude?: string[];
    };
    const excludes = tsconfig.exclude ?? [];
    expect(excludes.some((entry) => entry === "output" || entry === "output/playwright" || entry === "output/**")).toBe(true);
  });

  it("retains dev entries for the full one-worker browser acceptance window", () => {
    expect(nextConfig.onDemandEntries).toEqual({
      maxInactiveAge: 10 * 60 * 1000,
      pagesBufferLength: 8,
    });
  });

  it("rejects inherited harness IDs that contain path traversal or separators", () => {
    for (const inheritedId of [
      "x/../../../../outside-root",
      "x\\..\\..\\outside-root",
      "../outside-root",
      "/absolute-like",
    ]) {
      expect(() =>
        resolvePhase3dDevHarness({
          projectRoot,
          processId: 4242,
          inheritedId,
        }),
      ).toThrow(/invalid Playwright dev harness ID/i);
    }
  });
});
