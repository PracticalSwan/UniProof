"use client";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { formatClaimValue, formatIsoDate } from "@/lib/research/mode/format";
import type { PublicResearchClaim } from "@/lib/research/mode/public-contracts";
import { cn } from "@/lib/utils";

interface ResearchClaimRowProps {
  claim: PublicResearchClaim;
  selected: boolean;
  onSelect: (claimId: string, trigger: HTMLButtonElement) => void;
}

export function ResearchClaimRow({
  claim,
  selected,
  onSelect,
}: ResearchClaimRowProps) {
  const metadata: string[] = [];
  if (claim.academicYear !== undefined) metadata.push(`Academic year ${claim.academicYear}`);
  if (claim.intake !== undefined) metadata.push(`Intake ${claim.intake}`);
  if (claim.effectiveDate !== undefined) {
    metadata.push(`Effective ${formatIsoDate(claim.effectiveDate)}`);
  }

  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_230px] sm:items-start">
      <div className="min-w-0">
        <h4 className="break-words text-[15px] font-semibold">{claim.property}</h4>
        <p className="mt-1 break-words text-[15px] leading-6">{formatClaimValue(claim)}</p>
        {metadata.length > 0 ? (
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {metadata.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <EvidenceBadge status={claim.verificationStatus} />
        <span className="text-xs text-muted-foreground">
          {claim.sourceIds.length} {claim.sourceIds.length === 1 ? "source" : "sources"}
        </span>
        <button
          type="button"
          onClick={(event) => onSelect(claim.id, event.currentTarget)}
          aria-label={`View evidence for ${claim.property}`}
          className={cn(
            "inline-flex min-h-8 items-center rounded-md border border-border bg-white px-3 text-[13px] font-semibold text-link outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            selected && "bg-accent",
          )}
        >
          View evidence
        </button>
      </div>
    </li>
  );
}
