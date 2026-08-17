import type {
  PublicEvidenceStatus,
  PublicResearchClaim,
  ResearchModeCategory,
} from "./public-contracts";

const utcMonthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatUtcDate(date: Date): string {
  return `${utcMonthLabels[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function formatUtcTimestamp(time: number): string {
  const date = new Date(time);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${formatUtcDate(date)}, ${hours}:${minutes} UTC`;
}

export function formatClaimValue(claim: PublicResearchClaim): string {
  const value =
    typeof claim.value === "boolean"
      ? claim.value ? "Yes" : "No"
      : String(claim.value);
  return [claim.currency ?? "", value, claim.unit ?? ""]
    .filter((part) => part !== "")
    .join(" ");
}

export function formatIsoDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : formatUtcDate(date);
}

export function formatRetrievedAt(value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : formatUtcTimestamp(time);
}

export function categoryLabel(category: ResearchModeCategory): string {
  const labels: Record<ResearchModeCategory, string> = {
    admissions: "Admissions",
    tuition: "Tuition",
    scholarships: "Scholarships",
    "program-structure": "Program structure",
    research: "Research",
    outcomes: "Outcomes",
    support: "Support",
  };
  return labels[category];
}

export function evidenceStatusLabel(status: PublicEvidenceStatus): string {
  const labels: Record<PublicEvidenceStatus, string> = {
    verified: "Verified",
    corroborated: "Corroborated",
    "university-reported": "University-reported",
    conflicting: "Conflicting",
    anecdotal: "Anecdotal",
    inferred: "Inferred",
    outdated: "Outdated",
  };
  return labels[status];
}

export function sourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    university: "University source",
    government: "Government source",
    accreditation: "Accreditation source",
    dataset: "Dataset",
    independent: "Independent source",
    ranking: "Ranking source",
    anecdotal: "Community source",
  };
  return labels[sourceType] ?? "Source";
}
