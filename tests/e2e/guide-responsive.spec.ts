import { test, expect, type ResearchRouteController } from "./helpers/research-browser";
import { guideFixtureTarget, openGuide, selectGuideProgram, fillGuideProfile, submitGuide } from "./helpers/guide-browser";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";

const target = guideFixtureTarget;

const sourceIds = Array.from({ length: 12 }, (_, index) => `source-${index + 1}`);
const longEvidence = "Evidence segment αβγ🙂 ".repeat(90).slice(0, 2000);
const longUniversity = `University ${"Very Long International Name ".repeat(5)}`.slice(0, 180);
const longProgram = `Master of ${"Advanced Computing Artificial Intelligence and Data Systems ".repeat(4)}`.slice(0, 180);

function stressDossier() {
  return buildGuideDossier({
    universityId: target.university.id,
    programId: target.program.id,
    universityName: longUniversity,
    programName: longProgram,
    sourceCount: 12,
    admissionsClaims: [
      makeClaim({ id: "gpa", property: "Minimum GPA", value: 3.0, unit: "4.00", sourceIds, supportingText: longEvidence }),
      makeClaim({ id: "subject", property: "Required subject background", value: "computing" }),
      makeClaim({ id: "ielts-overall", property: "Minimum IELTS score", value: 6.5 }),
      makeClaim({ id: "ielts-component", property: "Minimum IELTS component", value: 6.0 }),
      makeClaim({ id: "qualification-good", property: "Minimum qualification level", value: "bachelor" }),
      makeClaim({ id: "qualification-conflict", property: "Minimum qualification level", value: "master", verificationStatus: "conflicting" }),
      makeClaim({ id: "document", property: "Required documents", value: "Transcript, CV and two references" }),
      makeClaim({ id: "deadline", property: "Application deadline", value: "2026-09-01" }),
      makeClaim({ id: "fee", property: "Application fee", value: 100, currency: "USD" }),
      makeClaim({ id: "manual", property: "Program-specific portfolio note", value: "Confirm this unusually long manual evidence item with the official admissions office." }),
    ],
    tuitionClaims: [
      makeClaim({ id: "tuition", category: "tuition", property: "Annual tuition", value: 50000, currency: "USD" }),
    ],
    scholarshipClaims: [
      makeClaim({ id: "scholarship", category: "scholarships", property: "Scholarship availability", value: false }),
    ],
  });
}

async function renderStressGuide(page: import("@playwright/test").Page, research: ResearchRouteController) {
  await openGuide(page);
  await selectGuideProgram(page);
  await fillGuideProfile(page, {
    citizenship: `${"Applicant🙂".repeat(6)}`.slice(0, 60),
    currentCountry: `${"Countryα".repeat(7)}`.slice(0, 60),
    qualificationTitle: `${"Bachelor of Computer Science ".repeat(5)}`.slice(0, 180),
    qualificationSubject: "Computer Science",
    gpaValue: "3.5",
    gpaScale: "4.00",
    englishKind: "ielts",
    englishOverall: "6.0",
    budgetAmount: "40000",
    budgetCurrency: "USD",
    budgetScope: "annual",
    scholarshipNeed: true,
  });
  research.enqueueJson({ ok: true, dossier: stressDossier() });
  await submitGuide(page);
  await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`Guide stress result has no page overflow at ${viewport.width}x${viewport.height}`, async ({ page, research }) => {
    await page.setViewportSize(viewport);
    await renderStressGuide(page, research);
    await expect(page.getByText("Meets", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Probably meets", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Does not meet", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Missing applicant information", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Unclear requirement", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Manual confirmation required", { exact: true }).first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            id: element.id,
            className: element.className,
            text: (element.textContent ?? "").trim().slice(0, 120),
            left: rect.left,
            right: rect.right,
            width: rect.width,
            scrollWidth: element.scrollWidth,
          };
        })
        .filter((item) => item.right > clientWidth + 1 || item.left < -1 || item.scrollWidth > item.width + 1)
        .slice(0, 20);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth, offenders };
    });
    expect(overflow.scrollWidth, JSON.stringify(overflow.offenders, null, 2)).toBeLessThanOrEqual(overflow.clientWidth);
  });
}

test("Guide evidence sheet handles 12 sources and 2,000-character evidence on mobile", async ({ page, research }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await renderStressGuide(page, research);
  await page.getByRole("button", { name: /View evidence for Minimum Gpa/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(longEvidence.slice(0, 240));
  const sourcesRegion = dialog.getByRole("region", { name: "Evidence sources" });
  await expect(sourcesRegion.getByRole("listitem")).toHaveCount(12);
  await expect(sourcesRegion.getByText("Source 12")).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
});
