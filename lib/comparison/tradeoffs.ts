import { z } from "zod";

import type { ResearchDossier } from "@/lib/research/mode/public-contracts";
import {
  comparisonPrioritySchema,
  comparisonPriorityCategory,
  comparisonPriorityOrder,
  comparisonTargetKey,
  type ComparisonPriority,
  type ComparisonSubmission,
} from "./contracts";
import type {
  ComparisonScoreResult,
  ComparisonUnscoredReason,
} from "./scoring";

export const comparisonTradeoffEvidenceRefSchema = z.object({
  targetKey: z.string().trim().min(1).max(245),
  claimId: z.string().trim().min(1).max(120),
}).strict();

export type ComparisonTradeoffEvidenceRef = Readonly<{
  targetKey: string;
  claimId: string;
}>;

export type ComparisonTradeoff = Readonly<{
  id: string;
  dimension: ComparisonPriority;
  kind: "relative" | "tie" | "gap" | "warning";
  summary: string;
  targetKeys: readonly string[];
  evidenceRefs: readonly ComparisonTradeoffEvidenceRef[];
}>;

export const comparisonTradeoffSchema = z.object({
  id: z.string().trim().min(1).max(200),
  dimension: comparisonPrioritySchema,
  kind: z.enum(["relative", "tie", "gap", "warning"]),
  summary: z.string().trim().min(1).max(600),
  targetKeys: z.array(z.string().trim().min(1).max(245)).min(1).max(4),
  evidenceRefs: z.array(comparisonTradeoffEvidenceRefSchema).max(24),
}).strict();

const dimensionLabels: Record<ComparisonPriority, string> = {
  affordability: "Affordability",
  research: "Research",
  scholarships: "Scholarships",
  outcomes: "Outcomes",
  support: "Support",
};

const warningReasons = new Set<ComparisonUnscoredReason>([
  "conflicting",
  "outdated",
  "inferred-only",
  "anecdotal-only",
  "ranking-only",
  "duplicate-inconsistent-values",
  "currency-mismatch",
  "unit-mismatch",
  "period-mismatch",
]);

const reasonText: Record<ComparisonUnscoredReason, string> = {
  "category-not-researched": "the backing Research category was not included",
  "category-unknown": "the researched category has no reliable established claim",
  "category-incomplete": "research for the backing category did not complete",
  "no-eligible-metric": "no claim matches the closed score metric with eligible evidence",
  "unsupported-value-type": "the matching claim uses a value, unit, currency, or range that cannot be scored safely",
  conflicting: "the evidence is conflicting and no winner is selected",
  outdated: "the matching evidence is outdated",
  "inferred-only": "only inferred evidence is available",
  "anecdotal-only": "only anecdotal evidence is available for scoring",
  "ranking-only": "only ranking-derived supporting evidence is available for scoring",
  "duplicate-inconsistent-values": "multiple eligible claims contain inconsistent values",
  "currency-mismatch": "the published currency is not compatible with the comparable peer evidence",
  "unit-mismatch": "the published unit is not compatible with the comparable peer evidence",
  "period-mismatch": "the published period is not compatible with the requested or peer evidence period",
  "insufficient-peers": "fewer than two compatible peer facts are available for this relative numeric metric",
};

function orderedDimensions(submission: ComparisonSubmission): ComparisonPriority[] {
  return [...comparisonPriorityOrder]
    .filter((dimension) => submission.weights[dimension] > 0)
    .sort((left, right) => {
      const difference = submission.weights[right] - submission.weights[left];
      if (difference !== 0) return difference;
      return comparisonPriorityOrder.indexOf(left) - comparisonPriorityOrder.indexOf(right);
    });
}

function indexDossierClaims(dossiers: readonly ResearchDossier[]) {
  const byTarget = new Map<string, Map<string, ResearchDossier["categories"][number]["category"]>>();
  for (const dossier of dossiers) {
    const key = comparisonTargetKey({
      universityId: dossier.target.university.id,
      ...(dossier.target.program === undefined ? {} : { programId: dossier.target.program.id }),
    });
    const claims = new Map<string, ResearchDossier["categories"][number]["category"]>();
    for (const row of dossier.categories) {
      for (const claim of row.claims) claims.set(claim.id, row.category);
    }
    byTarget.set(key, claims);
  }
  return byTarget;
}

function factualEvidenceRefs(
  scoreResult: ComparisonScoreResult,
  dimension: ComparisonPriority,
): ComparisonTradeoffEvidenceRef[] {
  const result: ComparisonTradeoffEvidenceRef[] = [];
  const seen = new Set<string>();
  for (const target of scoreResult.targets) {
    const outcome = target.dimensions[dimension];
    if (outcome.state !== "scored") continue;
    const targetKey = comparisonTargetKey(target.target);
    for (const claimId of outcome.claimIds) {
      const key = `${targetKey}\u0000${claimId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ targetKey, claimId });
    }
  }
  return result;
}

function assertFactualReferences(
  scoreResult: ComparisonScoreResult,
  dossiers: readonly ResearchDossier[],
  dimension: ComparisonPriority,
): void {
  const claimIndex = indexDossierClaims(dossiers);
  const expectedCategory = comparisonPriorityCategory[dimension];
  for (const target of scoreResult.targets) {
    const outcome = target.dimensions[dimension];
    if (outcome.state !== "scored") continue;
    const targetKey = comparisonTargetKey(target.target);
    const claims = claimIndex.get(targetKey);
    if (claims === undefined) throw new Error("Trade-off evidence target is missing its validated dossier.");
    for (const claimId of outcome.claimIds) {
      if (claims.get(claimId) !== expectedCategory) {
        throw new Error("Trade-off claim reference does not resolve to the scored target/category.");
      }
    }
  }
}

export function buildComparisonTradeoffs(
  scoreResult: ComparisonScoreResult,
  dossiers: readonly ResearchDossier[],
  submission: ComparisonSubmission,
): readonly ComparisonTradeoff[] {
  const tradeoffs: ComparisonTradeoff[] = [];
  const dimensions = orderedDimensions(submission);

  for (const dimension of dimensions) {
    const targetResults = scoreResult.targets.map((target, index) => ({
      index,
      key: comparisonTargetKey(target.target),
      outcome: target.dimensions[dimension],
    }));
    const scored = targetResults.filter((item) => item.outcome.state === "scored");

    if (scored.length >= 2) {
      assertFactualReferences(scoreResult, dossiers, dimension);
      const scores = scored.map((item) => item.outcome.state === "scored" ? item.outcome.score : 0);
      const evidenceRefs = factualEvidenceRefs(scoreResult, dimension);
      const targetKeys = scored.map((item) => item.key);
      if (new Set(scores).size === 1) {
        tradeoffs.push({
          id: `${dimension}-tie`,
          dimension,
          kind: "tie",
          summary: `${dimensionLabels[dimension]} has an equal comparable score for ${scored.map((item) => `option ${item.index + 1}`).join(" and ")}.`,
          targetKeys,
          evidenceRefs,
        });
      } else {
        const highest = Math.max(...scores);
        const leading = scored.filter((item) => item.outcome.state === "scored" && item.outcome.score === highest);
        tradeoffs.push({
          id: `${dimension}-relative`,
          dimension,
          kind: "relative",
          summary: `${dimensionLabels[dimension]} gives ${leading.map((item) => `option ${item.index + 1}`).join(" and ")} the higher within-set compatible score from the published facts that can be compared directly.`,
          targetKeys,
          evidenceRefs,
        });
      }
    }

    for (const item of targetResults) {
      if (item.outcome.state === "scored") continue;
      tradeoffs.push({
        id: `${dimension}-option-${item.index + 1}-${item.outcome.reason}`,
        dimension,
        kind: warningReasons.has(item.outcome.reason) ? "warning" : "gap",
        summary: `${dimensionLabels[dimension]} for option ${item.index + 1} is unscored because ${reasonText[item.outcome.reason]}.`,
        targetKeys: [item.key],
        evidenceRefs: item.outcome.claimIds.map((claimId) => ({ targetKey: item.key, claimId })),
      });
    }
  }

  return tradeoffs;
}
