import { test, expect } from "./helpers/research-browser";
import { openGuide, selectGuideProgram, fillGuideProfile, submitGuide, guideFixtureTarget } from "./helpers/guide-browser";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";

const markers = {
  citizenship: "UNIQUE-CIT-MARKER-9f3a",
  currentCountry: "UNIQUE-CTRY-MARKER-7b2c",
  title: "UNIQUE-TITLE-MARKER-4d1e",
  subject: "UNIQUE-SUBJ-MARKER-8a5f",
  otherTestName: "UNIQUE-TEST-MARKER-3c8d",
  otherTestScore: "UNIQUE-SCORE-MARKER-5e7f",
  budget: "987654321",
};

function dossier(options: { supportingText?: string } = {}) {
  return buildGuideDossier({
    universityId: guideFixtureTarget.university.id,
    programId: guideFixtureTarget.program.id,
    admissionsClaims: [
      makeClaim({
        id: "security-gpa",
        property: "Minimum GPA",
        value: 3.0,
        unit: "4.00",
        ...(options.supportingText === undefined ? {} : { supportingText: options.supportingText }),
      }),
    ],
  });
}

async function fillPrivateMarkers(page: import("@playwright/test").Page) {
  await selectGuideProgram(page);
  await fillGuideProfile(page, {
    citizenship: markers.citizenship,
    currentCountry: markers.currentCountry,
    qualificationTitle: markers.title,
    qualificationSubject: markers.subject,
    gpaValue: "3.77",
    gpaScale: "4.00",
    englishKind: "other",
    otherEnglishName: markers.otherTestName,
    otherEnglishScore: markers.otherTestScore,
    budgetAmount: markers.budget,
    budgetCurrency: "USD",
    budgetScope: "annual",
    scholarshipNeed: true,
  });
}

function assertNoPrivateMarker(text: string) {
  for (const marker of Object.values(markers)) expect(text).not.toContain(marker);
  expect(text).not.toContain("3.77");
}

test.describe("Guide security and privacy", () => {
  test("profile values and keys never enter the public Research request", async ({ page, research }) => {
    await openGuide(page);
    await fillPrivateMarkers(page);
    research.enqueueJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    const request = research.requests[0];
    expect(request).toBeDefined();
    const bodyText = JSON.stringify(request?.body);
    assertNoPrivateMarker(bodyText);
    for (const key of [
      "citizenship",
      "currentCountry",
      "qualification",
      "englishTest",
      "budget",
      "scholarshipNeed",
      "assessmentDate",
    ]) {
      expect(bodyText).not.toContain(key);
    }

    const body = request?.body as Record<string, unknown>;
    expect(body.universityId).toBe(guideFixtureTarget.university.id);
    expect(body.programId).toBe(guideFixtureTarget.program.id);
    expect(body.categories).toEqual(["admissions", "tuition", "scholarships"]);
    expect("question" in body).toBe(false);
  });

  test("private markers never appear in any browser request URL or request body", async ({ page, research }) => {
    const observedRequests: string[] = [];
    page.on("request", (request) => observedRequests.push(`${request.url()}\n${request.postData() ?? ""}`));

    await openGuide(page);
    await fillPrivateMarkers(page);
    research.enqueueJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    assertNoPrivateMarker(observedRequests.join("\n"));
  });

  test("Guide creates no durable browser storage and serializes no profile marker into URL/history", async ({ page, research }) => {
    await openGuide(page);
    await fillPrivateMarkers(page);
    research.enqueueJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    const persistence = await page.evaluate(async () => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
      cookies: document.cookie,
      url: window.location.href,
      historyState: JSON.stringify(history.state),
      indexedDbNames: typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((database) => database.name ?? "")
        : [],
      cacheKeys: "caches" in window ? await caches.keys() : [],
      serviceWorkers: "serviceWorker" in navigator
        ? (await navigator.serviceWorker.getRegistrations()).map((registration) => registration.scope)
        : [],
    }));

    expect(persistence.local).toEqual([]);
    expect(persistence.session).toEqual([]);
    expect(persistence.indexedDbNames.filter((name) => name !== "__next_debug_channel")).toEqual([]);
    expect(persistence.indexedDbNames.filter((name) => /guide/i.test(name))).toEqual([]);
    expect(persistence.cacheKeys).toEqual([]);
    expect(persistence.serviceWorkers).toEqual([]);
    assertNoPrivateMarker(`${persistence.cookies}\n${persistence.url}\n${persistence.historyState}`);
  });

  test("profile controls request no autocomplete persistence where supported", async ({ page }) => {
    await openGuide(page);
    const form = page.getByRole("form", { name: "Applicant profile" });
    await expect(form).toHaveAttribute("autocomplete", "off");
    for (const selector of [
      "#guide-program-search",
      "#guide-program-select",
      "#guide-intake",
      "#guide-year",
      "#guide-citizenship",
      "#guide-current-country",
      "#guide-qual-level",
      "#guide-qual-title",
      "#guide-qual-subject",
      "#guide-gpa-value",
      "#guide-gpa-scale",
      "#guide-english-kind",
      "#guide-budget-amount",
      "#guide-budget-currency",
      "#guide-budget-scope",
    ]) {
      await expect(page.locator(selector)).toHaveAttribute("autocomplete", "off");
    }
  });

  test("full reload and app navigation return to a fresh Guide workspace", async ({ page, research }) => {
    await openGuide(page);
    await fillPrivateMarkers(page);
    research.enqueueJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.locator("#guide-program-select")).toHaveValue("");
    await expect(page.getByLabel("Citizenship")).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Requirement assessment" })).toHaveCount(0);

    await fillPrivateMarkers(page);
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Research", exact: true }).click();
    await expect(page).toHaveURL(/\/research$/);
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Guide", exact: true }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.locator("#guide-program-select")).toHaveValue("");
    await expect(page.getByLabel("Citizenship")).toHaveValue("");

    const beforeBack = await page.evaluate(() => JSON.stringify(history.state));
    assertNoPrivateMarker(beforeBack);
    await page.goBack();
    await page.goForward();
    const afterForward = await page.evaluate(() => JSON.stringify(history.state));
    assertNoPrivateMarker(afterForward);
  });

  test("XSS-shaped profile and evidence strings remain inert text under the real browser policy", async ({ page, research }) => {
    const profilePayload = '<img src=x onerror="window.__guideProfileXss=1">PROFILE-XSS-MARKER';
    const evidencePayload = '<script>window.__guideEvidenceXss=1</script><img src=x onerror="window.__guideEvidenceXss=2">EVIDENCE-XSS-MARKER';
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, {
      citizenship: "Testland",
      currentCountry: "Thailand",
      qualificationTitle: profilePayload,
      qualificationSubject: "Computer Science",
      gpaValue: "3.5",
      gpaScale: "4.00",
    });
    research.enqueueJson({ ok: true, dossier: dossier({ supportingText: evidencePayload }) });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Title")).toHaveValue(profilePayload);
    expect(await page.locator("img[src='x']").count()).toBe(0);
    expect(await page.locator("script").evaluateAll((scripts) => scripts.some((script) =>
      (script.textContent ?? "").includes("__guideProfileXss") || (script.textContent ?? "").includes("__guideEvidenceXss")
    ))).toBe(false);
    expect(await page.evaluate(() => ({
      profile: (window as typeof window & { __guideProfileXss?: number }).__guideProfileXss,
      evidence: (window as typeof window & { __guideEvidenceXss?: number }).__guideEvidenceXss,
    }))).toEqual({ profile: undefined, evidence: undefined });

    await page.getByRole("button", { name: /View evidence for Minimum Gpa/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("EVIDENCE-XSS-MARKER");
    expect(await dialog.locator("img[src='x']").count()).toBe(0);
    expect(await page.evaluate(() => (window as typeof window & { __guideEvidenceXss?: number }).__guideEvidenceXss)).toBeUndefined();
  });

  test("Guide runtime exposes no provider names, API-key names, or admission-probability language", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, { gpaValue: "3.5", gpaScale: "4.00" });
    research.enqueueJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/Tavily|Brave Search|Gemini|Groq|OpenRouter/i);
    expect(text).not.toMatch(/TAVILY_API_KEY|BRAVE_SEARCH_API_KEY|GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY/);
    expect(text).not.toMatch(/admission probability|acceptance chance|guaranteed admission|likely admitted|% chance/i);
  });
});
