import { describe, expect, it, vi } from "vitest";

import {
  candidateSourceSchema,
  researchProviderAttemptSchema,
  researchResultSchema,
  researchRunSchema,
} from "@/lib/research/contracts";
import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { runPhase2Research, type Phase2ResearchOptions } from "@/lib/research/orchestration";
import { fetchPublicUrl } from "@/lib/research/retrieval/fetch-public";
import type { ExtractionTask } from "@/lib/research/extraction/types";
import { accountInjectedStructuredAttempts, createExplanationBudget } from "@/lib/research/ai/types";
import {
  RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS,
  RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN,
} from "@/lib/security/research-limits";

const timestamp = "2026-08-17T00:00:00.000Z";

type TestCategory =
  | "admissions"
  | "tuition"
  | "scholarships"
  | "program-structure"
  | "research"
  | "outcomes"
  | "support";

function candidate(url: string, category?: TestCategory, overrides: Record<string, unknown> = {}) {
  const normalized = normalizeCandidateSource(
    {
      url,
      title: "Evidence",
      publisher: "Example University",
      sourceType: "university",
      ...overrides,
    },
    {
      discoveryProvider: typeof overrides.discoveryProvider === "string" ? overrides.discoveryProvider as never : "tavily",
      requestedCategory: category,
      discoveryQueryId: category === undefined ? "identity-university" : `category-${category}`,
    },
  );
  if (normalized === null) throw new Error("test candidate was invalid");
  return candidateSourceSchema.parse(normalized);
}

function retrieval(url: string, text = "The application deadline is 2027-01-01.") {
  return {
    ok: true as const,
    originalUrl: url,
    finalUrl: url,
    canonicalUrl: url,
    redirectChain: [],
    headers: { "content-type": "text/plain; charset=utf-8" },
    contentType: "text/plain" as const,
    bytes: new TextEncoder().encode(text),
    retrievedBytes: new TextEncoder().encode(text).byteLength,
    retrievedAt: timestamp,
    pinnedAddresses: [{ address: "93.184.216.34", family: 4 as const }],
  };
}

async function successfulExtractionRunTask(task: {
  segment: { id: string; text: string };
  categories: readonly TestCategory[];
}) {
  const claims = task.categories.map((category) => ({
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
  }));
  return {
    payload: { claims },
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
    createRunId: () => "run-fixed",
    now: () => timestamp,
    discovery: {
      enableRor: false,
      tavilySearch: async (query: { category?: TestCategory }) => ({
        outcome: "success" as const,
        candidates: query.category === undefined
          ? []
          : [candidate(`https://example.edu/${query.category}`, query.category)],
        retryCount: 0,
      }),
      braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
    },
    retrieve: async (url: string) => retrieval(url),
    extraction: {
      runTask: successfulExtractionRunTask,
    },
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

describe("Phase 2F contracts and attempt ceilings", () => {
  it("derives the integrated provider-history ceiling from real stage bounds", () => {
    expect(RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN).toBe(32);
    expect(RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS).toBe(60_000);
    expect(RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN).toBe(24);
    expect(RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN).toBe(12);
    expect(RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN).toBe(6);
    expect(RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN).toBe(32 + 28 + 16 + 10);
    expect(RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN).toBe(86);
  });

  it("accepts a legal maximum-history terminal result without truncation", () => {
    const distribution = [
      ["discovery", RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN],
      ["extraction", RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN + 4],
      ["reconciliation", RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN + 4],
      ["explanation", RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN + 4],
    ] as const;
    const providerAttempts = distribution.flatMap(([stage, count]) =>
      Array.from({ length: count }, (_, index) => researchProviderAttemptSchema.parse({
        stage,
        provider: stage === "discovery" ? "tavily" : "gemini",
        outcome: index === count - 1 && stage !== "discovery" ? "skipped" : "success",
        retryCount: 0,
        durationMs: 1,
        failureKind: index === count - 1 && stage !== "discovery" ? "budget" : undefined,
      })),
    );
    const result = researchResultSchema.parse({
      run: researchRunSchema.parse({
        id: "run-max",
        status: "failed",
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        providerAttempts,
        processedCategories: [],
        unprocessedCategories: ["admissions"],
        failureCode: "provider-error",
        failureReason: "bounded provider chain did not complete",
      }),
      evidenceSummary: {
        statusCounts: {
          verified: 0, corroborated: 0, "university-reported": 0, conflicting: 0,
          anecdotal: 0, inferred: 0, unknown: 0, outdated: 0,
        },
        totalClaims: 0,
        categoryCoverage: [],
        categoriesProcessed: [],
        categoriesUnknown: [],
        categoriesOutdated: [],
        categoriesUnprocessed: ["admissions"],
        categoriesFailed: ["admissions"],
      },
      failures: [{
        category: "admissions",
        code: "provider-error",
        message: "bounded provider chain did not complete",
      }],
    });
    expect(result.run.providerAttempts).toHaveLength(86);
  });
});

describe("Phase 2F orchestration", () => {
  it("returns a sanitized failed result for an invalid request without provider work", async () => {
    const result = await runPhase2Research({ categories: ["not-a-category"] }, baseOptions());
    expect(result).toMatchObject({
      run: {
        status: "failed",
        failureCode: "validation",
        providerAttempts: [],
        processedCategories: [],
        unprocessedCategories: [],
      },
      candidateSources: [],
      sources: [],
      documents: [],
      candidates: [],
      claims: [],
      explanations: [],
    });
    expect(result.run.failureReason).not.toContain("not-a-category");
  });

  it("fails every requested category when target resolution fails and skips D/E", async () => {
    const extractionCalls: unknown[] = [];
    const options = baseOptions({
      discovery: {
        enableRor: false,
        targetResolver: {
          resolveUniversity: async () => undefined,
        },
        tavilySearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
        braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
      },
      extraction: {
        runTask: async (task: unknown) => {
          extractionCalls.push(task);
          return { payload: { claims: [] }, attempts: [] };
        },
      },
    });
    const result = await runPhase2Research({
      target: { university: { id: "missing" } },
      categories: ["admissions", "tuition"],
    }, options);
    expect(result.run.status).toBe("failed");
    expect(result.run.failureCode).toBe("source-discovery");
    expect(result.run.processedCategories).toEqual([]);
    expect(result.run.unprocessedCategories).toEqual(["admissions", "tuition"]);
    expect(result.evidenceSummary.categoriesFailed).toEqual(["admissions", "tuition"]);
    expect(extractionCalls).toHaveLength(0);
  });

  it("runs a deterministic authoritative category end to end", async () => {
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions(),
    );
    expect(result.run.status).toBe("succeeded");
    expect(result.run.id).toBe("run-fixed");
    expect(result.run.processedCategories).toEqual(["admissions"]);
    expect(result.sources).toHaveLength(1);
    expect(result.documents).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]?.verificationStatus).toBe("verified");
    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0]?.referencedClaimIds).toEqual([result.claims[0]?.id]);
    expect(result.evidenceSummary.totalClaims).toBe(1);
  });

  it("uses bounded UUID run IDs and clamps a backward clock", async () => {
    const forward = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions({ createRunId: undefined }),
    );
    expect(forward.run.id).toMatch(/^run-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const times = [
      "2026-08-17T00:00:01.000Z",
      "2026-08-17T00:00:02.000Z",
      "2026-08-17T00:00:01.500Z",
      "2026-08-17T00:00:02.000Z",
    ];
    let index = 0;
    const backward = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions({ now: () => times[index++ % times.length] }),
    );
    expect(backward.run.createdAt).toBe(times[0]);
    expect(backward.run.startedAt).toBe(times[1]);
    expect(backward.run.updatedAt).toBe(times[1]);
    expect(backward.run.completedAt).toBe(times[1]);
  });

  it("rejects an invalid injected clock as an internal seam error", async () => {
    await expect(runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions({ now: () => "not-a-time" }),
    )).rejects.toThrow(/research orchestration clock/i);
  });

  it("canonicalizes shuffled requested categories for semantics and dispatch", async () => {
    const dispatch: (string | undefined)[] = [];
    const options = baseOptions({
      discovery: {
        enableRor: false,
        tavilySearch: async (query: { category?: TestCategory }) => {
          dispatch.push(query.category);
          return {
            outcome: "success" as const,
            candidates: query.category === undefined
              ? []
              : [candidate(`https://example.edu/${query.category}`, query.category)],
            retryCount: 0,
          };
        },
      },
    });
    const first = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["tuition", "admissions", "support"] },
      options,
    );
    const second = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["support", "admissions", "tuition"] },
      options,
    );
    expect(dispatch).toEqual([
      "admissions", "tuition", "support", undefined,
      "admissions", "tuition", "support", undefined,
    ]);
    expect(first.run.processedCategories).toEqual(["admissions", "tuition", "support"]);
    expect(second.run.processedCategories).toEqual(["admissions", "tuition", "support"]);
    expect(first.explanations.map((item) => item.category)).toEqual(["admissions", "tuition", "support"]);
    expect(second.explanations.map((item) => item.category)).toEqual(["admissions", "tuition", "support"]);
    expect(second.run.providerAttempts.map((attempt) => attempt.queryId)).toEqual(
      first.run.providerAttempts.map((attempt) => attempt.queryId),
    );
  });

  it("preserves multi-category associations through canonical dedupe", async () => {
    const options = baseOptions({
      discovery: {
        enableRor: false,
        tavilySearch: async (query: { category?: TestCategory; id: string }) => ({
          outcome: "success" as const,
          candidates: query.category === undefined
            ? []
            : [candidate("https://example.edu/shared", query.category, { discoveryQueryId: query.id })],
          retryCount: 0,
        }),
      },
    });
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions", "tuition"] },
      options,
    );
    expect(result.candidateSources).toHaveLength(1);
    expect(result.candidateSources[0]?.requestedCategory).toBe("admissions");
    expect(result.documents).toHaveLength(1);
    expect(result.candidates.map((item) => item.category).sort()).toEqual(["admissions", "tuition"]);
    expect(result.evidenceSummary.categoryCoverage.map((row) => row.category)).toEqual(["admissions", "tuition"]);
  });

  it("treats clean discovery emptiness as completed unknown without AI", async () => {
    const retrievals: string[] = [];
    const extractionCalls: unknown[] = [];
    const options = baseOptions({
      discovery: {
        enableRor: false,
        tavilySearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
        braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
      },
      retrieve: async (url: string) => {
        retrievals.push(url);
        return retrieval(url);
      },
      extraction: {
        runTask: async (task: unknown) => {
          extractionCalls.push(task);
          return { payload: { claims: [] }, attempts: [] };
        },
      },
    });
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      options,
    );
    expect(result.run.status).toBe("succeeded");
    expect(result.evidenceSummary.categoriesUnknown).toEqual(["admissions"]);
    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0]).toMatchObject({
      category: "admissions",
      referencedClaimIds: [],
      fallback: true,
    });
    expect(retrievals).toHaveLength(0);
    expect(extractionCalls).toHaveLength(0);
  });

  it("keeps degraded direct salvage operational and out of Phase 2E", async () => {
    const result = await runPhase2Research(
      { target: { university: { id: "uni-1" } }, categories: ["admissions"] },
      baseOptions({
        discovery: {
          enableRor: false,
          targetResolver: {
            resolveUniversity: async (id: string) => ({
              id,
              name: "Example University",
              websiteUrl: "https://example.edu",
            }),
          },
          tavilySearch: async () => ({
            outcome: "failed" as const,
            candidates: [],
            retryCount: 0,
            failureKind: "upstream" as const,
          }),
          braveSearch: async () => ({
            outcome: "failed" as const,
            candidates: [],
            retryCount: 0,
            failureKind: "upstream" as const,
          }),
        },
      }),
    );
    expect(result.run.status).toBe("failed");
    expect(result.run.unprocessedCategories).toEqual(["admissions"]);
    expect(result.evidenceSummary.categoriesUnknown).toEqual([]);
    expect(result.sources).toHaveLength(1);
    expect(result.documents).toHaveLength(1);
    expect(result.claims).toHaveLength(0);
  });

  it("keeps a selected relevant retrieval failure category-incomplete", async () => {
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions({
        retrieve: async () => ({
          ok: false as const,
          code: "http-status" as const,
          message: "source returned an unsupported HTTP status",
          safeUrl: "https://example.edu/",
        }),
      }),
    );
    expect(result.run.status).toBe("failed");
    expect(result.run.unprocessedCategories).toEqual(["admissions"]);
    expect(result.evidenceSummary.categoriesFailed).toEqual(["admissions"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ category: "admissions", code: "retrieval" });
    expect(result.failures[0]?.message).not.toContain("unsupported HTTP status");
    expect(result.run.providerAttempts.some((attempt) => attempt.stage === "retrieval")).toBe(false);
  });

  it("cancels before discovery without provider or network work", async () => {
    const controller = new AbortController();
    controller.abort();
    const providerCalls: unknown[] = [];
    const options = baseOptions({
      signal: controller.signal,
      discovery: {
        enableRor: false,
        tavilySearch: async (query: unknown) => {
          providerCalls.push(query);
          return { outcome: "empty" as const, candidates: [], retryCount: 0 };
        },
        braveSearch: async (query: unknown) => {
          providerCalls.push(query);
          return { outcome: "empty" as const, candidates: [], retryCount: 0 };
        },
      },
      retrieve: async (url: unknown) => {
        providerCalls.push(url);
        return retrieval("https://example.edu/admissions");
      },
    });
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      options,
    );
    expect(result.run.status).toBe("failed");
    expect(result.run.failureCode).toBe("cancelled");
    expect(result.run.providerAttempts).toHaveLength(0);
    expect(result.evidenceSummary.categoriesFailed).toEqual(["admissions"]);
    expect(providerCalls).toHaveLength(0);
  });

  it("gives the extraction seam only public task data and enforces the shared budget", async () => {
    const observed: unknown[] = [];
    let calls = 0;
    const text = "x".repeat(200_000);
    const options = baseOptions({
      retrieve: async (url: string) => retrieval(url, text),
      extraction: {
        runTask: async (task: unknown) => {
          observed.push(task);
          calls += 1;
          return {
            payload: { claims: [] },
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
        },
      },
    });
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      options,
    );
    expect(calls).toBe(RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN);
    for (const task of observed) {
      expect(Object.keys(task as object).sort()).toEqual(["categories", "document", "segment", "target"]);
    }
    expect(result.candidates).toHaveLength(0);
    expect(result.run.unprocessedCategories).toEqual(["admissions"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ category: "admissions", code: "provider-error" });
  });

  it("fails closed before DNS when pinned retrieval is pre-aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let dnsCalls = 0;
    const result = await fetchPublicUrl("https://public.example/research", {
      signal: controller.signal,
      dnsResolver: async () => {
        dnsCalls += 1;
        return [{ address: "93.184.216.34", family: 4 as const }];
      },
    });
    expect(result).toMatchObject({ ok: false, code: "cancelled" });
    expect(dnsCalls).toBe(0);
  });

  it("keeps per-document extraction failures isolated and returns a true partial run", async () => {
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions", "tuition"] },
      baseOptions({
        retrieve: async (url: string) => url.includes("tuition")
          ? retrieval(url, "Tuition information for this program.")
          : retrieval(url),
        extraction: {
          runTask: async (task: ExtractionTask) => {
            if (task.categories.includes("tuition")) {
              return {
                attempts: [researchProviderAttemptSchema.parse({
                  stage: "extraction",
                  provider: "gemini",
                  model: "injected-model",
                  outcome: "failed",
                  retryCount: 0,
                  durationMs: 1,
                  failureKind: "upstream",
                })],
                provider: "gemini" as const,
                failureKind: "upstream" as const,
              };
            }
            return successfulExtractionRunTask(task);
          },
        },
      }),
    );
    expect(result.run.status).toBe("partial");
    expect(result.run.partial).toBe(true);
    expect(result.run.processedCategories).toEqual(["admissions"]);
    expect(result.run.unprocessedCategories).toEqual(["tuition"]);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]?.category).toBe("admissions");
    expect(result.sources).toHaveLength(2);
    expect(result.documents).toHaveLength(2);
    expect(result.evidenceSummary.categoriesFailed).toEqual(["tuition"]);
    expect(result.failures[0]).toMatchObject({ category: "tuition", code: "provider-error" });
  });

  it("sends only claim-bearing categories to explanation AI and falls back locally for unknown", async () => {
    const explanationCategories: string[][] = [];
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions", "tuition"] },
      baseOptions({
        discovery: {
          tavilySearch: async (query: { category?: TestCategory }) => ({
            outcome: query.category === "admissions" ? "success" as const : "empty" as const,
            candidates: query.category === "admissions"
              ? [candidate("https://example.edu/admissions", "admissions")]
              : [],
            retryCount: 0,
          }),
          braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
          enableRor: false,
        },
        reconciliation: {
          explanationRunTask: async (task) => {
            explanationCategories.push([...task.categories]);
            return { attempts: [] };
          },
        },
      }),
    );
    expect(result.run.status).toBe("succeeded");
    expect(result.run.processedCategories).toEqual(["admissions", "tuition"]);
    expect(result.evidenceSummary.categoriesUnknown).toEqual(["tuition"]);
    expect(explanationCategories).toEqual([["admissions"]]);
    expect(result.explanations).toHaveLength(2);
    expect(result.explanations.find((item) => item.category === "tuition")).toMatchObject({
      referencedClaimIds: [],
      fallback: true,
    });
  });

  it("prunes provisional claims from a semantically incomplete category while retaining provenance", async () => {
    let semanticQuestions = 0;
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions", "tuition"] },
      baseOptions({
        discovery: {
          enableRor: false,
          tavilySearch: async (query: { category?: TestCategory }) => {
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
        retrieve: async (url: string) => {
          if (url.endsWith("tuition-a")) return retrieval(url, "Tuition fee is USD 10000.");
          if (url.endsWith("tuition-b")) return retrieval(url, "Annual tuition costs USD 10000.");
          return retrieval(url);
        },
        extraction: {
          runTask: async (task: ExtractionTask) => {
            if (task.categories.includes("admissions")) return successfulExtractionRunTask(task);
            const supportingText = task.segment.text.includes("Annual tuition")
              ? "Annual tuition costs USD 10000."
              : "Tuition fee is USD 10000.";
            return {
              payload: { claims: [{
                category: "tuition" as const,
                property: "tuition fee",
                value: 10000,
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
              attempts: [researchProviderAttemptSchema.parse({
                stage: "extraction", provider: "gemini", model: "injected-model",
                outcome: "success", retryCount: 0, durationMs: 1,
              })],
            };
          },
        },
        reconciliation: {
          runTask: async (task) => {
            semanticQuestions += task.questions.length;
            return {
              provider: "gemini" as const,
              attempts: [researchProviderAttemptSchema.parse({
                stage: "reconciliation", provider: "gemini", model: "injected-reconciliation",
                outcome: "failed", retryCount: 0, durationMs: 1, failureKind: "upstream",
              })],
              failureKind: "upstream" as const,
            };
          },
        },
      }),
    );
    expect(semanticQuestions).toBeGreaterThan(0);
    expect(result.run.status).toBe("partial");
    expect(result.run.processedCategories).toEqual(["admissions"]);
    expect(result.run.unprocessedCategories).toEqual(["tuition"]);
    expect(result.candidates.filter((item) => item.category === "tuition")).toHaveLength(2);
    expect(result.claims.every((claim) => claim.category === "admissions")).toBe(true);
    expect(result.explanations.every((explanation) => explanation.category === "admissions")).toBe(true);
  });

  it("deduplicates repeated non-dispatched extraction telemetry without truncating work", async () => {
    const text = "x".repeat(20_000);
    const result = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions({
        retrieve: async (url: string) => retrieval(url, text),
        extraction: {
          runTask: async () => ({
            payload: { claims: [] },
            provider: "gemini" as const,
            model: "injected-model",
            attempts: [researchProviderAttemptSchema.parse({
              stage: "extraction", provider: "gemini", model: "injected-model",
              outcome: "skipped", retryCount: 0, durationMs: 0, failureKind: "configuration",
            })],
          }),
        },
      }),
    );
    const extractionSkips = result.run.providerAttempts.filter((attempt) =>
      attempt.stage === "extraction" && attempt.outcome === "skipped" && attempt.failureKind === "configuration",
    );
    expect(extractionSkips).toHaveLength(1);
    expect(result.run.status).toBe("succeeded");
    expect(result.evidenceSummary.categoriesUnknown).toEqual(["admissions"]);
  });


  it("does not promote general-web emptiness to unknown when discovery times out before supplements finish", async () => {
    vi.useFakeTimers();
    try {
      const pending = runPhase2Research(
        { target: { university: { name: "Example University" } }, categories: ["admissions"] },
        baseOptions({
          discovery: {
            enableRor: true,
            tavilySearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
            braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
            rorSearch: async () => new Promise<never>(() => undefined),
          },
        }),
      );
      await vi.advanceTimersByTimeAsync(RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS);
      const result = await pending;
      expect(result.run.status).toBe("failed");
      expect(result.run.failureCode).toBe("timeout");
      expect(result.run.unprocessedCategories).toEqual(["admissions"]);
      expect(result.evidenceSummary.categoriesUnknown).toEqual([]);
      expect(result.evidenceSummary.categoriesFailed).toEqual(["admissions"]);
    } finally {
      vi.useRealTimers();
    }
  });


  it("rejects false final evidence-state summaries and non-fallback unknown explanations", async () => {
    const verified = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions(),
    );
    const falseConflict = structuredClone(verified);
    falseConflict.evidenceSummary.categoriesWithConflicts = ["admissions"];
    expect(researchResultSchema.safeParse(falseConflict).success).toBe(false);
    const falseOutdated = structuredClone(verified);
    falseOutdated.evidenceSummary.categoriesOutdated = ["admissions"];
    expect(researchResultSchema.safeParse(falseOutdated).success).toBe(false);

    const unknown = await runPhase2Research(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      baseOptions({
        discovery: {
          enableRor: false,
          tavilySearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
          braveSearch: async () => ({ outcome: "empty" as const, candidates: [], retryCount: 0 }),
        },
      }),
    );
    const falseUnknownExplanation = structuredClone(unknown);
    delete falseUnknownExplanation.explanations[0]!.fallback;
    expect(researchResultSchema.safeParse(falseUnknownExplanation).success).toBe(false);
  });


  it("rejects injected AI histories that exceed stage or provider budgets", () => {
    const budget = createExplanationBudget(2, { gemini: 1 });
    const successAttempt = researchProviderAttemptSchema.parse({
      stage: "explanation",
      provider: "gemini",
      model: "injected-model",
      outcome: "success",
      retryCount: 0,
      durationMs: 1,
    });
    accountInjectedStructuredAttempts({
      budget,
      attempts: [successAttempt],
      provider: "gemini",
      hasPayload: true,
      stage: "explanation",
    });
    expect(() => accountInjectedStructuredAttempts({
      budget,
      attempts: [successAttempt],
      provider: "gemini",
      hasPayload: true,
      stage: "explanation",
    })).toThrow("provider attempt budget");

    const totalBudget = createExplanationBudget(1);
    expect(() => accountInjectedStructuredAttempts({
      budget: totalBudget,
      attempts: [successAttempt, successAttempt],
      provider: "gemini",
      hasPayload: true,
      stage: "explanation",
    })).toThrow("shared attempt budget");
  });


  it("does not dispatch providers when the caller aborts during target resolution", async () => {
    const controller = new AbortController();
    let providerCalls = 0;
    const result = await runPhase2Research(
      { target: { university: { id: "uni-1" } }, categories: ["admissions"] },
      baseOptions({
        signal: controller.signal,
        discovery: {
          enableRor: false,
          targetResolver: {
            resolveUniversity: async (id: string) => {
              controller.abort();
              return id === "uni-1"
                ? { id: "uni-1", name: "Example University", officialUrl: "https://example.edu" }
                : undefined;
            },
          },
          tavilySearch: async () => {
            providerCalls += 1;
            return { outcome: "empty" as const, candidates: [], retryCount: 0 };
          },
          braveSearch: async () => {
            providerCalls += 1;
            return { outcome: "empty" as const, candidates: [], retryCount: 0 };
          },
        },
      }),
    );
    expect(providerCalls).toBe(0);
    expect(result.run.status).toBe("failed");
    expect(result.run.failureCode).toBe("cancelled");
    expect(result.run.providerAttempts).toEqual([]);
    expect(result.run.unprocessedCategories).toEqual(["admissions"]);
  });

});
