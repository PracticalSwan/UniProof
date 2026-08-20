import { describe, expect, it } from "vitest";

import {
  evaluateReleaseFileMetadata,
  evaluateReleaseConfiguration,
  verifyRepositoryReleaseContracts,
} from "../scripts/verify-release-config.mjs";
import { GEMINI_INTERACTIONS_ENDPOINT } from "@/lib/integrations/gemini/structured";

const productionEnv = {
  NEXT_PUBLIC_APP_URL: "https://uniproof.example",
  UNIPROOF_RESEARCH_MODE: "live",
  TAVILY_API_KEY: "test",
  GEMINI_API_KEY: "test",
};

describe("release configuration verifier", () => {
  it("accepts a minimal class-based live production profile and reports only reduced resilience", () => {
    const result = evaluateReleaseConfiguration({ ...productionEnv }, "production");
    expect(result).toMatchObject({
      profile: "production",
      releaseReady: true,
      authConfigured: false,
      discoveryProviderClassesConfigured: { tavily: true, brave: false },
      structuredAiProviderClassesConfigured: { gemini: true, groq: false, openrouter: false },
    });
    expect(result.issues).toEqual([]);
    expect(result.resilienceNotes).toEqual(expect.arrayContaining([
      "BRAVE_SEARCH_API_KEY is not configured; discovery fallback resilience is reduced.",
      "GROQ_API_KEY is not configured; structured AI fallback resilience is reduced.",
      "OPENROUTER_API_KEY is not configured; structured AI fallback resilience is reduced.",
    ]));
  });

  it("accepts fully configured HTTPS auth and does not require the service-role key", () => {
    const result = evaluateReleaseConfiguration({
      ...productionEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://uniproof.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
    }, "production");
    expect(result.releaseReady).toBe(true);
    expect(result.authConfigured).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it.each([
    ["missing app URL", { NEXT_PUBLIC_APP_URL: "" }],
    ["HTTP app URL", { NEXT_PUBLIC_APP_URL: "http://uniproof.example" }],
    ["localhost", { NEXT_PUBLIC_APP_URL: "https://localhost" }],
    ["trailing-dot localhost", { NEXT_PUBLIC_APP_URL: "https://localhost." }],
    ["trailing-dot localhost subdomain", { NEXT_PUBLIC_APP_URL: "https://app.localhost." }],
    ["loopback IP", { NEXT_PUBLIC_APP_URL: "https://127.0.0.1" }],
    ["unspecified IP", { NEXT_PUBLIC_APP_URL: "https://0.0.0.0" }],
    ["IPv4-mapped loopback IP", { NEXT_PUBLIC_APP_URL: "https://[::ffff:127.0.0.1]" }],
    ["path influence", { NEXT_PUBLIC_APP_URL: "https://uniproof.example/path" }],
    ["query influence", { NEXT_PUBLIC_APP_URL: "https://uniproof.example/?x=1" }],
    ["fragment influence", { NEXT_PUBLIC_APP_URL: "https://uniproof.example/#fragment" }],
    ["credentials", { NEXT_PUBLIC_APP_URL: "https://user:synthetic@uniproof.example" }],
  ])("rejects a production app URL with %s", (_name, overrides) => {
    const result = evaluateReleaseConfiguration({ ...productionEnv, ...overrides }, "production");
    expect(result.releaseReady).toBe(false);
    expect(result.issues.some((issue) => issue.variable === "NEXT_PUBLIC_APP_URL")).toBe(true);
  });

  it("requires deliberate live mode and at least one provider in each required class", () => {
    const seed = evaluateReleaseConfiguration(productionEnv, "production");
    expect(seed.releaseReady).toBe(true);

    const notLive = evaluateReleaseConfiguration({
      ...productionEnv,
      UNIPROOF_RESEARCH_MODE: "seed",
    }, "production");
    expect(notLive.releaseReady).toBe(false);
    expect(notLive.issues.some((issue) => issue.variable === "UNIPROOF_RESEARCH_MODE")).toBe(true);

    const zeroSearch = evaluateReleaseConfiguration({
      ...productionEnv,
      TAVILY_API_KEY: "",
    }, "production");
    expect(zeroSearch.releaseReady).toBe(false);
    expect(zeroSearch.issues.some((issue) => issue.variable === "TAVILY_API_KEY")).toBe(true);

    const zeroAi = evaluateReleaseConfiguration({
      ...productionEnv,
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
      OPENROUTER_API_KEY: "",
    }, "production");
    expect(zeroAi.releaseReady).toBe(false);
    expect(zeroAi.issues.some((issue) => issue.variable === "GEMINI_API_KEY")).toBe(true);
  });

  it("rejects half-configured production auth", () => {
    const result = evaluateReleaseConfiguration({
      ...productionEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://uniproof.supabase.co",
    }, "production");
    expect(result.releaseReady).toBe(false);
    expect(result.issues.some((issue) => issue.variable === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).toBe(true);
  });

  it("does not require production secrets in development or CI profiles", () => {
    for (const profile of ["development", "ci"] as const) {
      const result = evaluateReleaseConfiguration({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        UNIPROOF_RESEARCH_MODE: "seed",
      }, profile);
      expect(result).toMatchObject({
        profile,
        releaseReady: true,
        authConfigured: false,
      });
      expect(result.issues).toEqual([]);
    }
  });
});

describe("repository release contract", () => {
  it("rejects synthetic staged or tracked secret-bearing release paths without reading file contents", () => {
    const result = evaluateReleaseFileMetadata({
      trackedFiles: [".env.example", "src/safe.ts", "output/playwright/phase3d-dev-app-123/page.js"],
      stagedFiles: ["supabase/.temp/project-ref", ".vercel/project.json"],
    });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ variable: "output/playwright/phase3d-dev-app-123/page.js" }),
      expect.objectContaining({ variable: "supabase/.temp/project-ref" }),
      expect.objectContaining({ variable: ".vercel/project.json" }),
    ]));
    expect(result.some((issue) => issue.variable === ".env.example")).toBe(false);
  });

  it("verifies local release files and configuration without secret-bearing output", () => {
    const result = verifyRepositoryReleaseContracts(process.cwd());
    expect(result.issues).toEqual([]);
    expect(result.checked).toEqual(expect.arrayContaining([
      ".github/workflows/ci.yml",
      "app/api/research/route.ts",
      "docs/planning/phase-6-requirements-traceability.md",
      "docs/operations/vercel-production.md",
      "vercel.json",
    ]));
    expect(GEMINI_INTERACTIONS_ENDPOINT).toBe("https://generativelanguage.googleapis.com/v1/interactions");
  });
});
