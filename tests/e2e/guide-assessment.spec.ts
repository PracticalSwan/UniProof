import { test, expect } from "./helpers/research-browser";
import { openGuide, selectGuideProgram, fillGuideProfile, submitGuide } from "./helpers/guide-browser";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";
import { researchCatalog } from "@/lib/research/catalog/data";

const target = {
  university: researchCatalog.universities[0]!,
  program: researchCatalog.programs.find((p) => p.universityId === researchCatalog.universities[0]!.id)!,
};

test.describe("Guide assessment states", () => {
  test("renders all six assessment states", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, {
      gpaValue: "3.5",
      gpaScale: "4.00",
      englishKind: "ielts",
      englishOverall: "6.0",
    });

    const dossier = buildGuideDossier({
      universityId: target.university.id,
      programId: target.program.id,
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.00" }),
        makeClaim({ id: "subject-1", property: "Required subject background", value: "computing" }),
        makeClaim({ id: "ielts-overall", property: "Minimum IELTS score", value: 6.5 }),
        makeClaim({ id: "ielts-component", property: "Minimum IELTS component", value: 6.0 }),
        makeClaim({ id: "qual-1", property: "Minimum qualification level", value: "bachelor" }),
        makeClaim({ id: "qual-2", property: "Minimum qualification level", value: "master", verificationStatus: "conflicting" }),
        makeClaim({ id: "doc-1", property: "Required documents", value: "Transcript" }),
      ],
    });
    research.enqueueJson({ ok: true, dossier });

    await submitGuide(page);

    await expect(page.getByText("Meets", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Probably meets", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Does not meet", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Missing applicant information", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Unclear requirement", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Manual confirmation required", { exact: true }).first()).toBeVisible();
  });

  test("does not meet is shown for below-threshold GPA", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, { gpaValue: "2.5", gpaScale: "4.00" });

    const dossier = buildGuideDossier({
      universityId: target.university.id,
      programId: target.program.id,
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.00" }),
      ],
    });
    research.enqueueJson({ ok: true, dossier });

    await submitGuide(page);
    await expect(page.getByText("Does not meet", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("unclear requirement shown for conflicting evidence", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, { gpaValue: "3.5", gpaScale: "4.00" });

    const dossier = buildGuideDossier({
      universityId: target.university.id,
      programId: target.program.id,
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.00", verificationStatus: "verified" }),
        makeClaim({ id: "gpa-2", property: "Minimum GPA", value: 3.5, unit: "4.00", verificationStatus: "conflicting" }),
      ],
    });
    research.enqueueJson({ ok: true, dossier });

    await submitGuide(page);
    await expect(page.getByText("Unclear requirement", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("no admission probability language", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, { gpaValue: "3.5", gpaScale: "4.00" });

    const dossier = buildGuideDossier({
      universityId: target.university.id,
      programId: target.program.id,
      admissionsClaims: [makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.00" })],
    });
    research.enqueueJson({ ok: true, dossier });

    await submitGuide(page);
    await expect(page.getByText("Assessment complete")).toBeVisible({ timeout: 15_000 });

    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/admission probability|% chance|likely admitted|guaranteed admission|acceptance chance/i);
    expect(text).toContain("does not predict admission");
  });
});
