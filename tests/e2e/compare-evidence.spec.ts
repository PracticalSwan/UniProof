import { expect, test } from "@/tests/e2e/helpers/research-browser";
import {
  openCompare,
  selectDefaultComparisonTargets,
  submitComparison,
} from "@/tests/e2e/helpers/compare-browser";
import {
  comparisonBrowserCategories,
  comparisonBrowserTargets,
  defaultComparisonBrowserResponses,
} from "@/tests/fixtures/comparison-browser";
import { makeComparisonDossier, type ComparisonFixtureClaim } from "@/tests/fixtures/comparison-dossiers";
import { researchModeResponseSchema, type ResearchModeCategory } from "@/lib/research/mode/public-contracts";
import { researchCatalog } from "@/lib/research/catalog/data";

function responseFromClaims(
  target: typeof comparisonBrowserTargets.mit | typeof comparisonBrowserTargets.stanford,
  claims: readonly ComparisonFixtureClaim[],
) {
  const states = Object.fromEntries(
    comparisonBrowserCategories
      .filter((category) => !claims.some((claim) => claim.category === category))
      .map((category) => [category, "unknown"]),
  ) as Partial<Record<ResearchModeCategory, "unknown">>;
  return researchModeResponseSchema.parse({
    ok: true,
    dossier: makeComparisonDossier({ ...target, categories: comparisonBrowserCategories, claims, states }),
  });
}

test.describe("Phase 4 Compare evidence and provenance", () => {
  test("opens the shared evidence dialog, traps focus, closes with Escape, and restores the exact trigger", async ({ page, research }) => {
    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const trigger = page.locator("[data-comparison-card='1']").getByRole("button", { name: "View Affordability evidence" });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("renders 12 sources, 2,000-character hostile-looking evidence, and high claim counts as inert text", async ({ page, research }) => {
    const hostileText = `<script>alert(1)</script><img src=x onerror=alert(2)>${" evidence".repeat(218)}`.slice(0, 2000);
    const baseMit = makeComparisonDossier({
      ...comparisonBrowserTargets.mit,
      categories: comparisonBrowserCategories,
      claims: [{
        id: "hostile-tuition",
        category: "tuition",
        property: "annual tuition",
        value: 10_000,
        currency: "USD",
        academicYear: "2027-28",
        sourceTypes: Array.from({ length: 12 }, () => "university" as const),
        supportingText: hostileText,
      }],
      states: {
        admissions: "unknown",
        scholarships: "unknown",
        "program-structure": "unknown",
        research: "unknown",
        outcomes: "unknown",
        support: "unknown",
      },
    });
    const sharedSourceId = "source-hostile-tuition-1";
    const noiseClaims = Array.from({ length: 80 }, (_, index) => ({
      id: `noise-${index}`,
      category: "tuition" as const,
      property: `non-scoring tuition detail ${index}`,
      value: `value ${index}`,
      verificationStatus: "verified" as const,
      representativeSourceId: sharedSourceId,
      sourceIds: [sharedSourceId],
      supportingText: `Non-scoring published detail ${index}.`,
    }));
    const mit = researchModeResponseSchema.parse({
      ok: true,
      dossier: {
        ...baseMit,
        categories: baseMit.categories.map((row) => row.category === "tuition" && row.state === "ready"
          ? { ...row, claims: [...row.claims, ...noiseClaims] }
          : row),
        summary: {
          ...baseMit.summary,
          totalClaims: baseMit.summary.totalClaims + noiseClaims.length,
          statusCounts: {
            ...baseMit.summary.statusCounts,
            verified: baseMit.summary.statusCounts.verified + noiseClaims.length,
          },
        },
      },
    });
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "stanford-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
      { id: "stanford-research", category: "research", property: "research opportunity available", value: true },
    ]);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    await page.locator("[data-comparison-card='1']").getByRole("button", { name: "View Affordability evidence" }).click();
    const dialog = page.getByRole("dialog");
    const sourceCards = dialog.locator('section[aria-label="Evidence sources"] li');
    await expect(sourceCards).toHaveCount(12);
    await expect(sourceCards.first()).toContainText("Representative source");
    await expect(dialog).toContainText("<script>alert(1)</script><img src=x onerror=alert(2)>");
    await expect(dialog.locator("script")).toHaveCount(0);
    await expect(dialog.locator("img")).toHaveCount(0);
    await expect(dialog.locator("[onerror], [onclick], [onload]")).toHaveCount(0);
    const sourceLinks = dialog.locator('section[aria-label="Evidence sources"] a');
    await expect(sourceLinks).toHaveCount(12);
    for (let index = 0; index < 12; index += 1) {
      const link = sourceLinks.nth(index);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
    }
  });

  test("keeps conflicting, outdated, ranking-only, and anecdotal evidence visible but unscored", async ({ page, research }) => {
    const mit = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "mit-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: "mit-conflict", category: "research", property: "research opportunity available", value: true, verificationStatus: "conflicting" },
      { id: "mit-ranking", category: "outcomes", property: "ranking context", value: "Ranking context only", sourceTypes: ["ranking"] },
      { id: "mit-anecdotal", category: "support", property: "student opinion", value: "Community opinion only", verificationStatus: "anecdotal", sourceTypes: ["anecdotal"] },
    ]);
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "stanford-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
      { id: "stanford-old", category: "research", property: "research opportunity available", value: true, verificationStatus: "outdated" },
      { id: "stanford-ranking", category: "outcomes", property: "ranking context", value: "Other ranking context", sourceTypes: ["ranking"] },
      { id: "stanford-anecdotal", category: "support", property: "student opinion", value: "Other community opinion", verificationStatus: "anecdotal", sourceTypes: ["anecdotal"] },
    ]);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await page.getByLabel("Show ranking-derived contextual evidence (display only; never scored)").check();
    await page.getByLabel("Show student/community opinion (display only; never scored)").check();
    await submitComparison(page);

    await expect(page.getByText("Conflicting evidence — unscored")).toHaveCount(1);
    await expect(page.getByText("Outdated evidence — unscored")).toHaveCount(1);
    await expect(page.getByText("Display-only context")).toHaveCount(2);
    await expect(page.getByText("These items never change fit or evidence coverage.")).toHaveCount(2);
  });

  test("shows both conflict and outdated category warnings when both evidence states are present", async ({ page, research }) => {
    const mit = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "mit-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: "mit-research-conflict", category: "research", property: "research opportunity available", value: true, verificationStatus: "conflicting" },
      { id: "mit-research-outdated", category: "research", property: "research opportunity available", value: false, verificationStatus: "outdated" },
    ]);
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "stanford-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
      { id: "stanford-research", category: "research", property: "research opportunity available", value: true },
    ]);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const firstCard = page.locator("[data-comparison-card='1']");
    await expect(firstCard.getByText("Research: conflicting evidence remains visible and unscored.")).toBeVisible();
    await expect(firstCard.getByText("Research: outdated evidence remains visible and unscored.")).toBeVisible();
  });

  test("ranking/opinion display toggles change contextual visibility only, never score or coverage", async ({ page, research }) => {
    const mit = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "mit-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: "mit-research", category: "research", property: "research opportunity available", value: true },
      { id: "mit-scholarship", category: "scholarships", property: "scholarship available", value: true },
      { id: "mit-employment", category: "outcomes", property: "employment rate", value: 82, unit: "%", academicYear: "2027-28" },
      { id: "mit-support", category: "support", property: "international student services available", value: true },
      { id: "mit-ranking-context", category: "outcomes", property: "published ranking context", value: "Ranking context", sourceTypes: ["ranking"] },
      { id: "mit-opinion-context", category: "support", property: "published student opinion", value: "Student opinion", verificationStatus: "anecdotal", sourceTypes: ["anecdotal"] },
    ]);
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "stanford-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
      { id: "stanford-research", category: "research", property: "research opportunity available", value: true },
      { id: "stanford-scholarship", category: "scholarships", property: "scholarship available", value: false },
      { id: "stanford-employment", category: "outcomes", property: "employment rate", value: 91, unit: "%", academicYear: "2027-28" },
      { id: "stanford-support", category: "support", property: "international student services available", value: true },
    ]);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await expect(page.getByText("Display-only context")).toHaveCount(0);
    const firstCard = page.locator("[data-comparison-card='1']");
    const baselineRows = await firstCard.locator("[data-priority]").allTextContents();
    const baselineCoverage = await firstCard.getByText(/Evidence coverage/).textContent();
    const baselineFit = await firstCard.getByText("Fit score", { exact: true }).locator("xpath=following-sibling::*[1]").textContent();

    await page.getByRole("button", { name: "Clear result" }).click();
    await page.getByLabel("Show ranking-derived contextual evidence (display only; never scored)").check();
    await page.getByLabel("Show student/community opinion (display only; never scored)").check();
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await submitComparison(page);
    await expect(page.getByText("Display-only context")).toHaveCount(1);
    const rerunCard = page.locator("[data-comparison-card='1']");
    expect(await rerunCard.locator("[data-priority]").allTextContents()).toEqual(baselineRows);
    expect(await rerunCard.getByText(/Evidence coverage/).textContent()).toBe(baselineCoverage);
    expect(await rerunCard.getByText("Fit score", { exact: true }).locator("xpath=following-sibling::*[1]").textContent()).toBe(baselineFit);
  });

  test("renders deterministic trade-off order and each factual trigger opens the exact referenced claim", async ({ page, research }) => {
    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const tradeoffSection = page.getByRole("heading", { name: "Evidence-bound trade-offs" }).locator("xpath=..");
    const rows = tradeoffSection.locator("ol > li");
    await expect(rows).toHaveCount(4);
    const summaries = await rows.locator("p").allTextContents();
    expect(summaries.map((summary) => summary.split(" ")[0])).toEqual([
      "Affordability",
      "Research",
      "Scholarships",
      "Outcomes",
    ]);

    const expectedClaimTitles = [
      "annual tuition",
      "research opportunity available",
      "scholarship available",
      "employment rate",
    ];
    for (let index = 0; index < expectedClaimTitles.length; index += 1) {
      const trigger = rows.nth(index).getByRole("button", { name: "View trade-off evidence for option 1" });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: expectedClaimTitles[index]!, exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });

  test("keeps trade-off evidence target-scoped when different dossiers reuse the same claim ID", async ({ page, research }) => {
    const mit = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "shared-tradeoff-claim", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
    ]);
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "shared-tradeoff-claim", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
    ]);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const tradeoffSection = page.getByRole("heading", { name: "Evidence-bound trade-offs" }).locator("xpath=..");
    const affordability = tradeoffSection.locator("ol > li").first();
    const option1 = affordability.getByRole("button", { name: "View trade-off evidence for option 1" });
    const option2 = affordability.getByRole("button", { name: "View trade-off evidence for option 2" });
    await expect(option1).toBeVisible();
    await expect(option2).toBeVisible();

    await option1.click();
    await expect(page.getByRole("dialog")).toContainText("USD 10000");
    await page.keyboard.press("Escape");
    await expect(option1).toBeFocused();

    await option2.click();
    await expect(page.getByRole("dialog")).toContainText("USD 20000");
    await page.keyboard.press("Escape");
    await expect(option2).toBeFocused();
  });

  test("uses catalog-owned official target URLs even when server-returned canonical link fields are hostile", async ({ page, research }) => {
    const [mitBase, stanfordBase] = defaultComparisonBrowserResponses();
    if (mitBase === undefined || !mitBase.ok || stanfordBase === undefined || !stanfordBase.ok) {
      throw new Error("Expected successful comparison browser fixtures.");
    }
    const hostileMit = researchModeResponseSchema.parse({
      ...mitBase,
      dossier: {
        ...mitBase.dossier,
        target: {
          university: { ...mitBase.dossier.target.university, websiteUrl: "https://evil.example/university" },
          program: { ...mitBase.dossier.target.program!, officialUrl: "https://evil.example/program" },
        },
      },
    });
    research.enqueueJson(hostileMit);
    research.enqueueJson(stanfordBase);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const mitCatalogProgram = researchCatalog.programs.find((item) => item.id === comparisonBrowserTargets.mit.programId)!;
    const mitCatalogUniversity = researchCatalog.universities.find((item) => item.id === comparisonBrowserTargets.mit.universityId)!;
    const card = page.locator("[data-comparison-card='1']");
    await expect(card.getByRole("link", { name: "Official program page" })).toHaveAttribute("href", mitCatalogProgram.officialUrl);
    await expect(card.getByRole("link", { name: "Official university website" })).toHaveAttribute("href", mitCatalogUniversity.websiteUrl);

    await card.getByRole("button", { name: "View Affordability evidence" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: /Official program page/ })).toHaveAttribute("href", mitCatalogProgram.officialUrl);
    await expect(dialog.getByRole("link", { name: /Official university website/ })).toHaveAttribute("href", mitCatalogUniversity.websiteUrl);
    await expect(page.locator('a[href^="https://evil.example"]')).toHaveCount(0);
  });
});
