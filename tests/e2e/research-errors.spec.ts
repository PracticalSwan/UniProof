import type { PublicResearchTransportErrorCode } from "@/lib/research/mode/public-contracts";
import {
  canonicalTargetResponse,
  publicErrorStatuses,
  publicTransportErrors,
  rawInvalidBrokenSourceReference,
  rawInvalidContradictoryLifecycle,
  rawInvalidDuplicateClaimIds,
  rawInvalidDuplicateSource,
  rawInvalidEmptyBody,
  rawInvalidLifecycleTimestamps,
  rawInvalidMalformedJsonBody,
  rawInvalidNonJsonBody,
  rawInvalidUnknownDossierKey,
  rawInvalidUnknownTopLevelKey,
  rawInvalidUnusedSource,
  succeededAllReadyResponse,
  wrongCategorySetResponse,
  wrongProgramResponse,
  wrongUniversityResponse,
} from "@/tests/fixtures/research-dossiers";
import {
  expect,
  openResearch,
  selectFixtureProgram,
  submitResearch,
  test,
} from "./helpers/research-browser";

const safeMessages: Record<PublicResearchTransportErrorCode, string> = {
  "invalid-content-type": "The research request could not be accepted. Check the form and start a new request.",
  "request-too-large": "The research request is too large. Please shorten the public research context and try again.",
  "invalid-json": "The research request could not be accepted. Check the form and start a new request.",
  "invalid-request": "The research request is invalid. Correct the highlighted fields and start a new request.",
  "unsupported-target": "The selected university or program is no longer supported. Choose a supported target again.",
  "sensitive-input": "Research fields must contain public information only. Edit the populated free-text fields and start a new request.",
  "forbidden-origin": "The research request was blocked by browser origin controls.",
  "internal-error": "UniProof could not complete this research request.",
};

const publicCodes = Object.keys(publicErrorStatuses) as PublicResearchTransportErrorCode[];

test.describe("Research public transport errors", () => {
  for (const code of publicCodes) {
    test(`${code} renders only the stable client-safe message and preserves prior result`, async ({ page, research }) => {
      await openResearch(page);
      await selectFixtureProgram(page);
      await page.getByLabel("Focused question (optional)").fill("Preserved public request context");
      research.enqueueJson(canonicalTargetResponse);
      await submitResearch(page);
      await expect(page.getByRole("heading", { name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();

      research.enqueueJson(publicTransportErrors[code], publicErrorStatuses[code]);
      await submitResearch(page);

      const error = page.getByRole("region", { name: "Research request error" });
      await expect(error).toBeVisible();
      await expect(error).toContainText(safeMessages[code]);
      await expect(error).not.toContainText(`Sanitized fixture message for ${code}.`);
      await expect(error).not.toContainText(/stack|parser|gemini|groq|openrouter|tavily|brave|https?:\/\//i);
      await expect(page.getByLabel("Focused question (optional)")).toHaveValue("Preserved public request context");
      await expect(page.getByRole("heading", { name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();

      const retry = page.getByRole("button", { name: "Retry this research", exact: true });
      if (code === "internal-error") {
        await expect(retry).toHaveCount(1);
      } else {
        await expect(retry).toHaveCount(0);
      }

      if (code === "request-too-large") {
        await expect(error).toContainText("public research context");
        await expect(error).not.toContainText(/question alone/i);
      }
      if (code === "forbidden-origin") {
        await expect(error).not.toContainText(/disable|bypass|cors/i);
      }
      expect(research.requests).toHaveLength(2);
    });
  }
});

test.describe("Research malformed/untrusted response handling", () => {
  test("rejects malformed bodies, schema violations, target/category binding errors, status disagreement, and content-type errors without leaking raw data", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);
    await expect(page.getByText("Research completed")).toBeVisible();

    const cases: Array<{ name: string; queue: () => void }> = [
      { name: "empty body", queue: () => research.enqueueRaw(rawInvalidEmptyBody) },
      { name: "non-JSON text", queue: () => research.enqueueRaw(rawInvalidNonJsonBody) },
      { name: "malformed JSON", queue: () => research.enqueueRaw(rawInvalidMalformedJsonBody) },
      { name: "unknown top-level key", queue: () => research.enqueueUnvalidatedJson(rawInvalidUnknownTopLevelKey()) },
      { name: "unknown dossier key", queue: () => research.enqueueUnvalidatedJson(rawInvalidUnknownDossierKey()) },
      { name: "broken source reference", queue: () => research.enqueueUnvalidatedJson(rawInvalidBrokenSourceReference()) },
      { name: "unused source", queue: () => research.enqueueUnvalidatedJson(rawInvalidUnusedSource()) },
      { name: "duplicate source", queue: () => research.enqueueUnvalidatedJson(rawInvalidDuplicateSource()) },
      { name: "duplicate claim ids", queue: () => research.enqueueUnvalidatedJson(rawInvalidDuplicateClaimIds()) },
      { name: "bad lifecycle timestamps", queue: () => research.enqueueUnvalidatedJson(rawInvalidLifecycleTimestamps()) },
      { name: "contradictory lifecycle", queue: () => research.enqueueUnvalidatedJson(rawInvalidContradictoryLifecycle()) },
      { name: "wrong university", queue: () => research.enqueueJson(wrongUniversityResponse) },
      { name: "wrong program", queue: () => research.enqueueJson(wrongProgramResponse) },
      { name: "wrong category set", queue: () => research.enqueueJson(wrongCategorySetResponse) },
      { name: "2xx plus ok:false", queue: () => research.enqueueJson(publicTransportErrors["internal-error"], 200) },
      { name: "non-2xx plus ok:true", queue: () => research.enqueueJson(succeededAllReadyResponse, 500) },
      { name: "wrong JSON content type", queue: () => research.enqueueJson(succeededAllReadyResponse, 200, "text/plain") },
      { name: "missing JSON content type", queue: () => research.enqueueRaw(JSON.stringify(succeededAllReadyResponse), { contentType: null }) },
    ];

    for (const invalidCase of cases) {
      invalidCase.queue();
      await submitResearch(page);
      const error = page.getByRole("region", { name: "Research request error" });
      await expect(error, invalidCase.name).toContainText("The research response could not be safely validated for display.");
      await expect(error, invalidCase.name).not.toContainText(/not-json|unexpected|missing-source|stack|zod|parser|gemini|groq|https?:\/\//i);
      await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(1);
      await expect(page.getByText("Research completed")).toBeVisible();
    }

    expect(research.requests).toHaveLength(1 + cases.length);
  });

  test("rejects a program-bearing dossier for a university-only request", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    await page.getByRole("button", { name: "Research university only" }).click();
    research.enqueueJson(succeededAllReadyResponse);
    await submitResearch(page);

    await expect(page.getByRole("region", { name: "Research request error" })).toContainText(
      "The research response could not be safely validated for display.",
    );
    expect(research.requests[0]!.body).not.toHaveProperty("programId");
  });

  test("network abort is sanitized as network-error and is explicit-retry only", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueAbort("failed");
    await submitResearch(page);

    const error = page.getByRole("region", { name: "Research request error" });
    await expect(error).toContainText("The research request could not be sent. Check the connection and try again.");
    await expect(error).not.toContainText(/ERR_FAILED|net::|stack|https?:\/\//i);
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(1);
    expect(research.requests).toHaveLength(1);
  });

  test("redirect response is rejected instead of being followed", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueRedirect("http://127.0.0.1:3102/research");
    await submitResearch(page);

    const error = page.getByRole("region", { name: "Research request error" });
    await expect(error).toContainText(/could not be sent|could not be safely validated/);
    await expect(page).toHaveURL(/\/research$/);
    expect(research.requests).toHaveLength(1);
  });
});

test.describe("Research correction-required server errors", () => {
  test("unsupported-target clears both target ids, preserves editable context, requires explicit reselection, and leaves the prior canonical dossier intact", async ({ page, research }) => {
    await openResearch(page);
    await selectFixtureProgram(page);
    research.enqueueJson(canonicalTargetResponse);
    await submitResearch(page);
    await expect(page.getByRole("heading", { name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();

    await page.getByLabel("Search supported universities and programs").fill("Stanford");
    await page.getByLabel("Country").selectOption("US");
    await page.getByLabel("Degree level").selectOption("bachelor");
    await page.getByLabel("Subject").selectOption({ label: "Computer Science" });
    await page.getByRole("checkbox", { name: "Support" }).uncheck();
    await page.getByLabel("Focused question (optional)").fill("Preserve this public question");
    await page.getByLabel("Intake (optional)").fill("Autumn 2028");
    await page.getByLabel("Academic year (optional)").fill("2028-29");

    research.enqueueJson(publicTransportErrors["unsupported-target"], publicErrorStatuses["unsupported-target"]);
    await submitResearch(page);

    const search = page.getByLabel("Search supported universities and programs");
    await expect(search).toHaveValue("Stanford");
    await expect(search).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await search.getAttribute("aria-describedby")) ?? "";
    expect(describedBy).toContain("research-university-error");
    expect(describedBy).toContain("research-program-error");
    await expect(page.locator("#research-university-error")).toBeVisible();
    await expect(page.locator("#research-program-error")).toBeVisible();
    await expect(page.getByText(/previously selected target is no longer supported/i)).toBeVisible();
    await expect(page.getByText(/previously selected program is no longer supported/i)).toBeVisible();

    await expect(page.getByText(/University-level research/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Research university only" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear target" })).toHaveCount(0);
    await expect(page.getByLabel("Country")).toHaveValue("US");
    await expect(page.getByLabel("Degree level")).toHaveValue("bachelor");
    await expect(page.getByLabel("Subject")).toHaveValue("Computer Science");
    await expect(page.getByRole("checkbox", { name: "Support" })).not.toBeChecked();
    await expect(page.getByLabel("Focused question (optional)")).toHaveValue("Preserve this public question");
    await expect(page.getByLabel("Intake (optional)")).toHaveValue("Autumn 2028");
    await expect(page.getByLabel("Academic year (optional)")).toHaveValue("2028-29");
    await expect(page.getByRole("heading", { name: "Server Canonical MIT Name • Server Canonical AI Program Name" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(0);

    expect(research.requests).toHaveLength(2);
  });

  for (const field of ["question", "intake", "academicYear"] as const) {
    test(`sensitive-input marks only populated ${field} invalid and does not identify or echo the triggering field`, async ({ page, research }) => {
      await openResearch(page);
      await selectFixtureProgram(page);
      const labels = {
        question: "Focused question (optional)",
        intake: "Intake (optional)",
        academicYear: "Academic year (optional)",
      } as const;
      const fakeValue = `invented-sensitive-looking-${field}-000-12-3456`;
      await page.getByLabel(labels[field]).fill(fakeValue);
      research.enqueueJson(publicTransportErrors["sensitive-input"], publicErrorStatuses["sensitive-input"]);
      await submitResearch(page);

      const error = page.getByRole("region", { name: "Research request error" });
      await expect(error).toContainText("Research fields must contain public information only.");
      await expect(error).not.toContainText(fakeValue);
      await expect(error).not.toContainText(new RegExp(`the ${field} field`, "i"));
      await expect(page.locator("#research-free-text-help")).toContainText("Please edit the populated fields and remove sensitive information");

      for (const candidate of ["question", "intake", "academicYear"] as const) {
        const control = page.getByLabel(labels[candidate]);
        await expect(control).toHaveAttribute("aria-invalid", candidate === field ? "true" : "false");
      }
      await expect(page.getByRole("button", { name: "Retry this research", exact: true })).toHaveCount(0);
      expect(research.requests).toHaveLength(1);
    });
  }
});
