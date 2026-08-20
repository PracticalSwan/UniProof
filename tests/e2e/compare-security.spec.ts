import { expect, test } from "@/tests/e2e/helpers/research-browser";
import {
  openResearch,
  selectFixtureProgram,
  submitResearch,
} from "@/tests/e2e/helpers/research-browser";
import {
  openCompare,
  selectDefaultComparisonTargets,
  submitComparison,
} from "@/tests/e2e/helpers/compare-browser";
import { defaultComparisonBrowserResponses } from "@/tests/fixtures/comparison-browser";
import { succeededAllReadyResponse } from "@/tests/fixtures/research-dossiers";

const production = process.env.UNIPROOF_E2E_PRODUCTION === "1";
const e2ePort = process.env.UNIPROOF_E2E_PORT ?? "3102";
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

function directive(policy: string, name: string): string {
  return policy.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? "";
}

function nonceFrom(policy: string): string {
  const match = policy.match(/'nonce-([^']+)'/);
  expect(match).not.toBeNull();
  return match![1]!;
}

function assertApprovedHeaders(headers: Record<string, string>, policy: string): void {
  const nonce = nonceFrom(policy);
  expect(directive(policy, "script-src")).toContain(`'nonce-${nonce}'`);
  expect(directive(policy, "script-src")).toContain("'strict-dynamic'");
  expect(directive(policy, "script-src")).not.toContain("'unsafe-inline'");
  expect(directive(policy, "script-src-attr")).toBe("script-src-attr 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'none'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-dns-prefetch-control"]).toBe("off");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["strict-transport-security"]).toBeUndefined();
  expect(headers["x-powered-by"]).toBeUndefined();

  if (production) {
    expect(directive(policy, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(policy, "style-src-elem")).toContain(`'nonce-${nonce}'`);
    expect(directive(policy, "style-src-elem")).not.toContain("'unsafe-inline'");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
  } else {
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "style-src-elem")).toBe("style-src-elem 'self' 'unsafe-inline'");
    expect(directive(policy, "connect-src")).toContain(`ws://127.0.0.1:${e2ePort}`);
  }
}

test.describe("Phase 4 Compare security and privacy", () => {
  test("serves fresh nonce CSP and approved headers on every public HTML route", async ({ page }) => {
    const seenNonces = new Set<string>();
    for (const path of ["/", "/research", "/compare", "/guide"] as const) {
      const response = await page.goto(path);
      expect(response).not.toBeNull();
      const headers = response!.headers();
      const policy = headers["content-security-policy"] ?? "";
      assertApprovedHeaders(headers, policy);
      const nonce = nonceFrom(policy);
      expect(nonce).toMatch(/^[A-Za-z0-9+/_=-]+$/);
      expect(seenNonces.has(nonce), `${path} should receive a fresh request nonce`).toBe(false);
      seenNonces.add(nonce);
    }

    const reloaded = await page.reload();
    const reloadPolicy = reloaded?.headers()["content-security-policy"] ?? "";
    const reloadNonce = nonceFrom(reloadPolicy);
    expect(seenNonces.has(reloadNonce)).toBe(false);
  });

  test("keeps executable script origins first-party and nonce-binds server-rendered inline scripts", async ({ page }) => {
    const response = await page.goto("/compare");
    const policy = response?.headers()["content-security-policy"] ?? "";
    const nonce = nonceFrom(policy);
    const scripts = await page.locator("script").evaluateAll((elements) => elements.map((element) => ({
      src: (element as HTMLScriptElement).src,
      text: element.textContent ?? "",
      nonce: (element as HTMLScriptElement).nonce,
    })));
    for (const script of scripts) {
      if (script.src !== "") expect(new URL(script.src).origin).toBe(e2eOrigin);
      if (script.src === "" && script.text.trim() !== "") expect(script.nonce).toBe(nonce);
    }
    await expect(page.locator("iframe, object, embed")).toHaveCount(0);
    expect(scripts.some((script) => script.src !== "")).toBe(true);
  });

  test("records zero CSP violations through Compare and Research evidence flows", async ({ page, research }) => {
    await page.addInitScript(() => {
      const root = globalThis as typeof globalThis & { __uniproofCspViolations?: string[] };
      root.__uniproofCspViolations = [];
      window.addEventListener("securitypolicyviolation", (event) => {
        root.__uniproofCspViolations!.push(`${event.effectiveDirective}:${event.blockedURI}`);
      });
    });

    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    research.enqueueJson(succeededAllReadyResponse);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await page.locator("[data-comparison-card='1']").getByRole("button", { name: "View Affordability evidence" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await openResearch(page);
    await selectFixtureProgram(page);
    await submitResearch(page);
    await expect(page.getByRole("region", { name: "Research dossier" })).toBeVisible();
    await page.getByRole("button", { name: /View evidence for Published application code/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    const violations = await page.evaluate(() =>
      (globalThis as typeof globalThis & { __uniproofCspViolations?: string[] }).__uniproofCspViolations ?? [],
    );
    expect(violations).toEqual([]);
  });

  test("keeps comparison state memory-only with no browser persistence, cookie, service worker, or URL state", async ({ page, research, context }) => {
    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    await openCompare(page);
    if (!production) {
      await expect.poll(async () => page.evaluate(async () =>
        typeof indexedDB.databases === "function" ? (await indexedDB.databases()).length : 0,
      )).toBeGreaterThanOrEqual(1);
    }
    const baseline = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDb: typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((database) => database.name ?? "").sort()
        : [],
      caches: "caches" in globalThis ? (await caches.keys()).sort() : [],
      serviceWorkers: "serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).map((registration) => registration.scope).sort() : [],
    }));
    await selectDefaultComparisonTargets(page);
    await page.getByLabel("Intake (public context only, optional)").fill("Fall 2027");
    await page.getByLabel("Academic year (public context only, optional)").fill("2027-28");
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();

    const persistence = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDb: typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((database) => database.name ?? "").sort()
        : [],
      caches: "caches" in globalThis ? (await caches.keys()).sort() : [],
      serviceWorkers: "serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).map((registration) => registration.scope).sort() : [],
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    }));
    expect(persistence.localStorage).toBe(baseline.localStorage);
    expect(persistence.sessionStorage).toBe(baseline.sessionStorage);
    expect(persistence.indexedDb).toEqual(baseline.indexedDb);
    expect(persistence.caches).toEqual(baseline.caches);
    expect(persistence.serviceWorkers).toEqual(baseline.serviceWorkers);
    if (production) {
      expect(baseline.localStorage).toBe(0);
      expect(baseline.sessionStorage).toBe(0);
      expect(baseline.indexedDb).toEqual([]);
      expect(baseline.caches).toEqual([]);
      expect(baseline.serviceWorkers).toEqual([]);
    }
    expect(persistence).toMatchObject({ path: "/compare", search: "", hash: "" });
    expect(await context.cookies()).toEqual([]);
  });

  test("keeps provider internals and provider key names out of rendered DOM and public Research responses", async ({ page, research }) => {
    const responseBodies: string[] = [];
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname !== "/api/research") return;
      try {
        responseBodies.push(await response.text());
      } catch {
        responseBodies.push("<unreadable>");
      }
    });

    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await expect.poll(() => responseBodies.length).toBe(2);

    const text = `${await page.locator("body").innerText()}\n${responseBodies.join("\n")}`.toLowerCase();
    for (const forbidden of [
      "tavily_api_key",
      "brave_search_api_key",
      "gemini_api_key",
      "groq_api_key",
      "openrouter_api_key",
      "researchproviderattempt",
      "providerattempts",
      "providerattempt",
      "rawdocuments",
      "retrievaldocuments",
      "claimcandidates",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
