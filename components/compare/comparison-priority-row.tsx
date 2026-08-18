"use client";

import type { ComparisonPriority } from "@/lib/comparison/contracts";
import type { ComparisonDimensionResult, ComparisonUnscoredReason } from "@/lib/comparison/scoring";

const priorityLabels: Record<ComparisonPriority, string> = {
  affordability: "Affordability",
  research: "Research",
  scholarships: "Scholarships",
  outcomes: "Outcomes",
  support: "Support",
};

const reasonLabels: Record<ComparisonUnscoredReason, string> = {
  "category-not-researched": "Category not researched",
  "category-unknown": "Evidence unknown",
  "category-incomplete": "Research incomplete",
  "no-eligible-metric": "No eligible score metric",
  "unsupported-value-type": "Unsupported published value",
  conflicting: "Conflicting evidence — unscored",
  outdated: "Outdated evidence — unscored",
  "inferred-only": "Inferred-only evidence — unscored",
  "anecdotal-only": "Anecdotal-only evidence — unscored",
  "ranking-only": "Ranking-only evidence — unscored",
  "duplicate-inconsistent-values": "Inconsistent duplicate evidence — unscored",
  "currency-mismatch": "Currency mismatch — no conversion",
  "unit-mismatch": "Unit mismatch — no conversion",
  "period-mismatch": "Period mismatch — unscored",
  "insufficient-peers": "Insufficient compatible peers",
};

interface ComparisonPriorityRowProps {
  dimension: ComparisonPriority;
  weight: number;
  outcome: ComparisonDimensionResult;
  onEvidence?: (claimId: string, trigger: HTMLButtonElement) => void;
}

export function ComparisonPriorityRow({ dimension, weight, outcome, onEvidence }: ComparisonPriorityRowProps) {
  return (
    <div className="border-b border-border py-3 last:border-b-0" data-priority={dimension}>
      <div className="flex min-w-0 items-start justify-between gap-4 text-sm">
        <dt className="min-w-0 text-muted-foreground">
          {priorityLabels[dimension]} <span className="text-xs">({weight})</span>
        </dt>
        <dd className="min-w-0 text-right font-semibold">
          {outcome.state === "scored" ? `${Math.round(outcome.score)} / 100` : reasonLabels[outcome.reason]}
        </dd>
      </div>
      {outcome.state === "scored" && outcome.claimIds.length > 0 && onEvidence !== undefined ? (
        <button
          type="button"
          onClick={(event) => onEvidence(outcome.claimIds[0]!, event.currentTarget)}
          className="mt-2 min-h-8 rounded-md text-xs font-semibold text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          View {priorityLabels[dimension]} evidence
        </button>
      ) : null}
    </div>
  );
}
