"use client";

import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import type { ResearchDossier } from "@/lib/research/mode/public-contracts";
import type { ComparisonResult } from "@/lib/comparison/client-state";
import { ComparisonTargetCard } from "./comparison-target-card";
import { ComparisonTradeoffs } from "./comparison-tradeoffs";

interface ComparisonResultsProps {
  result: ComparisonResult;
  catalog: ResearchCatalog;
  onEvidence: (dossier: ResearchDossier, claimId: string, trigger: HTMLButtonElement) => void;
}

export function ComparisonResults({ result, catalog, onEvidence }: ComparisonResultsProps) {
  const dossiers = result.outcomes
    .filter((outcome) => outcome.state === "dossier" && outcome.dossier.run.status !== "failed")
    .map((outcome) => outcome.state === "dossier" ? outcome.dossier : null)
    .filter((dossier): dossier is ResearchDossier => dossier !== null);

  return (
    <section className="mt-10" aria-labelledby="comparison-results-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="comparison-results-heading" className="text-2xl font-semibold">Comparison results</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.status === "partial" ? "Partial comparison: at least one target or Research category is incomplete." : "Comparison complete."}
          </p>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Cards remain in your submitted selection order.</p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {result.score.targets.map((targetScore, index) => (
          <ComparisonTargetCard
            key={`${targetScore.target.universityId}:${targetScore.target.programId ?? ""}`}
            index={index}
            targetScore={targetScore}
            submission={result.submission}
            catalog={catalog}
            onEvidence={onEvidence}
          />
        ))}
      </div>

      <ComparisonTradeoffs tradeoffs={result.tradeoffs} dossiers={dossiers} submission={result.submission} onEvidence={onEvidence} />

      <section className="mt-8 border-t border-border pt-5" aria-labelledby="comparison-method-heading">
        <h2 id="comparison-method-heading" className="text-lg font-semibold">How this fit is calculated</h2>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-muted-foreground">
          Fit uses only verified, corroborated, or university-reported evidence with an eligible supporting source. Relative numeric metrics need at least two directly compatible peers. Missing, conflicting, outdated, inferred, anecdotal, ranking-only, incompatible, or unsupported evidence is shown as unscored, never as zero. Overall fit requires at least two positive-weight scored dimensions and at least 50% weighted evidence coverage.
        </p>
      </section>
    </section>
  );
}
