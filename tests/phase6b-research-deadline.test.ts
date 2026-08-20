import { describe, expect, it, vi } from "vitest";

import { searchBrave } from "@/lib/integrations/brave/search";
import { searchTavily } from "@/lib/integrations/tavily/search";
import { waitForRetryDelay } from "@/lib/integrations/abortable-delay";
import { researchCatalog } from "@/lib/research/catalog/data";
import { createCatalogTargetResolver } from "@/lib/research/catalog/resolver";
import {
  candidateSourceSchema,
  researchProviderAttemptSchema,
  type ResearchResult,
} from "@/lib/research/contracts";
import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import type { DiscoveryQuery } from "@/lib/research/discovery/types";
import type { ExtractionTask } from "@/lib/research/extraction/types";
import { createResearchPostHandler } from "@/lib/research/mode/handler";
import {
  runPhase2Research,
  type Phase2ResearchOptions,
} from "@/lib/research/orchestration";
import {
  createResearchExecutionBudget,
  RESEARCH_TOTAL_DEADLINE_MS,
  researchAbortFailureCode,
} from "@/lib/research/orchestration/execution-budget";

const timestamp = "2026-08-19T00:00:00.000Z";
const routeUrl = "http://localhost:3000/api/research";
type TestCategory = "admissions" | "tuition";

function candidate(targetUrl: string, category: TestCategory) {
  const normalized = normalizeCandidateSource(
    {
      url: targetUrl,
      title: "Evidence",
      publisher: "Example University",
      sourceType: "university",
    },
    {
      discoveryProvider: "tavily",
      requestedCategory: category,
      discoveryQueryId: `category-${category}`,
    },
  );
  if (normalized === null) throw new Error("test candidate was invalid");
  return candidateSourceSchema.parse(normalized);
}

function retrieval(targetUrl: string, text = "The application deadline is 2027-01-01.") {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true as const,
    originalUrl: targetUrl,
    finalUrl: targetUrl,
    canonicalUrl: targetUrl,
    redirectChain: [],
    headers: { "content-type": "text/plain; charset=utf-8" },
    contentType: "text/plain" as const,
    bytes,
    retrievedBytes: bytes.byteLength,
    retrievedAt: timestamp,
    pinnedAddresses: [{ address: "93.184.216.34", family: 4 as const }],
  };
}

async function successfulExtractionRunTask(task: ExtractionTask) {
  return {
    payload: {
      claims: task.categories.map((category) => ({
        category,
        property: "application deadline",
        value: "2027-01-01",
        unit: null,
        currency: null,
        academicYear: "2027",
        effectiveDate: null,
        intake: null,
        segmentId: task.segment.id,
        supportingText: "The application deadline is 2027-01-01.",
      })),
    },
    provider: "gemini" as const,
    model: "injected-model",
    attempts: [researchProviderAttemptSchema.parse({
      stage: "extraction",
      provider: "gemini",
      model: "injected-model",
      outcome: "success",
      retryCount: 0,
      durationMs: 1,
    })],
  };
}

function baseOptions(overrides: Partial<Phase2ResearchOptions> = {}): Phase2ResearchOptions {
  const defaults = {
    createRunId: () => "run-phase6b",
    now: () => timestamp,
    discovery: {
      enableRor: false,
      tavilySearch: async (query: DiscoveryQuery) => ({
        outcome: "success" as const,
        candidates: query.category === "admissions" || query.category === "tuition"
          ? [candidate(`https://example.edu/${query.category}`, query.category)]
          : [],
        retryCount: 0,
      }),
      braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
    },
    retrieve: async (targetUrl: string) => retrieval(targetUrl),
    extraction: { runTask: successfulExtractionRunTask },
    reconciliation: {
      runTask: async (task: { questions: readonly { questionId: string; leftCandidateId: string; rightCandidateId: string }[] }) => ({
        payload: {
          relationships: task.questions.map((question) => ({
            questionId: question.questionId,
            leftCandidateId: question.leftCandidateId,
            rightCandidateId: question.rightCandidateId,
            relationship: "insufficient-evidence" as const,
          })),
        },
        provider: "gemini" as const,
        model: "injected-reconciliation",
        attempts: [],
      }),
      explanationRunTask: async () => ({ attempts: [] }),
    },
  } satisfies Phase2ResearchOptions;

  return {
    ...defaults,
    ...overrides,
    discovery: { ...defaults.discovery, ...overrides.discovery },
    extraction: { ...defaults.extraction, ...overrides.extraction },
    reconciliation: { ...defaults.reconciliation, ...overrides.reconciliation },
  };
}

async function makeHandlerResult(): Promise<ResearchResult> {
  return runPhase2Research({
    target: { university: { id: "university-mit" } },
    categories: ["admissions"],
  }, baseOptions({
    discovery: {
      enableRor: false,
      tavilySearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
      braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
    },
  }));
}

function jsonRequest(value: unknown, headers: Record<string, string> = {}): Request {
  return new Request(routeUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(value),
  });
}

const validBody = { universityId: "university-mit", categories: ["admissions"] };

describe("research execution budget", () => {
  it("uses the reviewed 240-second application deadline", () => {
    expect(RESEARCH_TOTAL_DEADLINE_MS).toBe(240_000);
  });

  it("classifies caller pre-abort as cancelled without starting work", async () => {
    const caller = new AbortController();
    caller.abort();
    const budget = createResearchExecutionBudget(caller.signal, 20);
    try {
      expect(budget.signal.aborted).toBe(true);
      expect(budget.callerCancelled()).toBe(true);
      expect(budget.deadlineReached()).toBe(false);
      expect(researchAbortFailureCode(budget.signal)).toBe("cancelled");
      const result = await runPhase2Research({
        target: { university: { name: "Example University" } },
        categories: ["admissions", "tuition"],
      }, baseOptions({ signal: budget.signal }));
      expect(result.run.failureCode).toBe("cancelled");
      expect(result.failures.map((failure) => failure.code)).toEqual(["cancelled", "cancelled"]);
    } finally {
      budget.dispose();
    }
  });

  it("preserves first terminal owner in caller/deadline races", () => {
    vi.useFakeTimers();
    try {
      const deadlineCaller = new AbortController();
      const deadlineFirst = createResearchExecutionBudget(deadlineCaller.signal, 20);
      vi.advanceTimersByTime(20);
      deadlineCaller.abort();
      expect(researchAbortFailureCode(deadlineFirst.signal)).toBe("timeout");
      deadlineFirst.dispose();

      const caller = new AbortController();
      const callerFirst = createResearchExecutionBudget(caller.signal, 20);
      caller.abort();
      vi.advanceTimersByTime(20);
      expect(researchAbortFailureCode(callerFirst.signal)).toBe("cancelled");
      callerFirst.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("disposes timer and caller listener idempotently", () => {
    vi.useFakeTimers();
    try {
      const caller = new AbortController();
      const budget = createResearchExecutionBudget(caller.signal, 20);
      budget.dispose();
      budget.dispose();
      vi.advanceTimersByTime(20);
      caller.abort();
      expect(budget.signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Research route ownership", () => {
  it("reuses the shared Fetch-Metadata-first same-origin policy", async () => {
    const targetResolver = createCatalogTargetResolver(researchCatalog);
    const result = await makeHandlerResult();
    const calls: Array<AbortSignal | undefined> = [];
    const post = createResearchPostHandler({
      catalog: researchCatalog,
      targetResolver,
      runResearch: async (_input, options) => {
        calls.push(options.signal);
        return result;
      },
    });

    expect((await post(jsonRequest(validBody, {
      origin: "http://127.0.0.1:3000",
      "sec-fetch-site": "same-origin",
    }))).status).toBe(200);
    expect(calls).toHaveLength(1);
    expect((await post(jsonRequest(validBody, { "sec-fetch-site": "same-site" }))).status).toBe(403);
    expect((await post(jsonRequest(validBody, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(calls).toHaveLength(1);
  });

  it("starts the whole-run timer only at accepted dispatch", async () => {
    vi.useFakeTimers();
    const targetResolver = createCatalogTargetResolver(researchCatalog);
    const result = await makeHandlerResult();
    let dispatchSignal: AbortSignal | undefined;
    const post = createResearchPostHandler({
      catalog: researchCatalog,
      targetResolver,
      runResearch: async (_input, options) => {
        const signal = options.signal;
        if (signal === undefined) throw new Error("Research dispatch did not receive the execution signal.");
        dispatchSignal = signal;
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        return result;
      },
    });

    try {
      const pending = post(jsonRequest(validBody, { "sec-fetch-site": "same-origin" }));
      await vi.advanceTimersByTimeAsync(RESEARCH_TOTAL_DEADLINE_MS - 1);
      expect(dispatchSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(dispatchSignal?.aborted).toBe(true);
      expect(researchAbortFailureCode(dispatchSignal!)).toBe("timeout");
      expect((await pending).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("terminal deadline evidence and dispatch ownership", () => {
  it("preserves a validated category and labels only unresolved work timeout", async () => {
    const budget = createResearchExecutionBudget(new AbortController().signal, 20);
    try {
      const result = await runPhase2Research({
        target: { university: { name: "Example University" } },
        categories: ["admissions", "tuition"],
      }, baseOptions({
        signal: budget.signal,
        discovery: {
          enableRor: false,
          tavilySearch: async (query: DiscoveryQuery) => {
            if (query.category === "admissions") {
              return { outcome: "success" as const, candidates: [candidate("https://example.edu/admissions", "admissions")], retryCount: 0 };
            }
            if (query.category === "tuition") {
              return {
                outcome: "success" as const,
                candidates: [
                  candidate("https://example.edu/tuition-a", "tuition"),
                  candidate("https://example.edu/tuition-b", "tuition"),
                ],
                retryCount: 0,
              };
            }
            return { outcome: "empty" as const, candidates: [], retryCount: 0 };
          },
        },
        retrieve: async (targetUrl: string) => targetUrl.endsWith("tuition-b")
          ? retrieval(targetUrl, "Annual tuition costs USD ten thousand.")
          : targetUrl.endsWith("tuition-a")
            ? retrieval(targetUrl, "Tuition fee is USD ten thousand.")
            : retrieval(targetUrl),
        extraction: {
          runTask: async (task) => {
            if (task.categories.includes("admissions")) return successfulExtractionRunTask(task);
            const supportingText = task.segment.text.includes("Annual tuition")
              ? "Annual tuition costs USD ten thousand."
              : "Tuition fee is USD ten thousand.";
            return {
              payload: { claims: [{
                category: "tuition" as const,
                property: "tuition fee",
                value: "USD ten thousand",
                unit: null,
                currency: "USD",
                academicYear: null,
                effectiveDate: null,
                intake: null,
                segmentId: task.segment.id,
                supportingText,
              }] },
              provider: "gemini" as const,
              model: "injected-model",
              attempts: [],
            };
          },
        },
        reconciliation: {
          runTask: async () => new Promise<{ aborted: true; attempts: never[] }>((resolve) => {
            if (budget.signal.aborted) return resolve({ aborted: true, attempts: [] });
            budget.signal.addEventListener("abort", () => resolve({ aborted: true, attempts: [] }), { once: true });
          }),
          explanationRunTask: async () => ({ attempts: [] }),
        },
      }));

      expect(result.run.status).toBe("partial");
      expect(result.run.processedCategories).toEqual(["admissions"]);
      expect(result.run.unprocessedCategories).toEqual(["tuition"]);
      expect(result.claims.map((claim) => claim.category)).toEqual(["admissions"]);
      expect(result.failures).toEqual([expect.objectContaining({ category: "tuition", code: "timeout" })]);
      expect(result.explanations.some((explanation) => explanation.category === "admissions")).toBe(true);
    } finally {
      budget.dispose();
    }
  });

  it("keeps caller abort cancelled even when retrieval labels it cancelled", async () => {
    const caller = new AbortController();
    const budget = createResearchExecutionBudget(caller.signal, 50);
    try {
      const pending = runPhase2Research({
        target: { university: { name: "Example University" } },
        categories: ["admissions", "tuition"],
      }, baseOptions({
        signal: budget.signal,
        retrieve: async (targetUrl: string, options) => {
          if (targetUrl.endsWith("tuition")) {
            await new Promise<void>((resolve) => options?.signal?.addEventListener("abort", () => resolve(), { once: true }));
            return { ok: false as const, code: "cancelled", message: "cancelled", safeUrl: targetUrl };
          }
          return retrieval(targetUrl);
        },
      }));
      caller.abort();
      const result = await pending;
      expect(result.run.failureCode).toBe("cancelled");
      expect(result.failures.every((failure) => failure.code === "cancelled")).toBe(true);
    } finally {
      budget.dispose();
    }
  });
});

describe("abortable provider retry waits", () => {
  it("stops a pending wait without resolving injected sleep", async () => {
    const caller = new AbortController();
    let sleepResolved = false;
    const pending = waitForRetryDelay(1_000, caller.signal, () => new Promise<void>((resolve) => {
      setTimeout(resolve, 60_000);
    }).then(() => { sleepResolved = true; }));
    caller.abort();
    expect(await pending).toBe(false);
    expect(sleepResolved).toBe(false);
  });

  it.each([
    ["Tavily", searchTavily],
    ["Brave", searchBrave],
  ] as const)("does not dispatch a %s retry after abort during Retry-After", async (_name, search) => {
    const caller = new AbortController();
    let calls = 0;
    const pending = search(
      {
        id: "query",
        kind: "category",
        text: "Example University admissions",
        category: "admissions",
        maxResults: 1,
        target: { universityName: "Example University" },
      },
      {
        apiKey: "test",
        signal: caller.signal,
        fetchImpl: async () => {
          calls += 1;
          return new Response("blocked", {
            status: 429,
            headers: { "retry-after": "1", "content-type": "text/plain" },
          });
        },
        sleep: () => new Promise<void>(() => undefined),
      },
    );
    await Promise.resolve();
    caller.abort();
    const outcome = await pending;
    expect(outcome).toEqual(expect.objectContaining({ outcome: "skipped", failureKind: "budget" }));
    expect(calls).toBe(1);
  });
});
