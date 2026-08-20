import { z } from "zod";

import {
  researchDossierSchema,
  type PublicResearchClaim,
  type ResearchDossier,
} from "@/lib/research/mode/public-contracts";
import {
  comparisonPriorityCategory,
  comparisonPriorityOrder,
  comparisonSubmissionSchema,
  comparisonTargetKey,
  normalizeComparisonPriorityWeights,
  comparisonTargetSchema,
  type ComparisonPriority,
  type ComparisonSubmission,
  type ComparisonTarget,
} from "./contracts";
import {
  comparisonMetricsForDimension,
  lookupComparisonMetric,
  normalizeComparisonToken,
  type ComparisonMetricDefinition,
  type ComparisonMetricId,
} from "./metric-registry";

export const comparisonMetricIdSchema = z.enum([
  "annual-tuition",
  "scholarship-availability",
  "scholarship-presence",
  "research-opportunity-availability",
  "employment-rate",
  "international-support-availability",
]);

export const comparisonUnscoredReasonSchema = z.enum([
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
]);

export type ComparisonUnscoredReason =
  | "category-not-researched"
  | "category-unknown"
  | "category-incomplete"
  | "no-eligible-metric"
  | "unsupported-value-type"
  | "conflicting"
  | "outdated"
  | "inferred-only"
  | "anecdotal-only"
  | "ranking-only"
  | "duplicate-inconsistent-values"
  | "currency-mismatch"
  | "unit-mismatch"
  | "period-mismatch"
  | "insufficient-peers";

export type ComparisonMetricFact = Readonly<{
  metricId: ComparisonMetricId;
  value: number | boolean | string;
  claimIds: readonly string[];
  sourceIds: readonly string[];
  currency?: string;
  unit?: string;
  academicYear?: string;
  effectiveDate?: string;
  intake?: string;
}>;

export type ComparisonDimensionResult =
  | Readonly<{
      state: "scored";
      score: number;
      metricId: ComparisonMetricId;
      claimIds: readonly string[];
      fact: ComparisonMetricFact;
    }>
  | Readonly<{
      state: "unscored";
      reason: ComparisonUnscoredReason;
      claimIds: readonly string[];
    }>;

export type ComparisonTargetScore = Readonly<{
  target: ComparisonTarget;
  dossier: ResearchDossier | null;
  dimensions: Readonly<Record<ComparisonPriority, ComparisonDimensionResult>>;
  evidenceCoverage: number;
  fitScore: number | null;
  fitSuppressed: boolean;
}>;

export type ComparisonScoreResult = Readonly<{
  submission: ComparisonSubmission;
  targets: readonly ComparisonTargetScore[];
}>;

export const comparisonMetricFactSchema = z.object({
  metricId: comparisonMetricIdSchema,
  value: z.union([z.number().finite(), z.boolean(), z.string().trim().min(1).max(500)]),
  claimIds: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  sourceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  unit: z.string().trim().min(1).max(80).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
  effectiveDate: z.iso.date().optional(),
  intake: z.string().trim().min(1).max(40).optional(),
}).strict();

export const comparisonDimensionResultSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("scored"),
    score: z.number().finite().min(0).max(100),
    metricId: comparisonMetricIdSchema,
    claimIds: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    fact: comparisonMetricFactSchema,
  }).strict(),
  z.object({
    state: z.literal("unscored"),
    reason: comparisonUnscoredReasonSchema,
    claimIds: z.array(z.string().trim().min(1).max(120)).max(12),
  }).strict(),
]);

export const comparisonTargetScoreSchema = z.object({
  target: comparisonTargetSchema,
  dossier: researchDossierSchema.nullable(),
  dimensions: z.strictObject(
    Object.fromEntries(
      comparisonPriorityOrder.map((priority) => [priority, comparisonDimensionResultSchema]),
    ) as Record<ComparisonPriority, typeof comparisonDimensionResultSchema>,
  ),
  evidenceCoverage: z.number().finite().min(0).max(100),
  fitScore: z.number().finite().min(0).max(100).nullable(),
  fitSuppressed: z.boolean(),
}).strict();

export const comparisonScoreResultSchema = z.object({
  submission: comparisonSubmissionSchema,
  targets: z.array(comparisonTargetScoreSchema).min(2).max(4),
}).strict();

const scoringStatuses = new Set(["verified", "corroborated", "university-reported"] as const);

function dossierTargetKey(dossier: ResearchDossier): string {
  return comparisonTargetKey({
    universityId: dossier.target.university.id,
    ...(dossier.target.program === undefined ? {} : { programId: dossier.target.program.id }),
  });
}

function normalizeContext(value: string): string {
  return normalizeComparisonToken(value);
}

type IndexedDossier = {
  dossier: ResearchDossier;
  categories: Map<ResearchDossier["categories"][number]["category"], ResearchDossier["categories"][number]>;
  sources: Map<string, ResearchDossier["sources"][number]>;
  claimsByMetric: Map<ComparisonMetricId, PublicResearchClaim[]>;
};

function indexDossier(dossier: ResearchDossier): IndexedDossier {
  const categories = new Map(dossier.categories.map((row) => [row.category, row]));
  const sources = new Map(dossier.sources.map((source) => [source.id, source]));
  const claimsByMetric = new Map<ComparisonMetricId, PublicResearchClaim[]>();
  for (const row of dossier.categories) {
    if (row.state !== "ready" || row.sourceGap !== undefined) continue;
    for (const claim of row.claims) {
      const definition = lookupComparisonMetric(claim.property);
      if (definition === undefined || definition.category !== claim.category) continue;
      const current = claimsByMetric.get(definition.id) ?? [];
      current.push(claim);
      claimsByMetric.set(definition.id, current);
    }
  }
  return { dossier, categories, sources, claimsByMetric };
}

type CandidateFact = ComparisonMetricFact & {
  definition: ComparisonMetricDefinition;
  unitExact: string;
  unitCompatibility: string;
  currencyCompatibility: string;
  periodKey: string;
};

type PreliminaryDimension =
  | { state: "fact"; fact: CandidateFact }
  | { state: "unscored"; reason: ComparisonUnscoredReason; claimIds: readonly string[] };

function unscored(
  reason: ComparisonUnscoredReason,
  claimIds: readonly string[] = [],
): PreliminaryDimension {
  return { state: "unscored", reason, claimIds: [...claimIds] };
}

function requestedPeriodMatches(claim: PublicResearchClaim, submission: ComparisonSubmission): boolean {
  if (submission.academicYear !== undefined) {
    if (claim.academicYear === undefined || normalizeContext(claim.academicYear) !== normalizeContext(submission.academicYear)) {
      return false;
    }
  }
  if (submission.intake !== undefined) {
    if (claim.intake === undefined || normalizeContext(claim.intake) !== normalizeContext(submission.intake)) {
      return false;
    }
  }
  return true;
}

function periodKey(claim: PublicResearchClaim, submission: ComparisonSubmission): string {
  if (submission.academicYear !== undefined || submission.intake !== undefined) {
    return [
      submission.academicYear === undefined ? "" : `ay:${normalizeContext(submission.academicYear)}`,
      submission.intake === undefined ? "" : `intake:${normalizeContext(submission.intake)}`,
    ].join("|");
  }
  if (claim.academicYear !== undefined) return `ay:${normalizeContext(claim.academicYear)}`;
  if (claim.effectiveDate !== undefined) return `date:${claim.effectiveDate}`;
  return "none";
}

function candidateFromClaim(
  definition: ComparisonMetricDefinition,
  claim: PublicResearchClaim,
  submission: ComparisonSubmission,
): CandidateFact | "unsupported-value-type" | "period-mismatch" {
  if (!requestedPeriodMatches(claim, submission)) return "period-mismatch";

  const unitExact = claim.unit === undefined ? "" : normalizeComparisonToken(claim.unit);
  let unitCompatibility = "";
  let currencyCompatibility = "";

  if (definition.id === "annual-tuition") {
    if (typeof claim.value !== "number" || !Number.isFinite(claim.value)) return "unsupported-value-type";
    if (claim.currency === undefined || !/^[A-Z]{3}$/.test(claim.currency)) return "unsupported-value-type";
    if (unitExact !== "" && !new Set(["per year", "annual", "year"]).has(unitExact)) {
      return "unsupported-value-type";
    }
    unitCompatibility = "annual";
    currencyCompatibility = claim.currency;
  } else if (definition.id === "employment-rate") {
    if (
      typeof claim.value !== "number" ||
      !Number.isFinite(claim.value) ||
      claim.value < 0 ||
      claim.value > 100
    ) {
      return "unsupported-value-type";
    }
    if (!new Set(["%", "percent", "percentage"]).has(unitExact)) return "unsupported-value-type";
    unitCompatibility = "percent";
  } else if (definition.kind === "boolean") {
    if (typeof claim.value !== "boolean") return "unsupported-value-type";
  } else if (definition.kind === "presence") {
    if (typeof claim.value !== "string" || claim.value.trim() === "") return "unsupported-value-type";
  } else {
    return "unsupported-value-type";
  }

  const claimPeriodKey = periodKey(claim, submission);
  if (definition.kind === "numeric" && claimPeriodKey === "none") return "period-mismatch";

  return {
    metricId: definition.id,
    definition,
    value: claim.value,
    claimIds: [claim.id],
    sourceIds: [...claim.sourceIds],
    ...(claim.currency === undefined ? {} : { currency: claim.currency }),
    ...(claim.unit === undefined ? {} : { unit: claim.unit }),
    ...(claim.academicYear === undefined ? {} : { academicYear: claim.academicYear }),
    ...(claim.effectiveDate === undefined ? {} : { effectiveDate: claim.effectiveDate }),
    ...(claim.intake === undefined ? {} : { intake: claim.intake }),
    unitExact,
    unitCompatibility,
    currencyCompatibility,
    periodKey: claimPeriodKey,
  };
}

function sourceEligibilityReason(
  claim: PublicResearchClaim,
  indexed: IndexedDossier,
): "ranking-only" | "anecdotal-only" | undefined {
  const sources = claim.sourceIds.map((sourceId) => indexed.sources.get(sourceId));
  if (sources.some((source) => source === undefined)) return "anecdotal-only";
  if (sources.some((source) => source!.sourceType !== "ranking" && source!.sourceType !== "anecdotal")) {
    return undefined;
  }
  if (sources.every((source) => source!.sourceType === "ranking")) return "ranking-only";
  return "anecdotal-only";
}

function collapseCandidates(
  candidates: readonly CandidateFact[],
): PreliminaryDimension {
  const claimIds = candidates.flatMap((candidate) => candidate.claimIds);
  if (new Set(candidates.map((candidate) => candidate.currencyCompatibility)).size > 1) {
    return unscored("currency-mismatch", claimIds);
  }
  if (new Set(candidates.map((candidate) => candidate.unitExact)).size > 1) {
    return unscored("unit-mismatch", claimIds);
  }
  if (new Set(candidates.map((candidate) => candidate.periodKey)).size > 1) {
    return unscored("period-mismatch", claimIds);
  }
  const first = candidates[0]!;
  if (candidates.some((candidate) => !Object.is(candidate.value, first.value))) {
    return unscored("duplicate-inconsistent-values", claimIds);
  }
  const sourceIds = [...new Set(candidates.flatMap((candidate) => candidate.sourceIds))];
  return {
    state: "fact",
    fact: {
      ...first,
      claimIds,
      sourceIds,
    },
  };
}

function evaluateMetric(
  definition: ComparisonMetricDefinition,
  claims: readonly PublicResearchClaim[],
  indexed: IndexedDossier,
  submission: ComparisonSubmission,
): PreliminaryDimension {
  const claimIds = claims.map((claim) => claim.id);
  if (claims.some((claim) => claim.verificationStatus === "conflicting")) {
    return unscored("conflicting", claimIds);
  }

  const statusEligible = claims.filter((claim) => scoringStatuses.has(
    claim.verificationStatus as "verified" | "corroborated" | "university-reported",
  ));
  if (statusEligible.length === 0) {
    if (claims.some((claim) => claim.verificationStatus === "outdated")) return unscored("outdated", claimIds);
    if (claims.some((claim) => claim.verificationStatus === "inferred")) return unscored("inferred-only", claimIds);
    if (claims.some((claim) => claim.verificationStatus === "anecdotal")) return unscored("anecdotal-only", claimIds);
    return unscored("no-eligible-metric", claimIds);
  }

  const candidates: CandidateFact[] = [];
  let sawUnsupported = false;
  let sawPeriodMismatch = false;
  let sawRankingOnly = false;
  let sawAnecdotalOnly = false;
  for (const claim of statusEligible) {
    const sourceReason = sourceEligibilityReason(claim, indexed);
    if (sourceReason !== undefined) {
      if (sourceReason === "ranking-only") sawRankingOnly = true;
      else sawAnecdotalOnly = true;
      continue;
    }
    const candidate = candidateFromClaim(definition, claim, submission);
    if (candidate === "unsupported-value-type") sawUnsupported = true;
    else if (candidate === "period-mismatch") sawPeriodMismatch = true;
    else candidates.push(candidate);
  }

  if (candidates.length === 0) {
    if (sawPeriodMismatch) return unscored("period-mismatch", claimIds);
    if (sawUnsupported) return unscored("unsupported-value-type", claimIds);
    if (sawRankingOnly && !sawAnecdotalOnly) return unscored("ranking-only", claimIds);
    if (sawAnecdotalOnly) return unscored("anecdotal-only", claimIds);
    return unscored("no-eligible-metric", claimIds);
  }
  return collapseCandidates(candidates);
}

function preliminaryDimension(
  dimension: ComparisonPriority,
  indexed: IndexedDossier | undefined,
  submission: ComparisonSubmission,
): PreliminaryDimension {
  const category = comparisonPriorityCategory[dimension];
  if (!submission.categories.includes(category)) return unscored("category-not-researched");
  if (indexed === undefined) return unscored("category-incomplete");
  const row = indexed.categories.get(category);
  if (row === undefined || row.state === "incomplete") return unscored("category-incomplete");
  if (row.state === "unknown") return unscored("category-unknown");
  if (row.sourceGap !== undefined) return unscored("category-incomplete");

  for (const definition of comparisonMetricsForDimension(dimension)) {
    const claims = indexed.claimsByMetric.get(definition.id) ?? [];
    if (claims.length > 0) return evaluateMetric(definition, claims, indexed, submission);
  }
  return unscored("no-eligible-metric");
}

function publishedMetricFact(fact: CandidateFact): ComparisonMetricFact {
  return {
    metricId: fact.metricId,
    value: fact.value,
    claimIds: [...fact.claimIds],
    sourceIds: [...fact.sourceIds],
    ...(fact.currency === undefined ? {} : { currency: fact.currency }),
    ...(fact.unit === undefined ? {} : { unit: fact.unit }),
    ...(fact.academicYear === undefined ? {} : { academicYear: fact.academicYear }),
    ...(fact.effectiveDate === undefined ? {} : { effectiveDate: fact.effectiveDate }),
    ...(fact.intake === undefined ? {} : { intake: fact.intake }),
  };
}

function scoredAbsolute(fact: CandidateFact): ComparisonDimensionResult {
  const score = fact.definition.kind === "presence" ? 100 : fact.value === true ? 100 : 0;
  return {
    state: "scored",
    score,
    metricId: fact.metricId,
    claimIds: fact.claimIds,
    fact: publishedMetricFact(fact),
  };
}

function compatibilityKey(fact: CandidateFact): string {
  return JSON.stringify([
    fact.metricId,
    fact.currencyCompatibility,
    fact.unitCompatibility,
    fact.periodKey,
  ]);
}

function incompatibleNumericReason(
  fact: CandidateFact,
  facts: readonly CandidateFact[],
): ComparisonUnscoredReason {
  const others = facts.filter((candidate) => candidate !== fact && candidate.metricId === fact.metricId);
  if (others.length === 0) return "insufficient-peers";
  if (others.some((candidate) => candidate.currencyCompatibility !== fact.currencyCompatibility)) {
    return "currency-mismatch";
  }
  if (others.some((candidate) => candidate.unitCompatibility !== fact.unitCompatibility)) {
    return "unit-mismatch";
  }
  if (others.some((candidate) => candidate.periodKey !== fact.periodKey)) {
    return "period-mismatch";
  }
  return "insufficient-peers";
}

function scoreNumericGroup(facts: readonly CandidateFact[]): Map<CandidateFact, number> {
  const values = facts.map((fact) => fact.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const result = new Map<CandidateFact, number>();
  for (const fact of facts) {
    const value = fact.value as number;
    const score = max === min
      ? 100
      : fact.definition.direction === "lower"
        ? ((max - value) / (max - min)) * 100
        : ((value - min) / (max - min)) * 100;
    result.set(fact, score);
  }
  return result;
}

export function scoreComparison(
  submissionInput: ComparisonSubmission,
  dossierInputs: readonly ResearchDossier[],
): ComparisonScoreResult {
  const parsedSubmission = comparisonSubmissionSchema.safeParse(submissionInput);
  if (!parsedSubmission.success) throw new Error("Comparison scoring received an invalid submission.");
  const submission = submissionInput;
  const selectedKeys = new Set(submission.targets.map(comparisonTargetKey));
  const indexedByTarget = new Map<string, IndexedDossier>();

  for (const dossierInput of dossierInputs) {
    const parsedDossier = researchDossierSchema.safeParse(dossierInput);
    if (!parsedDossier.success) throw new Error("Comparison scoring received an invalid ResearchDossier.");
    const dossier = parsedDossier.data;
    const key = dossierTargetKey(dossier);
    if (!selectedKeys.has(key) || indexedByTarget.has(key)) {
      throw new Error("Comparison scoring received a dossier outside the immutable target selection.");
    }
    const dossierCategories = dossier.categories.map((row) => row.category);
    if (
      dossierCategories.length !== submission.categories.length ||
      dossierCategories.some((category, index) => category !== submission.categories[index])
    ) {
      throw new Error("Comparison scoring received a dossier outside the immutable category selection.");
    }
    indexedByTarget.set(key, indexDossier(dossier));
  }

  const preliminary = submission.targets.map((target) => {
    const indexed = indexedByTarget.get(comparisonTargetKey(target));
    const dimensions = Object.fromEntries(
      comparisonPriorityOrder.map((dimension) => [
        dimension,
        preliminaryDimension(dimension, indexed, submission),
      ]),
    ) as Record<ComparisonPriority, PreliminaryDimension>;
    return { target, indexed, dimensions };
  });

  const resolved = preliminary.map((item) => ({
    ...item,
    dimensions: Object.fromEntries(
      comparisonPriorityOrder.map((dimension) => {
        const current = item.dimensions[dimension];
        if (current.state === "unscored") {
          return [dimension, {
            state: "unscored",
            reason: current.reason,
            claimIds: current.claimIds,
          } satisfies ComparisonDimensionResult];
        }
        if (current.fact.definition.kind !== "numeric") {
          return [dimension, scoredAbsolute(current.fact)];
        }
        return [dimension, current];
      }),
    ) as Record<ComparisonPriority, ComparisonDimensionResult | PreliminaryDimension>,
  }));

  for (const dimension of comparisonPriorityOrder) {
    const facts = preliminary
      .map((item) => item.dimensions[dimension])
      .filter((current): current is Extract<PreliminaryDimension, { state: "fact" }> =>
        current.state === "fact" && current.fact.definition.kind === "numeric"
      )
      .map((current) => current.fact);
    if (facts.length === 0) continue;

    const groups = new Map<string, CandidateFact[]>();
    for (const fact of facts) {
      const key = compatibilityKey(fact);
      const group = groups.get(key) ?? [];
      group.push(fact);
      groups.set(key, group);
    }
    const scores = new Map<CandidateFact, number>();
    for (const group of groups.values()) {
      if (group.length >= 2) {
        for (const [fact, score] of scoreNumericGroup(group)) scores.set(fact, score);
      }
    }

    for (const item of resolved) {
      const current = item.dimensions[dimension];
      if (current.state !== "fact") continue;
      const score = scores.get(current.fact);
      item.dimensions[dimension] = score === undefined
        ? {
            state: "unscored",
            reason: incompatibleNumericReason(current.fact, facts),
            claimIds: current.fact.claimIds,
          }
        : {
            state: "scored",
            score,
            metricId: current.fact.metricId,
            claimIds: current.fact.claimIds,
            fact: publishedMetricFact(current.fact),
          };
    }
  }

  const normalizedWeights = normalizeComparisonPriorityWeights(submission.weights);
  const targets: ComparisonTargetScore[] = resolved.map((item) => {
    const dimensions = item.dimensions as Record<ComparisonPriority, ComparisonDimensionResult>;
    const scoredPositive = comparisonPriorityOrder.filter(
      (dimension) => normalizedWeights[dimension] > 0 && dimensions[dimension].state === "scored",
    );
    const availableWeight = scoredPositive.reduce((sum, dimension) => sum + normalizedWeights[dimension], 0);
    const evidenceCoverage = Math.min(100, availableWeight * 100);
    let fitScore: number | null = null;
    if (scoredPositive.length >= 2 && evidenceCoverage >= 50 && availableWeight > 0) {
      const weightedTotal = scoredPositive.reduce((sum, dimension) => {
        const result = dimensions[dimension];
        return result.state === "scored"
          ? sum + result.score * normalizedWeights[dimension]
          : sum;
      }, 0);
      fitScore = weightedTotal / availableWeight;
    }
    return {
      target: { ...item.target },
      dossier: item.indexed?.dossier ?? null,
      dimensions,
      evidenceCoverage,
      fitScore,
      fitSuppressed: fitScore === null,
    };
  });

  return { submission, targets };
}
