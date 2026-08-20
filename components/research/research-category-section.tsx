"use client";

import { Badge } from "@/components/ui/badge";
import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import {
  categoryLabel,
} from "@/lib/research/mode/format";
import type { ResearchDossier } from "@/lib/research/mode/public-contracts";
import { ResearchClaimRow } from "./research-claim-row";

type ReadyCategory = Extract<ResearchDossier["categories"][number], { state: "ready" }>;
type UnknownCategory = Extract<ResearchDossier["categories"][number], { state: "unknown" }>;
type IncompleteCategory = Extract<ResearchDossier["categories"][number], { state: "incomplete" }>;

interface CategorySectionProps {
  row: ResearchDossier["categories"][number];
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string, trigger: HTMLButtonElement) => void;
}

function ReadySection({
  row,
  selectedClaimId,
  onSelectClaim,
}: CategorySectionProps & { row: ReadyCategory }) {
  const presentStatuses = [...new Set(row.claims.map((claim) => claim.verificationStatus))];

  return (
    <article className="p-5" aria-labelledby={`category-${row.category}-heading`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            id={`category-${row.category}-heading`}
            className="text-[17px] font-semibold"
          >
            {categoryLabel(row.category)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.claims.length} {row.claims.length === 1 ? "claim" : "claims"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {presentStatuses.map((status) => (
            <EvidenceBadge key={status} status={status} />
          ))}
        </div>
      </div>

      {row.hasConflict ? (
        <p className="mt-4 rounded-md bg-evidence-conflicting-bg px-3 py-2 text-[13px] font-medium text-evidence-conflicting-fg">
          Sources report conflicting values. All returned claims are shown without selecting a
          winner.
        </p>
      ) : null}
      {row.hasOutdated ? (
        <p className="mt-4 rounded-md bg-evidence-outdated-bg px-3 py-2 text-[13px] font-medium text-evidence-outdated-fg">
          At least one claim is outdated for its recorded period. Check explicit period metadata
          and the official target link.
        </p>
      ) : null}
      {row.sourceGap !== undefined ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium text-muted-foreground">
          Some selected sources could not be retrieved or processed. The claims below come only
          from successfully processed sources, so Compare and Guide will not treat this category
          as definitive.
        </p>
      ) : null}

      <div className="mt-4 border-l-[3px] border-l-primary/60 pl-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Evidence summary
        </p>
        <p className="mt-2 break-words text-sm leading-6">{row.explanation.summary}</p>
      </div>

      <ul className="mt-2 divide-y divide-border">
        {row.claims.map((claim) => (
          <ResearchClaimRow
            key={claim.id}
            claim={claim}
            selected={selectedClaimId === claim.id}
            onSelect={onSelectClaim}
          />
        ))}
      </ul>
    </article>
  );
}

function UnknownSection({ row }: CategorySectionProps & { row: UnknownCategory }) {
  return (
    <article className="p-5" aria-labelledby={`category-${row.category}-heading`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            id={`category-${row.category}-heading`}
            className="text-[17px] font-semibold"
          >
            {categoryLabel(row.category)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">0 claims</p>
        </div>
        <EvidenceBadge status="unknown" />
      </div>
      <p className="mt-4 text-sm leading-6">
        Completed bounded research did not establish a supported factual claim for this category.
      </p>
      <div className="mt-4 border-l-[3px] border-l-muted-foreground/40 pl-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Evidence summary
        </p>
        <p className="mt-2 break-words text-sm leading-6">{row.explanation.summary}</p>
      </div>
    </article>
  );
}

function IncompleteSection({ row }: CategorySectionProps & { row: IncompleteCategory }) {
  return (
    <article className="p-5" aria-labelledby={`category-${row.category}-heading`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            id={`category-${row.category}-heading`}
            className="text-[17px] font-semibold"
          >
            {categoryLabel(row.category)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">0 claims</p>
        </div>
        <Badge
          variant="outline"
          className="h-auto whitespace-normal rounded-md border-border bg-panel px-2.5 py-1 text-xs font-semibold text-muted-foreground"
        >
          Research incomplete
        </Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{row.failure.message}</p>
    </article>
  );
}

export function ResearchCategorySection(props: CategorySectionProps) {
  if (props.row.state === "ready") {
    return <ReadySection {...props} row={props.row} />;
  }
  if (props.row.state === "unknown") {
    return <UnknownSection {...props} row={props.row} />;
  }
  return <IncompleteSection {...props} row={props.row} />;
}
