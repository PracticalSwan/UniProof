import { expect, expectNoHorizontalOverflow, test } from "@/tests/e2e/helpers/research-browser";
import {
  openCompare,
  selectFourComparisonTargets,
  setComparisonWeight,
  submitComparison,
} from "@/tests/e2e/helpers/compare-browser";
import {
  comparisonBrowserCategories,
  comparisonBrowserTargets,
  makeComparisonBrowserResponse,
} from "@/tests/fixtures/comparison-browser";
import { makeComparisonDossier } from "@/tests/fixtures/comparison-dossiers";
import { researchModeResponseSchema } from "@/lib/research/mode/public-contracts";

const longProgramName = `International Computer Science and Artificial Intelligence ${"研究・ปัญญาประดิษฐ์・မြန်မာ".repeat(5)}`.slice(0, 190);
const longUniversityName = `Global Technical University ${"มหาวิทยาลัย・大学・တက္ကသိုလ်".repeat(5)}`.slice(0, 190);
const longContextProperty = `Published contextual ranking label ${"รายละเอียด・context・အချက်အလက်".repeat(6)}`.slice(0, 190);
const longContextValue = `Context value ${"0123456789 abcdefghijklmnopqrstuvwxyz ".repeat(20)}`.slice(0, 500);
const longEvidence = `<script>alert(1)</script>${" long published evidence 研究 ภาษาไทย မြန်မာ ".repeat(80)}`.slice(0, 2000);

function makeHighClaimMitResponse() {
  const tuitionSourceTypes = [
    ...Array.from({ length: 11 }, () => "university" as const),
    "ranking" as const,
  ];
  const base = makeComparisonDossier({
    ...comparisonBrowserTargets.mit,
    categories: comparisonBrowserCategories,
    claims: [
      {
        id: "mit-stress-tuition",
        category: "tuition",
        property: "annual tuition",
        value: 10_000,
        currency: "USD",
        academicYear: "2027-28",
        sourceTypes: tuitionSourceTypes,
        supportingText: longEvidence,
      },
    ],
    states: {
      admissions: "unknown",
      scholarships: "unknown",
      "program-structure": "unknown",
      research: "unknown",
      outcomes: "unknown",
      support: "unknown",
    },
    canonicalProgramName: longProgramName,
    canonicalUniversityName: longUniversityName,
  });
  const sharedSourceId = "source-mit-stress-tuition-1";
  const rankingSourceId = "source-mit-stress-tuition-12";
  const contextClaim = {
    id: "mit-long-context",
    category: "tuition" as const,
    property: longContextProperty,
    value: longContextValue,
    verificationStatus: "verified" as const,
    representativeSourceId: rankingSourceId,
    sourceIds: [rankingSourceId],
    supportingText: longContextValue,
  };
  const noiseClaims = Array.from({ length: 300 }, (_, index) => ({
    id: `stress-noise-${index}`,
    category: "tuition" as const,
    property: `non-scoring stress detail ${index}`,
    value: `irrelevant published value ${index}`,
    verificationStatus: "verified" as const,
    representativeSourceId: sharedSourceId,
    sourceIds: [sharedSourceId],
    supportingText: `Irrelevant stress evidence ${index}.`,
  }));
  return researchModeResponseSchema.parse({
    ok: true,
    dossier: {
      ...base,
      categories: base.categories.map((row) => row.category === "tuition" && row.state === "ready"
        ? { ...row, claims: [...row.claims, contextClaim, ...noiseClaims] }
        : row),
      summary: {
        ...base.summary,
        totalClaims: base.summary.totalClaims + noiseClaims.length + 1,
        statusCounts: {
          ...base.summary.statusCounts,
          verified: base.summary.statusCounts.verified + noiseClaims.length + 1,
        },
      },
    },
  });
}

const stressResponses = [
  makeHighClaimMitResponse(),
  makeComparisonBrowserResponse({
    target: comparisonBrowserTargets.stanford,
    tuition: 20_000,
    employment: 91,
    research: true,
    scholarship: false,
    canonicalProgramName: `${longProgramName} B`.slice(0, 198),
    canonicalUniversityName: `${longUniversityName} B`.slice(0, 198),
  }),
  makeComparisonBrowserResponse({
    target: comparisonBrowserTargets.georgiaTech,
    tuition: 15_000,
    employment: 86,
    research: true,
    scholarship: true,
    canonicalProgramName: `${longProgramName} C`.slice(0, 198),
    canonicalUniversityName: `${longUniversityName} C`.slice(0, 198),
  }),
  makeComparisonBrowserResponse({
    target: comparisonBrowserTargets.berkeley,
    tuition: 18_000,
    employment: 88,
    research: false,
    scholarship: true,
    canonicalProgramName: `${longProgramName} D`.slice(0, 198),
    canonicalUniversityName: `${longUniversityName} D`.slice(0, 198),
  }),
] as const;

for (const viewport of [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`four-target Compare stress stays responsive at ${viewport.width}x${viewport.height}`, async ({ page, research }) => {
    await page.setViewportSize(viewport);
    for (const response of stressResponses) research.enqueueJson(response);
    await openCompare(page);
    await selectFourComparisonTargets(page);
    await setComparisonWeight(page, "Support", 1);
    await setComparisonWeight(page, "Outcomes", 19);
    await page.getByLabel("Show ranking-derived contextual evidence (display only; never scored)").check();
    await submitComparison(page);

    const cards = page.locator("[data-comparison-card]");
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toContainText("研究");
    await expect(cards.nth(3)).toBeVisible();
    await expect(page.getByText("Display-only context")).toHaveCount(1);
    await expect(page.getByText("non-scoring stress detail 299")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    const evidenceButton = page.locator("[data-comparison-card='1']").getByRole("button", { name: "View Affordability evidence" });
    await evidenceButton.scrollIntoViewIfNeeded();
    await evidenceButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(longEvidence.slice(0, 120));
    await expect(dialog.locator('section[aria-label="Evidence sources"] li')).toHaveCount(12);
    await expect(dialog.locator("script, img, [onerror], [onclick], [onload]")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
