import { expect, test } from "@/tests/e2e/helpers/research-browser";
import {
  addProgramTarget,
  comparePrograms,
  expectComparisonRequestShape,
  openCompare,
  selectDefaultComparisonTargets,
  setComparisonWeight,
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
    const categories = page.getByRole("group", { name: "Research categories" });
    const priorities = page.getByRole("group", { name: "Comparison priorities" });
    await expect(categories).toBeVisible();
    await expect(priorities).toBeVisible();
    await expect(categories.getByRole("heading", { level: 2, name: "Research categories" })).toBeVisible();
    await expect(priorities.getByRole("heading", { level: 2, name: "Comparison priorities" })).toBeVisible();
    await expect(page.getByText(/relative importance/i)).toBeVisible();
    await expect(page.getByText(/total exactly 100|Weight total 100 \/ 100/)).toHaveCount(0);
    await expect(page.getByText("Showing 20 of 75 supported matches. Refine the search to see hidden matches.")).toBeVisible();

    const expected = {
      affordability: "30",
      research: "30",
      scholarships: "20",
      outcomes: "20",
      support: "0",
    } as const;
    for (const [priority, value] of Object.entries(expected)) {
      const slider = page.locator(`#compare-weight-${priority}`);
      await expect(slider).toHaveAttribute("type", "range");
      await expect(slider).toHaveAttribute("min", "0");
      await expect(slider).toHaveAttribute("max", "100");
      await expect(slider).toHaveAttribute("step", "1");
      await expect(slider).toHaveValue(value);
      await expect(page.getByTestId(`compare-weight-${priority}-value`)).toHaveText(value);
    }
  });

  test("keeps Enter inside catalog search and explains an empty result", async ({ page, research }) => {
    await openCompare(page);
    const search = page.getByLabel("Search supported universities and programs");
    await search.fill("MIT");
    await search.press("Enter");
    await expect(page.getByText("Select exactly two to four unique supported targets.")).toHaveCount(0);
    expect(research.requests).toHaveLength(0);

    await search.fill("No Such UniProof Target");
    await expect(page.getByText("No supported matches. Change the search or filters.")).toBeVisible();
  });

  test("finds expanded Canada and EU targets through the bounded result list", async ({ page }) => {
    await openCompare(page);
    const search = page.getByLabel("Search supported universities and programs");
    const results = page.locator('[aria-label="Catalog search results"]');

    await search.fill("U of T");
    await expect(results.getByRole("button", { name: /University of TorontoUniversity target/ })).toBeVisible();

    await search.fill("TU Delft");
    await expect(results.getByRole("button", { name: /Delft University of TechnologyUniversity target/ })).toBeVisible();

    await page.getByLabel("Country filter").selectOption("DE");
    await search.fill("RWTH");
    await expect(results.getByRole("button", { name: /RWTH Aachen UniversityUniversity target/ })).toBeVisible();
  });

  test("validates target count and rejects an all-zero priority vector before any Research dispatch", async ({ page, research }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText("Select exactly two to four unique supported targets.")).toBeVisible();
    expect(research.requests).toHaveLength(0);

    await addProgramTarget(page, "MIT", comparePrograms.mit);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText("Select exactly two to four unique supported targets.")).toBeVisible();
    expect(research.requests).toHaveLength(0);
    await page.getByRole("button", { name: "Reset form" }).click();

    await selectDefaultComparisonTargets(page);
    for (const priority of ["Affordability", "Research", "Scholarships", "Outcomes", "Support"]) {
      await setComparisonWeight(page, priority, 0);
    }
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText("Set at least one comparison priority above 0.")).toBeVisible();
    expect(research.requests).toHaveLength(0);
  });

  test("allows arbitrary positive relative totals and supports native slider keyboard controls", async ({ page, research }) => {
    const [mit, stanford] = defaultComparisonBrowserResponses();
    research.enqueueJson(mit!);
    research.enqueueJson(stanford!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);

    const affordability = page.getByLabel("Affordability weight");
    await affordability.focus();
    await page.keyboard.press("Home");
    await expect(affordability).toHaveValue("0");
    await expect(page.getByTestId("compare-weight-affordability-value")).toHaveText("0");
    await page.keyboard.press("ArrowRight");
    await expect(affordability).toHaveValue("1");
    await page.keyboard.press("End");
    await expect(affordability).toHaveValue("100");

    await setComparisonWeight(page, "Research", 50);
    await setComparisonWeight(page, "Scholarships", 50);
    await setComparisonWeight(page, "Outcomes", 0);
    await setComparisonWeight(page, "Support", 0);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(2);
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

  test("rejects positive-weight/category mismatch and keeps display toggles out of Research requests", async ({ page, research }) => {
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    const affordability = page.getByLabel("Affordability weight");
    await expect(affordability).toHaveAttribute("type", "range");
    await expect(affordability).toHaveAttribute("min", "0");
    await expect(affordability).toHaveAttribute("max", "100");
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
