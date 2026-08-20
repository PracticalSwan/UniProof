import { describe, expect, it } from "vitest";

import {
  canReuseGuideDossier,
  createGuideWorkspaceState,
  finalizeGuideResult,
  guideResearchKey,
  guideWorkspaceReducer,
  type GuideReusableDossier,
} from "@/lib/guide/client-state";
import { researchCatalog } from "@/lib/research/catalog/data";
import type { GuideApplicantProfile, GuideSubmission } from "@/lib/guide/contracts";
import type { ResearchModeRequest } from "@/lib/research/mode/public-contracts";
import { guideCatalogTarget } from "@/tests/helpers/catalog-targets";
import { buildGuideDossier, makeClaim } from "./fixtures/guide-dossiers";

const { university: testUniversity, program: testProgram } = guideCatalogTarget;

const profile: GuideApplicantProfile = {
  citizenship: "Malaysia",
  currentCountry: "Thailand",
  qualification: {
    level: "bachelor",
    title: "BSc Computer Science",
    subject: "Computer Science",
  },
  englishTest: { kind: "not-provided" },
  scholarshipNeed: false,
};

const submission: GuideSubmission = {
  target: { universityId: testUniversity.id, programId: testProgram.id },
  publicContext: {},
  profile,
  assessmentDate: "2026-08-18",
};

const request: ResearchModeRequest = {
  universityId: testUniversity.id,
  programId: testProgram.id,
  categories: ["admissions", "tuition", "scholarships"],
};

describe("guideWorkspaceReducer", () => {
  it("starts in idle state", () => {
    const state = createGuideWorkspaceState();
    expect(state.kind).toBe("idle");
  });

  it("start transitions to loading with prior result preserved", () => {
    const loadingState1 = guideWorkspaceReducer(createGuideWorkspaceState(), {
      type: "start", sequence: 1, submission, researchRequest: request, forceRefresh: false,
    });
    const priorResult = {} as import("@/lib/guide/contracts").GuideResult;
    const resultState = guideWorkspaceReducer(loadingState1, {
      type: "complete", sequence: 1, result: priorResult,
    });
    const loadingState = guideWorkspaceReducer(resultState, {
      type: "start", sequence: 2, submission, researchRequest: request, forceRefresh: false,
    });
    expect(loadingState.kind).toBe("loading");
    if (loadingState.kind === "loading") {
      expect(loadingState.previous).toBeDefined();
    }
  });

  it("restores only a newer historical result and preserves it through refresh cancellation", () => {
    const saved = { submission } as import("@/lib/guide/contracts").GuideResult;
    const state = guideWorkspaceReducer(createGuideWorkspaceState(), {
      type: "restore", sequence: 4, result: saved,
    });
    expect(state).toEqual({
      kind: "result",
      result: saved,
      notice: "Saved snapshot loaded.",
      lastSequence: 4,
    });

    const loading = guideWorkspaceReducer(state, {
      type: "start", sequence: 5, submission, researchRequest: request, forceRefresh: true,
    });
    const ignored = guideWorkspaceReducer(loading, {
      type: "restore", sequence: 6, result: {} as import("@/lib/guide/contracts").GuideResult,
    });
    expect(ignored).toBe(loading);
    expect(guideWorkspaceReducer(loading, { type: "cancel", sequence: 5 })).toEqual({
      kind: "result",
      result: saved,
      notice: "Assessment cancelled.",
      lastSequence: 5,
    });
  });

  it("stale sequence actions are ignored", () => {
    const state1 = guideWorkspaceReducer(createGuideWorkspaceState(), {
      type: "start", sequence: 2, submission, researchRequest: request, forceRefresh: false,
    });
    const staleComplete = guideWorkspaceReducer(state1, {
      type: "complete", sequence: 1, result: {} as import("@/lib/guide/contracts").GuideResult,
    });
    expect(staleComplete.kind).toBe("loading");
  });

  it("cancel with no prior result returns idle", () => {
    const state = guideWorkspaceReducer(createGuideWorkspaceState(), {
      type: "start", sequence: 1, submission, researchRequest: request, forceRefresh: false,
    });
    const cancelled = guideWorkspaceReducer(state, { type: "cancel", sequence: 1 });
    expect(cancelled.kind).toBe("idle");
  });

  it("ignores a stale cancel action instead of cancelling a newer run", () => {
    const loading = guideWorkspaceReducer(createGuideWorkspaceState(), {
      type: "start", sequence: 2, submission, researchRequest: request, forceRefresh: false,
    });
    const afterStaleCancel = guideWorkspaceReducer(loading, { type: "cancel", sequence: 1 });
    expect(afterStaleCancel).toEqual(loading);
  });
});

describe("guideResearchKey", () => {
  it("produces collision-safe structured keys", () => {
    const key1 = guideResearchKey({ ...request });
    const key2 = guideResearchKey({ ...request });
    expect(key1).toBe(key2);

    const differentTarget = guideResearchKey({ ...request, programId: "other" });
    expect(key1).not.toBe(differentTarget);
  });
});

describe("canReuseGuideDossier", () => {
  it("reuses same key succeeded dossier", () => {
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
    });
    const reusable: GuideReusableDossier = { key: guideResearchKey(request), dossier };
    expect(canReuseGuideDossier(reusable, request)).toBe(true);
  });

  it("does not reuse failed dossier", () => {
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
      runStatus: "failed",
      admissionsState: "incomplete",
      tuitionState: "incomplete",
      scholarshipState: "incomplete",
    });
    const reusable: GuideReusableDossier = { key: guideResearchKey(request), dossier };
    expect(canReuseGuideDossier(reusable, request)).toBe(false);
  });

  it("does not reuse different key", () => {
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
    });
    const reusable: GuideReusableDossier = { key: guideResearchKey({ ...request, intake: "Fall 2027" }), dossier };
    expect(canReuseGuideDossier(reusable, request)).toBe(false);
  });
});

describe("finalizeGuideResult", () => {
  it("accepts matching inputs and produces a result", () => {
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
      admissionsClaims: [makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" })],
    });
    const result = finalizeGuideResult(submission, request, dossier, researchCatalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.assessments.length).toBeGreaterThan(0);
      expect(result.result.status).toBe("complete");
    }
  });

  it("rejects mismatched target", () => {
    const dossier = buildGuideDossier({
      universityId: "other-uni",
      programId: testProgram.id,
    });
    const result = finalizeGuideResult(submission, request, dossier, researchCatalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("guide-assessment-error");
  });

  it("rejects category mismatch", () => {
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
    });
    const badRequest = { ...request, categories: ["admissions", "tuition", "outcomes"] };
    const result = finalizeGuideResult(submission, badRequest, dossier, researchCatalog);
    expect(result.ok).toBe(false);
  });

  it.each([
    ["intake", "September 2027", "January 2028"],
    ["academicYear", "2027-28", "2028-29"],
  ] as const)("rejects a Research request whose %s differs from the immutable submission", (field, submissionValue, requestValue) => {
    const contextualSubmission: GuideSubmission = {
      ...submission,
      publicContext: field === "intake" ? { intake: submissionValue } : { academicYear: submissionValue },
    };
    const contextualRequest: ResearchModeRequest = {
      ...request,
      ...(field === "intake" ? { intake: requestValue } : { academicYear: requestValue }),
    };
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
    });

    const result = finalizeGuideResult(contextualSubmission, contextualRequest, dossier, researchCatalog);
    expect(result.ok).toBe(false);
  });

  it("rejects failed dossier", () => {
    const dossier = buildGuideDossier({
      universityId: testUniversity.id,
      programId: testProgram.id,
      runStatus: "failed",
      admissionsState: "incomplete",
      tuitionState: "incomplete",
      scholarshipState: "incomplete",
    });
    const result = finalizeGuideResult(submission, request, dossier, researchCatalog);
    expect(result.ok).toBe(false);
  });

  it("returns sanitized error without raw Zod details", () => {
    const result = finalizeGuideResult({ invalid: true }, request, {}, researchCatalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("guide-assessment-error");
      expect(result.error.message).not.toContain("ZodError");
      expect(result.error.message).not.toContain("path");
    }
  });
});
