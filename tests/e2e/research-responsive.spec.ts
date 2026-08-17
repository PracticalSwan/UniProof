import {
  longContentResponse,
  maxClaimCountResponse,
} from "@/tests/fixtures/research-dossiers";
import {
  expect,
  expectNoHorizontalOverflow,
  openResearch,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

const viewports = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`near-maximum Research content has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page, research }) => {
    await page.setViewportSize(viewport);
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(longContentResponse);
    await submitResearch(page);

    await expect(page.getByText("Research completed")).toBeVisible();
    await expect(page.getByRole("region", { name: "Research dossier" })).toContainText("Long University");
    await expect(page.getByText("P".repeat(200), { exact: true })).toBeVisible();
    await expect(page.getByText("V".repeat(500), { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: `View evidence for ${"P".repeat(200)}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Evidence😀é");
    await expect(dialog.locator('section[aria-label="Evidence sources"] li')).toHaveCount(12);
    await expect(dialog.locator('section[aria-label="Evidence sources"] li').first()).toContainText("Representative source");
    await expect(dialog.locator('section[aria-label="Evidence sources"] li').first()).toContainText("Long source title");
    await expectNoHorizontalOverflow(page);

    const safeSource = dialog.getByRole("link", { name: /Open source:/ }).first();
    await expect(safeSource).toHaveAttribute("href", /^https:\/\/long-12\.example\//);
    await expect(safeSource).toHaveAttribute("target", "_blank");
    await expect(safeSource).toHaveAttribute("rel", "noopener noreferrer");
    await expect(safeSource).toHaveAttribute("referrerpolicy", "no-referrer");

    await page.getByRole("button", { name: "Close evidence details" }).click();
    await expect(dialog).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test("500-claim valid dossier remains reachable, associated, and overflow-safe without runtime errors", async ({ page, research }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openResearch(page);
  await selectFixtureProgram(page);
  research.enqueueJson(maxClaimCountResponse);
  await submitResearch(page);

  await expect(page.getByText("Research completed")).toBeVisible();
  await expect(page.getByText("500 final claims", { exact: false })).toBeVisible();
  const triggers = page.getByRole("button", { name: /View evidence for Maximum fixture claim/ });
  await expect(triggers).toHaveCount(500);
  await expectNoHorizontalOverflow(page);

  const firstProperty = page.getByText("Maximum fixture claim 1", { exact: true });
  const lastProperty = page.getByText("Maximum fixture claim 500", { exact: true });
  await firstProperty.scrollIntoViewIfNeeded();
  await expect(firstProperty).toBeVisible();
  await lastProperty.scrollIntoViewIfNeeded();
  await expect(lastProperty).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const lastTrigger = page.getByRole("button", { name: "View evidence for Maximum fixture claim 500" });
  await lastTrigger.scrollIntoViewIfNeeded();
  await lastTrigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Maximum fixture claim 500" })).toBeVisible();
  await expect(dialog).toContainText("500");
  await expect(dialog).toContainText("Exact supporting text for maximum fixture claim 500.");
  await expect(dialog).toContainText("Evidence source 8");
  await expect(dialog.getByRole("link", { name: "Open source: Evidence source 8" })).toHaveAttribute(
    "href",
    "https://source-8.example/evidence",
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Close evidence details" }).click();
  await expect(dialog).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
