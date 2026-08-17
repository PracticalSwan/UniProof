import { describe, expect, it, vi } from "vitest";

import { executeResearchRequest } from "@/lib/research/mode/client-transport";
import {
  researchDossierSchema,
  researchModeRequestSchema,
  type ResearchDossier,
  type ResearchModeRequest,
} from "@/lib/research/mode/public-contracts";

const request: ResearchModeRequest = researchModeRequestSchema.parse({
  universityId: "university-mit",
  programId: "program-mit-artificial-intelligence-decision-making-bs",
  categories: ["admissions"],
});

const universityOnlyRequest: ResearchModeRequest = researchModeRequestSchema.parse({
  universityId: "university-mit",
  categories: ["admissions", "tuition"],
});

const programTwoCategoryRequest: ResearchModeRequest = researchModeRequestSchema.parse({
  universityId: "university-mit",
  programId: "program-mit-artificial-intelligence-decision-making-bs",
  categories: ["admissions", "tuition"],
});

function makeDossier(options: {
  universityId?: string;
  programId?: string | null;
  categories?: readonly ("admissions" | "tuition")[];
} = {}): ResearchDossier {
  const categories = options.categories ?? ["admissions"];
  const hasIncomplete = categories.some((category) => category !== "admissions");
  const source = {
    id: "source-1",
    url: "https://example.edu/evidence",
    title: "Evidence page",
    publisher: "Example University",
    sourceType: "university" as const,
    retrievedAt: "2026-08-17T00:00:00.000Z",
    effectiveDate: "2026-09-01",
  };
  const claim = {
    id: "claim-1",
    category: "admissions" as const,
    property: "Application deadline",
    value: "2027-01-15",
    verificationStatus: "verified" as const,
    representativeSourceId: "source-1",
    sourceIds: ["source-1"],
    supportingText: "The application deadline is 15 January 2027.",
  };
  return researchDossierSchema.parse({
    target: {
      university: {
        id: options.universityId ?? "university-mit",
        name: "Massachusetts Institute of Technology",
        countryCode: "US",
        websiteUrl: "https://web.mit.edu/",
      },
      ...(options.programId === null
        ? {}
        : {
            program: {
              id: options.programId ?? "program-mit-artificial-intelligence-decision-making-bs",
              name: "Bachelor of Science in Artificial Intelligence and Decision Making (Course 6-4)",
              degreeLevel: "bachelor",
              subjectArea: "Artificial Intelligence",
              officialUrl: "https://catalog.mit.edu/",
            },
          }),
    },
    run: {
      id: "run-transport",
      status: hasIncomplete ? "partial" : "succeeded",
      createdAt: "2026-08-17T00:00:00.000Z",
      startedAt: "2026-08-17T00:00:01.000Z",
      updatedAt: "2026-08-17T00:00:02.000Z",
      completedAt: "2026-08-17T00:00:03.000Z",
    },
    summary: {
      totalClaims: 1,
      statusCounts: {
        verified: 1,
        corroborated: 0,
        "university-reported": 0,
        conflicting: 0,
        anecdotal: 0,
        inferred: 0,
        outdated: 0,
      },
      processedCategories: ["admissions"],
      unprocessedCategories: categories.filter((category) => category !== "admissions"),
    },
    categories: [
      {
        category: "admissions",
        state: "ready",
        claims: [claim],
        explanation: {
          category: "admissions",
          referencedClaimIds: ["claim-1"],
          summary: "The official passage supports the claim.",
        },
        hasConflict: false,
        hasOutdated: false,
      },
      ...categories
        .filter((category) => category !== "admissions")
        .map((category) => ({
          category,
          state: "incomplete" as const,
          claims: [],
          failure: {
            code: "provider-error" as const,
            message: "Research could not complete this category.",
          },
          hasConflict: false,
          hasOutdated: false,
        })),
    ],
    sources: [source],
  });
}

const validDossier = makeDossier();
const successEnvelope = JSON.stringify({ ok: true, dossier: validDossier });
const universityOnlyCategoriesWithProgram = makeDossier({ categories: ["admissions", "tuition"] });

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function stubResponse(
  init: { status?: number; headers?: Record<string, string>; text?: () => Promise<string> },
): Response {
  const status = init.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(init.headers ?? { "content-type": "application/json" }),
    text: init.text ?? (async () => ""),
  } as unknown as Response;
}

function errorEnvelope(code: string): string {
  return JSON.stringify({
    ok: false,
    error: { code, message: `Server message for ${code}` },
  });
}

const invalidResponse = {
  kind: "invalid-response",
  error: { code: "invalid-response", message: expect.any(String) },
};

describe("executeResearchRequest", () => {
  it("sends exactly one POST with the exact wire shape and returns a validated dossier", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(successEnvelope));
    const controller = new AbortController();

    const result = await executeResearchRequest(request, controller.signal, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/api/research", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    expect(result).toEqual({ kind: "dossier", dossier: validDossier });
  });

  it("returns a valid non-succeeded dossier as data rather than a transport error", async () => {
    const partial = makeDossier({ categories: ["admissions", "tuition"] });
    const fetchImpl = vi.fn(async () =>
      jsonResponse(JSON.stringify({ ok: true, dossier: partial })),
    );

    const result = await executeResearchRequest(
      programTwoCategoryRequest,
      new AbortController().signal,
      fetchImpl,
    );

    expect(result).toEqual({ kind: "dossier", dossier: partial });
  });

  it("returns a validated non-2xx public error as server-error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(errorEnvelope("sensitive-input"), 400));

    const result = await executeResearchRequest(request, new AbortController().signal, fetchImpl);

    expect(result).toEqual({
      kind: "server-error",
      error: { code: "sensitive-input", message: "Server message for sensitive-input" },
    });
  });

  it("rejects HTTP/envelope disagreement in both directions", async () => {
    const okErrorStatus = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () => jsonResponse(errorEnvelope("internal-error"), 200)),
    );
    expect(okErrorStatus).toEqual(invalidResponse);

    const errorOkStatus = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () => jsonResponse(successEnvelope, 500)),
    );
    expect(errorOkStatus).toEqual(invalidResponse);
  });

  it("rejects missing or non-JSON content types", async () => {
    for (const contentType of ["text/plain", "text/html", "application/octet-stream"]) {
      const result = await executeResearchRequest(
        request,
        new AbortController().signal,
        vi.fn(async () =>
          stubResponse({
            headers: { "content-type": contentType },
            text: async () => successEnvelope,
          }),
        ),
      );
      expect(result).toEqual(invalidResponse);
    }

    const missingType = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () =>
        stubResponse({
          headers: {},
          text: async () => successEnvelope,
        }),
      ),
    );
    expect(missingType).toEqual(invalidResponse);
  });

  it("rejects malformed JSON, empty bodies, and schema-invalid envelopes", async () => {
    for (const body of ["", "   ", "{not json", "null", "[]", '{"ok":true,"dossier":{},"extra":1}']) {
      const result = await executeResearchRequest(
        request,
        new AbortController().signal,
        vi.fn(async () => jsonResponse(body)),
      );
      expect(result).toEqual(invalidResponse);
    }
  });

  it("rejects a schema-valid dossier for a different university", async () => {
    const wrong = JSON.stringify({
      ok: true,
      dossier: makeDossier({ universityId: "university-stanford" }),
    });
    const result = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () => jsonResponse(wrong)),
    );
    expect(result).toEqual(invalidResponse);
  });

  it("rejects a schema-valid dossier for a different program", async () => {
    const wrong = JSON.stringify({
      ok: true,
      dossier: makeDossier({ programId: "program-mit-other" }),
    });
    const result = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () => jsonResponse(wrong)),
    );
    expect(result).toEqual(invalidResponse);
  });

  it("rejects an unexpected program for a university-only request", async () => {
    const result = await executeResearchRequest(
      universityOnlyRequest,
      new AbortController().signal,
      vi.fn(async () =>
        jsonResponse(JSON.stringify({ ok: true, dossier: universityOnlyCategoriesWithProgram })),
      ),
    );
    expect(result).toEqual(invalidResponse);
  });

  it("rejects a schema-valid dossier with the wrong category set", async () => {
    const wrongCategories = JSON.stringify({
      ok: true,
      dossier: makeDossier({ categories: ["admissions", "tuition"] }),
    });
    const result = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () => jsonResponse(wrongCategories)),
    );
    expect(result).toEqual(invalidResponse);
  });

  it("rejects a declared oversized response before reading the body", async () => {
    const fetchImpl = vi.fn(async () =>
      stubResponse({
        headers: {
          "content-type": "application/json",
          "content-length": String(4 * 1024 * 1024 + 1),
        },
        text: async () => {
          throw new Error("body must not be read");
        },
      }),
    );

    const result = await executeResearchRequest(request, new AbortController().signal, fetchImpl);

    expect(result).toEqual(invalidResponse);
  });

  it("sanitizes network failures without copying exception bodies", async () => {
    const result = await executeResearchRequest(
      request,
      new AbortController().signal,
      vi.fn(async () => {
        throw new TypeError("boom https://secret.example/token");
      }),
    );

    expect(result).toEqual({
      kind: "network-error",
      error: { code: "network-error", message: expect.any(String) },
    });
    if (result.kind === "network-error") {
      expect(result.error.message).not.toContain("boom");
      expect(result.error.message).not.toContain("secret.example");
    }
  });

  it("returns cancelled without dispatch when the signal is already aborted", async () => {
    const fetchImpl = vi.fn();
    const controller = new AbortController();
    controller.abort();

    const result = await executeResearchRequest(request, controller.signal, fetchImpl);

    expect(result).toEqual({ kind: "cancelled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lets the exact signal win after fetch resolves even without AbortError", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      return jsonResponse(successEnvelope);
    });

    const result = await executeResearchRequest(request, controller.signal, fetchImpl);

    expect(result).toEqual({ kind: "cancelled" });
  });

  it("lets the exact signal win when abort races with fetch rejection", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new Error("connection reset");
    });

    const result = await executeResearchRequest(request, controller.signal, fetchImpl);

    expect(result).toEqual({ kind: "cancelled" });
  });

  it("lets the exact signal win during body/schema work", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () =>
      stubResponse({
        text: async () => {
          controller.abort();
          return successEnvelope;
        },
      }),
    );

    const result = await executeResearchRequest(request, controller.signal, fetchImpl);

    expect(result).toEqual({ kind: "cancelled" });
  });

  it("never retries a failed request automatically", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });

    const result = await executeResearchRequest(request, new AbortController().signal, fetchImpl);

    expect(result.kind).toBe("network-error");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
