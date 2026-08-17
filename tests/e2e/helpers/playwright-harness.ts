import path from "node:path";

const SAFE_HARNESS_ID = /^[A-Za-z0-9_-]{1,80}$/;

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
