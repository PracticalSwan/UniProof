"use client";

import type { GuideEvidenceRef, GuideRequirementAssessment } from "@/lib/guide/contracts";

const STATE_LABEL: Record<string, string> = {
  meets: "Meets",
  "probably-meets": "Probably meets",
  "does-not-meet": "Does not meet",
  "missing-applicant-information": "Missing applicant information",
  "unclear-requirement": "Unclear requirement",
  "manual-confirmation-required": "Manual confirmation required",
};

const STATE_CLASS: Record<string, string> = {
  meets: "bg-evidence-verified-bg text-evidence-verified-fg",
  "probably-meets": "bg-evidence-corroborated-bg text-evidence-corroborated-fg",
  "does-not-meet": "bg-evidence-conflicting-bg text-evidence-conflicting-fg",
  "missing-applicant-information": "bg-evidence-university-bg text-evidence-university-fg",
  "unclear-requirement": "bg-evidence-outdated-bg text-evidence-outdated-fg",
  "manual-confirmation-required": "bg-evidence-inferred-bg text-evidence-inferred-fg",
};

interface GuideRequirementRowProps {
  assessment: GuideRequirementAssessment;
  onShowEvidence: (ref: GuideEvidenceRef, trigger: HTMLButtonElement) => void;
  disabled: boolean;
}

export function GuideRequirementRow({ assessment, onShowEvidence, disabled }: GuideRequirementRowProps) {
  return (
    <article className="p-5 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{assessment.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{assessment.detail}</p>
          {assessment.publishedValue !== undefined ? (
            <p className="mt-1 text-xs text-muted-foreground">Published: {assessment.publishedValue}</p>
          ) : null}
          {assessment.applicantValue !== undefined ? (
            <p className="text-xs text-muted-foreground">Your value: {assessment.applicantValue}</p>
          ) : null}
          <span className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${STATE_CLASS[assessment.state] ?? ""}`}>
            {STATE_LABEL[assessment.state] ?? assessment.state}
          </span>
        </div>
        {assessment.evidenceRefs.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 sm:justify-end">
            {assessment.evidenceRefs.map((ref, index) => (
              <button
                key={`${ref.targetKey}:${ref.claimId}`}
                type="button"
                aria-label={assessment.evidenceRefs.length === 1
                  ? `View evidence for ${assessment.label}`
                  : `View evidence for ${assessment.label} (${index + 1} of ${assessment.evidenceRefs.length})`}
                onClick={(event) => onShowEvidence(ref, event.currentTarget)}
                disabled={disabled}
                className="inline-flex min-h-6 items-center text-[13px] font-semibold text-link underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                View evidence{assessment.evidenceRefs.length > 1 ? ` ${index + 1}` : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
