import type { Page } from "@playwright/test";

import type { ResearchModeResponse } from "@/lib/research/mode/public-contracts";

import {
  canonicalTargetResponse,
  failedResponse,
  partialResponse,
  succeededAllReadyResponse,
  succeededWithUnknownResponse,
} from "@/tests/fixtures/research-dossiers";
import {
  expect,
  openResearch,
  ResearchRouteController,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

const canonicalCategoryLabels = [
  "Admissions",
  "Tuition",
  "Scholarships",
  "Program structure",
  "Research",
  "Outcomes",
  "Support",
];

async function runFixture(
  page: Page,
  research: ResearchRouteController,
  response: ResearchModeResponse,
) {
  await openResearch(page);
  await selectFixtureProgram(page);
  research.enqueueJson(response);
  await submitResearch(page);
}

test.describe("Research lifecycle acceptance", () => {
  test("succeeded all-ready data renders the server canonical target, exact claim total, and canonical category order", async ({ page, research }) => {
    await runFixture(page, research, canonicalTargetResponse);

    await expect(page.getByText("Research completed")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    await expect(page.getByText("7 final claims", { exact: false })).toBeVisible();
    await expect(page.getByText(/Some research is incomplete/)).toHaveCount(0);
    await expect(page.getByText(/Research failed/)).toHaveCount(0);

    const headings = await page.locator('section[aria-label="Research dossier"] article h3').allTextContents();
    expect(headings).toEqual(canonicalCategoryLabels);

    for (const status of ["Verified", "Corroborated", "University-reported", "Anecdotal", "Inferred"]) {
      await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Unknown", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Research incomplete", { exact: true })).toHaveCount(0);
  });

  test("succeeded data can contain Unknown as a category state without operational-failure styling or evidence actions", async ({ page, research }) => {
    await runFixture(page, research, succeededWithUnknownResponse);

    await expect(page.getByText("Research completed")).toBeVisible();
    await expect(page.getByText("6 unknown categories", { exact: false })).toBeVisible();
    await expect(page.getByText("Unknown", { exact: true })).toHaveCount(6);
    await expect(page.getByText("Research incomplete", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Some research is incomplete")).toHaveCount(0);

    const tuition = page.locator("article").filter({ has: page.getByRole("heading", { name: "Tuition", exact: true }) });
    await expect(tuition).toContainText("0 claims");
    await expect(tuition).toContainText("Completed bounded research did not establish a supported factual claim");
    await expect(tuition.getByRole("button", { name: /View evidence/ })).toHaveCount(0);
    await expect(tuition.getByText("Research incomplete", { exact: true })).toHaveCount(0);
  });

  test("partial data keeps ready and Unknown rows visible while incomplete rows expose an operational reason and explicit retry", async ({ page, research }) => {
    await runFixture(page, research, partialResponse);

    await expect(page.getByText("Some research is incomplete")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admissions", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tuition", exact: true })).toBeVisible();
    await expect(page.getByText("Unknown", { exact: true }).first()).toBeVisible();

    const scholarships = page.locator("article").filter({ has: page.getByRole("heading", { name: "Scholarships", exact: true }) });
    await expect(scholarships).toContainText("Research incomplete");
    await expect(scholarships).toContainText("provider rate limit");
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(1);
    expect(research.requests).toHaveLength(1);
  });

  test("a valid failed dossier remains result data with failed run and incomplete rows rather than becoming a generic transport error", async ({ page, research }) => {
    await runFixture(page, research, failedResponse);

    await expect(page.getByText("Research failed", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Research request error" })).toHaveCount(0);
    await expect(page.getByText("Research incomplete", { exact: true })).toHaveCount(7);
    await expect(page.getByText("Unknown", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View evidence/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(1);
    expect(research.requests).toHaveLength(1);
  });

  test("ordinary succeeded all-ready response exposes exactly the fixture claim count and no incomplete banner", async ({ page, research }) => {
    await runFixture(page, research, succeededAllReadyResponse);

    await expect(page.getByText("7 final claims", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /View evidence for/ })).toHaveCount(7);
    await expect(page.getByText("Research incomplete", { exact: true })).toHaveCount(0);
    expect(research.requests).toHaveLength(1);
  });
});
