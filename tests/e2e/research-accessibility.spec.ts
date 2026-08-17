import type { Locator, Page } from "@playwright/test";

import {
  partialResponse,
  succeededAllReadyResponse,
} from "@/tests/fixtures/research-dossiers";
import {
  expect,
  openResearch,
  ResearchRouteController,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

async function tabTo(page: Page, locator: Locator, maxTabs = 120): Promise<void> {
  await expect(locator).toBeVisible();
  for (let index = 0; index < maxTabs; index += 1) {
    if (await locator.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(locator).toBeFocused();
}

async function renderAllReady(page: Page, research: ResearchRouteController) {
  await openResearch(page);
  await selectFixtureProgram(page);
  research.enqueueJson(succeededAllReadyResponse);
  await submitResearch(page);
  await expect(page.getByText("Research completed")).toBeVisible();
}

test.describe("Research accessibility and keyboard acceptance", () => {
  test("provides a keyboard-visible skip link that bypasses repeated site navigation", async ({ page }) => {
    await openResearch(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content", exact: true });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await skipLink.press("Enter");

    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("has one main landmark, coherent visible heading levels, labelled native controls, active navigation, and no positive tabindex", async ({ page, research }) => {
    await renderAllReady(page, research);

    await expect(page.locator("main")).toHaveCount(1);
    const levels = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((headings) =>
      headings
        .filter((heading) => {
          const style = getComputedStyle(heading);
          const rect = heading.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        })
        .map((heading) => Number(heading.tagName.slice(1))),
    );
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
    }

    for (const label of [
      "Search supported universities and programs",
      "Country",
      "Degree level",
      "Subject",
      "Focused question (optional)",
      "Intake (optional)",
      "Academic year (optional)",
    ]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await expect(page.getByRole("checkbox", { name: "Admissions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Research", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "View evidence for Published application code" })).toBeVisible();

    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Research", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation", includeHidden: true }).getByRole("link", { name: "Research", exact: true, includeHidden: true }),
    ).toHaveAttribute("aria-current", "page");

    const positiveTabIndex = await page.locator("[tabindex]").evaluateAll((elements) =>
      elements.filter((element) => Number(element.getAttribute("tabindex")) > 0).length,
    );
    expect(positiveTabIndex).toBe(0);
  });

  test("target and category errors use exact described-by ids and stale target/category validation clears after correction", async ({ page, research }) => {
    await openResearch(page);

    await submitResearch(page);
    const search = page.getByLabel("Search supported universities and programs");
    await expect(search).toHaveAttribute("aria-invalid", "true");
    await expect(search).toHaveAttribute("aria-describedby", /research-university-error/);
    await expect(page.locator("#research-university-error")).toContainText("Select a supported university.");
    expect(research.requests).toHaveLength(0);

    await selectFixtureProgram(page);
    await expect(search).toHaveAttribute("aria-invalid", "false");
    await expect(search).not.toHaveAttribute("aria-describedby", /research-university-error|research-program-error/);

    const categories = ["Admissions", "Tuition", "Scholarships", "Program structure", "Research", "Outcomes", "Support"];
    for (const name of categories) await page.getByRole("checkbox", { name }).uncheck();
    await submitResearch(page);
    const admissions = page.getByRole("checkbox", { name: "Admissions" });
    await expect(admissions).toHaveAttribute("aria-invalid", "true");
    await expect(admissions).toHaveAttribute("aria-describedby", "research-categories-error");
    await expect(page.locator("#research-categories-error")).toContainText("Select at least one research category.");
    expect(research.requests).toHaveLength(0);

    await admissions.check();
    await expect(admissions).toHaveAttribute("aria-invalid", "false");
    await expect(admissions).not.toHaveAttribute("aria-describedby", "research-categories-error");
    await expect(page.locator("#research-categories-error")).toHaveCount(0);
  });

  test("desktop keyboard flow reaches navigation, search, filters, catalog result, target actions, categories, form actions, Retry/Clear, and evidence trigger", async ({ page, research }) => {
    await openResearch(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    const primaryResearch = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Research", exact: true });
    await tabTo(page, primaryResearch);
    await expect(primaryResearch).toBeFocused();

    const search = page.getByLabel("Search supported universities and programs");
    await tabTo(page, search);
    await search.type("MIT");
    await tabTo(page, page.getByLabel("Country"));
    await tabTo(page, page.getByLabel("Degree level"));
    await tabTo(page, page.getByLabel("Subject"));

    const program = page.getByRole("button", { name: /Artificial Intelligence and Decision Making/ });
    await tabTo(page, program);
    await program.press("Enter");
    await expect(page.getByRole("button", { name: "Research university only" })).toBeVisible();
    await tabTo(page, page.getByRole("button", { name: "Research university only" }));
    await tabTo(page, page.getByRole("button", { name: "Clear target" }));
    await tabTo(page, page.getByRole("checkbox", { name: "Admissions" }));
    await tabTo(page, page.getByLabel("Focused question (optional)"));
    await tabTo(page, page.getByLabel("Intake (optional)"));
    await tabTo(page, page.getByLabel("Academic year (optional)"));

    const researchButton = page.getByRole("button", { name: "Research", exact: true });
    await tabTo(page, researchButton);
    research.enqueueJson(partialResponse);
    await researchButton.press("Enter");
    await expect(page.getByText("Some research is incomplete")).toBeVisible();

    const retry = page.getByRole("button", { name: "Retry this research", exact: true });
    await tabTo(page, retry);
    await expect(retry).toBeFocused();
    const clear = page.getByRole("button", { name: "Clear result", exact: true });
    await tabTo(page, clear);
    await expect(clear).toBeFocused();
    const evidence = page.getByRole("button", { name: "View evidence for Published application code" });
    await tabTo(page, evidence);
    await expect(evidence).toBeFocused();
  });

  test("mobile keyboard navigation is reachable and marks Research current", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openResearch(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    const mobileResearch = page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Research", exact: true });
    await tabTo(page, mobileResearch);
    await expect(mobileResearch).toBeFocused();
    await expect(mobileResearch).toHaveAttribute("aria-current", "page");
  });

  test("keyboard focus has a visible focus treatment and obvious non-inline controls provide practical 24px targets", async ({ page, research }) => {
    await renderAllReady(page, research);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const search = page.getByLabel("Search supported universities and programs");
    await tabTo(page, search);
    const focusStyle = await search.evaluate((element) => {
      const style = getComputedStyle(element);
      return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(
      focusStyle.boxShadow !== "none" ||
      (focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth !== "0px"),
    ).toBe(true);

    const controlBoxes = await page.locator("button:visible, input:visible:not([type=checkbox]), select:visible, textarea:visible").evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, text: (element.textContent ?? "").trim().slice(0, 80), width: rect.width, height: rect.height };
      }),
    );
    expect(controlBoxes.length).toBeGreaterThan(0);
    for (const box of controlBoxes) {
      expect(box.width, `${box.tag} ${box.text} width`).toBeGreaterThanOrEqual(24);
      expect(box.height, `${box.tag} ${box.text} height`).toBeGreaterThanOrEqual(24);
    }

    const categoryLabel = page.locator('label[for="research-category-admissions"]');
    const categoryBox = await categoryLabel.boundingBox();
    expect(categoryBox).not.toBeNull();
    expect(categoryBox!.width).toBeGreaterThanOrEqual(24);
    expect(categoryBox!.height).toBeGreaterThanOrEqual(24);
  });

  test("loading, cancellation, errors, and completion use one controlled live status without skeleton announcement spam", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    const pending = research.enqueueDeferredJson(succeededAllReadyResponse);
    await submitResearch(page);
    await pending.entered;

    await expect(page.getByRole("status")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("Researching sources and evidence");
    await expect(page.getByRole("region", { name: "Research in progress" }).locator('[aria-live]')).toHaveCount(0);

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("cancelled in this session");
    pending.release();

    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByRole("status")).toContainText("Research succeeded.");
    await expect(page.getByRole("status")).toHaveCount(1);
  });
});

for (const viewport of [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
]) {
  test(`focused controls are not fully obscured by the sticky header at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openResearch(page);
    await selectFixtureProgram(page);

    const controls = [
      page.getByLabel("Search supported universities and programs"),
      page.getByLabel("Country"),
      page.getByRole("button", { name: "Research university only" }),
      page.getByRole("checkbox", { name: "Admissions" }),
      page.getByLabel("Focused question (optional)"),
      page.getByRole("button", { name: "Research", exact: true }),
      page.getByRole("button", { name: "Reset", exact: true }),
    ];

    for (const control of controls) {
      await control.focus();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const headerBox = await page.locator("header").boundingBox();
      const box = await control.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(box).not.toBeNull();
      const headerBottom = headerBox!.y + headerBox!.height;
      expect(box!.y + box!.height, `focused control at ${viewport.width}px should remain visible below header`).toBeGreaterThan(headerBottom);
      expect(box!.y, `focused control at ${viewport.width}px should remain in viewport`).toBeLessThan(viewport.height);
    }
  });
}

test.describe("Research reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("retains text-based loading and completion meaning with reduced motion", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    const pending = research.enqueueDeferredJson(succeededAllReadyResponse);
    await submitResearch(page);
    await pending.entered;
    await expect(page.getByRole("status")).toContainText("Researching sources and evidence");
    pending.release();
    await expect(page.getByRole("status")).toContainText("Research succeeded.");
  });
});
