import { test, expect } from "./helpers/research-browser";
import { guideFixtureTarget, openGuide, selectGuideProgram, fillGuideProfile, submitGuide } from "./helpers/guide-browser";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";

const target = guideFixtureTarget;

function gpaDossier(options: { supportingText?: string; universityWebsiteUrl?: string; programOfficialUrl?: string } = {}) {
  return buildGuideDossier({
    universityId: target.university.id,
    programId: target.program.id,
    ...(options.universityWebsiteUrl === undefined ? {} : { universityWebsiteUrl: options.universityWebsiteUrl }),
    ...(options.programOfficialUrl === undefined ? {} : { programOfficialUrl: options.programOfficialUrl }),
    admissionsClaims: [
      makeClaim({
        id: "gpa-1",
        property: "Minimum GPA",
        value: 3.0,
        unit: "4.00",
        ...(options.supportingText === undefined ? {} : { supportingText: options.supportingText }),
      }),
    ],
  });
}

async function prepareGuideWithGpa(page: import("@playwright/test").Page) {
  await openGuide(page);
  await selectGuideProgram(page);
  await fillGuideProfile(page, { gpaValue: "3.5", gpaScale: "4.00" });
}

test.describe("Guide evidence", () => {
  test("opens exact evidence and Escape restores focus to the exact trigger", async ({ page, research }) => {
    await prepareGuideWithGpa(page);
    research.enqueueJson({ ok: true, dossier: gpaDossier() });
    await submitGuide(page);
    await expect(page.getByText("Minimum GPA")).toBeVisible({ timeout: 15_000 });

    const trigger = page.getByRole("button", { name: "View evidence" }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Minimum GPA" })).toBeVisible();
    await expect(dialog.getByText("Applicants must have a minimum GPA")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("every competing singleton evidence reference remains reachable", async ({ page, research }) => {
    await prepareGuideWithGpa(page);
    research.enqueueJson({
      ok: true,
      dossier: buildGuideDossier({
        universityId: target.university.id,
        programId: target.program.id,
        admissionsClaims: [
          makeClaim({ id: "gpa-a", property: "Minimum GPA", value: 3.0, unit: "4.0", supportingText: "Competing GPA evidence A." }),
          makeClaim({ id: "gpa-b", property: "Minimum GPA", value: 3.2, unit: "4.0", supportingText: "Competing GPA evidence B." }),
        ],
      }),
    });
    await submitGuide(page);
    const row = page.getByText("Multiple inconsistent published values were found for this requirement.").locator("xpath=ancestor::article");
    await expect(row).toBeVisible({ timeout: 15_000 });
    const evidenceButtons = row.getByRole("button", { name: /View evidence/ });
    await expect(evidenceButtons).toHaveCount(2);

    await evidenceButtons.nth(0).click();
    await expect(page.getByRole("dialog").getByText("Competing GPA evidence A.")).toBeVisible();
    await page.keyboard.press("Escape");
    await evidenceButtons.nth(1).click();
    await expect(page.getByRole("dialog").getByText("Competing GPA evidence B.")).toBeVisible();
  });

  test("catalog-owned official links cannot be replaced by hostile same-ID dossier canonical URLs", async ({ page, research }) => {
    await prepareGuideWithGpa(page);
    research.enqueueJson({
      ok: true,
      dossier: gpaDossier({
        universityWebsiteUrl: "https://hostile.invalid/university",
        programOfficialUrl: "https://hostile.invalid/program",
      }),
    });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('a[href*="hostile.invalid"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Official program page/ })).toHaveAttribute("href", target.program.officialUrl);
    await expect(page.getByRole("link", { name: /Official university website/ })).toHaveAttribute("href", target.university.websiteUrl);

    await page.getByRole("button", { name: "View evidence" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('a[href*="hostile.invalid"]')).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: /Official program page/ })).toHaveAttribute("href", target.program.officialUrl);
    await expect(dialog.getByRole("link", { name: /Official university website/ })).toHaveAttribute("href", target.university.websiteUrl);
  });

  test("successful refresh closes preserved evidence before replacing its backing result", async ({ page, research }) => {
    await prepareGuideWithGpa(page);
    research.enqueueJson({ ok: true, dossier: gpaDossier({ supportingText: "Old supporting text marker." }) });
    await submitGuide(page);
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    const pending = research.enqueueDeferredJson({
      ok: true,
      dossier: gpaDossier({ supportingText: "New supporting text marker." }),
    });
    await page.getByRole("button", { name: "Refresh requirements" }).click();
    await pending.entered;

    await page.getByRole("button", { name: "View evidence" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Old supporting text marker.")).toBeVisible();

    pending.release();
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "View evidence" }).first().click();
    await expect(page.getByRole("dialog").getByText("New supporting text marker.")).toBeVisible();
  });
});
