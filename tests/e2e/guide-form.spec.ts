import { test, expect } from "./helpers/research-browser";
import { openGuide, selectGuideProgram, fillGuideProfile, submitGuide, guideFixtureTarget } from "./helpers/guide-browser";

test.describe("Guide form", () => {
  test("removes static illustrative preview and shows real form", async ({ page }) => {
    await openGuide(page);
    await expect(page.getByText("Illustrative UI preview")).toHaveCount(0);
    await expect(page.getByText("THB 1.2M total")).toHaveCount(0);
    await expect(page.getByText("3.40 / 4.00")).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Applicant profile" })).toBeVisible();
  });

  test("requires program selection", async ({ page }) => {
    await openGuide(page);
    await fillGuideProfile(page, {});
    await submitGuide(page);
    await expect(page.getByText("Select a supported program.")).toBeVisible();
  });

  test("shows validation errors for blank fields", async ({ page }) => {
    await openGuide(page);
    await submitGuide(page);
    await expect(page.getByText("Select a supported program.")).toBeVisible();
  });

  test("finds and selects expanded supported programs by university alias", async ({ page }) => {
    await openGuide(page);
    await page.getByLabel("Search programs").fill("TU Delft");
    const select = page.locator("#guide-program-select");
    await expect(select.locator('option[value="program-tu-delft-computer-science-msc"]')).toContainText(
      "MSc Computer Science - Delft University of Technology",
    );
    await select.selectOption("program-tu-delft-computer-science-msc");
    await expect(select).toHaveValue("program-tu-delft-computer-science-msc");
  });

  test("program selection populates target", async ({ page }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await expect(page.locator("#guide-program-select")).toHaveValue(guideFixtureTarget.program.id);
    await expect(page.locator("#guide-program-select").locator("xpath=following-sibling::p")).toContainText(
      guideFixtureTarget.program.name,
    );
  });

  test("selected program stays available when the search query no longer matches", async ({ page }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await page.getByLabel("Search programs").fill("no-such-program-marker");
    await expect(page.locator("#guide-program-select")).toHaveValue(guideFixtureTarget.program.id);
    await expect(page.locator(`#guide-program-select option[value="${guideFixtureTarget.program.id}"]`)).toHaveCount(1);
    await expect(page.locator("#guide-program-select").locator("xpath=following-sibling::p")).toContainText(
      guideFixtureTarget.program.name,
    );
  });

  test("selecting the blank option clears the selected target", async ({ page }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await page.locator("#guide-program-select").selectOption("");
    await expect(page.locator("#guide-program-select")).toHaveValue("");
    await expect(page.locator("#guide-program-select").locator("xpath=following-sibling::p")).toHaveCount(0);
  });

  test("Enter in program search never submits the Guide form", async ({ page, research }) => {
    await openGuide(page);
    await selectGuideProgram(page);
    await fillGuideProfile(page, {});
    await page.getByLabel("Search programs").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Researching published requirements/)).toHaveCount(0);
    expect(research.requests).toHaveLength(0);
  });
});
