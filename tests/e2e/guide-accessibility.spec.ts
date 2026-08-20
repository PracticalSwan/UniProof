import type { Locator, Page } from "@playwright/test";

import { test, expect, type ResearchRouteController } from "./helpers/research-browser";
import { guideFixtureTarget, openGuide, selectGuideProgram, fillGuideProfile, submitGuide } from "./helpers/guide-browser";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";

const target = guideFixtureTarget;

function dossier() {
  return buildGuideDossier({
    universityId: target.university.id,
    programId: target.program.id,
    admissionsClaims: [makeClaim({ id: "gpa-a11y", property: "Minimum GPA", value: 3.0, unit: "4.00" })],
  });
}

async function tabTo(page: Page, locator: Locator, maxTabs = 120) {
  await expect(locator).toBeVisible();
  for (let index = 0; index < maxTabs; index += 1) {
    if (await locator.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(locator).toBeFocused();
}

async function renderGuide(page: Page, research: ResearchRouteController) {
  await openGuide(page);
  await selectGuideProgram(page);
  await fillGuideProfile(page, { gpaValue: "3.5", gpaScale: "4.00" });
  research.enqueueJson({ ok: true, dossier: dossier() });
  await submitGuide(page);
  await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });
}

test.describe("Guide accessibility and keyboard acceptance", () => {
  test("first-tab skip link bypasses repeated navigation and Guide has one main landmark", async ({ page }) => {
    await openGuide(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content", exact: true });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("uses labelled native controls, coherent headings, current Guide navigation, and no positive tabindex", async ({ page, research }) => {
    await renderGuide(page, research);
    const levels = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((headings) => headings
      .filter((heading) => {
        const rect = heading.getBoundingClientRect();
        const style = getComputedStyle(heading);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((heading) => Number(heading.tagName.slice(1))));
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
    }

    for (const label of [
      "Search programs",
      "Supported program",
      "Intake",
      "Academic year",
      "Citizenship",
      "Current country",
      "Level",
      "Title",
      "Subject",
      "GPA value",
      "GPA scale",
      "Test type",
      "Amount",
      "Currency",
      "Scope",
    ]) {
      await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByRole("checkbox", { name: /scholarship or funding consideration/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Guide", exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.locator("[tabindex]").evaluateAll((elements) => elements.filter((el) => Number(el.getAttribute("tabindex")) > 0).length)).toBe(0);
  });

  test("field errors have exact ids/descriptions and only affected controls are invalid", async ({ page }) => {
    await openGuide(page);
    await submitGuide(page);
    const targetSelect = page.getByLabel("Supported program");
    await expect(targetSelect).toHaveAttribute("aria-invalid", "true");
    await expect(targetSelect).toHaveAttribute("aria-describedby", "guide-error-target");
    await expect(page.locator("#guide-error-target")).toContainText("Select a supported program.");
    await expect(page.getByLabel("GPA value", { exact: false })).not.toHaveAttribute("aria-invalid", "true");

    await selectGuideProgram(page);
    await fillGuideProfile(page, {});
    await page.getByLabel("Test type").selectOption("ielts");
    await submitGuide(page);
    const overall = page.getByLabel("Overall score");
    await expect(overall).toHaveAttribute("aria-invalid", "true");
    await expect(overall).toHaveAttribute("aria-describedby", "guide-error-englishOverall");
    await expect(page.locator("#guide-error-englishOverall")).toContainText("Enter your overall score.");
  });

  test("keyboard flow reaches profile controls, Assess, evidence dialog, and restores focus", async ({ page, research }) => {
    await openGuide(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tabTo(page, page.getByLabel("Search programs"));
    await tabTo(page, page.getByLabel("Supported program"));
    await page.getByLabel("Supported program").selectOption(target.program.id);
    await tabTo(page, page.getByLabel("Citizenship"));
    await page.getByLabel("Citizenship").fill("Keyboard Testland");
    await tabTo(page, page.getByLabel("Current country"));
    await page.getByLabel("Current country").fill("Keyboard Country");
    await page.getByLabel("Title").fill("BSc Keyboard");
    await page.getByLabel("Subject").fill("Computer Science");
    await page.getByLabel("GPA value", { exact: false }).fill("3.5");
    await page.getByLabel("GPA scale", { exact: false }).fill("4.00");

    const assess = page.getByRole("button", { name: "Assess", exact: true });
    await tabTo(page, assess);
    research.enqueueJson({ ok: true, dossier: dossier() });
    await assess.press("Enter");
    await expect(page.getByText("Assessment complete", { exact: false })).toBeVisible({ timeout: 15_000 });

    const evidence = page.getByRole("button", { name: "View evidence" }).first();
    await tabTo(page, evidence);
    await evidence.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(evidence).toBeFocused();
  });

  test("loading, cancellation, and completion have one controlled Guide live status", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, {});
    const pending = research.enqueueDeferredJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await pending.entered;
    await expect(page.getByRole("status")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("Researching published requirements");
    await page.getByRole("button", { name: "Cancel" }).click();
    pending.release();
    await expect(page.getByRole("status")).toContainText("Assessment cancelled.");
    await expect(page.getByRole("status")).toHaveCount(1);

    research.enqueueJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await expect(page.getByRole("status")).toContainText("Assessment complete");
    await expect(page.getByRole("status")).toHaveCount(1);
  });

  test("focus treatment is visible and ordinary controls provide practical targets", async ({ page, research }) => {
    await renderGuide(page, research);
    const search = page.getByLabel("Search programs");
    await search.focus();
    const style = await search.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { boxShadow: computed.boxShadow, outlineStyle: computed.outlineStyle, outlineWidth: computed.outlineWidth };
    });
    expect(style.boxShadow !== "none" || (style.outlineStyle !== "none" && style.outlineWidth !== "0px")).toBe(true);

    const boxes = await page.locator("button:visible, input:visible:not([type=checkbox]), select:visible").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, tag: element.tagName };
    }));
    for (const box of boxes) {
      expect(box.width, `${box.tag} width`).toBeGreaterThanOrEqual(24);
      expect(box.height, `${box.tag} height`).toBeGreaterThanOrEqual(24);
    }
  });
});

for (const viewport of [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
]) {
  test(`Guide focused controls are not fully obscured by the sticky header at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openGuide(page);
    await selectGuideProgram(page);
    const controls = [
      page.getByLabel("Search programs"),
      page.getByLabel("Supported program"),
      page.getByLabel("Citizenship"),
      page.getByLabel("GPA value", { exact: false }),
      page.getByRole("button", { name: "Assess", exact: true }),
    ];
    for (const control of controls) {
      await control.focus();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const headerBox = await page.locator("header").boundingBox();
      const box = await control.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(box).not.toBeNull();
      const headerBottom = headerBox!.y + headerBox!.height;
      expect(box!.y + box!.height).toBeGreaterThan(headerBottom);
      expect(box!.y).toBeLessThan(viewport.height);
    }
  });
}

test.describe("Guide reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("retains text loading/completion meaning with reduced motion", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, {});
    const pending = research.enqueueDeferredJson({ ok: true, dossier: dossier() });
    await submitGuide(page);
    await pending.entered;
    await expect(page.getByRole("status")).toContainText("Researching published requirements");
    pending.release();
    await expect(page.getByRole("status")).toContainText("Assessment complete");
  });
});
