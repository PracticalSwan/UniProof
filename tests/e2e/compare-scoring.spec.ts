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

const supportScoringCategories = [...comparisonBrowserCategories, "support"] as const satisfies readonly ResearchModeCategory[];

function responseFromClaims(
  target: typeof comparisonBrowserTargets.mit | typeof comparisonBrowserTargets.stanford,
  claims: readonly ComparisonFixtureClaim[],
  categories: readonly ResearchModeCategory[] = comparisonBrowserCategories,
) {
  const states = Object.fromEntries(
    categories
      .filter((category) => !claims.some((claim) => claim.category === category))
      .map((category) => [category, "unknown"]),
  ) as Partial<Record<ResearchModeCategory, "unknown">>;
  return researchModeResponseSchema.parse({
    ok: true,
    dossier: makeComparisonDossier({ ...target, categories, claims, states }),
  });
}

async function setWeight(page: import("@playwright/test").Page, label: string, value: string) {
  await page.getByLabel(`${label} weight`).fill(value);
}

test.describe("Phase 4 Compare scoring presentation", () => {
  test("shows deterministic fit/coverage without sorting cards by score", async ({ page, research }) => {
    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const cards = page.locator("[data-comparison-card]");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Evidence coverage 100%");
    await expect(cards.nth(1)).toContainText("Evidence coverage 100%");
    await expect(cards.nth(0)).toContainText("80");
    await expect(cards.nth(1)).toContainText("50");
    await expect(cards.nth(0)).toContainText("Artificial Intelligence and Decision Making");
    await expect(cards.nth(1)).toContainText("Computer Science Bachelor's Program");
    const resultText = (await page.getByRole("heading", { level: 2, name: "Comparison results" }).locator("xpath=..").textContent())?.toLowerCase() ?? "";
    for (const forbidden of ["best university", "winner", "top school", "prestige score", "admission probability", "guaranteed admission"]) {
      expect(resultText).not.toContain(forbidden);
    }
  });

  test("suppresses fit below 50% coverage and permits exactly 50% with two scored dimensions", async ({ page, research }) => {
    const tuitionScholarshipA = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "a-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: "a-scholarship", category: "scholarships", property: "scholarship available", value: true },
    ]);
    const tuitionScholarshipB = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "b-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
      { id: "b-scholarship", category: "scholarships", property: "scholarship available", value: false },
    ]);

    research.enqueueJson(tuitionScholarshipA);
    research.enqueueJson(tuitionScholarshipB);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await setWeight(page, "Affordability", "29");
    await setWeight(page, "Research", "0");
    await setWeight(page, "Scholarships", "20");
    await setWeight(page, "Outcomes", "51");
    await submitComparison(page);
    await expect(page.locator("[data-comparison-card]").first()).toContainText("Evidence coverage 49%");
    await expect(page.locator("[data-comparison-card]").first()).toContainText("Suppressed: insufficient comparable evidence");

    await page.getByRole("button", { name: "Clear result" }).click();
    await setWeight(page, "Affordability", "30");
    await setWeight(page, "Outcomes", "50");
    research.enqueueJson(tuitionScholarshipA);
    research.enqueueJson(tuitionScholarshipB);
    await submitComparison(page);
    await expect(page.locator("[data-comparison-card]").first()).toContainText("Evidence coverage 50%");
    await expect(page.locator("[data-comparison-card]").first()).not.toContainText("Suppressed: insufficient comparable evidence");
  });

  test("fails closed on mixed currency and mixed periods without conversion or guessing", async ({ page, research }) => {
    const currencyA = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "a-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
    ]);
    const currencyB = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "b-tuition", category: "tuition", property: "annual tuition", value: 8_000, currency: "GBP", academicYear: "2027-28" },
    ]);
    research.enqueueJson(currencyA);
    research.enqueueJson(currencyB);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await setWeight(page, "Affordability", "100");
    await setWeight(page, "Research", "0");
    await setWeight(page, "Scholarships", "0");
    await setWeight(page, "Outcomes", "0");
    await submitComparison(page);
    await expect(page.getByText("Currency mismatch — no conversion")).toHaveCount(2);
    await expect(page.getByText("Suppressed: insufficient comparable evidence")).toHaveCount(2);

    await page.getByRole("button", { name: "Clear result" }).click();
    const periodA = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "a-period", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
    ]);
    const periodB = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "b-period", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2028-29" },
    ]);
    research.enqueueJson(periodA);
    research.enqueueJson(periodB);
    await submitComparison(page);
    await expect(page.getByText("Period mismatch — unscored")).toHaveCount(2);
  });

  test("renders numeric-looking strings and unsupported units as unscored rather than coercing them", async ({ page, research }) => {
    const malformedA = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "a-string", category: "tuition", property: "annual tuition", value: "10000", currency: "USD", academicYear: "2027-28" },
    ]);
    const malformedB = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "b-unit", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", unit: "semester", academicYear: "2027-28" },
    ]);
    research.enqueueJson(malformedA);
    research.enqueueJson(malformedB);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await setWeight(page, "Affordability", "100");
    await setWeight(page, "Research", "0");
    await setWeight(page, "Scholarships", "0");
    await setWeight(page, "Outcomes", "0");
    await submitComparison(page);
    await expect(page.getByText("Unsupported published value")).toHaveCount(2);
  });

  test("renders equal numeric facts as a tie and absolute boolean/presence metrics without peer-relative scaling", async ({ page, research }) => {
    const mit = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "mit-tuition-tie", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: "mit-research-true", category: "research", property: "research opportunity available", value: true },
      { id: "mit-scholarship-false", category: "scholarships", property: "scholarship available", value: false },
      { id: "mit-scholarship-name", category: "scholarships", property: "scholarship name", value: "Named award still must not override explicit false" },
      { id: "mit-support-false", category: "support", property: "international office available", value: false },
    ], supportScoringCategories);
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "stanford-tuition-tie", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: "stanford-research-false", category: "research", property: "research opportunity available", value: false },
      { id: "stanford-scholarship-presence", category: "scholarships", property: "funding opportunity", value: "Published funding opportunity" },
      { id: "stanford-support-true", category: "support", property: "international student services available", value: true },
    ], supportScoringCategories);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await setWeight(page, "Affordability", "20");
    await setWeight(page, "Research", "30");
    await setWeight(page, "Scholarships", "30");
    await setWeight(page, "Outcomes", "0");
    await setWeight(page, "Support", "20");
    await submitComparison(page);

    const first = page.locator("[data-comparison-card='1']");
    const second = page.locator("[data-comparison-card='2']");
    await expect(first.locator('[data-priority="affordability"]')).toContainText("100 / 100");
    await expect(second.locator('[data-priority="affordability"]')).toContainText("100 / 100");
    await expect(first.locator('[data-priority="research"]')).toContainText("100 / 100");
    await expect(second.locator('[data-priority="research"]')).toContainText("0 / 100");
    await expect(first.locator('[data-priority="scholarships"]')).toContainText("0 / 100");
    await expect(second.locator('[data-priority="scholarships"]')).toContainText("100 / 100");
    await expect(first.locator('[data-priority="support"]')).toContainText("0 / 100");
    await expect(second.locator('[data-priority="support"]')).toContainText("100 / 100");
    await expect(page.getByText(/Affordability has an equal comparable score/)).toBeVisible();
  });

  test("shows missing/inferred/anecdotal/ranking-only evidence as explicit unscored reasons, never score zero", async ({ page, research }) => {
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await setWeight(page, "Affordability", "0");
    await setWeight(page, "Research", "100");
    await setWeight(page, "Scholarships", "0");
    await setWeight(page, "Outcomes", "0");

    const cases: Array<{
      expected: string;
      mitClaims: ComparisonFixtureClaim[];
      stanfordClaims: ComparisonFixtureClaim[];
    }> = [
      {
        expected: "Evidence unknown",
        mitClaims: [],
        stanfordClaims: [{ id: "peer-known", category: "research", property: "research opportunity available", value: true }],
      },
      {
        expected: "Inferred-only evidence — unscored",
        mitClaims: [{ id: "mit-inferred", category: "research", property: "research opportunity available", value: true, verificationStatus: "inferred" }],
        stanfordClaims: [{ id: "stanford-inferred", category: "research", property: "research opportunity available", value: true, verificationStatus: "inferred" }],
      },
      {
        expected: "Anecdotal-only evidence — unscored",
        mitClaims: [{ id: "mit-anecdotal", category: "research", property: "research opportunity available", value: true, verificationStatus: "anecdotal" }],
        stanfordClaims: [{ id: "stanford-anecdotal", category: "research", property: "research opportunity available", value: true, verificationStatus: "anecdotal" }],
      },
      {
        expected: "Ranking-only evidence — unscored",
        mitClaims: [{ id: "mit-ranking", category: "research", property: "research opportunity available", value: true, sourceTypes: ["ranking"] }],
        stanfordClaims: [{ id: "stanford-ranking", category: "research", property: "research opportunity available", value: true, sourceTypes: ["ranking"] }],
      },
    ];

    for (let index = 0; index < cases.length; index += 1) {
      const current = cases[index]!;
      research.enqueueJson(responseFromClaims(comparisonBrowserTargets.mit, current.mitClaims));
      research.enqueueJson(responseFromClaims(comparisonBrowserTargets.stanford, current.stanfordClaims));
      await submitComparison(page);
      const firstResearch = page.locator("[data-comparison-card='1']").locator('[data-priority="research"]');
      await expect(firstResearch).toContainText(current.expected);
      await expect(firstResearch).not.toContainText("0 / 100");
      if (index > 0) {
        await expect(page.locator("[data-comparison-card='2']").locator('[data-priority="research"]')).toContainText(current.expected);
      }
      if (index < cases.length - 1) await page.getByRole("button", { name: "Clear result" }).click();
    }
  });

  test("shows exact duplicate-unit incompatibility as unit mismatch rather than converting", async ({ page, research }) => {
    const mit = responseFromClaims(comparisonBrowserTargets.mit, [
      { id: "mit-annual", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", unit: "annual", academicYear: "2027-28" },
      { id: "mit-year", category: "tuition", property: "annual tuition fee", value: 10_000, currency: "USD", unit: "year", academicYear: "2027-28" },
    ]);
    const stanford = responseFromClaims(comparisonBrowserTargets.stanford, [
      { id: "stanford-annual", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", unit: "annual", academicYear: "2027-28" },
    ]);
    research.enqueueJson(mit);
    research.enqueueJson(stanford);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await setWeight(page, "Affordability", "100");
    await setWeight(page, "Research", "0");
    await setWeight(page, "Scholarships", "0");
    await setWeight(page, "Outcomes", "0");
    await submitComparison(page);
    await expect(page.locator("[data-comparison-card='1']")).toContainText("Unit mismatch — no conversion");
  });
});
