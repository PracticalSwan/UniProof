import { describe, expect, it } from "vitest";

import {
  lookupComparisonMetric,
  normalizeComparisonPropertyKey,
} from "@/lib/comparison/metric-registry";
import { scoreComparison } from "@/lib/comparison/scoring";
import {
  comparisonSubmissionSchema,
  freezeComparisonSubmission,
  type ComparisonPriorityWeights,
  type ComparisonSubmission,
  type ComparisonTarget,
} from "@/lib/comparison/contracts";
import { makeComparisonDossier, type ComparisonFixtureClaim } from "@/tests/fixtures/comparison-dossiers";
import { researchDossierSchema, type ResearchDossier, type ResearchModeCategory } from "@/lib/research/mode/public-contracts";

const targetA = { universityId: "university-mit", programId: "program-mit-artificial-intelligence-decision-making-bs" } as const;
const targetB = { universityId: "university-stanford", programId: "program-stanford-computer-science-bs" } as const;
const targetC = { universityId: "university-georgia-tech", programId: "program-georgia-tech-computer-science-bs" } as const;

const defaultWeights: ComparisonPriorityWeights = {
  affordability: 30,
  research: 30,
  scholarships: 20,
  outcomes: 20,
  support: 0,
};

function submission(options: {
  targets?: readonly ComparisonTarget[];
  categories?: readonly ResearchModeCategory[];
  weights?: ComparisonPriorityWeights;
  intake?: string;
  academicYear?: string;
} = {}): ComparisonSubmission {
  const parsed = comparisonSubmissionSchema.parse({
    targets: options.targets ?? [targetA, targetB],
    categories: options.categories ?? ["tuition", "scholarships", "research", "outcomes", "support"],
    weights: options.weights ?? defaultWeights,
    showRankingEvidence: false,
    showAnecdotalEvidence: false,
    ...(options.intake === undefined ? {} : { intake: options.intake }),
    ...(options.academicYear === undefined ? {} : { academicYear: options.academicYear }),
  });
  return freezeComparisonSubmission(parsed);
}

function dossier(target: ComparisonTarget, claims: readonly ComparisonFixtureClaim[], options: {
  categories?: readonly ResearchModeCategory[];
  states?: Parameters<typeof makeComparisonDossier>[0]["states"];
} = {}): ResearchDossier {
  return makeComparisonDossier({
    ...target,
    categories: options.categories ?? ["tuition", "scholarships", "research", "outcomes", "support"],
    claims,
    states: options.states,
  });
}

function tuition(id: string, value: string | number, options: Partial<ComparisonFixtureClaim> = {}): ComparisonFixtureClaim {
  return {
    id,
    category: "tuition",
    property: "annual tuition",
    value,
    currency: "USD",
    academicYear: "2027-28",
    ...options,
  };
}

function scored(result: ReturnType<typeof scoreComparison>, targetIndex: number, dimension: keyof typeof defaultWeights) {
  return result.targets[targetIndex]!.dimensions[dimension];
}

describe("Phase 4 closed comparison metric registry", () => {
  it("normalizes only the documented cosmetic property-key differences", () => {
    expect(normalizeComparisonPropertyKey("  Annual_Tuition:  Fee  ")).toBe("annual tuition fee");
    expect(normalizeComparisonPropertyKey("ANNUAL-TUITION")).toBe("annual tuition");
    expect(normalizeComparisonPropertyKey("A\u0301nnual Tuition")).toBe("ánnual tuition");
    expect(lookupComparisonMetric("annual tuition")?.id).toBe("annual-tuition");
    expect(lookupComparisonMetric("tuition per year")?.id).toBe("annual-tuition");
    expect(lookupComparisonMetric("tuition fee")).toBeUndefined();
    expect(lookupComparisonMetric("annual tuition fee!")).toBeUndefined();
    expect(lookupComparisonMetric("annual–tuition")).toBeUndefined();
    expect(lookupComparisonMetric("graduate employment percentage")).toBeUndefined();
  });
});

describe("Phase 4 deterministic scoring", () => {
  it("scores lower-is-better tuition and higher-is-better employment within compatible peers", () => {
    const a = dossier(targetA, [
      tuition("a-tuition", 10_000),
      { id: "a-outcome", category: "outcomes", property: "employment rate", value: 80, unit: "%", academicYear: "2027-28" },
    ]);
    const b = dossier(targetB, [
      tuition("b-tuition", 20_000),
      { id: "b-outcome", category: "outcomes", property: "graduate employment rate", value: 90, unit: "percent", academicYear: "2027-28" },
    ]);
    const result = scoreComparison(submission(), [a, b]);

    expect(scored(result, 0, "affordability")).toMatchObject({ state: "scored", score: 100, metricId: "annual-tuition" });
    expect(scored(result, 1, "affordability")).toMatchObject({ state: "scored", score: 0, metricId: "annual-tuition" });
    const publishedFact = scored(result, 0, "affordability");
    expect(publishedFact.state).toBe("scored");
    if (publishedFact.state === "scored") {
      expect(Object.keys(publishedFact.fact).sort()).toEqual([
        "academicYear",
        "claimIds",
        "currency",
        "metricId",
        "sourceIds",
        "value",
      ]);
    }
    expect(scored(result, 0, "outcomes")).toMatchObject({ state: "scored", score: 0, metricId: "employment-rate" });
    expect(scored(result, 1, "outcomes")).toMatchObject({ state: "scored", score: 100, metricId: "employment-rate" });
  });

  it("scores equal compatible numeric values as 100 for every participant", () => {
    const result = scoreComparison(submission(), [
      dossier(targetA, [tuition("a", 10_000)]),
      dossier(targetB, [tuition("b", 10_000)]),
    ]);
    expect(scored(result, 0, "affordability")).toMatchObject({ state: "scored", score: 100 });
    expect(scored(result, 1, "affordability")).toMatchObject({ state: "scored", score: 100 });
  });

  it("never parses numeric-looking strings or unsupported value/unit/range shapes", () => {
    const cases: ComparisonFixtureClaim[] = [
      tuition("string-tuition", "10000"),
      { id: "string-rate", category: "outcomes", property: "employment rate", value: "95%", unit: "%" },
      { id: "bad-rate-unit", category: "outcomes", property: "employment rate", value: 95, unit: "ratio" },
      { id: "bad-rate-range", category: "outcomes", property: "employment rate", value: 101, unit: "%" },
      { id: "bad-scholarship", category: "scholarships", property: "scholarship available", value: "yes" },
    ];
    for (const claim of cases) {
      const dimension = claim.category === "tuition"
        ? "affordability"
        : claim.category === "outcomes"
          ? "outcomes"
          : "scholarships";
      const categories = [claim.category] as ResearchModeCategory[];
      const weights = { affordability: 0, research: 0, scholarships: 0, outcomes: 0, support: 0, [dimension]: 100 } as ComparisonPriorityWeights;
      const result = scoreComparison(
        submission({ categories, weights }),
        [
          dossier(targetA, [claim], { categories }),
          dossier(targetB, [], { categories, states: { [claim.category]: "unknown" } }),
        ],
      );
      expect(scored(result, 0, dimension)).toMatchObject({ state: "unscored", reason: "unsupported-value-type" });
    }
  });

  it("uses explicit absolute boolean/presence rules and boolean scholarship availability precedence", () => {
    const categories: ResearchModeCategory[] = ["scholarships", "research", "support"];
    const weights: ComparisonPriorityWeights = { affordability: 0, research: 40, scholarships: 40, outcomes: 0, support: 20 };
    const result = scoreComparison(submission({ categories, weights }), [
      dossier(targetA, [
        { id: "a-scholarship-false", category: "scholarships", property: "scholarship available", value: false },
        { id: "a-scholarship-name", category: "scholarships", property: "scholarship name", value: "Named award" },
        { id: "a-research", category: "research", property: "thesis option available", value: true },
        { id: "a-support", category: "support", property: "international office available", value: false },
      ], { categories }),
      dossier(targetB, [
        { id: "b-scholarship", category: "scholarships", property: "funding opportunity", value: "Published award" },
        { id: "b-research", category: "research", property: "research opportunity available", value: false },
        { id: "b-support", category: "support", property: "international student services available", value: true },
      ], { categories }),
    ]);
    expect(scored(result, 0, "scholarships")).toMatchObject({ state: "scored", score: 0, metricId: "scholarship-availability" });
    expect(scored(result, 1, "scholarships")).toMatchObject({ state: "scored", score: 100, metricId: "scholarship-presence" });
    expect(scored(result, 0, "research")).toMatchObject({ state: "scored", score: 100 });
    expect(scored(result, 1, "research")).toMatchObject({ state: "scored", score: 0 });
    expect(scored(result, 0, "support")).toMatchObject({ state: "scored", score: 0 });
    expect(scored(result, 1, "support")).toMatchObject({ state: "scored", score: 100 });
  });

  it("permits only eligible evidence and an eligible non-ranking/non-anecdotal supporting source", () => {
    const categories: ResearchModeCategory[] = ["research"];
    const weights: ComparisonPriorityWeights = { affordability: 0, research: 100, scholarships: 0, outcomes: 0, support: 0 };
    const variants: Array<[Partial<ComparisonFixtureClaim>, string]> = [
      [{ verificationStatus: "conflicting" }, "conflicting"],
      [{ verificationStatus: "outdated" }, "outdated"],
      [{ verificationStatus: "inferred" }, "inferred-only"],
      [{ verificationStatus: "anecdotal" }, "anecdotal-only"],
      [{ sourceTypes: ["ranking"] }, "ranking-only"],
      [{ sourceTypes: ["anecdotal"] }, "anecdotal-only"],
    ];
    for (const [overrides, reason] of variants) {
      const result = scoreComparison(submission({ categories, weights }), [
        dossier(targetA, [{ id: `a-${reason}`, category: "research", property: "research opportunity available", value: true, ...overrides }], { categories }),
        dossier(targetB, [{ id: `b-${reason}`, category: "research", property: "research opportunity available", value: true, ...overrides }], { categories }),
      ]);
      expect(scored(result, 0, "research")).toMatchObject({ state: "unscored", reason });
    }

    const mixedSources = scoreComparison(submission({ categories, weights }), [
      dossier(targetA, [{ id: "mixed-a", category: "research", property: "research opportunity available", value: true, sourceTypes: ["ranking", "university"] }], { categories }),
      dossier(targetB, [{ id: "mixed-b", category: "research", property: "research opportunity available", value: false, sourceTypes: ["anecdotal", "government"] }], { categories }),
    ]);
    expect(scored(mixedSources, 0, "research")).toMatchObject({ state: "scored", score: 100 });
    expect(scored(mixedSources, 1, "research")).toMatchObject({ state: "scored", score: 0 });
  });

  it("collapses exact duplicate facts while failing closed on inconsistent value, currency, or unit", () => {
    const same = scoreComparison(submission(), [
      dossier(targetA, [tuition("a-1", 10_000), tuition("a-2", 10_000)]),
      dossier(targetB, [tuition("b", 20_000)]),
    ]);
    expect(scored(same, 0, "affordability")).toMatchObject({ state: "scored", claimIds: ["a-1", "a-2"] });

    const variants: Array<[ComparisonFixtureClaim[], string]> = [
      [[tuition("v1", 10_000), tuition("v2", 11_000)], "duplicate-inconsistent-values"],
      [[tuition("c1", 10_000, { currency: "USD" }), tuition("c2", 10_000, { currency: "GBP" })], "currency-mismatch"],
      [[tuition("u1", 10_000, { unit: "annual" }), tuition("u2", 10_000, { unit: "year" })], "unit-mismatch"],
    ];
    for (const [claims, reason] of variants) {
      const result = scoreComparison(submission(), [
        dossier(targetA, claims),
        dossier(targetB, [tuition("peer", 20_000)]),
      ]);
      expect(scored(result, 0, "affordability")).toMatchObject({ state: "unscored", reason });
    }
  });

  it("requires explicit compatible periods for numeric metrics and never uses retrieval time", () => {
    const requested = scoreComparison(submission({ academicYear: "2027-28" }), [
      dossier(targetA, [tuition("a", 10_000, { academicYear: "2026-27" })]),
      dossier(targetB, [tuition("b", 20_000, { academicYear: "2027-28" })]),
    ]);
    expect(scored(requested, 0, "affordability")).toMatchObject({ state: "unscored", reason: "period-mismatch" });

    const noPeriod = scoreComparison(submission(), [
      dossier(targetA, [tuition("a-no-period", 10_000, { academicYear: undefined })]),
      dossier(targetB, [tuition("b-no-period", 20_000, { academicYear: undefined })]),
    ]);
    expect(scored(noPeriod, 0, "affordability")).toMatchObject({ state: "unscored", reason: "period-mismatch" });
    expect(scored(noPeriod, 1, "affordability")).toMatchObject({ state: "unscored", reason: "period-mismatch" });

    const sharedDate = scoreComparison(submission(), [
      dossier(targetA, [tuition("a-date", 10_000, { academicYear: undefined, effectiveDate: "2027-01-01" })]),
      dossier(targetB, [tuition("b-date", 20_000, { academicYear: undefined, effectiveDate: "2027-01-01" })]),
    ]);
    expect(scored(sharedDate, 0, "affordability")).toMatchObject({ state: "scored", score: 100 });
  });

  it("reports cross-target currency/unit/period incompatibility instead of conversion or guessing", () => {
    const currency = scoreComparison(submission(), [
      dossier(targetA, [tuition("a", 10_000, { currency: "USD" })]),
      dossier(targetB, [tuition("b", 8_000, { currency: "GBP" })]),
    ]);
    expect(scored(currency, 0, "affordability")).toMatchObject({ state: "unscored", reason: "currency-mismatch" });
    expect(scored(currency, 1, "affordability")).toMatchObject({ state: "unscored", reason: "currency-mismatch" });

    const period = scoreComparison(submission(), [
      dossier(targetA, [tuition("a-period", 10_000, { academicYear: "2027-28" })]),
      dossier(targetB, [tuition("b-period", 20_000, { academicYear: "2028-29" })]),
    ]);
    expect(scored(period, 0, "affordability")).toMatchObject({ state: "unscored", reason: "period-mismatch" });
    expect(scored(period, 1, "affordability")).toMatchObject({ state: "unscored", reason: "period-mismatch" });
  });

  it("requires two compatible peers for relative numeric metrics but not absolute metrics", () => {
    const result = scoreComparison(submission(), [
      dossier(targetA, [tuition("a", 10_000), { id: "r-a", category: "research", property: "research opportunity available", value: true }]),
      dossier(targetB, [{ id: "r-b", category: "research", property: "research opportunity available", value: false }], { states: { tuition: "unknown" } }),
    ]);
    expect(scored(result, 0, "affordability")).toMatchObject({ state: "unscored", reason: "insufficient-peers" });
    expect(scored(result, 1, "affordability")).toMatchObject({ state: "unscored", reason: "category-unknown" });
    expect(scored(result, 0, "research")).toMatchObject({ state: "scored", score: 100 });
    expect(scored(result, 1, "research")).toMatchObject({ state: "scored", score: 0 });
  });

  it("distinguishes category not researched, unknown, incomplete, and no eligible metric", () => {
    const categories: ResearchModeCategory[] = ["research", "support"];
    const weights: ComparisonPriorityWeights = { affordability: 0, research: 100, scholarships: 0, outcomes: 0, support: 0 };
    const result = scoreComparison(submission({ categories, weights }), [
      dossier(targetA, [], { categories, states: { research: "unknown", support: "unknown" } }),
      dossier(targetB, [{ id: "other", category: "research", property: "research center count", value: 8 }], { categories, states: { support: "incomplete" } }),
    ]);
    expect(scored(result, 0, "research")).toMatchObject({ state: "unscored", reason: "category-unknown" });
    expect(scored(result, 1, "research")).toMatchObject({ state: "unscored", reason: "no-eligible-metric" });
    expect(scored(result, 0, "affordability")).toMatchObject({ state: "unscored", reason: "category-not-researched" });
    expect(scored(result, 1, "support")).toMatchObject({ state: "unscored", reason: "category-incomplete" });
  });

  it("treats source-gap claims as unscored rather than definitive comparison evidence", () => {
    const categories: ResearchModeCategory[] = ["tuition"];
    const weights: ComparisonPriorityWeights = { affordability: 100, research: 0, scholarships: 0, outcomes: 0, support: 0 };
    const base = dossier(targetA, [tuition("a-gap", 10_000)], { categories });
    const withGap = researchDossierSchema.parse({
      ...base,
      categories: base.categories.map((row) => row.state === "ready"
        ? {
            ...row,
            sourceGap: {
              code: "provider-budget",
              message: "The bounded AI work budget was exhausted before this category completed.",
            },
          }
        : row),
    });
    const result = scoreComparison(submission({ categories, weights }), [
      withGap,
      dossier(targetB, [tuition("b", 20_000)], { categories }),
    ]);

    expect(scored(result, 0, "affordability")).toMatchObject({ state: "unscored", reason: "category-incomplete" });
    expect(scored(result, 1, "affordability")).toMatchObject({ state: "unscored", reason: "insufficient-peers" });
  });

  it("computes weighted evidence coverage and suppresses sparse fit at both boundaries", () => {
    const twoDimensions = scoreComparison(submission(), [
      dossier(targetA, [
        tuition("a", 10_000),
        { id: "a-r", category: "research", property: "research opportunity available", value: true },
      ]),
      dossier(targetB, [
        tuition("b", 20_000),
        { id: "b-r", category: "research", property: "research opportunity available", value: false },
      ]),
    ]);
    expect(twoDimensions.targets[0]).toMatchObject({ evidenceCoverage: 60, fitSuppressed: false });
    expect(twoDimensions.targets[0]!.fitScore).toBe(100);
    expect(twoDimensions.targets[1]!.fitScore).toBe(0);

    const oneDimension = scoreComparison(submission(), [
      dossier(targetA, [tuition("a-only", 10_000)]),
      dossier(targetB, [tuition("b-only", 20_000)]),
    ]);
    expect(oneDimension.targets[0]).toMatchObject({ evidenceCoverage: 30, fitScore: null, fitSuppressed: true });

    const fiftyWeights: ComparisonPriorityWeights = { affordability: 30, research: 0, scholarships: 20, outcomes: 50, support: 0 };
    const atFifty = scoreComparison(submission({ weights: fiftyWeights }), [
      dossier(targetA, [tuition("a50", 10_000), { id: "a-s50", category: "scholarships", property: "scholarship available", value: true }]),
      dossier(targetB, [tuition("b50", 20_000), { id: "b-s50", category: "scholarships", property: "scholarship available", value: true }]),
    ]);
    expect(atFifty.targets[0]).toMatchObject({ evidenceCoverage: 50, fitSuppressed: false });

    const fortyNineWeights: ComparisonPriorityWeights = { affordability: 29, research: 0, scholarships: 20, outcomes: 51, support: 0 };
    const below = scoreComparison(submission({ weights: fortyNineWeights }), [
      dossier(targetA, [tuition("a49", 10_000), { id: "a-s49", category: "scholarships", property: "scholarship available", value: true }]),
      dossier(targetB, [tuition("b49", 20_000), { id: "b-s49", category: "scholarships", property: "scholarship available", value: true }]),
    ]);
    expect(below.targets[0]).toMatchObject({ evidenceCoverage: 49, fitScore: null, fitSuppressed: true });
  });

  it("normalizes relative weights for coverage and fit while remaining scale-invariant", () => {
    const relativeWeights: ComparisonPriorityWeights = {
      affordability: 100,
      research: 50,
      scholarships: 50,
      outcomes: 0,
      support: 0,
    };
    const relative = scoreComparison(submission({ weights: relativeWeights }), [
      dossier(targetA, [
        tuition("relative-a", 10_000),
        { id: "relative-a-r", category: "research", property: "research opportunity available", value: true },
      ]),
      dossier(targetB, [
        tuition("relative-b", 20_000),
        { id: "relative-b-r", category: "research", property: "research opportunity available", value: false },
      ]),
    ]);
    expect(relative.targets[0]!.evidenceCoverage).toBe(75);
    expect(relative.targets[0]!.fitScore).toBe(100);
    expect(relative.targets[1]!.fitScore).toBe(0);

    const baseline = scoreComparison(submission(), [
      dossier(targetA, [
        tuition("scale-a", 10_000),
        { id: "scale-a-r", category: "research", property: "research opportunity available", value: true },
      ]),
      dossier(targetB, [
        tuition("scale-b", 20_000),
        { id: "scale-b-r", category: "research", property: "research opportunity available", value: false },
      ]),
    ]);
    const doubled = scoreComparison(submission({
      weights: { affordability: 60, research: 60, scholarships: 40, outcomes: 40, support: 0 },
    }), [
      dossier(targetA, [
        tuition("scale-a", 10_000),
        { id: "scale-a-r", category: "research", property: "research opportunity available", value: true },
      ]),
      dossier(targetB, [
        tuition("scale-b", 20_000),
        { id: "scale-b-r", category: "research", property: "research opportunity available", value: false },
      ]),
    ]);
    expect(doubled.targets.map(({ evidenceCoverage, fitScore, fitSuppressed }) => ({ evidenceCoverage, fitScore, fitSuppressed })))
      .toEqual(baseline.targets.map(({ evidenceCoverage, fitScore, fitSuppressed }) => ({ evidenceCoverage, fitScore, fitSuppressed })));
  });

  it("uses unrounded normalized coverage at the 50 percent suppression boundary", () => {
    const weights: ComparisonPriorityWeights = { affordability: 1, research: 1, scholarships: 1, outcomes: 1, support: 1 };
    const result = scoreComparison(submission({ weights }), [
      dossier(targetA, [
        tuition("equal-a", 10_000),
        { id: "equal-a-r", category: "research", property: "research opportunity available", value: true },
        { id: "equal-a-s", category: "scholarships", property: "scholarship available", value: true },
      ]),
      dossier(targetB, [
        tuition("equal-b", 20_000),
        { id: "equal-b-r", category: "research", property: "research opportunity available", value: false },
        { id: "equal-b-s", category: "scholarships", property: "scholarship available", value: true },
      ]),
    ]);
    expect(result.targets[0]!.evidenceCoverage).toBeCloseTo(60, 10);
    expect(result.targets[0]!.fitSuppressed).toBe(false);
  });

  it("preserves immutable submission target order and never sorts by score", () => {
    const ordered = submission({ targets: [targetB, targetA, targetC] });
    const result = scoreComparison(ordered, [
      dossier(targetC, [tuition("c", 15_000)]),
      dossier(targetA, [tuition("a", 10_000)]),
      dossier(targetB, [tuition("b", 20_000)]),
    ]);
    expect(result.targets.map((item) => item.target)).toEqual([targetB, targetA, targetC]);
  });

  it("is invariant to dossier input ordering", () => {
    const s = submission();
    const a = dossier(targetA, [tuition("a-order", 10_000), { id: "a-r-order", category: "research", property: "research opportunity available", value: true }]);
    const b = dossier(targetB, [tuition("b-order", 20_000), { id: "b-r-order", category: "research", property: "research opportunity available", value: false }]);
    expect(scoreComparison(s, [a, b])).toEqual(scoreComparison(s, [b, a]));
  });

  it("does not change existing peer scores when an added target has no eligible comparable metric", () => {
    const baseSubmission = submission({ targets: [targetA, targetB] });
    const a = dossier(targetA, [tuition("a-irrelevant", 10_000)]);
    const b = dossier(targetB, [tuition("b-irrelevant", 20_000)]);
    const base = scoreComparison(baseSubmission, [a, b]);

    const extendedSubmission = submission({ targets: [targetA, targetB, targetC] });
    const c = dossier(targetC, [], {
      states: {
        tuition: "unknown",
        scholarships: "unknown",
        research: "unknown",
        outcomes: "unknown",
        support: "unknown",
      },
    });
    const extended = scoreComparison(extendedSubmission, [c, b, a]);
    expect(extended.targets[0]!.dimensions.affordability).toEqual(base.targets[0]!.dimensions.affordability);
    expect(extended.targets[1]!.dimensions.affordability).toEqual(base.targets[1]!.dimensions.affordability);
  });
});
