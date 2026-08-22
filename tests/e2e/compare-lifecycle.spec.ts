import { expect, test } from "@/tests/e2e/helpers/research-browser";
import {
  expectComparisonRequestShape,
  openCompare,
  selectDefaultComparisonTargets,
  selectFourComparisonTargets,
  selectThreeComparisonTargets,
  setComparisonWeight,
  submitComparison,
} from "@/tests/e2e/helpers/compare-browser";
import {
  comparisonBrowserTargets,
  defaultComparisonBrowserResponses,
  makeComparisonBrowserResponse,
} from "@/tests/fixtures/comparison-browser";

const [mitResponse, stanfordResponse] = defaultComparisonBrowserResponses();
const georgiaTechResponse = makeComparisonBrowserResponse({
  target: comparisonBrowserTargets.georgiaTech,
  tuition: 15_000,
  employment: 86,
  research: true,
  scholarship: true,
});
const berkeleyResponse = makeComparisonBrowserResponse({
  target: comparisonBrowserTargets.berkeley,
  tuition: 18_000,
  employment: 88,
  research: false,
  scholarship: true,
});

test.describe("Phase 4 Compare lifecycle and ownership", () => {
  test("dispatches Research strictly sequentially and preserves submitted target order", async ({ page, research }) => {
    const first = research.enqueueDeferredJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const entered = await first.entered;
    expect(research.requests).toHaveLength(1);
    expectComparisonRequestShape(entered.body);
    expect(entered.body).toMatchObject({
      universityId: comparisonBrowserTargets.mit.universityId,
      programId: comparisonBrowserTargets.mit.programId,
    });

    await page.waitForTimeout(100);
    expect(research.requests).toHaveLength(1);
    first.release();

    await expect.poll(() => research.requests.length).toBe(2);
    expectComparisonRequestShape(research.requests[1]!.body);
    expect(research.requests[1]!.body).toMatchObject({
      universityId: comparisonBrowserTargets.stanford.universityId,
      programId: comparisonBrowserTargets.stanford.programId,
    });
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    const cards = page.locator("[data-comparison-card]");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Artificial Intelligence and Decision Making");
    await expect(cards.nth(1)).toContainText("Computer Science Bachelor's Program");
  });

  test("uses one synchronous active-batch guard for rapid duplicate submission", async ({ page, research }) => {
    const first = research.enqueueDeferredJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);

    await page.getByRole("button", { name: "Compare", exact: true }).dblclick();
    await first.entered;
    expect(research.requests).toHaveLength(1);
    first.release();
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(2);
  });

  test("cancels the active fetch once, stops the batch, and never auto-retries", async ({ page, research }) => {
    const first = research.enqueueDeferredJson(mitResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await first.entered;

    await page.getByRole("button", { name: "Cancel comparison" }).click();
    first.release();
    await expect(page.getByText("Comparison cancelled.")).toBeVisible();
    await page.waitForTimeout(150);
    expect(research.requests).toHaveLength(1);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toHaveCount(0);
  });

  test("keeps a prior result visible while a new run is pending and restores it on cancellation", async ({ page, research }) => {
    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();

    const pending = research.enqueueDeferredJson(mitResponse!);
    await submitComparison(page);
    await pending.entered;
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel comparison" }).click();
    pending.release();
    await expect(page.getByText("Comparison cancelled.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(3);
  });

  test("retries only failed/partial targets using the prior immutable submission snapshot", async ({ page, research }) => {
    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    research.enqueueAbort();
    await openCompare(page);
    await selectThreeComparisonTargets(page);
    await submitComparison(page);

    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await expect(page.getByText(/Partial comparison:/)).toBeVisible();
    expect(research.requests).toHaveLength(3);

    await page.getByLabel("Academic year (public context only, optional)").fill("2030-31");
    research.enqueueJson(georgiaTechResponse);
    await page.getByRole("button", { name: "Retry incomplete/failed research" }).click();
    await expect.poll(() => research.requests.length).toBe(4);
    expectComparisonRequestShape(research.requests[3]!.body);
    expect(research.requests[3]!.body).toMatchObject({
      universityId: comparisonBrowserTargets.georgiaTech.universityId,
      programId: comparisonBrowserTargets.georgiaTech.programId,
    });
    expect(research.requests[3]!.body).not.toHaveProperty("academicYear");
    await expect(page.getByText("Comparison complete.")).toBeVisible();
    await expect(page.locator("[data-comparison-card]")).toHaveCount(3);
  });

  test("requires explicit target correction before resubmitting a server-rejected unsupported target", async ({ page, research }) => {
    research.enqueueJson({ ok: false, error: { code: "unsupported-target", message: "This target is not supported." } }, 400);
    research.enqueueJson(stanfordResponse!);
    research.enqueueJson(georgiaTechResponse);
    await openCompare(page);
    await selectThreeComparisonTargets(page);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(3);

    await submitComparison(page);
    await expect(page.getByText("Remove or replace each target Research reported as unsupported before starting a new comparison.")).toBeVisible();
    expect(research.requests).toHaveLength(3);

    await page.getByRole("button", { name: /Remove .*Artificial Intelligence and Decision Making/i }).click();
    research.enqueueJson(stanfordResponse!);
    research.enqueueJson(georgiaTechResponse);
    await submitComparison(page);
    await expect.poll(() => research.requests.length).toBe(5);
    await expect(page.getByText("Comparison complete.")).toBeVisible();
  });

  test("continues after a target-local failure but stops on a shared invalid-request failure", async ({ page, research }) => {
    research.enqueueJson({ ok: false, error: { code: "unsupported-target", message: "This target is not supported." } }, 400);
    research.enqueueJson(stanfordResponse!);
    research.enqueueJson(georgiaTechResponse);
    await openCompare(page);
    await selectThreeComparisonTargets(page);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(3);

    await page.getByRole("button", { name: "Clear result" }).click();
    await page.getByRole("button", { name: /Remove .*Artificial Intelligence and Decision Making/i }).click();
    research.enqueueJson({ ok: false, error: { code: "invalid-request", message: "The shared request is invalid." } }, 400);
    await submitComparison(page);
    await expect(page.getByRole("heading", { name: "Comparison could not be calculated" })).toBeVisible();
    expect(research.requests).toHaveLength(4);
  });

  for (const status of [429, 504]) {
    test(`raw deployment ${status} stops the sequential batch before the next target`, async ({ page, research }) => {
      research.enqueueRaw("platform details must not be parsed", { status, contentType: "text/plain" });
      await openCompare(page);
      await selectDefaultComparisonTargets(page);
      await submitComparison(page);

      await expect(page.getByRole("heading", { name: "Comparison could not be calculated" })).toBeVisible();
      const alert = page.getByRole("alert", { name: "Comparison could not be calculated" });
      await expect(alert).toContainText(
        status === 429 ? "temporarily limiting research requests" : "timed out before the research request completed",
      );
      await expect(alert).not.toContainText("platform details");
      await page.waitForTimeout(150);
      expect(research.requests).toHaveLength(1);
      await expect(page.getByRole("button", { name: "Retry incomplete/failed research" })).toHaveCount(1);
    });
  }

  test("renders an undispatched fourth target after a deployment stop without crashing", async ({ page, research }) => {
    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    research.enqueueRaw("platform details must not be parsed", { status: 429, contentType: "text/plain" });
    await openCompare(page);
    await selectFourComparisonTargets(page);
    await submitComparison(page);

    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    expect(research.requests).toHaveLength(3);
    await expect(page.locator("[data-comparison-card='3']")).toContainText("temporarily limiting research requests");
    await expect(page.locator("[data-comparison-card='4']")).toContainText("No usable Research dossier was available for this target.");
  });

  test("retry after a deployment stop replays the failed target and every target that was not dispatched", async ({ page, research }) => {
    research.enqueueRaw("platform details must not be parsed", { status: 429, contentType: "text/plain" });
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    await expect(page.getByRole("heading", { name: "Comparison could not be calculated" })).toBeVisible();
    expect(research.requests).toHaveLength(1);

    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    await page.getByRole("button", { name: "Retry incomplete/failed research" }).click();

    await expect.poll(() => research.requests.length).toBe(3);
    expect(research.requests[1]!.body).toMatchObject({
      universityId: comparisonBrowserTargets.mit.universityId,
      programId: comparisonBrowserTargets.mit.programId,
    });
    expect(research.requests[2]!.body).toMatchObject({
      universityId: comparisonBrowserTargets.stanford.universityId,
      programId: comparisonBrowserTargets.stanford.programId,
    });
    await expect(page.getByText("Comparison complete.")).toBeVisible();
  });

  test("cancels during request three and never dispatches request four", async ({ page, research }) => {
    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    const third = research.enqueueDeferredJson(georgiaTechResponse);
    await openCompare(page);
    await selectFourComparisonTargets(page);
    await submitComparison(page);
    await third.entered;
    expect(research.requests).toHaveLength(3);
    await page.getByRole("button", { name: "Cancel comparison" }).click();
    third.release();
    await expect(page.getByText("Comparison cancelled.")).toBeVisible();
    await page.waitForTimeout(150);
    expect(research.requests).toHaveLength(3);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toHaveCount(0);
  });

  test("navigation unmount aborts the active request and a later release cannot update the old page", async ({ page, research }) => {
    const pending = research.enqueueDeferredJson(mitResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await pending.entered;
    await page.goto("/guide");
    pending.release();
    await expect(page).toHaveURL(/\/guide$/);
    await page.waitForTimeout(150);
    expect(research.requests).toHaveLength(1);
    await expect(page.getByRole("heading", { name: "Comparison results" })).toHaveCount(0);
  });

  test("a stale released response cannot overwrite a newer completed batch", async ({ page, research }) => {
    const stale = research.enqueueDeferredJson(mitResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await stale.entered;
    await page.getByRole("button", { name: "Cancel comparison" }).click();

    const newerMit = makeComparisonBrowserResponse({
      target: comparisonBrowserTargets.mit,
      tuition: 9_000,
      employment: 84,
      research: true,
      scholarship: true,
      canonicalProgramName: "Newer validated MIT program label",
    });
    research.enqueueJson(newerMit);
    research.enqueueJson(stanfordResponse!);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await expect(page.locator("[data-comparison-card='1']")).toContainText("Newer validated MIT program label");
    stale.release();
    await page.waitForTimeout(150);
    await expect(page.locator("[data-comparison-card='1']")).toContainText("Newer validated MIT program label");
    expect(research.requests).toHaveLength(3);
  });

  test("Clear result preserves current form and a new Compare uses current edits", async ({ page, research }) => {
    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();

    await page.getByRole("button", { name: "Clear result" }).click();
    await page.getByLabel("Academic year (public context only, optional)").fill("2027-28");
    await setComparisonWeight(page, "Affordability", 31);
    await setComparisonWeight(page, "Research", 29);
    research.enqueueJson(mitResponse!);
    research.enqueueJson(stanfordResponse!);
    await submitComparison(page);
    await expect.poll(() => research.requests.length).toBe(4);
    expect(research.requests[2]!.body).toHaveProperty("academicYear", "2027-28");
    expect(research.requests[3]!.body).toHaveProperty("academicYear", "2027-28");
    await page.getByRole("button", { name: "Clear result" }).click();
    await expect(page.getByLabel("Academic year (public context only, optional)")).toHaveValue("2027-28");
    await expect(page.getByLabel("Affordability weight")).toHaveValue("31");
    await expect(page.getByRole("group", { name: "Selected comparison targets" }).locator("li")).toHaveCount(2);
  });

  test("dispatches a four-target batch strictly 1→2→3→4 only after each prior response settles", async ({ page, research }) => {
    const first = research.enqueueDeferredJson(mitResponse!);
    const second = research.enqueueDeferredJson(stanfordResponse!);
    const third = research.enqueueDeferredJson(georgiaTechResponse);
    const fourth = research.enqueueDeferredJson(berkeleyResponse);
    await openCompare(page);
    await selectFourComparisonTargets(page);
    await submitComparison(page);

    await first.entered;
    expect(research.requests).toHaveLength(1);
    first.release();
    await second.entered;
    expect(research.requests).toHaveLength(2);
    second.release();
    await third.entered;
    expect(research.requests).toHaveLength(3);
    third.release();
    await fourth.entered;
    expect(research.requests).toHaveLength(4);
    fourth.release();
    await expect(page.locator("[data-comparison-card]")).toHaveCount(4);
    expect(research.requests.map((request) => (request.body as Record<string, unknown>).programId)).toEqual([
      comparisonBrowserTargets.mit.programId,
      comparisonBrowserTargets.stanford.programId,
      comparisonBrowserTargets.georgiaTech.programId,
      comparisonBrowserTargets.berkeley.programId,
    ]);
  });

  test("shows an explicit no-fit error when fewer than two usable dossiers remain", async ({ page, research }) => {
    research.enqueueJson(mitResponse!);
    research.enqueueAbort();
    research.enqueueAbort();
    await openCompare(page);
    await selectThreeComparisonTargets(page);
    await submitComparison(page);

    await expect(page.getByRole("heading", { name: "Comparison could not be calculated" })).toBeVisible();
    await expect(page.getByText("At least two usable researched targets are required before a comparison fit can be calculated.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toHaveCount(0);
    await expect(page.getByText(/Fit score/)).toHaveCount(0);
    expect(research.requests).toHaveLength(3);
  });

  test("treats a partial dossier as usable while exposing its incomplete category gap", async ({ page, research }) => {
    const partialMit = makeComparisonBrowserResponse({
      target: comparisonBrowserTargets.mit,
      tuition: 10_000,
      employment: 82,
      research: true,
      scholarship: true,
      states: { research: "incomplete" },
    });
    research.enqueueJson(partialMit);
    research.enqueueJson(stanfordResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    await expect(page.getByRole("heading", { level: 2, name: "Comparison results" })).toBeVisible();
    await expect(page.getByText(/Partial comparison:/)).toBeVisible();
    await expect(page.locator("[data-comparison-card='1']")).toContainText("Research: research incomplete.");
    await expect(page.locator("[data-comparison-card='1']")).toContainText("Research incomplete");
  });

  test("distinguishes supported source-gap evidence from zero-claim incomplete research", async ({ page, research }) => {
    const sourceGapMit = makeComparisonBrowserResponse({
      target: comparisonBrowserTargets.mit,
      tuition: 10_000,
      employment: 82,
      research: true,
      scholarship: true,
      sourceGaps: {
        research: {
          code: "provider-budget",
          message: "The bounded AI work budget was exhausted before this category completed.",
        },
      },
    });
    research.enqueueJson(sourceGapMit);
    research.enqueueJson(stanfordResponse!);
    await openCompare(page);
    await selectDefaultComparisonTargets(page);
    await submitComparison(page);

    const firstCard = page.locator("[data-comparison-card='1']");
    await expect(firstCard).toContainText("Research: partial evidence — unscored.");
    await expect(firstCard).toContainText("The bounded AI work budget was exhausted before this category completed.");
    await expect(firstCard).not.toContainText("Research: research incomplete.");
  });
});
