import { describe, expect, it } from "vitest";

import { researchCatalog } from "@/lib/research/catalog";
import {
  evidenceStatusSchema,
  researchResultSchema,
  type ClaimCandidate,
  type EvidenceExplanation,
  type ResearchCategory,
  type ResearchResult,
  type VerifiedClaim,
} from "@/lib/research/contracts";
import { composeResearchDossier } from "@/lib/research/mode/compose-dossier";

const timestamps = {
  createdAt: "2026-08-17T00:00:00.000Z",
  startedAt: "2026-08-17T00:00:01.000Z",
  updatedAt: "2026-08-17T00:00:02.000Z",
  completedAt: "2026-08-17T00:00:03.000Z",
};

const university = researchCatalog.universities.find((item) => item.id === "university-mit")!;
const program = researchCatalog.programs.find(
  (item) => item.id === "program-mit-artificial-intelligence-decision-making-bs",
)!;
const selectedTarget = { university, program };

type ClaimSeed = {
  id: string;
  category: ResearchCategory;
  property: string;
  value: string | number | boolean;
  status: VerifiedClaim["verificationStatus"];
  unit?: string;
  currency?: string;
  academicYear?: string;
  effectiveDate?: string;
  intake?: string;
  supportingText?: string;
  sourceId?: string;
};

function source(id: string, url: string) {
  return {
    id,
    url,
    title: `Official source ${id}`,
    publisher: "Example University",
    sourceType: "university" as const,
    retrievedAt: timestamps.createdAt,
    effectiveDate: "2026-09-01",
    academicYear: "2026-2027",
    discoveryProvider: "tavily" as const,
    discoveryQueryId: "query-internal-do-not-expose",
  };
}

function document(id: string, sourceId: string, text: string) {
  return {
    id,
    sourceId,
    originalUrl: `https://example.edu/${sourceId}`,
    canonicalUrl: `https://example.edu/${sourceId}`,
    title: `Document ${id}`,
    publisher: "Example University",
    sourceType: "university" as const,
    retrievedAt: timestamps.createdAt,
    contentType: "text/plain",
    retrievedBytes: text.length,
    truncated: false,
    normalizedText: text,
    sections: [{ heading: "Evidence", text }],
    contentHash: "a".repeat(64),
  };
}

function candidateFor(claim: ClaimSeed, index: number): ClaimCandidate {
  const supportingText = claim.supportingText ?? `${claim.property} is ${claim.value}.`;
  return {
    id: `candidate-${index}`,
    universityId: university.id,
    programId: program.id,
    category: claim.category,
    property: claim.property,
    value: claim.value,
    unit: claim.unit,
    currency: claim.currency,
    academicYear: claim.academicYear,
    effectiveDate: claim.effectiveDate,
    intake: claim.intake,
    sourceId: claim.sourceId ?? "source-1",
    supportingText,
    documentId: `document-${claim.sourceId ?? "1"}`,
    extractionMethod: "model",
    extractionProvider: "gemini",
    extractionModel: "internal-model-do-not-expose",
  };
}

function verifiedClaim(seed: ClaimSeed, index: number): VerifiedClaim {
  const sourceId = seed.sourceId ?? "source-1";
  return {
    id: seed.id,
    universityId: university.id,
    programId: program.id,
    category: seed.category,
    property: seed.property,
    value: seed.value,
    unit: seed.unit,
    currency: seed.currency,
    academicYear: seed.academicYear,
    effectiveDate: seed.effectiveDate,
    intake: seed.intake,
    sourceId,
    supportingText: seed.supportingText ?? `${seed.property} is ${seed.value}.`,
    verificationStatus: seed.status,
    sourceIds: [sourceId],
    documentIds: [`document-${sourceId === "source-1" ? "1" : sourceId.slice(-1)}`],
    candidateIds: [`candidate-${index}`],
  };
}

function buildResult(
  claimSeeds: readonly ClaimSeed[],
  options: {
    processedCategories?: readonly ResearchCategory[];
    unprocessedCategories?: readonly ResearchCategory[];
    candidates?: readonly ClaimCandidate[];
    extraSources?: readonly ReturnType<typeof source>[];
    extraDocuments?: readonly ReturnType<typeof document>[];
    failureCode?: "cancelled" | "timeout" | "source-discovery" | "retrieval" | "normalization" | "provider-rate-limit" | "provider-error" | "source-limit" | "unknown";
  } = {},
): ResearchResult {
  const processedCategories = options.processedCategories ??
    [...new Set(claimSeeds.map((claim) => claim.category))];
  const unprocessedCategories = options.unprocessedCategories ?? [];
  const claims = claimSeeds.map((seed, index) => verifiedClaim(seed, index));
  const candidates = options.candidates ?? claimSeeds.map((seed, index) => candidateFor(seed, index));
  const canonicalOrder = (values: readonly ResearchCategory[]) =>
    (["admissions", "tuition", "scholarships", "program-structure", "research", "outcomes", "support"] as const)
      .filter((category) => values.includes(category));
  const explanations: EvidenceExplanation[] = canonicalOrder(processedCategories).map((category) => {
    const categoryClaims = claims.filter((claim) => claim.category === category);
    return {
      category,
      referencedClaimIds: categoryClaims.map((claim) => claim.id).sort(),
      summary: categoryClaims.length === 0
        ? "Completed bounded research did not establish a supported factual claim."
        : "Evidence-backed claims are summarized within the researched sources.",
      fallback: categoryClaims.length === 0 || undefined,
    };
  });
  const statusCounts = Object.fromEntries(
    evidenceStatusSchema.options.map((status) => [
      status,
      claims.filter((claim) => claim.verificationStatus === status).length,
    ]),
  ) as Record<EvidenceExplanation extends never ? never : VerifiedClaim["verificationStatus"], number>;
  const failureCode = options.failureCode ?? (unprocessedCategories.length > 0 ? "provider-error" : undefined);
  const failureMessage = `raw internal failure secret-path ${failureCode}`;

  return researchResultSchema.parse({
    run: {
      id: "run-phase3",
      status: processedCategories.length === 0
        ? "failed"
        : unprocessedCategories.length === 0 ? "succeeded" : "partial",
      partial: processedCategories.length > 0 && unprocessedCategories.length > 0,
      ...timestamps,
      providerAttempts: [{
        stage: "extraction",
        provider: "gemini",
        model: "internal-model-do-not-expose",
        outcome: "success",
        retryCount: 0,
        durationMs: 1,
      }],
      processedCategories: canonicalOrder(processedCategories),
      unprocessedCategories: canonicalOrder(unprocessedCategories),
      failureCode,
      failureReason: failureMessage,
    },
    candidateSources: [{
      url: "https://example.edu/source-1",
      title: "Candidate source",
      publisher: "Example University",
      domain: "example.edu",
      sourceType: "university",
      discoveryProvider: "tavily",
      discoveryQueryId: "query-internal-do-not-expose",
      discoveredAt: timestamps.createdAt,
      relevanceScore: 1,
      rank: 1,
    }],
    sources: [
      source("source-1", "https://example.edu/source-1"),
      ...(options.extraSources ?? []),
      source("source-unused", "https://example.edu/unused"),
    ],
    documents: [
      document("document-1", "source-1", "The evidence used by all standard fixture claims."),
      ...(options.extraDocuments ?? []),
    ],
    candidates,
    claims,
    explanations,
    evidenceSummary: {
      statusCounts,
      totalClaims: claims.length,
      categoryCoverage: canonicalOrder(processedCategories).map((category) => {
        const categoryClaims = claims.filter((claim) => claim.category === category);
        return {
          category,
          claimCount: categoryClaims.length,
          hasEvidence: categoryClaims.length > 0,
          statuses: evidenceStatusSchema.options.filter((status) =>
            categoryClaims.some((claim) => claim.verificationStatus === status)
          ),
        };
      }),
      categoriesProcessed: canonicalOrder(processedCategories),
      categoriesWithConflicts: canonicalOrder(claims.filter((claim) =>
        claim.verificationStatus === "conflicting").map((claim) => claim.category)),
      categoriesUnknown: canonicalOrder(processedCategories.filter((category) =>
        !claims.some((claim) => claim.category === category))),
      categoriesOutdated: canonicalOrder(claims.filter((claim) =>
        claim.verificationStatus === "outdated").map((claim) => claim.category)),
      categoriesUnprocessed: canonicalOrder(unprocessedCategories),
      categoriesFailed: canonicalOrder(unprocessedCategories),
    },
    failures: canonicalOrder(unprocessedCategories).map((category) => ({
      category,
      code: failureCode ?? "unknown",
      message: failureMessage,
    })),
    warnings: ["raw warning secret-path query-internal-do-not-expose"],
  });
}

describe("Phase 3B dossier composer", () => {
  it("projects a ready verified claim with exact scalar and representative provenance", () => {
    const result = buildResult([
      { id: "claim-b", category: "admissions", property: "Application deadline", value: "2027-01-15", status: "verified", effectiveDate: "2026-09-01" },
      { id: "claim-a", category: "tuition", property: "Tuition", value: 10000, status: "university-reported", currency: "usd" },
      { id: "claim-c", category: "support", property: "Support available", value: false, status: "corroborated" },
    ]);
    const dossier = composeResearchDossier(result, selectedTarget);
    expect(dossier.categories.map((row) => row.category)).toEqual(["admissions", "tuition", "support"]);
    expect(dossier.categories.every((row) => row.state === "ready")).toBe(true);
    const values = dossier.categories.flatMap((row) => row.claims.map((claim) => [claim.id, claim.value]));
    expect(values).toContainEqual(["claim-b", "2027-01-15"]);
    expect(values).toContainEqual(["claim-a", 10000]);
    expect(values).toContainEqual(["claim-c", false]);
    expect(dossier.sources.map((item) => item.id)).toEqual(["source-1"]);
    expect(dossier.categories[0]?.claims[0]?.representativeSourceId).toBe("source-1");
  });

  it("composes all seven ready categories in canonical order", () => {
    const categories = ["support", "research", "outcomes", "program-structure", "scholarships", "tuition", "admissions"] as ResearchCategory[];
    const result = buildResult(categories.map((category, index) => ({
      id: `claim-${index}`,
      category,
      property: `Property ${index}`,
      value: index,
      status: "verified" as const,
    })));
    const dossier = composeResearchDossier(result, selectedTarget);
    expect(dossier.categories.map((row) => row.category)).toEqual([
      "admissions", "tuition", "scholarships", "program-structure", "research", "outcomes", "support",
    ]);
    expect(dossier.run.status).toBe("succeeded");
    expect(dossier.summary.totalClaims).toBe(7);
  });

  it("distinguishes ready, unknown, and incomplete lifecycle states", () => {
    const result = buildResult(
      [{ id: "claim-ready", category: "admissions", property: "Deadline", value: "2027-01-15", status: "verified" }],
      { processedCategories: ["admissions", "tuition"], unprocessedCategories: ["support"], failureCode: "timeout" },
    );
    const dossier = composeResearchDossier(result, selectedTarget);
    expect(dossier.run.status).toBe("partial");
    expect(dossier.categories.map((row) => row.state)).toEqual(["ready", "unknown", "incomplete"]);
    const unknownRow = dossier.categories.find((row) => row.state === "unknown")!;
    const incompleteRow = dossier.categories.find((row) => row.state === "incomplete")!;
    expect(unknownRow).toMatchObject({ state: "unknown", claims: [] });
    expect(unknownRow.explanation).toMatchObject({ referencedClaimIds: [], fallback: true });
    expect(incompleteRow).toMatchObject({ state: "incomplete", claims: [] });
    expect(incompleteRow.failure).toEqual({
      code: "timeout",
      message: "Research did not finish within the available time.",
    });
    expect("explanation" in dossier.categories[2]!).toBe(false);
  });

  it("composes an all-failed run as incomplete without category unknown", () => {
    const result = buildResult([], {
      processedCategories: [],
      unprocessedCategories: ["admissions", "tuition"],
      failureCode: "provider-rate-limit",
    });
    const dossier = composeResearchDossier(result, selectedTarget);
    expect(dossier.run.status).toBe("failed");
    expect(dossier.categories.map((row) => row.state)).toEqual(["incomplete", "incomplete"]);
    expect(dossier.summary.statusCounts).toEqual({
      verified: 0, corroborated: 0, "university-reported": 0, conflicting: 0, anecdotal: 0, inferred: 0, outdated: 0,
    });
  });

  it("preserves conflicting and outdated states without choosing winners", () => {
    const result = buildResult([
      { id: "claim-conflict-a", category: "tuition", property: "Tuition", value: 10000, status: "conflicting", currency: "USD" },
      { id: "claim-conflict-b", category: "tuition", property: "Tuition", value: 11000, status: "conflicting", currency: "USD" },
      { id: "claim-old", category: "outcomes", property: "Employment rate", value: "90%", status: "outdated" },
    ]);
    const dossier = composeResearchDossier(result, selectedTarget);
    const tuition = dossier.categories.find((row) => row.category === "tuition")!;
    const outcomes = dossier.categories.find((row) => row.category === "outcomes")!;
    expect(tuition.hasConflict).toBe(true);
    expect(tuition.claims.map((claim) => claim.value).sort()).toEqual([10000, 11000]);
    expect(outcomes.hasOutdated).toBe(true);
  });

  it("supports every permitted non-unknown final evidence status", () => {
    const statuses = [
      "verified", "corroborated", "university-reported", "conflicting", "anecdotal", "inferred", "outdated",
    ] as const;
    const result = buildResult(statuses.map((status, index) => ({
      id: `claim-${status}`,
      category: "admissions",
      property: `Property ${index}`,
      value: index,
      status,
    })));
    const dossier = composeResearchDossier(result, selectedTarget);
    expect(dossier.categories[0]?.claims.map((claim) => claim.verificationStatus).sort()).toEqual([...statuses].sort());
    expect(dossier.summary.totalClaims).toBe(7);
  });

  it("resolves explicit and implicit representative sources from candidate passages", () => {
    for (const explicit of [true, false]) {
      const seeds: ClaimSeed[] = [
        { id: "claim-multi", category: "admissions", property: "Deadline", value: "2027-01-15", status: "verified", supportingText: "The deadline is 15 January 2027." },
      ];
      const base = buildResult(seeds, {
        extraSources: [source("source-2", "https://example.edu/source-2")],
        extraDocuments: [document("document-2", "source-2", "The deadline is 15 January 2027.")],
      });
      const candidates: ClaimCandidate[] = [
        base.candidates[0]!,
        { ...base.candidates[0]!, id: "candidate-1", sourceId: "source-2", documentId: "document-2" },
      ];
      const claim = {
        ...base.claims[0]!,
        sourceId: explicit ? "source-2" : undefined,
        sourceIds: ["source-1", "source-2"],
        documentIds: ["document-1", "document-2"],
        candidateIds: ["candidate-0", "candidate-1"],
      };
      const result = researchResultSchema.parse({ ...base, candidates, claims: [claim] });
      const dossier = composeResearchDossier(result, selectedTarget);
      expect(dossier.categories[0]?.claims[0]?.representativeSourceId)
        .toBe(explicit ? "source-2" : "source-1");
      expect(dossier.categories[0]?.claims[0]?.sourceIds).toEqual(["source-1", "source-2"]);
    }
  });

  it("fails closed on invalid source, candidate, and explanation invariants", () => {
    const valid = buildResult([
      { id: "claim-valid", category: "admissions", property: "Deadline", value: "2027-01-15", status: "verified" },
    ]);
    expect(() => composeResearchDossier({ ...valid, claims: [] }, selectedTarget)).toThrow();
    const missingCandidate = structuredClone(valid);
    missingCandidate.candidates = [];
    expect(() => composeResearchDossier(missingCandidate as ResearchResult, selectedTarget)).toThrow();
    const badExplanation = structuredClone(valid);
    badExplanation.explanations = [{
      ...badExplanation.explanations[0]!,
      referencedClaimIds: ["claim-missing"],
    }];
    expect(() => composeResearchDossier(badExplanation as ResearchResult, selectedTarget)).toThrow();
  });

  it("fails closed when a valid result belongs to a different catalog target", () => {
    const base = buildResult([
      { id: "claim-target", category: "admissions", property: "Deadline", value: "2027-01-15", status: "verified" },
    ]);
    const otherUniversity = researchCatalog.universities.find((item) => item.id === "university-stanford")!;
    const otherProgram = researchCatalog.programs.find((item) => item.id === "program-stanford-computer-science-bs")!;
    const result = researchResultSchema.parse({
      ...base,
      candidates: base.candidates.map((candidate) => ({
        ...candidate,
        universityId: otherUniversity.id,
        programId: otherProgram.id,
      })),
      claims: base.claims.map((claim) => ({
        ...claim,
        universityId: otherUniversity.id,
        programId: otherProgram.id,
      })),
    });

    expect(() => composeResearchDossier(result, selectedTarget)).toThrow("selected university");
    expect(() => composeResearchDossier(base, { university })).toThrow("program-scoped");
  });

  it("uses catalog official links and minimizes serialized evidence data", () => {
    const dossier = composeResearchDossier(buildResult([
      { id: "claim-safe", category: "admissions", property: "Requirement", value: "<script>alert('x')</script>", status: "verified", supportingText: "<img onerror=\"alert(1)\"> exact passage" },
    ]), selectedTarget);
    const serialized = JSON.stringify(dossier);
    expect(dossier.target.university.websiteUrl).toBe(university.websiteUrl);
    expect(dossier.target.program?.officialUrl).toBe(program.officialUrl);
    expect(serialized).toContain("<script>alert('x')</script>");
    for (const leaked of [
      "providerAttempts", "documents", "candidateSources", "candidates", "candidateIds", "documentIds",
      "discoveryQueryId", "discoveryProvider", "internal-model-do-not-expose", "query-internal-do-not-expose",
      "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY",
      "raw internal failure secret-path",
    ]) {
      expect(serialized).not.toContain(leaked);
    }
    expect(dossier.sources.map((item) => item.id)).toEqual(["source-1"]);
  });

  it("preserves contract-valid long Unicode without truncation", () => {
    const property = "p".repeat(200);
    const value = "𝄞".repeat(250);
    const supportingText = "é".repeat(2000);
    const dossier = composeResearchDossier(buildResult([
      { id: "claim-long", category: "admissions", property, value, status: "verified", supportingText },
    ]), selectedTarget);
    expect(dossier.categories[0]?.claims[0]).toMatchObject({ property, value, supportingText });
  });
});
