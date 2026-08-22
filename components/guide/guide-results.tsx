"use client";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Button } from "@/components/ui/button";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import { categoryLabel } from "@/lib/research/mode/format";
import type { GuideEvidenceRef, GuideResult } from "@/lib/guide/contracts";
import { GuideChecklist } from "./guide-checklist";
import { GuideRequirementRow } from "./guide-requirement-row";
import { GuideTimeline } from "./guide-timeline";

interface GuideResultsProps {
  result: GuideResult;
  catalog: ResearchCatalog;
  onShowEvidence: (ref: GuideEvidenceRef, trigger: HTMLButtonElement) => void;
  disabled: boolean;
  onClear: () => void;
}

export function GuideResults({ result, catalog, onShowEvidence, disabled, onClear }: GuideResultsProps) {
  const university = catalog.universities.find((u) => u.id === result.submission.target.universityId);
  const program = catalog.programs.find(
    (p) => p.id === result.submission.target.programId && p.universityId === result.submission.target.universityId,
  );

  return (
    <section aria-labelledby="guide-results-heading" className="space-y-6">
      <div>
        <h2 id="guide-results-heading" className="text-[20px] font-semibold">
          Requirement assessment
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.dossier.target.program?.name ?? program?.name ?? "Selected program"} - {" "}
          {result.dossier.target.university.name}
          {result.status === "partial" ? " (partial research)" : ""}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Assessment date: {result.submission.assessmentDate}. This checks published requirements; it does not predict admission.
        </p>
      </div>

      {result.status === "partial" ? (
        <section aria-label="Guide research completeness" className="rounded-md border border-border bg-panel p-4 text-sm">
          <p className="font-semibold">Research completeness</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.dossier.categories.flatMap((row) => {
              if (row.state === "incomplete") {
                return [
                  <p key={row.category}>
                    {categoryLabel(row.category)}: research incomplete. {row.failure.message}
                  </p>,
                ];
              }
              if (row.state === "ready" && row.sourceGap !== undefined) {
                return [
                  <p key={row.category}>
                    {categoryLabel(row.category)}: partial evidence — non-definitive. {row.sourceGap.message}
                  </p>,
                ];
              }
              return [];
            })}
          </div>
        </section>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {result.assessments.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No machine-assessable requirements were found in the published evidence.
          </p>
        ) : (
          result.assessments.map((assessment, index) => (
            <div key={assessment.id}>
              <GuideRequirementRow assessment={assessment} onShowEvidence={onShowEvidence} disabled={false} />
              {index < result.assessments.length - 1 ? (
                <div className="border-b border-border" aria-hidden="true" />
              ) : null}
            </div>
          ))
        )}
      </div>

      {result.budgetAssessment !== undefined ? (
        <section aria-labelledby="guide-budget-heading" className="rounded-lg border border-border bg-white p-5">
          <h3 id="guide-budget-heading" className="text-[17px] font-semibold">Budget constraint</h3>
          <p className="mt-2 text-sm text-muted-foreground">{result.budgetAssessment.detail}</p>
          {result.budgetAssessment.evidenceRefs.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {result.budgetAssessment.evidenceRefs.map((ref, index) => (
                <button
                  key={`${ref.targetKey}:${ref.claimId}`}
                  type="button"
                  aria-label={result.budgetAssessment!.evidenceRefs.length === 1
                    ? "View tuition evidence"
                    : `View tuition evidence (${index + 1} of ${result.budgetAssessment!.evidenceRefs.length})`}
                  onClick={(event) => onShowEvidence(ref, event.currentTarget)}
                  className="inline-flex min-h-6 items-center text-[13px] font-semibold text-link underline underline-offset-4"
                >
                  View tuition evidence{result.budgetAssessment!.evidenceRefs.length > 1 ? ` ${index + 1}` : ""}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {result.risks.length > 0 ? (
        <section aria-labelledby="guide-risks-heading">
          <h3 id="guide-risks-heading" className="text-[17px] font-semibold">Risks</h3>
          <ul className="mt-3 space-y-2">
            {result.risks.map((risk) => (
              <li key={risk.id} className="rounded-md border border-border bg-white p-4 text-sm">
                <span className="font-semibold text-destructive">{risk.severity.toUpperCase()}</span>{" "}
                <span className="font-semibold">{risk.title}</span>
                <p className="mt-1 text-muted-foreground">{risk.description}</p>
                {risk.evidenceRefs.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {risk.evidenceRefs.map((ref, index) => (
                      <button
                        key={`${ref.targetKey}:${ref.claimId}`}
                        type="button"
                        aria-label={risk.evidenceRefs.length === 1
                          ? `View evidence for ${risk.title}`
                          : `View evidence for ${risk.title} (${index + 1} of ${risk.evidenceRefs.length})`}
                        onClick={(event) => onShowEvidence(ref, event.currentTarget)}
                        className="inline-flex min-h-6 items-center text-[13px] font-semibold text-link underline underline-offset-4"
                      >
                        View evidence{risk.evidenceRefs.length > 1 ? ` ${index + 1}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <GuideChecklist items={result.checklist} onShowEvidence={onShowEvidence} />
      <GuideTimeline items={result.timeline} onShowEvidence={onShowEvidence} />

      {result.unrecognizedAdmissions.length > 0 ? (
        <section aria-labelledby="guide-manual-heading">
          <h3 id="guide-manual-heading" className="text-[17px] font-semibold">
            Other published admissions evidence
          </h3>
          <ul className="mt-3 space-y-2">
            {result.unrecognizedAdmissions.map((item) => (
              <li key={item.id} className="rounded-md border border-border bg-white p-4 text-sm">
                <p className="font-semibold">{item.property}: {item.value}</p>
                <div className="mt-1 flex items-center gap-2">
                  <EvidenceBadge status={item.verificationStatus as never} />
                  <button
                    type="button"
                    onClick={(event) => onShowEvidence(item.evidenceRef, event.currentTarget)}
                    className="inline-flex min-h-6 items-center text-[13px] font-semibold text-link underline underline-offset-4"
                  >
                    View evidence
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {university !== undefined && program !== undefined ? (
        <section aria-labelledby="guide-official-heading" className="rounded-lg border border-border bg-white p-5">
          <h3 id="guide-official-heading" className="text-[17px] font-semibold">Official links</h3>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={program.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex min-h-10 items-center break-all rounded-md border border-border bg-white px-3 py-2 text-[13px] font-semibold text-link underline underline-offset-4"
            >
              Official program page: {program.name}
            </a>
            <a
              href={university.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex min-h-10 items-center break-all rounded-md border border-border bg-white px-3 py-2 text-[13px] font-semibold text-link underline underline-offset-4"
            >
              Official university website: {university.name}
            </a>
          </div>
        </section>
      ) : null}

      <Button type="button" variant="outline" onClick={onClear} disabled={disabled} className="h-[42px]">
        Clear result
      </Button>
    </section>
  );
}
