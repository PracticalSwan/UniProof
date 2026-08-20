import { describe, expect, it } from "vitest";

import {
  claimCandidateSchema,
  researchDocumentSchema,
  researchResultSchema,
  researchSourceSchema,
  verifiedClaimSchema,
} from "@/lib/research/contracts";
import { generateEvidenceExplanations } from "@/lib/research/verification/explanation";
import { buildReconciliationPrompt } from "@/lib/research/reconciliation/schema";
import { buildSemanticQuestions } from "@/lib/research/reconciliation/semantic";
import { evaluateEvidenceGate } from "@/lib/research/verification/evidence-policy";

const timestamp = "2026-08-17T00:00:00.000Z";

function candidate(id: string, sourceId: string, documentId: string, overrides: Record<string, unknown> = {}) {
  return claimCandidateSchema.parse({
    id,
    universityName: "Example University",
    category: "admissions",
    property: "application requirement",
    value: "required",
    sourceId,
    documentId,
    extractionMethod: "model",
    extractionProvider: "gemini",
    extractionModel: "gemini-3.5-flash-lite",
    supportingText: "Application requirement: required.",
    ...overrides,
  });
}

function source(id: string, publisher: string, sourceType: "university" | "independent" = "university") {
  return researchSourceSchema.parse({
    id,
    url: `https://${id}.example.org/evidence`,
    title: "Evidence",
    publisher,
    sourceType,
    retrievedAt: timestamp,
  });
}

function document(id: string, sourceId: string, text: string) {
  return researchDocumentSchema.parse({
    id,
    sourceId,
    originalUrl: `https://${id}.example.org/evidence`,
    canonicalUrl: `https://${id}.example.org/evidence`,
    title: "Evidence",
    publisher: "Example University",
    sourceType: "university",
    retrievedAt: timestamp,
    contentType: "text/plain",
    normalizedText: text,
    contentHash: id === "document-1" ? "1".repeat(64) : "2".repeat(64),
  });
}

describe("Phase 2E independent review regressions", () => {
  it("does not grant resolved-target authority to an unowned university page", () => {
    const value = candidate("candidate-1", "source-1", "document-1");
    const result = evaluateEvidenceGate({
      candidates: [value],
      sources: [source("source-1", "Other University")],
      documents: [document("document-1", "source-1", value.supportingText)],
      target: { universityName: "Example University" },
      decisionEligibleCategories: ["admissions"],
    });
    expect(result.claims[0]?.verificationStatus).not.toBe("verified");
    expect(result.claims[0]?.verificationStatus).not.toBe("university-reported");
  });

  it("rejects processed zero-claim coverage that is not marked unknown", () => {
    const parsed = researchResultSchema.safeParse({
      run: { id: "run-unknown", status: "succeeded", createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp, processedCategories: ["admissions"], unprocessedCategories: [], partial: false },
      sources: [], documents: [], candidates: [], claims: [],
      evidenceSummary: {
        statusCounts: { verified: 0, corroborated: 0, "university-reported": 0, conflicting: 0, anecdotal: 0, inferred: 0, unknown: 0, outdated: 0 },
        totalClaims: 0,
        categoryCoverage: [{ category: "admissions", claimCount: 0, hasEvidence: false, statuses: [] }],
        categoriesProcessed: ["admissions"], categoriesUnknown: [], categoriesUnprocessed: [], categoriesWithConflicts: [], categoriesOutdated: [], categoriesFailed: [],
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts final provenance across allowed unit and period aliases", () => {
    const left = candidate("candidate-1", "source-1", "document-1", {
      value: "12  months",
      property: "duration",
      unit: "months",
      academicYear: "AY 2027/28",
      intake: "Sep",
      supportingText: "Duration: 12 months.",
    });
    const right = candidate("candidate-2", "source-2", "document-2", {
      value: "12 months",
      property: "duration",
      unit: "month",
      academicYear: "2027-2028",
      intake: "September",
      supportingText: "Duration: 12 months.",
    });
    const sources = [source("source-1", "Independent One", "independent"), source("source-2", "Independent Two", "independent")];
    const documents = [document("document-1", "source-1", left.supportingText), document("document-2", "source-2", right.supportingText)];
    const gate = evaluateEvidenceGate({
      candidates: [left, right],
      sources,
      documents,
      target: { universityName: "Example University" },
      decisionEligibleCategories: ["admissions"],
      relationships: [{
        questionId: "question-aliases",
        leftCandidateId: left.id,
        rightCandidateId: right.id,
        category: "admissions",
        property: "duration",
        relationship: "equivalent",
        resolution: "deterministic",
      }],
    });
    const parsed = researchResultSchema.safeParse({
      run: {
        id: "run-aliases",
        status: "succeeded",
        createdAt: timestamp,
        startedAt: timestamp,
        updatedAt: timestamp,
        completedAt: timestamp,
        processedCategories: ["admissions"],
        unprocessedCategories: [],
        partial: false,
      },
      sources,
      documents,
      candidates: [left, right],
      claims: gate.claims,
      explanations: [{ category: "admissions", referencedClaimIds: [gate.claims[0]!.id], summary: "Independent admissions duration evidence." }],
      evidenceSummary: {
        statusCounts: { verified: 0, corroborated: 0, "university-reported": 0, conflicting: 0, anecdotal: 0, inferred: 1, unknown: 0, outdated: 0 },
        totalClaims: 1,
        categoryCoverage: [{ category: "admissions", claimCount: 1, hasEvidence: true, statuses: ["inferred"] }],
        categoriesProcessed: ["admissions"],
        categoriesUnknown: [],
        categoriesUnprocessed: [],
        categoriesWithConflicts: [],
        categoriesOutdated: [],
        categoriesFailed: [],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("does not send zero-claim categories to the explanation model", async () => {
    const claim = verifiedClaimSchema.parse({
      id: "claim-1", universityName: "Example University", category: "admissions", property: "requirement", value: "required",
      sourceIds: ["source-1"], documentIds: ["document-1"], candidateIds: ["candidate-1"], supportingText: "Requirement: required.", verificationStatus: "verified",
    });
    let observedCategories: readonly string[] = [];
    const result = await generateEvidenceExplanations({
      claims: [claim],
      categories: ["admissions", "outcomes"],
      runTask: async (input) => {
        observedCategories = input.categories;
        return { attempts: [] };
      },
    });
    expect(observedCategories).toEqual(["admissions"]);
    expect(result.explanations.find((item) => item.category === "outcomes")).toMatchObject({ fallback: true });
  });

  it("quotes resolved target scope as JSON data instead of prompt lines", () => {
    const left = candidate("candidate-1", "source-1", "document-1", { value: "a", supportingText: "Requirement a." });
    const right = candidate("candidate-2", "source-2", "document-2", { value: "b", supportingText: "Requirement b." });
    const target = { universityName: "Example University\nSECOND LINE DATA" };
    const plan = buildSemanticQuestions({ candidates: [left, right], target });
    const prompt = buildReconciliationPrompt({ questions: plan.questions, candidates: [left, right], target });
    const start = prompt.indexOf("BEGIN PUBLIC SCOPE DATA");
    const end = prompt.indexOf("END PUBLIC SCOPE DATA");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const scopeBlock = prompt.slice(start, end);
    expect(scopeBlock).toContain("\\nSECOND LINE DATA");
    expect(scopeBlock).not.toContain("\nSECOND LINE DATA");
  });
});
