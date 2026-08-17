import {
  canonicalTargetResponse,
  partialResponse,
  publicTransportErrors,
  succeededAllReadyResponse,
} from "@/tests/fixtures/research-dossiers";
import {
  expect,
  openResearch,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

test.describe("Research cancellation and request ownership", () => {
  test("cancels one pending request exactly once without automatic retry and preserves editable input", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    await page.getByLabel("Focused question (optional)").fill("Public cancellation context");
    await page.getByLabel("Intake (optional)").fill("Fall 2027");

    const pending = research.enqueueDeferredJson(succeededAllReadyResponse);
    await submitResearch(page);
    await pending.entered;

    await page.getByRole("button", { name: "Cancel", exact: true }).evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
    });

    await expect(page.getByText("The research request was cancelled in this session.")).toBeVisible();
    await expect(page.getByLabel("Focused question (optional)")).toHaveValue("Public cancellation context");
    await expect(page.getByLabel("Intake (optional)")).toHaveValue("Fall 2027");
    await expect(page.getByLabel("Focused question (optional)")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(0);
    expect(research.requests).toHaveLength(1);

    pending.release();
    await expect(page.getByRole("region", { name: "Research dossier" })).toHaveCount(0);
    expect(research.requests).toHaveLength(1);
  });

  test("refresh keeps the prior canonical dossier and evidence usable, hides conflicting ownership controls, and cancellation restores it unchanged", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(canonicalTargetResponse);
    await submitResearch(page);
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();

    await page.getByLabel("Focused question (optional)").fill("Refresh context");
    const refresh = research.enqueueDeferredJson(succeededAllReadyResponse);
    await submitResearch(page);
    await refresh.entered;

    await expect(page.getByText(/Updating this dossier/)).toContainText("Server Canonical MIT Name");
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear result", exact: true })).toHaveCount(0);

    const evidenceTrigger = page.getByRole("button", { name: "View evidence for Published application code" });
    await expect(evidenceTrigger).toBeEnabled();
    await evidenceTrigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close evidence details" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("The research request was cancelled in this session.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    await expect(evidenceTrigger).toBeEnabled();
    expect(research.requests).toHaveLength(2);

    refresh.release();
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    expect(research.requests).toHaveLength(2);
  });

  test("a cancelled stale request cannot overwrite a later successful request when its route is released last", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);

    const stale = research.enqueueDeferredJson(succeededAllReadyResponse);
    research.enqueueJson(canonicalTargetResponse);
    await submitResearch(page);
    await stale.entered;
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("The research request was cancelled in this session.")).toBeVisible();

    await submitResearch(page);
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    expect(research.requests).toHaveLength(2);

    stale.release();
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    await expect(page.getByText("7 final claims", { exact: false })).toBeVisible();
    expect(research.requests).toHaveLength(2);
  });

  test("replacement closes evidence opened from the preserved dossier without detached-trigger focus failure", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();

    await page.getByLabel("Focused question (optional)").fill("Replacement context");
    const refresh = research.enqueueDeferredJson(canonicalTargetResponse);
    await submitResearch(page);
    await refresh.entered;

    await page.getByRole("button", { name: "View evidence for Published application code" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("The published application code is the exact string 007.");

    refresh.release();
    await expect(page.getByRole("heading", { level: 2, name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("The published application code is the exact string 007.")).toHaveCount(0);
  });

  test("unmount aborts a pending request; releasing it cannot update the unmounted page and returning to Research starts fresh", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    const pending = research.enqueueDeferredJson(succeededAllReadyResponse);
    await submitResearch(page);
    await pending.entered;

    await page.getByRole("link", { name: "Compare", exact: true }).click();
    await expect(page).toHaveURL(/\/compare$/);
    pending.release();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Research", exact: true }).click();
    await expect(page).toHaveURL(/\/research$/);
    await expect(page.getByText("No target selected yet.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Research dossier" })).toHaveCount(0);
    await expect(page.getByText(/background/i)).toHaveCount(0);
    expect(research.requests).toHaveLength(1);
  });

  test("newer refresh error owns the only Retry; Retry resends its immutable body while Research uses the edited current form", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(partialResponse);
    await submitResearch(page);
    await expect(page.getByText("Some research is incomplete")).toBeVisible();

    const question = page.getByLabel("Focused question (optional)");
    await question.fill("failed immutable snapshot");
    research.enqueueJson(publicTransportErrors["internal-error"], 500);
    await submitResearch(page);
    await expect(page.getByRole("region", { name: "Research request error" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(1);
    await expect(page.getByText(/Retry repeats the exact failed request/)).toBeVisible();

    const failedBody = structuredClone(research.requests[1]!.body);
    await question.fill("edited current form");

    research.enqueueJson(succeededAllReadyResponse);
    await page.getByRole("button", { name: "Retry this research", exact: true }).click();
    await expect(page.getByText("Research completed")).toBeVisible();
    expect(research.requests[2]!.body).toEqual(failedBody);

    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();
    expect(research.requests[3]!.body).toMatchObject({ question: "edited current form" });
    expect(research.requests).toHaveLength(4);
  });

  test("Clear result after a refresh error clears both prior dossier and error while preserving current form values", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(partialResponse);
    await submitResearch(page);
    await expect(page.getByText("Some research is incomplete")).toBeVisible();

    const question = page.getByLabel("Focused question (optional)");
    const intake = page.getByLabel("Intake (optional)");
    await question.fill("failed request context");
    await intake.fill("Spring 2028");
    research.enqueueJson(publicTransportErrors["internal-error"], 500);
    await submitResearch(page);
    await expect(page.getByRole("region", { name: "Research request error" })).toBeVisible();
    await expect(page.getByText("Some research is incomplete")).toBeVisible();

    await question.fill("current form survives clear");
    await page.getByRole("button", { name: "Clear result", exact: true }).click();

    await expect(page.getByRole("region", { name: "Research request error" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Research dossier" })).toHaveCount(0);
    await expect(page.getByText("Some research is incomplete")).toHaveCount(0);
    await expect(question).toHaveValue("current form survives clear");
    await expect(intake).toHaveValue("Spring 2028");
    expect(research.requests).toHaveLength(2);
  });
});
