import { expect, test } from "@/tests/e2e/helpers/research-browser";
import {
  openCompare,
  selectDefaultComparisonTargets,
  selectThreeComparisonTargets,
} from "@/tests/e2e/helpers/compare-browser";
import {
  comparisonBrowserTargets,
  defaultComparisonBrowserResponses,
  makeComparisonBrowserResponse,
} from "@/tests/fixtures/comparison-browser";

test.describe("Phase 4 Compare accessibility", () => {
  test("keeps the global Skip to main content link first-tab reachable and focuses Compare main", async ({ page }) => {
    await openCompare(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content", exact: true });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    expect(await skipLink.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("has one main landmark, coherent native groups, stable errors, and affected-control ARIA", async ({ page }) => {
    await openCompare(page);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Compare fit, not prestige." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Choose two to four targets" })).toBeVisible();
    const headingLevels = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((headings) =>
      headings
        .filter((heading) => {
          const rect = heading.getBoundingClientRect();
          const style = getComputedStyle(heading);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })
        .map((heading) => Number(heading.tagName.slice(1))),
    );
    expect(headingLevels[0]).toBe(1);
    for (let index = 1; index < headingLevels.length; index += 1) {
      expect(headingLevels[index]! - headingLevels[index - 1]!).toBeLessThanOrEqual(1);
    }
    await expect(page.getByRole("group", { name: "Selected comparison targets" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Research categories" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Comparison priorities" })).toBeVisible();

    await page.getByRole("button", { name: "Compare", exact: true }).click();
    const search = page.getByLabel("Search supported universities and programs");
    await expect(search).toBeFocused();
    await expect(search).toHaveAttribute("aria-invalid", "true");
    await expect(search).toHaveAttribute("aria-describedby", "compare-targets-error");
    await expect(page.locator("#compare-targets-error")).toHaveText("Select exactly two to four unique supported targets.");
    await expect(page.getByLabel("Affordability weight")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("checkbox", { name: "Tuition" })).not.toHaveAttribute("aria-invalid", "true");
  });

  test("supports keyboard activation, visible focus, no positive tabindex, and practical target sizes", async ({ page, research }) => {
    for (const response of defaultComparisonBrowserResponses()) research.enqueueJson(response);
    await openCompare(page);

    const search = page.getByLabel("Search supported universities and programs");
    await search.focus();
    await search.pressSequentially("MIT");
    const mit = page.getByRole("button", { name: /Bachelor of Science in Artificial Intelligence and Decision Making/ }).last();
    await mit.focus();
    await mit.press("Enter");
    await search.focus();
    await search.fill("");
    await search.pressSequentially("Stanford");
    const stanford = page.getByRole("button", { name: /Computer Science Bachelor's Program/ }).last();
    await stanford.focus();
    await stanford.press("Enter");
    const compare = page.getByRole("button", { name: "Compare", exact: true });
    await compare.focus();
    await compare.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();

    await expect(page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).toHaveCount(0);
    const controls = await page.locator("main button:visible, main input:visible:not([type=checkbox]), main select:visible, main a:visible").evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, text: (element.textContent ?? "").trim().slice(0, 80), width: rect.width, height: rect.height };
      }),
    );
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.width, `${control.tag} ${control.text} width`).toBeGreaterThanOrEqual(24);
      expect(control.height, `${control.tag} ${control.text} height`).toBeGreaterThanOrEqual(24);
    }
    for (const label of await page.locator('main label:has(input[type="checkbox"])').all()) {
      const box = await label.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });

  test("uses exactly one controlled live batch status while research is pending", async ({ page, research }) => {
    const [firstResponse, secondResponse] = defaultComparisonBrowserResponses();
    const first = research.enqueueDeferredJson(firstResponse!);
    research.enqueueJson(secondResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await first.entered;
    await expect(page.getByRole("status")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("Researching option 1 of 2");
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
    first.release();
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("keyboard can remove a target, cancel, retry incomplete research, and clear the result", async ({ page, research }) => {
    const [mitResponse, stanfordResponse] = defaultComparisonBrowserResponses();
    const georgiaTechResponse = makeComparisonBrowserResponse({
      target: comparisonBrowserTargets.georgiaTech,
      tuition: 15_000,
      employment: 86,
      research: true,
      scholarship: true,
    });
    await openCompare(page);
    await selectThreeComparisonTargets(page);

    const selected = page.getByRole("group", { name: "Selected comparison targets" });
    const firstRemove = selected.getByRole("button", { name: /Remove Bachelor of Science in Artificial Intelligence/ });
    await firstRemove.focus();
    await firstRemove.press("Enter");
    await expect(selected.locator("li")).toHaveCount(2);
    const search = page.getByLabel("Search supported universities and programs");
    await search.fill("MIT");
    const mitTarget = page.getByRole("button", { name: /Bachelor of Science in Artificial Intelligence and Decision Making/ }).last();
    await mitTarget.focus();
    await mitTarget.press("Enter");
    await expect(selected.locator("li")).toHaveCount(3);

    const pending = research.enqueueDeferredJson(stanfordResponse!);
    const compare = page.getByRole("button", { name: "Compare", exact: true });
    await compare.focus();
    await compare.press("Enter");
    await pending.entered;
    const cancel = page.getByRole("button", { name: "Cancel comparison" });
    await cancel.focus();
    await cancel.press("Enter");
    pending.release();
    await expect(page.getByText("Comparison cancelled.")).toBeVisible();

    research.enqueueJson(stanfordResponse!);
    research.enqueueJson(georgiaTechResponse);
    research.enqueueAbort();
    await compare.focus();
    await compare.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await expect(page.getByText(/Partial comparison/)).toBeVisible();

    research.enqueueJson(mitResponse!);
    const retry = page.getByRole("button", { name: "Retry incomplete/failed research" });
    await retry.focus();
    await retry.press("Enter");
    await expect(page.getByText("Comparison complete.")).toBeVisible();

    const clear = page.getByRole("button", { name: "Clear result" });
    await clear.focus();
    await clear.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toHaveCount(0);
    await expect(selected.locator("li")).toHaveCount(3);
  });
});

for (const viewport of [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
]) {
  test(`Compare focused controls are not fully obscured by the sticky header at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openCompare(page);
    const controls = [
      page.getByLabel("Search supported universities and programs"),
      page.getByLabel("Country filter"),
      page.getByLabel("Degree filter"),
      page.getByRole("checkbox", { name: "Admissions" }),
      page.getByLabel("Affordability weight"),
      page.getByLabel("Intake (public context only, optional)"),
      page.getByRole("button", { name: "Compare", exact: true }),
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

test.describe("Phase 4 Compare reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("retains text-based progress and completion meaning with reduced motion", async ({ page, research }) => {
    const [firstResponse, secondResponse] = defaultComparisonBrowserResponses();
    const first = research.enqueueDeferredJson(firstResponse!);
    research.enqueueJson(secondResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await first.entered;
    await expect(page.getByRole("status")).toContainText("Researching option 1 of 2");
    first.release();
    await expect(page.getByText("Comparison complete.")).toBeVisible();
  });
});
