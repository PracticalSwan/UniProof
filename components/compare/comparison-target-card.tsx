"use client";

import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import { categoryLabel } from "@/lib/research/mode/format";
import type { PublicResearchClaim, ResearchDossier } from "@/lib/research/mode/public-contracts";
import { comparisonPriorityOrder, type ComparisonSubmission } from "@/lib/comparison/contracts";
import type { ComparisonResearchOutcome } from "@/lib/comparison/client-state";
import type { ComparisonTargetScore } from "@/lib/comparison/scoring";
import { ComparisonPriorityRow } from "./comparison-priority-row";

interface ComparisonTargetCardProps {
  index: number;
  targetScore: ComparisonTargetScore;
  outcome?: ComparisonResearchOutcome;
  submission: ComparisonSubmission;
  catalog: ResearchCatalog;
  onEvidence: (dossier: ResearchDossier, claimId: string, trigger: HTMLButtonElement) => void;
}

function formatEvidenceCoverage(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function contextualClaims(dossier: ResearchDossier, submission: ComparisonSubmission): PublicResearchClaim[] {
  if (!submission.showRankingEvidence && !submission.showAnecdotalEvidence) return [];
  const sources = new Map(dossier.sources.map((source) => [source.id, source]));
  return dossier.categories
    .flatMap((row) => row.claims)
    .filter((claim) => {
      const types = claim.sourceIds.map((sourceId) => sources.get(sourceId)?.sourceType);
      const rankingOnly = types.length > 0 && types.every((type) => type === "ranking");
      const anecdotal = claim.verificationStatus === "anecdotal" || (types.length > 0 && types.every((type) => type === "anecdotal"));
      return (submission.showRankingEvidence && rankingOnly) || (submission.showAnecdotalEvidence && anecdotal);
    })
    .slice(0, 6);
}

export function ComparisonTargetCard({
  index,
  targetScore,
  outcome,
  submission,
  catalog,
  onEvidence,
}: ComparisonTargetCardProps) {
  const dossier = targetScore.dossier;
  const catalogUniversity = catalog.universities.find((item) => item.id === targetScore.target.universityId);
  const catalogProgram = targetScore.target.programId === undefined
    ? undefined
    : catalog.programs.find((item) => item.id === targetScore.target.programId);
  const title = dossier?.target.program?.name ?? dossier?.target.university.name ?? catalogProgram?.name ?? catalogUniversity?.name ?? `Option ${index + 1}`;
  const subtitle = dossier?.target.program === undefined
    ? dossier?.target.university.name ?? catalogUniversity?.name
    : dossier.target.university.name;
  const contextClaims = dossier === null ? [] : contextualClaims(dossier, submission);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-border border-t-[3px] border-t-primary bg-white p-5 sm:p-6" data-comparison-card={index + 1}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Option {index + 1}</p>
      <h3 className="mt-2 break-words text-xl font-bold [overflow-wrap:anywhere]">{title}</h3>
      {subtitle === undefined || subtitle === title ? null : <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>}

      <div className="my-5 border-t border-border" />
      <p className="text-xs text-muted-foreground">Fit score</p>
      {targetScore.fitSuppressed ? (
        <p className="mt-2 text-lg font-semibold">Suppressed: insufficient comparable evidence</p>
      ) : (
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl leading-none font-bold text-primary">{Math.round(targetScore.fitScore ?? 0)}</span>
          <span className="text-sm">/100</span>
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-muted-foreground">Evidence coverage {formatEvidenceCoverage(targetScore.evidenceCoverage)}%</p>

      <dl className="mt-5">
        {comparisonPriorityOrder.map((dimension) => (
          <ComparisonPriorityRow
            key={dimension}
            dimension={dimension}
            weight={submission.weights[dimension]}
            outcome={targetScore.dimensions[dimension]}
            onEvidence={dossier === null ? undefined : (claimId, trigger) => onEvidence(dossier, claimId, trigger)}
          />
        ))}
      </dl>

      {dossier === null ? (
        <p className="mt-5 rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {outcome?.state === "transport-error"
            ? outcome.error.message
            : "No usable Research dossier was available for this target."}
        </p>
      ) : (
        <div className="mt-5 space-y-2" aria-label={`Evidence warnings for option ${index + 1}`}>
          {dossier.categories.map((row) => {
            if (row.state === "incomplete") {
              return <p key={row.category} className="text-xs font-semibold text-evidence-inferred-fg">{categoryLabel(row.category)}: research incomplete.</p>;
            }
            if (row.state === "unknown") {
              return <p key={row.category} className="text-xs font-semibold text-evidence-inferred-fg">{categoryLabel(row.category)}: evidence unknown.</p>;
            }
            if (row.sourceGap === undefined && !row.hasConflict && !row.hasOutdated) return null;
            return (
              <div key={row.category} className="space-y-2">
                {row.sourceGap === undefined ? null : (
                  <p className="text-xs font-semibold text-evidence-inferred-fg">
                    {categoryLabel(row.category)}: partial evidence — unscored. {row.sourceGap.message}
                  </p>
                )}
                {row.hasConflict ? (
                  <p className="text-xs font-semibold text-destructive">{categoryLabel(row.category)}: conflicting evidence remains visible and unscored.</p>
                ) : null}
                {row.hasOutdated ? (
                  <p className="text-xs font-semibold text-evidence-inferred-fg">{categoryLabel(row.category)}: outdated evidence remains visible and unscored.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {contextClaims.length > 0 && dossier !== null ? (
        <section className="mt-5 border-t border-border pt-4" aria-label={`Contextual evidence for option ${index + 1}`}>
          <h4 className="text-sm font-semibold">Display-only context</h4>
          <p className="mt-1 text-xs text-muted-foreground">These items never change fit or evidence coverage.</p>
          <ul className="mt-3 grid gap-2">
            {contextClaims.map((claim) => (
              <li key={claim.id} className="rounded-md bg-panel p-3 text-sm">
                <p className="break-words font-semibold">{claim.property}</p>
                <button
                  type="button"
                  className="mt-2 min-h-8 text-xs font-semibold text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  onClick={(event) => onEvidence(dossier, claim.id, event.currentTarget)}
                >
                  View contextual evidence
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-xs">
        {catalogProgram === undefined ? null : (
          <a href={catalogProgram.officialUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="min-h-8 break-all font-semibold text-link underline underline-offset-4">
            Official program page
          </a>
        )}
        {catalogUniversity === undefined ? null : (
          <a href={catalogUniversity.websiteUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="min-h-8 break-all font-semibold text-link underline underline-offset-4">
            Official university website
          </a>
        )}
      </div>
    </article>
  );
}
