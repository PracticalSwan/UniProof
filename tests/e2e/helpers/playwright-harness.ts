import path from "node:path";

const SAFE_HARNESS_ID = /^[A-Za-z0-9_-]{1,80}$/;
const PLAYWRIGHT_DEFAULT_PORT = 3102;

export function resolvePlaywrightPort(value: string | undefined): number {
  if (value === undefined) return PLAYWRIGHT_DEFAULT_PORT;
  if (!/^[1-9]\d{0,4}$/u.test(value)) {
    throw new Error("Invalid Playwright port; expected an integer from 1 through 65535.");
  }
  const port = Number(value);
  if (port > 65_535) {
    throw new Error("Invalid Playwright port; expected an integer from 1 through 65535.");
  }
  return port;
}

export function resolvePlaywrightOrigin(value: string | undefined): string {
  return `http://127.0.0.1:${resolvePlaywrightPort(value)}`;
}

export const phase3dDevHarnessRootFiles = [
  "next.config.ts",
  "next-env.d.ts",
  "package.json",
  "postcss.config.mjs",
  "proxy.ts",
  "tsconfig.json",
] as const;

export type Phase3dDevHarness = {
  id: string;
  relative: string;
  root: string;
};

export function resolvePhase3dDevHarness(options: {
  projectRoot: string;
  processId: number;
  inheritedId?: string;
}): Phase3dDevHarness {
  const id = options.inheritedId ?? String(options.processId);
  if (!SAFE_HARNESS_ID.test(id)) {
    throw new Error("Invalid Playwright dev harness ID; expected only letters, numbers, underscore, or hyphen.");
  }

  const projectRoot = path.resolve(options.projectRoot);
  const outputRoot = path.resolve(projectRoot, "output", "playwright");
  const root = path.resolve(outputRoot, `phase3d-dev-app-${id}`);
  const relativeToOutput = path.relative(outputRoot, root);
  if (
    relativeToOutput === "" ||
    relativeToOutput.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToOutput)
  ) {
    throw new Error("Playwright dev harness path must remain inside output/playwright.");
  }

  return {
    id,
    relative: path.relative(projectRoot, root).split(path.sep).join("/"),
    root,
  };
}
