"use client";

import * as React from "react";

import type { ResearchSubmissionSnapshot } from "@/lib/research/mode/client-state";
import type { ResearchDossier as ResearchDossierData } from "@/lib/research/mode/public-contracts";
import { ClaimEvidenceSheet } from "./claim-evidence-sheet";
import { ResearchCategorySection } from "./research-category-section";
import { ResearchRunBanner } from "./research-run-banner";

interface ResearchDossierProps {
  dossier: ResearchDossierData;
  submission: ResearchSubmissionSnapshot;
  formMatchesSubmission: boolean;
  busy: boolean;
  updating: boolean;
  allowRetry?: boolean;
  selectedClaimId: string | null;
  claimTrigger: HTMLButtonElement | null;
  onSelectClaim: (claimId: string, trigger: HTMLButtonElement) => void;
  onClearClaim: () => void;
  onRetry: (submission: ResearchSubmissionSnapshot) => void;
  onClear: () => void;
}

export function ResearchDossier({
  dossier,
  submission,
  formMatchesSubmission,
  busy,
  updating,
  allowRetry = true,
  selectedClaimId,
  claimTrigger,
  onSelectClaim,
  onClearClaim,
  onRetry,
  onClear,
}: ResearchDossierProps) {
  return (
    <section aria-label="Research dossier" className="space-y-5">
      {updating ? (
        <p className="rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
          Updating this dossier. The details below are the previously validated result for{" "}
          {dossier.target.university.name}
          {dossier.target.program !== undefined ? ` • ${dossier.target.program.name}` : ""}.
        </p>
      ) : null}

      <ResearchRunBanner
        dossier={dossier}
        submission={submission}
        formMatchesSubmission={formMatchesSubmission}
        busy={busy}
        allowRetry={allowRetry}
        onRetry={onRetry}
        onClear={onClear}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {dossier.categories.map((row, index) => (
          <React.Fragment key={row.category}>
            <ResearchCategorySection
              row={row}
              selectedClaimId={selectedClaimId}
              onSelectClaim={onSelectClaim}
            />
            {index < dossier.categories.length - 1 ? (
              <div className="border-b border-border" aria-hidden="true" />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <ClaimEvidenceSheet
        dossier={dossier}
        selectedClaimId={selectedClaimId}
        triggerElement={claimTrigger}
        onClose={onClearClaim}
      />
    </section>
  );
}
