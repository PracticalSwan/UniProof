import { expect, test } from "@/tests/e2e/helpers/research-browser";
import {
  addProgramTarget,
  comparePrograms,
  expectComparisonRequestShape,
  openCompare,
  selectDefaultComparisonTargets,
  submitComparison,
} from "@/tests/e2e/helpers/compare-browser";
import { defaultComparisonBrowserResponses } from "@/tests/fixtures/comparison-browser";

test.describe("Phase 4 Compare form", () => {
  test("replaces the illustrative examples with the live catalog-driven form", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { level: 1, name: "Compare fit, not prestige." })).toBeVisible();
    await expect(page.getByText(/Example A|Example B|Example C/)).toHaveCount(0);
    await expect(page.getByLabel("Search supported universities and programs")).toBeVisible();
    await expect(page.getByRole("group", { name: "Selected comparison targets" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Research categories" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Comparison priorities" })).toBeVisible();
    await expect(page.getByText("Weight total 100 / 100")).toBeVisible();
    await expect(page.getByLabel("Affordability weight")).toHaveValue("30");
    await expect(page.getByLabel("Research weight")).toHaveValue("30");
    await expect(page.getByLabel("Scholarships weight")).toHaveValue("20");
    await expect(page.getByLabel("Outcomes weight")).toHaveValue("20");
    await expect(page.getByLabel("Support weight")).toHaveValue("0");
  });

  test("validates target count and invalid weights before any Research dispatch", async ({ page, research }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText("Select exactly two to four unique supported targets.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await addProgramTarget(page, "MIT", comparePrograms.mit);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText("Select exactly two to four unique supported targets.")).toBeVisible();
    expect(research.requests).toHaveLength(0);
    await page.getByRole("button", { name: "Reset form" }).click();

    await page.getByLabel("Affordability weight").fill("29");
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText(/Priority weights total 99/)).toBeVisible();
    expect(research.requests).toHaveLength(0);
  });

  test("selects exactly two, three, or four unique programs and prevents a fifth selection", async ({ page, research }) => {
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    const selected = page.getByRole("group", { name: "Selected comparison targets" }).locator("li");
    await expect(selected).toHaveCount(2);

    await addProgramTarget(page, "MIT", comparePrograms.mit);
    await expect(selected).toHaveCount(2);
    await addProgramTarget(page, "Georgia Tech", comparePrograms.georgiaTech);
    await expect(selected).toHaveCount(3);
    await addProgramTarget(page, "Berkeley", comparePrograms.berkeley);
    await expect(selected).toHaveCount(4);

    await page.getByLabel("Search supported universities and programs").fill("UCL");
    const fifth = page.locator('[aria-label="Catalog search results"]').getByRole("button", { name: /Computer Science BSc/ });
    await expect(fifth).toBeDisabled();
    expect(research.requests).toHaveLength(0);
  });

  test("rejects mixed university/program scope and mixed degree programs with zero Research dispatch", async ({ page, research }) => {
    await openCompare(page);
    const search = page.getByLabel("Search supported universities and programs");
    await search.fill("MIT");
    await page.locator('[aria-label="Catalog search results"]').getByRole("button", { name: /Massachusetts Institute of TechnologyUniversity target/ }).click();
    await addProgramTarget(page, "Stanford", comparePrograms.stanford);
    await submitComparison(page);
    await expect(page.getByText("Compare university targets together or program targets together, not a mixed scope.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await page.getByRole("button", { name: "Reset form" }).click();
    await addProgramTarget(page, "MIT", comparePrograms.mit);
    await addProgramTarget(page, "Edinburgh", "Artificial Intelligence MSc");
    await submitComparison(page);
    await expect(page.getByText("Program comparisons must use one degree level.")).toBeVisible();
    expect(research.requests).toHaveLength(0);
  });

  test("search and filters never retarget selected items", async ({ page, research }) => {
    const [mit, stanford] = defaultComparisonBrowserResponses();
    research.enqueueJson(mit!);
    research.enqueueJson(stanford!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await page.getByLabel("Country filter").selectOption("TH");
    await page.getByLabel("Degree filter").selectOption("master");
    await page.getByLabel("Search supported universities and programs").fill("Chulalongkorn");
    const selected = page.getByRole("group", { name: "Selected comparison targets" });
    await expect(selected).toContainText("Massachusetts Institute of Technology");
    await expect(selected).toContainText("Stanford University");
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(2);
  });

  test("rejects unsafe weight shapes/category coupling and keeps display toggles out of Research requests", async ({ page, research }) => {
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    const affordability = page.getByLabel("Affordability weight");
    for (const value of ["31", "-1", "30.5", "101"]) {
      await affordability.fill(value);
      await submitComparison(page);
      await expect(page.getByRole("alert").filter({ hasText: /priorities|Priority weights|whole numbers/i }).first()).toBeVisible();
      if (value === "-1" || value === "30.5" || value === "101") {
        await expect(affordability).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByLabel("Research weight")).not.toHaveAttribute("aria-invalid", "true");
      }
      expect(research.requests).toHaveLength(0);
    }
    await affordability.fill("30");
    await page.getByRole("checkbox", { name: "Tuition" }).uncheck();
    await submitComparison(page);
    await expect(page.getByText("Every positive priority needs its backing Research category selected, or set that priority to 0.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await page.getByRole("checkbox", { name: "Tuition" }).check();
    await page.getByLabel("Show ranking-derived contextual evidence (display only; never scored)").check();
    await page.getByLabel("Show student/community opinion (display only; never scored)").check();
    const [mit, stanford] = defaultComparisonBrowserResponses();
    research.enqueueJson(mit!);
    research.enqueueJson(stanford!);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(2);
    for (const request of research.requests) {
      expectComparisonRequestShape(request.body);
      expect(request.body).not.toHaveProperty("weights");
      expect(request.body).not.toHaveProperty("showRankingEvidence");
      expect(request.body).not.toHaveProperty("showAnecdotalEvidence");
    }
  });
});
