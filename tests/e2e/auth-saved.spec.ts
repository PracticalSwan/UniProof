import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { signInWithLocalMagicLink } from "./helpers/auth-browser";
import { fillGuideProfile } from "./helpers/guide-browser";
import { resolvePlaywrightOrigin } from "./helpers/playwright-harness";

const localOnly = process.env.UNIPROOF_E2E_LOCAL_SUPABASE === "1";
const e2eOrigin = resolvePlaywrightOrigin(process.env.UNIPROOF_E2E_PORT);
const runId = randomUUID().slice(0, 12);

function testEmail(label: string): string {
  return `phase6a-${label}-${runId}@example.test`;
}

test.skip(!localOnly, "Requires the local Supabase/Auth/Mailpit stack.");

const profileArtifact = {
  kind: "profile",
  schemaVersion: 1,
  payload: {
    citizenship: "Exampleland",
    currentCountry: "Testland",
    qualification: {
      level: "bachelor",
      title: "BSc Computer Science",
      subject: "Computer Science",
      gpa: { value: 3.6, scale: 4 },
    },
    englishTest: { kind: "ielts", overall: 7 },
    budget: { amount: 24000, currency: "USD", scope: "annual" },
    scholarshipNeed: true,
  },
} as const;

async function createProfile(page: Page): Promise<string> {
  const response = await page.request.post("/api/saved-artifacts", {
    headers: { "content-type": "application/json; charset=utf-8" },
    data: profileArtifact,
  });
  expect(response.status()).toBe(201);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json() as { id?: unknown };
  expect(typeof body.id).toBe("string");
  return body.id as string;
}

test.describe("Phase 6A local authentication and saved snapshots", () => {
  test("Auth is keyboard-operable, announces validation, and has no 320px horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/auth");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Send sign-in link" }).click();
    const status = page.getByRole("status");
    await expect(status).toHaveText("Enter a valid email address.");
    await expect(status).toBeFocused();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator("[tabindex]:not([tabindex='0']):not([tabindex='-1'])")).toHaveCount(0);
  });

  test("Magic Link PKCE flow signs in, persists through navigation, and keeps browser CSP narrowly scoped", async ({ page, request }) => {
    const authResponse = await page.request.get("/auth");
    const csp = authResponse.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("http://127.0.0.1:54321");
    expect(csp).not.toContain("*.supabase.co");
    expect(csp).not.toContain("tavily");
    expect(csp).not.toContain("groq");
    expect(csp).not.toContain("openrouter");

    await signInWithLocalMagicLink(page, request, testEmail("auth-a"));
    await page.goto("/research");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    const malformed = await page.request.get("/auth/confirm?token_hash=not-valid&type=email", { maxRedirects: 0 });
    expect(malformed.status()).toBe(303);
    expect(malformed.headers()["location"]).toContain("/auth");
    expect(malformed.headers()["cache-control"]).toContain("no-store");
  });

  test("local-scope sign out leaves a second session for the same invented account signed in", async ({ browser, request }) => {
    const first = await browser.newContext({ baseURL: e2eOrigin });
    const second = await browser.newContext({ baseURL: e2eOrigin });
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();
    try {
      const sharedEmail = testEmail("shared");
      await signInWithLocalMagicLink(firstPage, request, sharedEmail);
      await signInWithLocalMagicLink(secondPage, request, sharedEmail);

      const signOutResponsePromise = firstPage.waitForResponse((response) =>
        response.url().endsWith("/api/auth/sign-out") && response.request().method() === "POST",
      );
      await firstPage.getByRole("button", { name: "Sign out" }).click();
      const signOutResponse = await signOutResponsePromise;
      expect(signOutResponse.status()).toBe(200);
      expect(await signOutResponse.json()).toEqual({ signedOut: true });
      await expect(firstPage.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();

      await secondPage.reload();
      await expect(secondPage.getByRole("button", { name: "Sign out" })).toBeVisible();
    } finally {
      await first.close();
      await second.close();
    }
  });

  test("saves a valid applicant profile explicitly before any target selection or Research request", async ({ page, request }) => {
    await signInWithLocalMagicLink(page, request, testEmail("profile-direct"));
    let researchRequests = 0;
    let saveRequests = 0;
    page.on("request", (browserRequest) => {
      if (browserRequest.url().endsWith("/api/research") && browserRequest.method() === "POST") researchRequests += 1;
      if (browserRequest.url().endsWith("/api/saved-artifacts") && browserRequest.method() === "POST") saveRequests += 1;
    });

    await page.goto("/guide");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("#guide-qual-title")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#guide-qual-subject")).toHaveAttribute("aria-invalid", "true");
    expect(saveRequests).toBe(0);
    expect(researchRequests).toBe(0);

    await fillGuideProfile(page, {
      citizenship: "Exampleland",
      currentCountry: "Testland",
      qualificationTitle: "BSc Computer Science",
      qualificationSubject: "Computer Science",
      gpaValue: "3.6",
      gpaScale: "4",
      englishKind: "ielts",
      englishOverall: "7",
      budgetAmount: "24000",
      budgetCurrency: "USD",
      scholarshipNeed: true,
    });
    await expect(page.locator("#guide-program-select")).toHaveValue("");

    const saveResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/saved-artifacts") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save profile" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(201);
    await expect(page.getByText("Applicant profile saved privately.")).toBeVisible();
    await expect(page.locator("#guide-qual-title")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#guide-qual-subject")).not.toHaveAttribute("aria-invalid", "true");
    expect(saveRequests).toBe(1);
    expect(researchRequests).toBe(0);

    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Applicant profile" })).toHaveCount(1);
    await page.setViewportSize({ width: 320, height: 740 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("saves, lists, restores, and deletes a private profile without a persistent browser restore channel", async ({ page, request }) => {
    await signInWithLocalMagicLink(page, request, testEmail("profile"));
    const id = await createProfile(page);

    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Applicant profile" })).toBeVisible();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page).toHaveURL(/\/guide$/u, { timeout: 15_000 });
    await expect(page.getByLabel("Citizenship")).toHaveValue("Exampleland");
    await expect(page.getByLabel("Current country")).toHaveValue("Testland");
    await expect(page.locator("#guide-program-select")).toHaveValue("");
    await expect(page.getByText("It was not submitted and no research was started.")).toBeVisible();

    const persistentState = await page.evaluate(async () => {
      const indexed = await indexedDB.databases();
      const cacheKeys = "caches" in window ? await caches.keys() : [];
      return {
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
        indexed: indexed.map((item) => item.name ?? ""),
        caches: cacheKeys,
        href: window.location.href,
      };
    });
    expect(persistentState.local).toEqual([]);
    expect(persistentState.session).toEqual([]);
    expect(persistentState.indexed.filter((name) => name !== "__next_debug_channel")).toEqual([]);
    expect(persistentState.caches).toEqual([]);
    expect(persistentState.href).not.toContain(id);

    await page.goto("/saved");
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete snapshot" }).click();
    await expect(page.getByRole("button", { name: "Refresh list" })).toBeFocused();
    await expect(page.getByText("No saved snapshots yet.")).toBeVisible();
  });

  test("sign out clears restored private profile state from the active Guide workspace", async ({ page, request }) => {
    await signInWithLocalMagicLink(page, request, testEmail("profile-signout"));
    await createProfile(page);
    await page.goto("/saved");
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page).toHaveURL(/\/guide$/u, { timeout: 15_000 });
    await expect(page.getByLabel("Citizenship")).toHaveValue("Exampleland");

    const signOutResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/sign-out") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Sign out" }).click();
    expect((await signOutResponsePromise).status()).toBe(200);
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Citizenship")).toHaveValue("");
    await expect(page.getByLabel("Current country")).toHaveValue("");
    expect((await page.request.get("/api/saved-artifacts")).status()).toBe(401);
  });

  test("cross-user saved artifact IDs are non-disclosing and mutations reject cross-origin requests", async ({ browser, request }) => {
    const userA = await browser.newContext({ baseURL: e2eOrigin });
    const userB = await browser.newContext({ baseURL: e2eOrigin });
    const pageA = await userA.newPage();
    const pageB = await userB.newPage();
    try {
      await signInWithLocalMagicLink(pageA, request, testEmail("owner-a"));
      const artifactId = await createProfile(pageA);
      await signInWithLocalMagicLink(pageB, request, testEmail("owner-b"));

      const getOther = await pageB.request.get(`/api/saved-artifacts/${artifactId}`);
      const deleteOther = await pageB.request.delete(`/api/saved-artifacts/${artifactId}`);
      expect(getOther.status()).toBe(404);
      expect(deleteOther.status()).toBe(404);
      expect((await getOther.json()).error).toBe("snapshot-not-found");
      expect((await deleteOther.json()).error).toBe("snapshot-not-found");

      const crossOrigin = await pageB.request.post("/api/saved-artifacts", {
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "content-type": "application/json; charset=utf-8",
        },
        data: profileArtifact,
      });
      expect(crossOrigin.status()).toBe(403);
      expect((await crossOrigin.json()).error).toBe("forbidden-origin");
    } finally {
      await userA.close();
      await userB.close();
    }
  });
});
