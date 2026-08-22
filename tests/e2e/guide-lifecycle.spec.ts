import { test, expect } from "./helpers/research-browser";
import { guideFixtureTarget, openGuide, selectGuideProgram, fillGuideProfile, submitGuide } from "./helpers/guide-browser";
import { buildGuideDossier } from "@/tests/fixtures/guide-dossiers";
import { publicErrorStatuses, publicTransportErrors } from "@/tests/fixtures/research-dossiers";
import { researchCatalog } from "@/lib/research/catalog/data";
import { researchDossierSchema } from "@/lib/research/mode/public-contracts";

const target = guideFixtureTarget;
const secondProgram = researchCatalog.programs.find((program) => program.id !== target.program.id)!;
const secondUniversity = researchCatalog.universities.find((university) => university.id === secondProgram.universityId)!;

function unknownDossier(universityId = target.university.id, programId = target.program.id, universityName?: string, programName?: string) {
  return buildGuideDossier({
    universityId,
    programId,
    ...(universityName === undefined ? {} : { universityName }),
    ...(programName === undefined ? {} : { programName }),
    admissionsState: "unknown",
    tuitionState: "unknown",
    scholarshipState: "unknown",
  });
}

async function prepareGuide(page: import("@playwright/test").Page) {
  await openGuide(page);
  await selectGuideProgram(page);
  await fillGuideProfile(page, { gpaValue: "3.5", gpaScale: "4.00" });
}

test.describe("Guide lifecycle", () => {
  test("successful first run produces result", async ({ page, research }) => {
    await prepareGuide(page);
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
    expect(research.requests).toHaveLength(1);
  });

  test("shows the sanitized reason when supported evidence is partial and non-definitive", async ({ page, research }) => {
    await prepareGuide(page);
    const base = buildGuideDossier({
      universityId: target.university.id,
      programId: target.program.id,
      admissionsClaims: [{
        id: "gpa-source-gap-ui",
        category: "admissions",
        property: "Minimum GPA",
        value: 3,
        unit: "4.0",
        verificationStatus: "verified",
        representativeSourceId: "source-1",
        sourceIds: ["source-1"],
        supportingText: "Applicants must have a minimum GPA of 3.0 on a 4.0 scale.",
      }],
    });
    const dossier = researchDossierSchema.parse({
      ...base,
      categories: base.categories.map((row) => row.category === "admissions" && row.state === "ready"
        ? {
            ...row,
            sourceGap: {
              code: "provider-rate-limit",
              message: "Research provider limits prevented completion.",
            },
          }
        : row),
    });
    research.enqueueJson({ ok: true, dossier });
    await submitGuide(page);

    await expect(page.getByText("Partial result ready", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Admissions: partial evidence — non-definitive. Research provider limits prevented completion.")).toBeVisible();
    await expect(page.getByText("Minimum GPA", { exact: true })).toBeVisible();
    await expect(page.getByText("Unclear requirement", { exact: true })).toBeVisible();
  });

  test("same-tick duplicate submission dispatches at most one Research request", async ({ page, research }) => {
    await prepareGuide(page);
    const pending = research.enqueueDeferredJson({ ok: true, dossier: unknownDossier() });
    await page.getByRole("form", { name: "Applicant profile" }).evaluate((form) => {
      const htmlForm = form as HTMLFormElement;
      htmlForm.requestSubmit();
      htmlForm.requestSubmit();
    });
    await pending.entered;
    expect(research.requests).toHaveLength(1);
    pending.release();
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test("profile-only reassessment reuses dossier without network request", async ({ page, research }) => {
    await prepareGuide(page);
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
    expect(research.requests).toHaveLength(1);

    await page.getByLabel("GPA value (optional)").fill("3.8");
    await submitGuide(page);
    await expect(page.getByText("Previously researched requirements were reused.")).toBeVisible({ timeout: 5_000 });
    expect(research.requests).toHaveLength(1);
  });

  test("public intake/year changes force Research while a profile-only edit does not", async ({ page, research }) => {
    await prepareGuide(page);
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("GPA value (optional)").fill("3.7");
    await submitGuide(page);
    expect(research.requests).toHaveLength(1);

    await page.getByLabel("Intake", { exact: false }).fill("September 2028");
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect.poll(() => research.requests.length).toBe(2);

    await page.getByLabel("Academic year", { exact: false }).fill("2028-29");
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect.poll(() => research.requests.length).toBe(3);
  });

  test("network failure owns one Retry that repeats the exact failed immutable request", async ({ page, research }) => {
    await prepareGuide(page);
    await page.getByLabel("Intake", { exact: false }).fill("September 2027");
    research.enqueueAbort("failed");
    await submitGuide(page);
    await expect(page.getByRole("alert", { name: "Guide request error" })).toContainText("could not be sent");
    const failedBody = research.requests[0]!.body;

    await page.getByLabel("Intake", { exact: false }).fill("Changed draft intake");
    await page.getByLabel("GPA value (optional)").fill("3.9");
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await page.getByRole("button", { name: "Retry this assessment" }).click();
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
    expect(research.requests).toHaveLength(2);
    expect(research.requests[1]!.body).toEqual(failedBody);
    await expect(page.getByRole("button", { name: "Retry this assessment" })).toHaveCount(0);
  });

  test("raw deployment throttling preserves the prior assessment, applicant draft, and explicit retry", async ({ page, research }) => {
    await prepareGuide(page);
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("GPA value (optional)").fill("3.85");
    research.enqueueRaw("<html>platform internals stay private</html>", { status: 429, contentType: "text/html" });
    await page.getByRole("button", { name: "Refresh requirements" }).click();

    const error = page.getByRole("alert", { name: "Guide request error" });
    await expect(error).toContainText("temporarily limiting research requests");
    await expect(error).not.toContainText(/platform internals|html|vercel/i);
    await expect(page.getByRole("heading", { name: "Requirement assessment" })).toBeVisible();
    await expect(page.getByLabel("GPA value (optional)")).toHaveValue("3.85");
    await expect(page.getByRole("button", { name: "Retry this assessment" })).toHaveCount(1);
    await page.waitForTimeout(100);
    expect(research.requests).toHaveLength(2);
  });

  test("failed refresh preserves reusable evidence and profile-only Assess supersedes the transient error locally", async ({ page, research }) => {
    await prepareGuide(page);
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    research.enqueueAbort("failed");
    await page.getByRole("button", { name: "Refresh requirements" }).click();
    await expect(page.getByRole("alert", { name: "Guide request error" })).toContainText("could not be sent");
    await expect(page.getByRole("heading", { name: "Requirement assessment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry this assessment" })).toHaveCount(1);
    expect(research.requests).toHaveLength(2);

    await page.getByLabel("GPA value (optional)").fill("3.95");
    await submitGuide(page);
    await expect(page.getByText("Previously researched requirements were reused.")).toBeVisible({ timeout: 5_000 });
    expect(research.requests).toHaveLength(2);
    await expect(page.getByRole("alert", { name: "Guide request error" })).toHaveCount(0);
  });

  test("unsupported-target invalidates reuse, has no Retry, and a different supported program can recover", async ({ page, research }) => {
    await prepareGuide(page);
    research.enqueueJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    research.enqueueJson(publicTransportErrors["unsupported-target"], publicErrorStatuses["unsupported-target"]);
    await page.getByRole("button", { name: "Refresh requirements" }).click();
    await expect(page.getByRole("alert", { name: "Guide request error" })).toContainText("no longer supported");
    await expect(page.getByRole("button", { name: "Retry this assessment" })).toHaveCount(0);
    expect(research.requests).toHaveLength(2);

    await page.getByLabel("Intake", { exact: false }).fill("Different intake");
    await submitGuide(page);
    await expect(page.getByText("This program is correction-required. Select a different supported program.")).toBeVisible();
    expect(research.requests).toHaveLength(2);

    await page.locator("#guide-program-select").selectOption(secondProgram.id);
    research.enqueueJson({
      ok: true,
      dossier: unknownDossier(secondUniversity.id, secondProgram.id, secondUniversity.name, secondProgram.name),
    });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Requirement assessment" }).locator("xpath=..").getByText(secondProgram.name, { exact: false }),
    ).toBeVisible();
    expect(research.requests).toHaveLength(3);
  });

  test("Cancel aborts one pending run without retry and preserves the editable draft", async ({ page, research }) => {
    await prepareGuide(page);
    const pending = research.enqueueDeferredJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await pending.entered;
    await page.getByRole("button", { name: "Cancel" }).click();
    pending.release();
    await expect(page.getByText("Assessment cancelled.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("GPA value (optional)")).toHaveValue("3.5");
    await expect(page.getByRole("button", { name: "Retry this assessment" })).toHaveCount(0);
    expect(research.requests).toHaveLength(1);
  });

  test("Cancel during the successful result handoff still owns the run", async ({ page, research }) => {
    await prepareGuide(page);
    const pending = research.enqueueDeferredJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await pending.entered;
    await page.evaluate(() => {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        document.documentElement.dataset.guideTestRafPending = "true";
        return window.setTimeout(() => callback(performance.now()), 500);
      }) as typeof window.requestAnimationFrame;
    });
    pending.release();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.guideTestRafPending)).toBe("true");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Assessment cancelled.")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(600);
    await expect(page.getByText("Assessment complete", { exact: false })).toHaveCount(0);
  });

  test("an older cancelled response released last cannot overwrite the newer result", async ({ page, research }) => {
    await prepareGuide(page);
    const oldPending = research.enqueueDeferredJson({ ok: true, dossier: unknownDossier(undefined, undefined, "Old Server Name", "Old Program") });
    await submitGuide(page);
    await oldPending.entered;
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Assessment cancelled.")).toBeVisible({ timeout: 10_000 });

    research.enqueueJson({ ok: true, dossier: unknownDossier(undefined, undefined, "New Server Name", "New Program") });
    await submitGuide(page);
    await expect(page.getByText("New Program", { exact: false })).toBeVisible({ timeout: 15_000 });
    oldPending.release();
    await page.waitForTimeout(200);
    await expect(page.getByText("New Program", { exact: false })).toBeVisible();
    await expect(page.getByText("Old Program", { exact: false })).toHaveCount(0);
    expect(research.requests).toHaveLength(2);
  });

  test("navigation unmount aborts a pending Guide request and returning starts fresh", async ({ page, research }) => {
    await prepareGuide(page);
    const pending = research.enqueueDeferredJson({ ok: true, dossier: unknownDossier() });
    await submitGuide(page);
    await pending.entered;
    await page.goto("/research");
    pending.release();
    await expect(page).toHaveURL(/\/research$/);
    await page.goto("/guide");
    await expect(page.locator("#guide-program-select")).toHaveValue("");
    await expect(page.getByLabel("Citizenship")).toHaveValue("");
    expect(research.requests).toHaveLength(1);
  });
});
