"use client";

import { Button } from "@/components/ui/button";
import type { ResearchSubmissionSnapshot } from "@/lib/research/mode/client-state";
import { categoryLabel } from "@/lib/research/mode/format";
import type { ResearchDossier } from "@/lib/research/mode/public-contracts";

interface ResearchRunBannerProps {
  dossier: ResearchDossier;
  submission: ResearchSubmissionSnapshot;
  formMatchesSubmission: boolean;
  busy: boolean;
  allowRetry?: boolean;
  onRetry: (submission: ResearchSubmissionSnapshot) => void;
  onClear: () => void;
}

export function ResearchRunBanner({
  dossier,
  submission,
  formMatchesSubmission,
  busy,
  allowRetry = true,
  onRetry,
  onClear,
}: ResearchRunBannerProps) {
  const incompleteLabels = dossier.categories
    .filter((row) => row.state === "incomplete")
    .map((row) => categoryLabel(row.category));
  const unknownCount = dossier.categories.filter((row) => row.state === "unknown").length;
  const conflicts = dossier.summary.statusCounts.conflicting;
  const outdated = dossier.summary.statusCounts.outdated;
  const retryable = allowRetry && dossier.run.status !== "succeeded";
  const targetLabel = dossier.target.program === undefined
    ? dossier.target.university.name
    : `${dossier.target.university.name} • ${dossier.target.program.name}`;

  return (
    <section
      aria-label="Research run summary"
      className="rounded-lg border border-border bg-white p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-primary">
            {dossier.run.status === "succeeded"
              ? "Research completed"
              : dossier.run.status === "partial"
                ? "Some research is incomplete"
                : "Research failed"}
          </p>
          <h2 className="mt-2 break-words text-xl font-semibold">{targetLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dossier.summary.totalClaims} final{" "}
            {dossier.summary.totalClaims === 1 ? "claim" : "claims"}
            {unknownCount > 0
              ? ` · ${unknownCount} unknown ${unknownCount === 1 ? "category" : "categories"}`
              : ""}
            {conflicts > 0 ? ` · ${conflicts} conflicting` : ""}
            {outdated > 0 ? ` · ${outdated} outdated` : ""}
          </p>
          {incompleteLabels.length > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Incomplete: {incompleteLabels.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {retryable && !busy ? (
            <Button type="button" onClick={() => onRetry(submission)}>
              Retry this research
            </Button>
          ) : null}
          {!busy ? (
            <Button type="button" variant="outline" onClick={onClear}>
              Clear result
            </Button>
          ) : null}
        </div>
      </div>
      {retryable && !busy && !formMatchesSubmission ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Retry repeats the exact previous request. The Research button starts a separate new
          request from the current form.
        </p>
      ) : null}
    </section>
  );
}
