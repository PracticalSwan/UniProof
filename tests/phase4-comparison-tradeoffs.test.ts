import { describe, expect, it } from "vitest";

import { comparisonSubmissionSchema, freezeComparisonSubmission } from "@/lib/comparison/contracts";
import { scoreComparison } from "@/lib/comparison/scoring";
import { buildComparisonTradeoffs } from "@/lib/comparison/tradeoffs";
import { makeComparisonDossier } from "@/tests/fixtures/comparison-dossiers";

const targetA = { universityId: "university-mit", programId: "program-mit-artificial-intelligence-decision-making-bs" } as const;
const targetB = { universityId: "university-stanford", programId: "program-stanford-computer-science-bs" } as const;

function submission() {
  return freezeComparisonSubmission(comparisonSubmissionSchema.parse({
    targets: [targetA, targetB],
    categories: ["tuition", "scholarships", "research", "outcomes", "support"],
    weights: { affordability: 30, research: 30, scholarships: 20, outcomes: 20, support: 0 },
    showRankingEvidence: false,
    showAnecdotalEvidence: false,
  }));
}

function normalDossiers() {
  const categories = ["tuition", "scholarships", "research", "outcomes", "support"] as const;
  return [
    makeComparisonDossier({
      ...targetA,
      categories,
      claims: [
        { id: "a-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
        { id: "a-research", category: "research", property: "research opportunity available", value: true },
        { id: "a-scholarship", category: "scholarships", property: "scholarship available", value: true },
        { id: "a-outcomes", category: "outcomes", property: "employment rate", value: 90, unit: "%", academicYear: "2027-28" },
      ],
    }),
    makeComparisonDossier({
      ...targetB,
      categories,
      claims: [
        { id: "b-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
        { id: "b-research", category: "research", property: "research opportunity available", value: false },
        { id: "b-scholarship", category: "scholarships", property: "scholarship available", value: true },
        { id: "b-outcomes", category: "outcomes", property: "employment rate", value: 80, unit: "%", academicYear: "2027-28" },
      ],
    }),
  ] as const;
}

describe("Phase 4 deterministic trade-offs", () => {
  it("attaches exact claim references to factual relative and tie statements", () => {
    const s = submission();
    const dossiers = normalDossiers();
    const tradeoffs = buildComparisonTradeoffs(scoreComparison(s, dossiers), dossiers, s);

    const factual = tradeoffs.filter((item) => item.kind === "relative" || item.kind === "tie");
    expect(factual.length).toBeGreaterThan(0);
    for (const item of factual) {
      expect(item.evidenceRefs.length).toBeGreaterThan(0);
      expect("claimIds" in item).toBe(false);
      for (const targetKey of item.targetKeys) {
        const dossier = dossiers.find((candidate) => `${candidate.target.university.id}::${candidate.target.program?.id ?? ""}` === targetKey);
        expect(dossier).toBeDefined();
      }
      for (const reference of item.evidenceRefs) {
        const dossier = dossiers.find((candidate) => `${candidate.target.university.id}::${candidate.target.program?.id ?? ""}` === reference.targetKey);
        expect(dossier?.categories.some((row) => row.claims.some((claim) => claim.id === reference.claimId))).toBe(true);
      }
    }
  });

  it("keeps exact target-scoped evidence references when claim IDs collide across dossiers", () => {
    const s = submission();
    const categories = ["tuition", "scholarships", "research", "outcomes", "support"] as const;
    const dossiers = [
      makeComparisonDossier({
        ...targetA,
        categories,
        claims: [{ id: "shared-tuition", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" }],
      }),
      makeComparisonDossier({
        ...targetB,
        categories,
        claims: [{ id: "shared-tuition", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" }],
      }),
    ] as const;

    const tradeoff = buildComparisonTradeoffs(scoreComparison(s, dossiers), dossiers, s)
      .find((item) => item.dimension === "affordability" && item.kind === "relative");
    expect(tradeoff).toBeDefined();
    expect(tradeoff?.evidenceRefs).toEqual([
      { targetKey: `${targetA.universityId}::${targetA.programId}`, claimId: "shared-tuition" },
      { targetKey: `${targetB.universityId}::${targetB.programId}`, claimId: "shared-tuition" },
    ]);
  });

  it("uses deterministic safe language and deterministic order", () => {
    const s = submission();
    const dossiers = normalDossiers();
    const first = buildComparisonTradeoffs(scoreComparison(s, dossiers), dossiers, s);
    const second = buildComparisonTradeoffs(scoreComparison(s, dossiers), dossiers, s);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.map((item) => item.dimension)).toEqual([
      "affordability",
      "research",
      "scholarships",
      "outcomes",
    ]);
    const text = first.map((item) => item.summary).join(" ").toLowerCase();
    for (const forbidden of [
      "best university",
      "top university",
      "prestige",
      "admission chance",
      "admission probability",
      "guaranteed",
      "recommended because",
      "better school",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("projects every stable gap reason into explicit deterministic text without fake claim references", () => {
    const s = submission();
    const reasons = [
      "category-not-researched",
      "category-unknown",
      "category-incomplete",
      "no-eligible-metric",
      "unsupported-value-type",
      "conflicting",
      "outdated",
      "inferred-only",
      "anecdotal-only",
      "ranking-only",
      "duplicate-inconsistent-values",
      "currency-mismatch",
      "unit-mismatch",
      "period-mismatch",
      "insufficient-peers",
    ] as const;

    for (const reason of reasons) {
      const fakeScore = {
        submission: s,
        targets: [
          {
            target: targetA,
            dossier: null,
            dimensions: {
              affordability: { state: "unscored", reason, claimIds: [] },
              research: { state: "unscored", reason: "category-not-researched", claimIds: [] },
              scholarships: { state: "unscored", reason: "category-not-researched", claimIds: [] },
              outcomes: { state: "unscored", reason: "category-not-researched", claimIds: [] },
              support: { state: "unscored", reason: "category-not-researched", claimIds: [] },
            },
            evidenceCoverage: 0,
            fitScore: null,
            fitSuppressed: true,
          },
          {
            target: targetB,
            dossier: null,
            dimensions: {
              affordability: { state: "unscored", reason, claimIds: [] },
              research: { state: "unscored", reason: "category-not-researched", claimIds: [] },
              scholarships: { state: "unscored", reason: "category-not-researched", claimIds: [] },
              outcomes: { state: "unscored", reason: "category-not-researched", claimIds: [] },
              support: { state: "unscored", reason: "category-not-researched", claimIds: [] },
            },
            evidenceCoverage: 0,
            fitScore: null,
            fitSuppressed: true,
          },
        ],
      } as const;
      const rows = buildComparisonTradeoffs(fakeScore, [], s).filter((item) => item.dimension === "affordability");
      expect(rows).toHaveLength(2);
      expect(rows.every((item) => item.kind === "gap" || item.kind === "warning")).toBe(true);
      expect(rows.every((item) => item.summary.trim().length > 0)).toBe(true);
      expect(rows.every((item) => item.evidenceRefs.length === 0)).toBe(true);
      expect(rows.every((item) => !("claimIds" in item))).toBe(true);
    }
  });
});
