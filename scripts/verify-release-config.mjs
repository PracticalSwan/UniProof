import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DISCOVERY_KEYS = ["TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY"];
const AI_KEYS = ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"];
const AUTH_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

function present(env, name) {
  return typeof env[name] === "string" && env[name].trim() !== "";
}

function isForbiddenProductionHostname(rawHostname) {
  const unbracketed = rawHostname.toLowerCase().replace(/^\[|\]$/gu, "");
  const hostname = unbracketed.endsWith(".") ? unbracketed.slice(0, -1) : unbracketed;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname === "0.0.0.0" || hostname === "::" || hostname === "::1") return true;

  if (isIP(hostname) === 4) {
    const firstOctet = Number(hostname.split(".", 1)[0]);
    return firstOctet === 127;
  }

  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(hostname);
  if (mapped !== null) {
    const highWord = Number.parseInt(mapped[1], 16);
    return Number.isFinite(highWord) && (highWord >> 8) === 127;
  }

  return false;
}

function exactHttpsOrigin(value, { rejectLoopback = true } = {}) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username !== "" || url.password !== "") return false;
    if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return false;
    if (rejectLoopback && isForbiddenProductionHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function issue(variable, message) {
  return { variable, message };
}

function normalizeRepositoryPath(value) {
  return String(value).replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function isSecretBearingOrDisposablePath(value) {
  const relativePath = normalizeRepositoryPath(value);
  const baseName = relativePath.split("/").at(-1) ?? relativePath;
  if (relativePath === ".env.example") return false;
  if (relativePath === ".env" || relativePath.startsWith(".env.")) return true;
  if (relativePath.startsWith(".vercel/")) return true;
  if (relativePath.startsWith("supabase/.temp/")) return true;
  if (relativePath.startsWith("output/playwright/")) return true;
  if (relativePath.startsWith("ui-flow-screenshots/")) return true;
  return baseName.endsWith(".pem") || baseName.endsWith(".key");
}

/**
 * @param {{ trackedFiles?: readonly string[], stagedFiles?: readonly string[] }} [metadata]
 */
export function evaluateReleaseFileMetadata({ trackedFiles = [], stagedFiles = [] } = {}) {
  const issues = [];
  const seen = new Set();
  for (const [source, files] of [["tracked", trackedFiles], ["staged", stagedFiles]]) {
    for (const value of files) {
      const relativePath = normalizeRepositoryPath(value);
      if (!isSecretBearingOrDisposablePath(relativePath)) continue;
      const key = `${source}:${relativePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(issue(
        relativePath,
        `${source === "tracked" ? "Tracked" : "Staged"} release metadata includes a protected, secret-bearing, or disposable path.`,
      ));
    }
  }
  return issues;
}

function readGitPaths(root, args) {
  const raw = execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return raw.split("\0").filter((value) => value !== "");
}

function sameStringMap(left = {}, right = {}) {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function walkSourceFiles(root, relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const files = [];
  const visit = (absoluteDir, relativeDir) => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = normalizeRepositoryPath(path.join(relativeDir, entry.name));
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile() && /\.(?:[cm]?js|jsx|tsx?)$/u.test(entry.name)) {
        files.push(relativePath);
      }
    }
  };
  visit(absoluteRoot, relativeRoot);
  return files;
}

export function evaluateReleaseConfiguration(env = {}, profile = "production") {
  const normalizedProfile = String(profile).trim().toLowerCase();
  const issues = [];
  const resilienceNotes = [];
  const authPresent = AUTH_KEYS.map((name) => present(env, name));
  const authConfigured = authPresent.every(Boolean);
  const discoveryProviderClassesConfigured = {
    tavily: present(env, "TAVILY_API_KEY"),
    brave: present(env, "BRAVE_SEARCH_API_KEY"),
  };
  const structuredAiProviderClassesConfigured = {
    gemini: present(env, "GEMINI_API_KEY"),
    groq: present(env, "GROQ_API_KEY"),
    openrouter: present(env, "OPENROUTER_API_KEY"),
  };

  if (normalizedProfile === "production") {
    if (!present(env, "NEXT_PUBLIC_APP_URL") || !exactHttpsOrigin(env.NEXT_PUBLIC_APP_URL)) {
      issues.push(issue(
        "NEXT_PUBLIC_APP_URL",
        "Production requires NEXT_PUBLIC_APP_URL to be one exact non-loopback HTTPS origin.",
      ));
    }

    if (env.UNIPROOF_RESEARCH_MODE !== "live") {
      issues.push(issue(
        "UNIPROOF_RESEARCH_MODE",
        "Production requires UNIPROOF_RESEARCH_MODE=live.",
      ));
    }

    if (!DISCOVERY_KEYS.some((name) => present(env, name))) {
      issues.push(issue(
        "TAVILY_API_KEY",
        "Production requires at least one configured discovery provider: Tavily or Brave.",
      ));
    }

    if (!AI_KEYS.some((name) => present(env, name))) {
      issues.push(issue(
        "GEMINI_API_KEY",
        "Production requires at least one configured structured-AI provider: Gemini, Groq, or OpenRouter.",
      ));
    }

    if (authPresent.some(Boolean) && !authConfigured) {
      const missing = authPresent[0] ? AUTH_KEYS[1] : AUTH_KEYS[0];
      issues.push(issue(missing, "Supabase Auth must be fully configured or fully absent."));
    }
    if (authConfigured && !exactHttpsOrigin(env.NEXT_PUBLIC_SUPABASE_URL)) {
      issues.push(issue(
        "NEXT_PUBLIC_SUPABASE_URL",
        "Production Supabase Auth requires a non-loopback HTTPS project origin.",
      ));
    }

    for (const name of DISCOVERY_KEYS) {
      if (!present(env, name)) resilienceNotes.push(`${name} is not configured; discovery fallback resilience is reduced.`);
    }
    for (const name of AI_KEYS) {
      if (!present(env, name)) resilienceNotes.push(`${name} is not configured; structured AI fallback resilience is reduced.`);
    }
  }

  return {
    profile: normalizedProfile,
    releaseReady: issues.length === 0,
    authConfigured,
    discoveryProviderClassesConfigured,
    structuredAiProviderClassesConfigured,
    issues,
    resilienceNotes,
  };
}

function readText(root, relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(root, relativePath, checked, issues) {
  checked.push(relativePath);
  if (!existsSync(path.join(root, relativePath))) {
    issues.push(issue(relativePath, `Required release contract file is missing: ${relativePath}.`));
    return false;
  }
  return true;
}

export function verifyRepositoryReleaseContracts(
  root = process.cwd(),
  { requireProtectedScreenshots = true, gitMetadata } = {},
) {
  const checked = [];
  const issues = [];
  const requiredFiles = [
    "package.json",
    "package-lock.json",
    ".gitignore",
    ".vercelignore",
    "vercel.json",
    "next.config.ts",
    "app/api/research/route.ts",
    "lib/integrations/gemini/structured.ts",
    "lib/security/browser-policy.ts",
    "lib/security/research-limits.ts",
    ".github/workflows/ci.yml",
    "docs/planning/phase-6-requirements-traceability.md",
    "docs/operations/vercel-production.md",
  ];

  for (const relativePath of requiredFiles) requireFile(root, relativePath, checked, issues);

  let releaseMetadata = gitMetadata;
  if (releaseMetadata === undefined) {
    try {
      releaseMetadata = {
        trackedFiles: readGitPaths(root, ["ls-files", "-z"]),
        stagedFiles: readGitPaths(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]),
      };
    } catch {
      issues.push(issue("git", "Release metadata could not be inspected safely."));
    }
  }
  if (releaseMetadata !== undefined) {
    issues.push(...evaluateReleaseFileMetadata(releaseMetadata));
  }

  if (existsSync(path.join(root, "package.json")) && existsSync(path.join(root, "package-lock.json"))) {
    try {
      const manifest = JSON.parse(readText(root, "package.json"));
      const lock = JSON.parse(readText(root, "package-lock.json"));
      const lockRoot = lock.packages?.[""];
      if (
        lockRoot === undefined ||
        manifest.name !== lockRoot.name ||
        manifest.version !== lockRoot.version ||
        !sameStringMap(manifest.dependencies, lockRoot.dependencies) ||
        !sameStringMap(manifest.devDependencies, lockRoot.devDependencies)
      ) {
        issues.push(issue("package-lock.json", "package.json and the lockfile root dependency contract must match."));
      }
      if (manifest.engines?.node !== "22.x" || lockRoot?.engines?.node !== "22.x") {
        issues.push(issue("package.json", "Release builds must pin the Vercel Node.js major to 22.x in both manifest and lockfile."));
      }
    } catch {
      issues.push(issue("package-lock.json", "package.json and package-lock.json must be valid JSON."));
    }
  }

  if (existsSync(path.join(root, ".gitignore"))) {
    const gitignore = readText(root, ".gitignore");
    for (const requiredPattern of [
      ".env\n",
      ".env.*\n",
      "!.env.example\n",
      "output/playwright/\n",
      ".vercel/\n",
      "supabase/.temp/\n",
    ]) {
      if (!gitignore.includes(requiredPattern)) {
        issues.push(issue(".gitignore", `Release ignore contract is missing required pattern: ${requiredPattern.trim()}.`));
      }
    }
  }

  if (existsSync(path.join(root, ".vercelignore"))) {
    const vercelignore = readText(root, ".vercelignore");
    for (const requiredPattern of [
      "ui-flow-screenshots/\n",
      "output/\n",
      "test-results/\n",
      "supabase/.temp/\n",
      ".env\n",
      ".env.*\n",
      "!.env.example\n",
    ]) {
      if (!vercelignore.includes(requiredPattern)) {
        issues.push(issue(".vercelignore", `Vercel deployment ignore contract is missing required pattern: ${requiredPattern.trim()}.`));
      }
    }
  }

  if (existsSync(path.join(root, "vercel.json"))) {
    try {
      const config = JSON.parse(readText(root, "vercel.json"));
      const functions = config.functions ?? {};
      const optedIn = Object.entries(functions)
        .filter(([, value]) => value?.supportsCancellation === true)
        .map(([key]) => key);
      if (optedIn.length !== 1 || optedIn[0] !== "app/api/research/route.ts") {
        issues.push(issue(
          "vercel.json",
          "Vercel request cancellation must opt in only app/api/research/route.ts.",
        ));
      }
    } catch {
      issues.push(issue("vercel.json", "vercel.json must be valid JSON."));
    }
  }

  if (existsSync(path.join(root, "app/api/research/route.ts"))) {
    const route = readText(root, "app/api/research/route.ts");
    if (!route.includes('export const runtime = "nodejs";')) {
      issues.push(issue("app/api/research/route.ts", "Research must use the Node.js runtime."));
    }
    if (!route.includes("export const maxDuration = 300;")) {
      issues.push(issue("app/api/research/route.ts", "Research must retain the reviewed 300-second host duration ceiling."));
    }
  }

  if (existsSync(path.join(root, "lib/security/research-limits.ts"))) {
    const limits = readText(root, "lib/security/research-limits.ts");
    if (!limits.includes("export const RESEARCH_TOTAL_DEADLINE_MS = 240_000;")) {
      issues.push(issue(
        "lib/security/research-limits.ts",
        "Research must retain the reviewed 240-second application deadline below the 300-second host ceiling.",
      ));
    }
  }

  if (existsSync(path.join(root, "lib/integrations/gemini/structured.ts"))) {
    const gemini = readText(root, "lib/integrations/gemini/structured.ts");
    if (!gemini.includes("https://generativelanguage.googleapis.com/v1/interactions")) {
      issues.push(issue("lib/integrations/gemini/structured.ts", "Gemini must use the stable v1 Interactions endpoint."));
    }
    if (gemini.includes("/v1beta/interactions")) {
      issues.push(issue("lib/integrations/gemini/structured.ts", "Gemini must not use the v1beta Interactions endpoint."));
    }
  }

  for (const relativePath of ["vercel.json", "next.config.ts", "lib/security/browser-policy.ts"]) {
    if (!existsSync(path.join(root, relativePath))) continue;
    if (/strict-transport-security/iu.test(readText(root, relativePath))) {
      issues.push(issue(relativePath, "UniProof must not add a custom HSTS header on Vercel."));
    }
  }

  const browserBoundaryKeys = [
    ...DISCOVERY_KEYS,
    ...AI_KEYS,
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const relativePath of [
    ...walkSourceFiles(root, "app"),
    ...walkSourceFiles(root, "components"),
  ]) {
    const source = readText(root, relativePath);
    if (browserBoundaryKeys.some((name) => source.includes(name))) {
      issues.push(issue(relativePath, "Provider or service-role key names must not cross into app/component client surfaces."));
    }
  }
  for (const relativeRoot of ["lib/auth", "lib/persistence", "lib/supabase"]) {
    for (const relativePath of walkSourceFiles(root, relativeRoot)) {
      if (readText(root, relativePath).includes("SUPABASE_SERVICE_ROLE_KEY")) {
        issues.push(issue(relativePath, "Ordinary auth and persistence runtime must not use the Supabase service-role key."));
      }
    }
  }

  if (existsSync(path.join(root, ".github/workflows/ci.yml"))) {
    const workflow = readText(root, ".github/workflows/ci.yml");
    const requiredSnippets = [
      "pull_request:",
      "push:",
      "permissions:\n  contents: read",
      "node-version: '22.19.0'",
      "package-manager-cache: false",
      "npm ci",
      "npx vitest run",
      "npx tsc --noEmit",
      "npx eslint .",
      "npm run build",
      "node scripts/verify-release-config.mjs --profile=ci",
      "supabase db reset",
      "supabase db lint",
      "supabase db advisors --local",
      "supabase test db",
      "2.114.0",
    ];
    for (const snippet of requiredSnippets) {
      if (!workflow.includes(snippet)) {
        issues.push(issue(".github/workflows/ci.yml", `CI release contract is missing required text: ${snippet}.`));
      }
    }
    for (const forbidden of [
      "pull_request_target:",
      "secrets.",
      ...DISCOVERY_KEYS,
      ...AI_KEYS,
      "SUPABASE_SERVICE_ROLE_KEY",
      "vercel deploy",
      "supabase link",
      "--linked",
    ]) {
      if (workflow.includes(forbidden)) {
        issues.push(issue(".github/workflows/ci.yml", `CI release contract contains forbidden text: ${forbidden}.`));
      }
    }
    const actionUses = [...workflow.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/gu)];
    for (const [, action, ref] of actionUses) {
      if (!/^[a-f0-9]{40}$/u.test(ref)) {
        issues.push(issue(".github/workflows/ci.yml", `GitHub Action ${action} must be pinned to a full immutable SHA.`));
      }
    }
  }

  const screenshotDir = path.join(root, "ui-flow-screenshots");
  checked.push("ui-flow-screenshots/*.png");
  if (existsSync(screenshotDir)) {
    const screenshots = readdirSync(screenshotDir).filter((name) => name.toLowerCase().endsWith(".png"));
    if (screenshots.length !== 10) {
      issues.push(issue("ui-flow-screenshots", "Protected UI-flow screenshot manifest must contain exactly 10 PNG files."));
    }
  } else if (requireProtectedScreenshots) {
    issues.push(issue("ui-flow-screenshots", "Protected UI-flow screenshot directory is missing from the local verification workspace."));
  }

  return { ok: issues.length === 0, checked, issues };
}

function parseProfile(argv) {
  const explicit = argv.find((value) => value.startsWith("--profile="));
  return explicit === undefined ? "ci" : explicit.slice("--profile=".length);
}

const invokedPath = process.argv[1] === undefined ? "" : path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const profile = parseProfile(process.argv.slice(2));
  const root = process.cwd();
  const repository = verifyRepositoryReleaseContracts(root, {
    requireProtectedScreenshots: process.env.GITHUB_ACTIONS !== "true",
  });
  const environment = evaluateReleaseConfiguration(process.env, profile);
  const issues = [...repository.issues, ...environment.issues];

  if (issues.length > 0) {
    console.error(`Release configuration verification failed for profile ${profile}.`);
    for (const entry of issues) console.error(`- ${entry.variable}: ${entry.message}`);
    process.exit(1);
  }

  for (const note of environment.resilienceNotes) console.warn(`- ${note}`);
  console.log(`Release configuration verification passed for profile ${profile}.`);
}
