"use client";

import type { ResearchDossier } from "@/lib/research/mode/public-contracts";
import { comparisonTargetKey, type ComparisonSubmission } from "@/lib/comparison/contracts";
import type { ComparisonTradeoff } from "@/lib/comparison/tradeoffs";

interface ComparisonTradeoffsProps {
  tradeoffs: readonly ComparisonTradeoff[];
  dossiers: readonly ResearchDossier[];
  submission: ComparisonSubmission;
  onEvidence: (dossier: ResearchDossier, claimId: string, trigger: HTMLButtonElement) => void;
}

type TradeoffEvidenceOwner = {
  dossier: ResearchDossier;
  claimId: string;
  optionNumber: number;
};

function evidenceOwners(
  tradeoff: ComparisonTradeoff,
  dossiers: readonly ResearchDossier[],
  submission: ComparisonSubmission,
): TradeoffEvidenceOwner[] {
  const dossierByTarget = new Map(dossiers.map((dossier) => [
    comparisonTargetKey({
      universityId: dossier.target.university.id,
      ...(dossier.target.program === undefined ? {} : { programId: dossier.target.program.id }),
    }),
    dossier,
  ]));
  const optionByTarget = new Map(submission.targets.map((target, index) => [comparisonTargetKey(target), index + 1]));
  const owners: TradeoffEvidenceOwner[] = [];
  const seenTargets = new Set<string>();
  for (const reference of tradeoff.evidenceRefs) {
    if (seenTargets.has(reference.targetKey)) continue;
    const dossier = dossierByTarget.get(reference.targetKey);
    const optionNumber = optionByTarget.get(reference.targetKey);
    if (dossier === undefined || optionNumber === undefined) continue;
    const claimExists = dossier.categories.some((row) => row.claims.some((claim) => claim.id === reference.claimId));
    if (!claimExists) continue;
    seenTargets.add(reference.targetKey);
    owners.push({ dossier, claimId: reference.claimId, optionNumber });
  }
  return owners;
}

export function ComparisonTradeoffs({ tradeoffs, dossiers, submission, onEvidence }: ComparisonTradeoffsProps) {
  if (tradeoffs.length === 0) return null;
  return (
    <section className="mt-8 rounded-lg border border-border bg-white p-4 sm:p-6" aria-labelledby="comparison-tradeoffs-heading">
      <h2 id="comparison-tradeoffs-heading" className="text-xl font-semibold">Evidence-bound trade-offs</h2>
      <p className="mt-1 text-sm text-muted-foreground">Deterministic summaries follow your weight order and link factual statements back to exact Research claims.</p>
      <ol className="mt-5 grid gap-3">
        {tradeoffs.map((tradeoff) => {
          const owners = evidenceOwners(tradeoff, dossiers, submission);
          return (
            <li key={tradeoff.id} className="rounded-md border border-border bg-panel p-4">
              <p className="break-words text-sm leading-6">{tradeoff.summary}</p>
              {owners.length === 0 ? null : (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {owners.map((owner) => (
                    <button
                      key={`${owner.optionNumber}:${owner.claimId}`}
                      type="button"
                      className="min-h-8 text-xs font-semibold text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={(event) => onEvidence(owner.dossier, owner.claimId, event.currentTarget)}
                    >
                      View trade-off evidence for option {owner.optionNumber}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
