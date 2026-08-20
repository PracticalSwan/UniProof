import { describe, expect, it, vi } from "vitest";

import {
  executeResearchRequest,
} from "@/lib/research/mode/client-transport";
import {
  researchModeRequestSchema,
  type ResearchModeRequest,
} from "@/lib/research/mode/public-contracts";
import { admissionsOnlyResponse } from "./fixtures/research-dossiers";
import {
  comparisonBatchShouldStop,
  comparisonResearchOutcomeSchema,
  deriveRetryTargetKeys,
} from "@/lib/comparison/client-state";
import { comparisonSubmissionSchema } from "@/lib/comparison/contracts";
import {
  guideWorkspaceReducer,
  createGuideWorkspaceState,
} from "@/lib/guide/client-state";
import {
  initialResearchWorkspaceState,
  researchWorkspaceReducer,
} from "@/lib/research/mode/client-state";
import { guideSubmissionSchema } from "@/lib/guide/contracts";

const request: ResearchModeRequest = researchModeRequestSchema.parse({
  universityId: "university-mit",
  programId: "program-mit-artificial-intelligence-decision-making-bs",
  categories: ["admissions"],
});

function jsonResponse(body: string, status: number, contentType = "application/json"): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

const hostileBody = `<html><body>req=internal-request source-ip=203.0.113.7 rule=WAF-SECRET x-request-id=abc<script>window.secret="marker"</script></body></html>`;

describe("raw deployment platform failures", () => {
  it.each([429, 504])(
    "classifies HTTP %s before content type, JSON, or body validation",
    async (status) => {
      const fetchImpl = vi.fn(async () => jsonResponse(hostileBody, status, "text/html"));

      const result = await executeResearchRequest(request, new AbortController().signal, fetchImpl);

      expect(result).toEqual({
        kind: status === 429 ? "deployment-rate-limit" : "deployment-timeout",
        error: {
          code: status === 429 ? "deployment-rate-limit" : "deployment-timeout",
          message: expect.any(String),
        },
      });
      if (result.kind !== "dossier" && result.kind !== "cancelled") {
        expect(result.error.message).not.toContain("internal-request");
        expect(result.error.message).not.toContain("203.0.113.7");
        expect(result.error.message).not.toContain("WAF-SECRET");
        expect(result.error.message).not.toContain("abc");
        expect(result.error.message).not.toContain("<script>");
      }
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["html", hostileBody, "text/html"],
    ["plain text", "too many requests", "text/plain"],
    ["empty", "", "text/html"],
    ["malformed", '{"broken":', "application/json"],
    ["oversize", "x".repeat(5 * 1024 * 1024), "text/html"],
  ])("sanitizes a raw 429 with a %s body without reading it", async (_kind, body, contentType) => {
    let textCalled = false;
    let cancelled = false;
    const response = {
      status: 429,
      ok: false,
      headers: new Headers({ "content-type": contentType }),
      text: async () => {
        textCalled = true;
        return body;
      },
      body: {
        cancel: async () => {
          cancelled = true;
        },
      },
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => response);

    const result = await executeResearchRequest(request, new AbortController().signal, fetchImpl);

    expect(result).toMatchObject({ kind: "deployment-rate-limit" });
    expect(textCalled).toBe(false);
    expect(cancelled).toBe(true);
  });

  it("keeps ordinary application JSON failures on the strict server-error path", async () => {
    const body = JSON.stringify({
      ok: false,
      error: { code: "sensitive-input", message: "Research fields must contain public information only." },
    });
    const fetchImpl = vi.fn(async () => jsonResponse(body, 400));

    const result = await executeResearchRequest(request, new AbortController().signal, fetchImpl);

    expect(result).toEqual({
      kind: "server-error",
      error: { code: "sensitive-input", message: "Research fields must contain public information only." },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Research/Compare/Guide platform-failure lifecycle", () => {
  it("keeps a prior Research result and exact retry submission after deployment failure", () => {
    const dossier = admissionsOnlyResponse.dossier;
    let state = researchWorkspaceReducer(initialResearchWorkspaceState, {
      type: "start",
      sequence: 1,
      submission: { request, targetLabel: "Prior target" },
    });
    state = researchWorkspaceReducer(state, {
      type: "result",
      sequence: 1,
      dossier,
    });
    state = researchWorkspaceReducer(state, {
      type: "start",
      sequence: 2,
      submission: { request, targetLabel: "Refresh target" },
    });
    state = researchWorkspaceReducer(state, {
      type: "error",
      sequence: 2,
      error: { code: "deployment-rate-limit", message: "Rate limited by deployment." },
    });

    expect(state).toMatchObject({
      kind: "error",
      previous: { dossier },
      submission: { request, targetLabel: "Refresh target" },
    });
  });

  it("accepts deployment outcomes in comparison contracts and treats them as batch-stopping retryable errors", () => {
    const target = {
      universityId: "university-mit",
      programId: "program-mit-artificial-intelligence-decision-making-bs",
    };
    const outcome = comparisonResearchOutcomeSchema.parse({
      target,
      state: "transport-error",
      error: {
        code: "deployment-timeout",
        message: "Deployment timed out.",
      },
    });

    expect(comparisonBatchShouldStop({ kind: "deployment-timeout" })).toBe(true);
    expect(comparisonBatchShouldStop({ kind: "deployment-rate-limit" })).toBe(true);
    expect(comparisonBatchShouldStop({ kind: "network-error" })).toBe(false);
    const submission = comparisonSubmissionSchema.parse({
      targets: [
        target,
        {
          universityId: "university-stanford",
          programId: "program-stanford-computer-science-bs",
        },
      ],
      categories: ["tuition"],
      weights: { affordability: 100, research: 0, scholarships: 0, outcomes: 0, support: 0 },
      showRankingEvidence: false,
      showAnecdotalEvidence: false,
    });
    expect(deriveRetryTargetKeys(submission, [outcome])).toEqual([
      "university-mit::program-mit-artificial-intelligence-decision-making-bs",
      "university-stanford::program-stanford-computer-science-bs",
    ]);
  });

  it("keeps Guide applicant submission and prior result after deployment failure", () => {
    const submission = guideSubmissionSchema.parse({
      target: {
        universityId: "university-mit",
        programId: "program-mit-artificial-intelligence-decision-making-bs",
      },
      profile: {
        citizenship: "TH",
        currentCountry: "TH",
        qualification: {
          level: "secondary",
          title: "Thai high-school certificate",
          subject: "science",
        },
        englishTest: { kind: "not-provided" },
        scholarshipNeed: true,
      },
      publicContext: {},
      assessmentDate: "2026-08-19",
    });
    const researchRequest = request;
    let state = createGuideWorkspaceState();
    state = guideWorkspaceReducer(state, {
      type: "start",
      sequence: 1,
      submission,
      researchRequest,
      forceRefresh: true,
    });
    state = guideWorkspaceReducer(state, {
      type: "fail",
      sequence: 1,
      error: { code: "deployment-rate-limit", message: "Rate limited by deployment." },
    });

    expect(state).toMatchObject({
      kind: "error",
      submission,
      researchRequest,
      forceRefresh: true,
    });
  });
});
