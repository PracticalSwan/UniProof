import {
  conflictResponse,
  fixtureTarget,
  outdatedResponse,
  succeededAllReadyResponse,
  xssLookingResponse,
} from "@/tests/fixtures/research-dossiers";
import type { ResearchModeResponse } from "@/lib/research/mode/public-contracts";
import {
  expect,
  expectSafeExternalLink,
  openResearch,
  ResearchRouteController,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

async function render(
  page: Parameters<typeof openResearch>[0],
  research: ResearchRouteController,
  response: ResearchModeResponse,
) {
  await openResearch(page);
  await selectFixtureProgram(page);
  research.enqueueJson(response);
  await submitResearch(page);
  await expect(page.getByRole("region", { name: "Research dossier" })).toBeVisible();
}

test.describe("Research evidence semantics", () => {
  test("renders claim badges exactly and preserves scalar types without reinterpretation", async ({ page, research }) => {
    await render(page, research, succeededAllReadyResponse);

    for (const status of ["Verified", "Corroborated", "University-reported", "Anecdotal", "Inferred"]) {
      await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("007", { exact: true })).toBeVisible();
    await expect(page.getByText("USD 12345", { exact: true })).toBeVisible();
    await expect(page.getByText("Yes", { exact: true })).toBeVisible();
    await expect(page.getByText("No", { exact: true })).toBeVisible();
    await expect(page.getByText("Unknown", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/confidence/i)).toHaveCount(0);
    await expect(page.getByText(/converted|conversion/i)).toHaveCount(0);
  });

  test("conflict renders every competing value and keeps evidence/source associations separate without preferring a winner", async ({ page, research }) => {
    await render(page, research, conflictResponse);

    await expect(page.getByText("Conflicting", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2027-01-10", { exact: true })).toBeVisible();
    await expect(page.getByText("2027-01-20", { exact: true })).toBeVisible();
    await expect(page.getByText(/without selecting a winner/i)).toBeVisible();
    await expect(page.getByText(/preferred/i)).toHaveCount(0);

    const triggers = page.getByRole("button", { name: "View evidence for Published deadline" });
    await expect(triggers).toHaveCount(2);

    await triggers.nth(0).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("2027-01-10");
    await expect(dialog).toContainText("Source A publishes a January 10 deadline.");
    await expect(dialog).toContainText("Evidence source 1");
    await page.getByRole("button", { name: "Close evidence details" }).click();

    await triggers.nth(1).click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("2027-01-20");
    await expect(dialog).toContainText("Source B publishes a January 20 deadline.");
    await expect(dialog).toContainText("Evidence source 2");
    await expect(dialog).not.toContainText("Source A publishes a January 10 deadline.");
  });

  test("outdated claims distinguish explicit effective period metadata from Retrieved time and retain official target links", async ({ page, research }) => {
    await render(page, research, outdatedResponse);

    await expect(page.getByText("Outdated", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Academic year 2023-24/)).toBeVisible();
    await expect(page.getByText(/Effective Sep 1, 2023/)).toBeVisible();

    await page.getByRole("button", { name: "View evidence for Historical application deadline" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Retrieved Aug 18, 2026, 00:09 UTC");
    await expect(dialog).toContainText("Source effective Sep 1, 2023");
    await expect(dialog).toContainText("Source academic year 2023-24");
    await expect(dialog).not.toContainText("Retrieved Sep 1, 2023");

    await expectSafeExternalLink(
      page,
      /Official program page/,
      fixtureTarget.program.officialUrl,
    );
    await expectSafeExternalLink(
      page,
      /Official university website/,
      fixtureTarget.university.websiteUrl,
    );
  });

  test("evidence sheet shows exact claim data with representative source first even when sourceIds order differs", async ({ page, research }) => {
    await render(page, research, succeededAllReadyResponse);

    await page.getByRole("button", { name: "View evidence for Published application code" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Published application code" })).toBeVisible();
    await expect(dialog).toContainText("007");
    await expect(dialog).toContainText("Verified");
    await expect(dialog).toContainText("Effective Aug 1, 2026");
    await expect(dialog).toContainText("The published application code is the exact string 007.");

    const sourceCards = dialog.locator('section[aria-label="Evidence sources"] li');
    await expect(sourceCards).toHaveCount(2);
    await expect(sourceCards.nth(0)).toContainText("Representative source");
    await expect(sourceCards.nth(0)).toContainText("Evidence source 1");
    await expect(sourceCards.nth(1)).toContainText("Source 2");
    await expect(sourceCards.nth(1)).toContainText("Evidence source 2");
    await expect(dialog.getByText("Evidence source 1", { exact: true })).toHaveCount(1);
    await expect(dialog.getByText("Evidence source 2", { exact: true })).toHaveCount(1);

    await expectSafeExternalLink(page, /Open source: Evidence source 1/, "https://source-1.example/evidence");
    await expectSafeExternalLink(page, /Open source: Evidence source 2/, "https://source-2.example/evidence");
    await expectSafeExternalLink(page, /Official program page/, fixtureTarget.program.officialUrl);
    await expectSafeExternalLink(page, /Official university website/, fixtureTarget.university.websiteUrl);
  });

  test("keyboard opens the evidence sheet with Enter and Space, traps focus, closes with Escape, and returns focus to the exact mounted trigger", async ({ page, research }) => {
    await render(page, research, succeededAllReadyResponse);

    const trigger = page.getByRole("button", { name: "View evidence for Published application code" });
    await trigger.focus();
    await trigger.press("Enter");
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expect(page.getByRole("button", { name: "Close evidence details" })).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.press("Space");
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Close evidence details" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("payload-shaped XSS text remains inert text and never becomes executable DOM or URL behavior", async ({ page, research }) => {
    await render(page, research, xssLookingResponse);

    const dossier = page.getByRole("region", { name: "Research dossier" });
    await expect(dossier).toContainText('<script>alert(1)</script> & "quoted" property');
    await expect(dossier).toContainText("javascript: <img src=x onerror=alert(1)> & value");
    await expect(dossier.locator("script")).toHaveCount(0);
    await expect(dossier.locator("img")).toHaveCount(0);
    await expect(dossier.locator("[onerror], [onclick], [onload]")).toHaveCount(0);

    await page.getByRole("button", { name: /View evidence for <script>alert\(1\)<\/script>/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText('<img src=x onerror=alert(1)> <script>alert(1)</script> & "supporting text"');
    await expect(dialog).toContainText("<script>alert(1)</script>");
    await expect(dialog.locator("script")).toHaveCount(0);
    await expect(dialog.locator("img")).toHaveCount(0);
    await expect(dialog.locator("[onerror], [onclick], [onload]")).toHaveCount(0);
    await expectSafeExternalLink(page, /Open source: <script>alert\(1\)<\/script>/, "https://xss-shaped.example/safe-evidence");
  });
});
