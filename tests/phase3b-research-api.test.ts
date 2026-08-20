import { afterEach, describe, expect, it, vi } from "vitest";

import { createCatalogTargetResolver } from "@/lib/research/catalog/resolver";
import { researchCatalog } from "@/lib/research/catalog/data";
import {
  evidenceStatusSchema,
  researchResultSchema,
  type ResearchCategory,
  type ResearchResult,
} from "@/lib/research/contracts";
import type { Phase2ResearchOptions } from "@/lib/research/orchestration";
import {
  createResearchPostHandler,
  RESEARCH_MODE_MAX_RESPONSE_BYTES,
} from "@/lib/research/mode/handler";
import {
  readBoundedJsonRequest,
  RESEARCH_MODE_MAX_REQUEST_BYTES,
} from "@/lib/research/mode/read-bounded-request";
import { researchModeResponseSchema } from "@/lib/research/mode/public-contracts";

const url = "https://uniproof.test/api/research";
const timestamp = "2026-08-17T00:00:00.000Z";
const university = researchCatalog.universities.find((item) => item.id === "university-mit")!;
const program = researchCatalog.programs.find(
  (item) => item.id === "program-mit-artificial-intelligence-decision-making-bs",
)!;
const supportingText = "The application deadline is 15 January 2027.";

function makeResult(options: {
  processedCategories?: readonly ResearchCategory[];
  unprocessedCategories?: readonly ResearchCategory[];
  failureCode?: "cancelled" | "provider-error" | "timeout" | "provider-rate-limit";
  includeClaim?: boolean;
} = {}): ResearchResult {
  const processedCategories = options.processedCategories ?? (options.includeClaim === false ? [] : ["admissions"]);
  const unprocessedCategories = options.unprocessedCategories ?? [];
  const includeClaim = options.includeClaim ?? processedCategories.includes("admissions");
  const claim = {
    id: "claim-1",
    universityId: university.id,
    programId: program.id,
    category: "admissions" as const,
    property: "Application deadline",
    value: "2027-01-15",
    effectiveDate: "2026-09-01",
    supportingText,
    verificationStatus: "verified" as const,
    sourceId: "source-1",
    sourceIds: ["source-1"],
    documentIds: ["document-1"],
    candidateIds: ["candidate-1"],
  };
  const claims = includeClaim ? [claim] : [];
  const failureCode = options.failureCode ??
    (unprocessedCategories.length > 0 ? "provider-error" : undefined);

  return researchResultSchema.parse({
    run: {
      id: "run-api",
      status: processedCategories.length === 0 ? "failed" : unprocessedCategories.length === 0 ? "succeeded" : "partial",
      partial: processedCategories.length > 0 && unprocessedCategories.length > 0,
      createdAt: timestamp,
      startedAt: "2026-08-17T00:00:01.000Z",
      updatedAt: "2026-08-17T00:00:02.000Z",
      completedAt: "2026-08-17T00:00:03.000Z",
      providerAttempts: [{
        stage: "extraction" as const,
        provider: "gemini" as const,
        model: "internal-model-do-not-expose",
        outcome: "success" as const,
        retryCount: 0,
        durationMs: 1,
      }],
      processedCategories,
      unprocessedCategories,
      failureCode,
      failureReason: "raw provider error https://source.example/private?token=secret",
    },
    candidateSources: [{
      url: "https://example.edu/source-1",
      title: "Candidate",
      publisher: "Example University",
      domain: "example.edu",
      sourceType: "university" as const,
      discoveryProvider: "tavily" as const,
      discoveryQueryId: "query-internal",
      discoveredAt: timestamp,
      relevanceScore: 1,
      rank: 1,
    }],
    sources: [{
      id: "source-1",
      url: "https://example.edu/source-1",
      title: "Official evidence",
      publisher: "Example University",
      sourceType: "university" as const,
      retrievedAt: timestamp,
      effectiveDate: "2026-09-01",
      discoveryProvider: "tavily" as const,
      discoveryQueryId: "query-internal",
    }],
    documents: [{
      id: "document-1",
      sourceId: "source-1",
      originalUrl: "https://example.edu/source-1",
      canonicalUrl: "https://example.edu/source-1",
      title: "Evidence document",
      publisher: "Example University",
      sourceType: "university" as const,
      retrievedAt: timestamp,
      contentType: "text/plain",
      normalizedText: supportingText,
      sections: [{ heading: "Evidence", text: supportingText }],
      contentHash: "a".repeat(64),
    }],
    candidates: [{
      id: "candidate-1",
      universityId: university.id,
      programId: program.id,
      category: "admissions",
      property: claim.property,
      value: claim.value,
      effectiveDate: claim.effectiveDate,
      sourceId: "source-1",
      supportingText,
      documentId: "document-1",
      extractionMethod: "model" as const,
      extractionProvider: "gemini" as const,
      extractionModel: "internal-model-do-not-expose",
    }],
    claims,
    explanations: processedCategories.map((category) => ({
      category,
      referencedClaimIds: category === "admissions" ? claims.map((item) => item.id) : [],
      summary: claims.length > 0 && category === "admissions"
        ? "The official passage supports the claim."
        : "Completed bounded research did not establish a supported factual claim.",
      fallback: !(claims.length > 0 && category === "admissions") || undefined,
    })),
    evidenceSummary: {
      statusCounts: Object.fromEntries(evidenceStatusSchema.options.map((status) => [
        status, claims.filter((item) => item.verificationStatus === status).length,
      ])),
      totalClaims: claims.length,
      categoryCoverage: processedCategories.map((category) => {
        const categoryClaims = claims.filter((item) => item.category === category);
        return {
          category,
          claimCount: categoryClaims.length,
          hasEvidence: categoryClaims.length > 0,
          statuses: evidenceStatusSchema.options.filter((status) =>
            categoryClaims.some((item) => item.verificationStatus === status)),
        };
      }),
      categoriesProcessed: processedCategories,
      categoriesWithConflicts: [],
      categoriesUnknown: processedCategories.filter((category) =>
        !claims.some((item) => item.category === category)),
      categoriesOutdated: [],
      categoriesUnprocessed: unprocessedCategories,
      categoriesFailed: unprocessedCategories,
    },
    failures: unprocessedCategories.map((category) => ({
      category,
      code: failureCode ?? "unknown",
      message: "raw provider error https://source.example/private?token=secret",
    })),
    warnings: ["raw warning query-internal"],
  });
}

function jsonRequest(value: unknown, headers: Record<string, string> = {}) {
  const requestHeaders: Record<string, string> = { ...headers };
  if (requestHeaders["content-type"] === undefined) {
    requestHeaders["content-type"] = "application/json";
  }
  return new Request(url, {
    method: "POST",
    headers: requestHeaders,
    body: typeof value === "string" ? value : JSON.stringify(value),
  });
}

function binaryRequest(
  chunks: readonly Uint8Array[],
  headers: Record<string, string> = {},
  close = true,
) {
  let cancelled = false;
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]!);
      } else if (close) {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    cancelled: () => cancelled,
    request: new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body,
      duplex: "half",
    } as RequestInit),
  };
}

const validBody = {
  universityId: university.id,
  programId: program.id,
  categories: ["admissions"],
  question: "What is the published AI degree requirement?",
};

function makeHandler(result: ResearchResult = makeResult()) {
  const runResearch = vi.fn(async (
    input: unknown,
    options: Phase2ResearchOptions,
  ) => {
    void input;
    void options;
    return result;
  });
  const targetResolver = createCatalogTargetResolver(researchCatalog);
  const handler = createResearchPostHandler({
    catalog: researchCatalog,
    targetResolver,
    runResearch,
  });
  return { handler, runResearch, targetResolver };
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(researchModeResponseSchema.parse(body)).toEqual({
    ok: false,
    error: expect.objectContaining({ code }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bounded JSON request parsing", () => {
  it("accepts exact JSON content types and bounded JSON bodies", async () => {
    for (const contentType of [
      "application/json",
      "application/json; charset=utf-8",
      "APPLICATION/JSON; CHARSET=UTF-8",
    ]) {
      const parsed = await readBoundedJsonRequest(jsonRequest(validBody, {
        "content-type": contentType,
      }));
      expect(parsed).toEqual({ ok: true, value: validBody });
    }
  });

  it("rejects missing or non-JSON content types", async () => {
    for (const contentType of [undefined, "text/plain", "application/xml"]) {
      const request = contentType === undefined
        ? new Request(url, { method: "POST", body: JSON.stringify(validBody) })
        : jsonRequest(validBody, { "content-type": contentType });
      const parsed = await readBoundedJsonRequest(request);
      expect(parsed).toEqual({ ok: false, code: "invalid-content-type" });
    }
  });

  it("rejects invalid and oversize declared content lengths", async () => {
    for (const contentLength of ["-1", "1.5", "not-a-number"]) {
      const parsed = await readBoundedJsonRequest(jsonRequest(validBody, {
        "content-length": contentLength,
      }));
      expect(parsed).toEqual({ ok: false, code: "invalid-request" });
    }
    const parsed = await readBoundedJsonRequest(jsonRequest(validBody, {
      "content-length": String(RESEARCH_MODE_MAX_REQUEST_BYTES + 1),
    }));
    expect(parsed).toEqual({ ok: false, code: "request-too-large" });
  });

  it("accepts an exactly-at-limit JSON body without a declared length", async () => {
    const empty = JSON.stringify({ padding: "" });
    const value = { padding: "x".repeat(RESEARCH_MODE_MAX_REQUEST_BYTES - empty.length) };
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    expect(encoded.byteLength).toBe(RESEARCH_MODE_MAX_REQUEST_BYTES);
    const parsed = await readBoundedJsonRequest(binaryRequest([encoded]).request);
    expect(parsed).toEqual({ ok: true, value });
  });

  it("enforces the actual streamed byte ceiling and cancels an oversize body", async () => {
    const stream = binaryRequest([
      new Uint8Array(RESEARCH_MODE_MAX_REQUEST_BYTES + 1),
    ], {}, false);
    const parsed = await readBoundedJsonRequest(stream.request);
    expect(parsed).toEqual({ ok: false, code: "request-too-large" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stream.cancelled()).toBe(true);
  });

  it("catches a dishonest smaller declared length through actual streaming", async () => {
    const stream = binaryRequest([
      new TextEncoder().encode(JSON.stringify(validBody)),
      new Uint8Array(RESEARCH_MODE_MAX_REQUEST_BYTES),
    ], { "content-length": "10" }, false);
    const parsed = await readBoundedJsonRequest(stream.request);
    expect(parsed).toEqual({ ok: false, code: "request-too-large" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stream.cancelled()).toBe(true);
  });

  it("requires the completed actual body size to match a valid declared length", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify(validBody));
    const parsed = await readBoundedJsonRequest(binaryRequest([encoded], {
      "content-length": "10",
    }).request);
    expect(parsed).toEqual({ ok: false, code: "invalid-request" });
  });

  it("cancels a stalled body read when the caller aborts", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull() {
        return undefined;
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
      signal: controller.signal,
    } as RequestInit);
    const pending = readBoundedJsonRequest(request);
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(pending).resolves.toEqual({ ok: false, code: "invalid-request" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelled).toBe(true);
  });

  it("rejects invalid UTF-8 and malformed JSON without replacement characters", async () => {
    const invalidUtf8 = await readBoundedJsonRequest(binaryRequest([
      new Uint8Array([0xef, 0xbf, 0xbd, 0xff]),
    ]).request);
    expect(invalidUtf8).toEqual({ ok: false, code: "invalid-json" });
    const malformed = await readBoundedJsonRequest(jsonRequest("{not-json"));
    expect(malformed).toEqual({ ok: false, code: "invalid-json" });
  });
});

describe("research POST handler", () => {
  it("accepts a supported target and dispatches Phase 2 exactly once", async () => {
    const { handler, runResearch, targetResolver } = makeHandler();
    const request = jsonRequest(validBody);
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(runResearch).toHaveBeenCalledTimes(1);
    const [input, options] = runResearch.mock.calls[0]!;
    expect(input).toEqual({
      target: {
        university: { id: university.id },
        program: { id: program.id, universityId: university.id },
      },
      categories: ["admissions"],
      question: validBody.question,
    });
    expect(options.discovery).toEqual({ targetResolver });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal).not.toBe(request.signal);
    expect(options.signal?.aborted).toBe(false);
    expect(Object.keys(options).sort()).toEqual(["discovery", "signal"]);
    expect(JSON.stringify(options)).not.toContain("API_KEY");
    const body = await response.json();
    expect(researchModeResponseSchema.parse(body)).toBeTruthy();
    expect(body.dossier.target.university.id).toBe(university.id);
    expect(body.dossier.target.program.id).toBe(program.id);
  });

  it("rejects malformed requests and body parsing failures without dispatch", async () => {
    const invalid = [
      jsonRequest({ ...validBody, retryCount: 1 }),
      jsonRequest("{not-json"),
      jsonRequest(validBody, { "content-type": "text/plain" }),
      binaryRequest([new Uint8Array(RESEARCH_MODE_MAX_REQUEST_BYTES + 1)]).request,
    ];
    for (const request of invalid) {
      const { handler, runResearch } = makeHandler();
      const response = await handler(request);
      expect(response.status).toBeOneOf([400, 413, 415]);
      expect(runResearch).not.toHaveBeenCalled();
    }
  });

  it("stops before body reading and dispatch for a pre-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
      signal: controller.signal,
    });
    const { handler, runResearch } = makeHandler();
    const response = await handler(request);
    expect(response.status).toBe(400);
    expect(researchModeResponseSchema.parse(await response.json())).toBeTruthy();
    expect(runResearch).not.toHaveBeenCalled();
  });

  it("enforces same-origin and fetch-site rules before dispatch", async () => {
    const cases: Array<{ headers: Record<string, string>; allowed: boolean }> = [
      { headers: { origin: url.replace("/api/research", "") }, allowed: true },
      { headers: { origin: "https://evil.test" }, allowed: false },
      { headers: { origin: "https://" }, allowed: false },
      { headers: { "sec-fetch-site": "cross-site" }, allowed: false },
      { headers: { "sec-fetch-site": "same-origin" }, allowed: true },
      { headers: {}, allowed: true },
    ];
    for (const item of cases) {
      const { handler, runResearch } = makeHandler();
      const response = await handler(jsonRequest(validBody, item.headers));
      expect(response.status).toBe(item.allowed ? 200 : 403);
      expect(runResearch).toHaveBeenCalledTimes(item.allowed ? 1 : 0);
    }
  });

  it("rejects sensitive questions without echoing them", async () => {
    const { handler, runResearch } = makeHandler();
    const response = await handler(jsonRequest({
      ...validBody,
      question: "My GPA is 3.8 and my passport number is AB123456",
    }));
    const responseText = await response.text();
    expect(researchModeResponseSchema.parse(JSON.parse(responseText))).toMatchObject({
      ok: false,
      error: { code: "sensitive-input" },
    });
    expect(runResearch).not.toHaveBeenCalled();
    expect(responseText).not.toContain("AB123456");
  });

  it("rejects sensitive values in every caller-supplied free-text field", async () => {
    for (const field of ["intake", "academicYear"] as const) {
      const { handler, runResearch } = makeHandler();
      const response = await handler(jsonRequest({
        ...validBody,
        question: "What is the published requirement?",
        [field]: "My passport number is AB123456",
      }));
      const responseText = await response.text();
      expect(researchModeResponseSchema.parse(JSON.parse(responseText))).toMatchObject({
        ok: false,
        error: { code: "sensitive-input" },
      });
      expect(runResearch).not.toHaveBeenCalled();
      expect(responseText).not.toContain("AB123456");
    }
  });

  it("validates catalog membership and program ownership without fuzzy retargeting", async () => {
    const edinburghProgram = researchCatalog.programs.find(
      (item) => item.id === "program-edinburgh-artificial-intelligence-bsc",
    )!;
    const cases = [
      { body: { ...validBody, universityId: "university-does-not-exist" }, status: 404 },
      { body: { ...validBody, programId: "program-does-not-exist" }, status: 404 },
      { body: { ...validBody, programId: edinburghProgram.id }, status: 400 },
    ];
    for (const item of cases) {
      const { handler, runResearch } = makeHandler();
      const response = await handler(jsonRequest(item.body));
      await expectError(response, item.status, "unsupported-target");
      expect(runResearch).not.toHaveBeenCalled();
    }
  });

  it("returns valid terminal succeeded, partial, failed, and cancelled dossiers", async () => {
    const cases = [
      makeResult({ processedCategories: ["admissions", "support"], unprocessedCategories: [] }),
      makeResult({ processedCategories: ["admissions"], unprocessedCategories: ["support"], failureCode: "timeout" }),
      makeResult({ processedCategories: [], unprocessedCategories: ["admissions", "support"], failureCode: "provider-error" }),
      makeResult({ processedCategories: [], unprocessedCategories: ["admissions", "support"], failureCode: "cancelled" }),
    ];
    for (const result of cases) {
      const { handler, runResearch } = makeHandler(result);
      const response = await handler(jsonRequest({
        ...validBody,
        categories: ["admissions", "support"],
      }));
      expect(response.status).toBe(200);
      const body = researchModeResponseSchema.parse(await response.json());
      expect(body.ok).toBe(true);
      expect(runResearch).toHaveBeenCalledTimes(1);
    }
  });

  it("fails closed when a valid Phase 2 result does not partition the requested categories", async () => {
    const result = makeResult({
      processedCategories: ["admissions"],
      unprocessedCategories: ["support"],
      failureCode: "timeout",
    });
    const { handler, runResearch } = makeHandler(result);
    const response = await handler(jsonRequest({
      ...validBody,
      categories: ["admissions"],
    }));
    await expectError(response, 500, "internal-error");
    expect(runResearch).toHaveBeenCalledTimes(1);
  });

  it("rejects an otherwise valid dossier above 4 MiB without truncating evidence", async () => {
    const result = makeResult();
    result.sources[0]!.url = `https://example.edu/${"a".repeat(RESEARCH_MODE_MAX_RESPONSE_BYTES)}`;
    const { handler, runResearch } = makeHandler(result);
    const response = await handler(jsonRequest(validBody));
    await expectError(response, 500, "internal-error");
    expect(runResearch).toHaveBeenCalledTimes(1);
  });

  it("sanitizes unexpected internal errors and keeps evidence text as JSON data", async () => {
    const result = makeResult();
    result.claims[0]!.value = "<script>alert('x')</script>";
    result.candidates[0]!.value = result.claims[0]!.value;
    const { handler } = makeHandler(result);
    const response = await handler(jsonRequest(validBody));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("<script>alert('x')</script>");

    const throwing = vi.fn(async () => {
      throw new Error("upstream secret https://source.example/private-path?token=secret");
    });
    const failHandler = createResearchPostHandler({
      catalog: researchCatalog,
      targetResolver: createCatalogTargetResolver(researchCatalog),
      runResearch: throwing,
    });
    const errorResponse = await failHandler(jsonRequest(validBody));
    const errorText = await errorResponse.text();
    expect(researchModeResponseSchema.parse(JSON.parse(errorText))).toMatchObject({
      ok: false,
      error: { code: "internal-error" },
    });
    expect(errorResponse.status).toBe(500);
    expect(errorText).not.toContain("private-path");
    expect(errorText).not.toContain("secret");
  });

  it("rethrows only a sanitized cancellation error when an aborted run fails", async () => {
    const controller = new AbortController();
    const secret = "upstream secret https://source.example/private-path?token=secret";
    const runResearch = vi.fn(async () => {
      controller.abort();
      throw new Error(secret);
    });
    const handler = createResearchPostHandler({
      catalog: researchCatalog,
      targetResolver: createCatalogTargetResolver(researchCatalog),
      runResearch,
    });
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
      signal: controller.signal,
    });
    await expect(handler(request)).rejects.toThrow(
      "research request was cancelled before a response could be produced",
    );
    expect(runResearch).toHaveBeenCalledTimes(1);
  });
});
