import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvidenceStatus } from "@/types/domain";

const statusStyles: Record<EvidenceStatus, string> = {
  verified: "bg-evidence-verified-bg text-evidence-verified-fg",
  corroborated: "bg-evidence-corroborated-bg text-evidence-corroborated-fg",
  "university-reported": "bg-evidence-university-bg text-evidence-university-fg",
  conflicting: "bg-evidence-conflicting-bg text-evidence-conflicting-fg",
  anecdotal: "bg-evidence-anecdotal-bg text-evidence-anecdotal-fg",
  inferred: "bg-evidence-inferred-bg text-evidence-inferred-fg",
  unknown: "bg-evidence-unknown-bg text-evidence-unknown-fg",
  outdated: "bg-evidence-outdated-bg text-evidence-outdated-fg",
};

const statusLabels: Record<EvidenceStatus, string> = {
  verified: "Verified",
  corroborated: "Corroborated",
  "university-reported": "University-reported",
  conflicting: "Conflicting",
  anecdotal: "Anecdotal",
  inferred: "Inferred",
  unknown: "Unknown",
  outdated: "Outdated",
};

interface EvidenceBadgeProps {
  status: EvidenceStatus;
  className?: string;
}
export function EvidenceBadge({ status, className }: EvidenceBadgeProps) {
  return (
    <Badge
      className={cn(
        "h-auto rounded-md border-0 px-2.5 py-1 text-xs font-semibold",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </Badge>
  );
}
