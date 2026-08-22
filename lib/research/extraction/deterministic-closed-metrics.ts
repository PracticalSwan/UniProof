import "server-only";

import { createHash } from "node:crypto";

import {
  claimCandidateSchema,
  canonicalizeResearchCategories,
  type ClaimCandidate,
  type ResearchCategory,
  type ResearchDocument,
} from "@/lib/research/contracts";
import { hostMatchesOfficialRoot } from "@/lib/research/official-host";
import type { ExtractionSegment, ExtractionTargetIdentity } from "./types";

type ClosedMetricCategory = Extract<ResearchCategory, "tuition" | "scholarships" | "research" | "outcomes">;

type DeterministicExtractionInput = {
  segment: ExtractionSegment;
  categories: readonly ResearchCategory[];
  document: ResearchDocument;
  target: ExtractionTargetIdentity;
};

export type DeterministicClosedMetricResult = {
  candidates: readonly ClaimCandidate[];
  completedCategories: readonly ClosedMetricCategory[];
};

const closedMetricCategories = new Set<ResearchCategory>(["tuition", "scholarships", "research", "outcomes"]);
const negativeAvailability = /\b(?:no|not|isn't|aren't|without)\b[^.!?\n]{0,80}\b(?:scholarships?|funding|research opportunities?|thesis options?)\b|\b(?:scholarships?|funding|research opportunities?|thesis options?)\b[^.!?\n]{0,50}\bnot\s+available\b/iu;
const scholarshipAvailable = /\b(?:scholarships?\s+(?:are|is)\s+available|scholarship\s+opportunit(?:y|ies)\s+(?:are|is)\s+available|funding\s+(?:is\s+)?available)\b/iu;
const researchAvailable = /\b(?:research\s+opportunit(?:y|ies)\s+(?:are|is)\s+available|thesis\s+options?\s+(?:are|is)\s+available|research\s+thesis\s+(?:is\s+)?available)\b/iu;
const employmentRate = /\b(?:graduate\s+)?employment\s+(?:outcome\s+)?rate\b/iu;
const annualTuition = /\btuition\b/iu;
const annualContext = /\b(?:annual(?:ly)?|per\s+(?:academic\s+)?year|yearly)\b/iu;

const currencyPattern = /(?:(GBP|THB|USD|EUR|CAD|AUD|SGD|£|฿|€|US\$|C\$|A\$|S\$)\s*([0-9][0-9, ]*(?:\.[0-9]{1,2})?)|([0-9][0-9, ]*(?:\.[0-9]{1,2})?)\s*(GBP|THB|USD|EUR|CAD|AUD|SGD|baht|pounds?|euros?))/giu;
const percentagePattern = /(?:^|[^\d.])([0-9]{1,3}(?:\.[0-9]+)?)\s*%/gu;
const yearPattern = /\b(20\d{2}(?:\s*[/\-–—]\s*(?:20)?\d{2})?)\b/gu;

function isOfficialUniversityDocument(document: ResearchDocument, officialHost: string | undefined): boolean {
  if (document.sourceType !== "university" || officialHost === undefined) return false;
  return hostMatchesOfficialRoot(new URL(document.canonicalUrl).hostname, officialHost);
}

function evidenceWindows(text: string): string[] {
  const windows: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const sentences = trimmed.split(/(?<=[.!?])\s+/u);
    for (const sentence of sentences) {
      const exact = sentence.trim();
      if (exact !== "" && exact.length <= 2_000) windows.push(exact);
    }
  }
  return windows;
}

function normalizeYear(value: string): string {
  return value.replace(/\s*([/\-–—])\s*/u, "$1");
}

function singleYear(text: string): string | undefined {
  const matches = [...text.matchAll(yearPattern)].map((match) => normalizeYear(match[1]!));
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : undefined;
}

function normalizeCurrency(token: string): string | undefined {
  const normalized = token.toUpperCase();
  if (normalized === "£" || /^POUNDS?$/u.test(normalized)) return "GBP";
  if (normalized === "฿" || normalized === "BAHT") return "THB";
  if (normalized === "€" || /^EUROS?$/u.test(normalized)) return "EUR";
  if (normalized === "US$") return "USD";
  if (normalized === "C$") return "CAD";
  if (normalized === "A$") return "AUD";
  if (normalized === "S$") return "SGD";
  return new Set(["GBP", "THB", "USD", "EUR", "CAD", "AUD", "SGD"]).has(normalized)
    ? normalized
    : undefined;
}

function singleCurrencyAmount(text: string): { value: number; currency: string } | undefined {
  const matches = [...text.matchAll(currencyPattern)].flatMap((match) => {
    const currency = normalizeCurrency(match[1] ?? match[4] ?? "");
    const rawValue = match[2] ?? match[3];
    if (currency === undefined || rawValue === undefined) return [];
    const value = Number(rawValue.replace(/[ ,]/gu, ""));
    return Number.isFinite(value) && value >= 0 ? [{ value, currency }] : [];
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function singlePercentage(text: string): number | undefined {
  const values = [...text.matchAll(percentagePattern)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  return values.length === 1 ? values[0] : undefined;
}

function candidateId(input: {
  sourceId: string;
  documentId: string;
  category: ResearchCategory;
  property: string;
  value: string | number | boolean;
  unit?: string;
  currency?: string;
  academicYear?: string;
  supportingText: string;
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex")
    .slice(0, 32);
  return `candidate-rule-${digest}`;
}

function buildCandidate(input: {
  category: ClosedMetricCategory;
  property: string;
  value: string | number | boolean;
  supportingText: string;
  segment: ExtractionSegment;
  target: ExtractionTargetIdentity;
  unit?: string;
  currency?: string;
  academicYear?: string;
}): ClaimCandidate | undefined {
  if (!input.segment.text.includes(input.supportingText)) return undefined;
  const identity = input.target;
  const base = {
    universityId: identity.universityId,
    universityName: identity.universityName,
    programId: identity.programId,
    programName: identity.programName,
    category: input.category,
    property: input.property,
    value: input.value,
    unit: input.unit,
    currency: input.currency,
    academicYear: input.academicYear,
    sourceId: input.segment.sourceId,
    documentId: input.segment.documentId,
    extractionMethod: "rule" as const,
    supportingText: input.supportingText,
  };
  const id = candidateId({
    sourceId: input.segment.sourceId,
    documentId: input.segment.documentId,
    category: input.category,
    property: input.property,
    value: input.value,
    unit: input.unit,
    currency: input.currency,
    academicYear: input.academicYear,
    supportingText: input.supportingText,
  });
  const parsed = claimCandidateSchema.safeParse({ ...base, id });
  return parsed.success ? { ...parsed.data, supportingText: input.supportingText } : undefined;
}

function tuitionCandidate(window: string, input: DeterministicExtractionInput): ClaimCandidate | undefined {
  if (!annualTuition.test(window) || !annualContext.test(window)) return undefined;
  const amount = singleCurrencyAmount(window);
  const academicYear = singleYear(window);
  if (amount === undefined || academicYear === undefined) return undefined;
  return buildCandidate({
    category: "tuition",
    property: "annual tuition",
    value: amount.value,
    currency: amount.currency,
    unit: "per year",
    academicYear,
    supportingText: window,
    segment: input.segment,
    target: input.target,
  });
}

function scholarshipCandidate(window: string, input: DeterministicExtractionInput): ClaimCandidate | undefined {
  if (negativeAvailability.test(window) || !scholarshipAvailable.test(window)) return undefined;
  return buildCandidate({
    category: "scholarships",
    property: "scholarship available",
    value: true,
    supportingText: window,
    segment: input.segment,
    target: input.target,
  });
}

function researchCandidate(window: string, input: DeterministicExtractionInput): ClaimCandidate | undefined {
  if (negativeAvailability.test(window) || !researchAvailable.test(window)) return undefined;
  return buildCandidate({
    category: "research",
    property: "research opportunity available",
    value: true,
    supportingText: window,
    segment: input.segment,
    target: input.target,
  });
}

function outcomesCandidate(window: string, input: DeterministicExtractionInput): ClaimCandidate | undefined {
  if (!employmentRate.test(window)) return undefined;
  const value = singlePercentage(window);
  const academicYear = singleYear(window);
  if (value === undefined || academicYear === undefined) return undefined;
  return buildCandidate({
    category: "outcomes",
    property: "employment rate",
    value,
    unit: "%",
    academicYear,
    supportingText: window,
    segment: input.segment,
    target: input.target,
  });
}

export function extractDeterministicClosedMetrics(input: DeterministicExtractionInput): DeterministicClosedMetricResult {
  if (!isOfficialUniversityDocument(input.document, input.target.officialHost)) {
    return { candidates: [], completedCategories: [] };
  }

  const requested = canonicalizeResearchCategories(input.categories).filter(
    (category): category is ClosedMetricCategory => closedMetricCategories.has(category),
  );
  if (requested.length === 0) return { candidates: [], completedCategories: [] };

  const candidates: ClaimCandidate[] = [];
  const completed = new Set<ClosedMetricCategory>();
  for (const window of evidenceWindows(input.segment.text)) {
    for (const category of requested) {
      const candidate = category === "tuition"
        ? tuitionCandidate(window, input)
        : category === "scholarships"
          ? scholarshipCandidate(window, input)
          : category === "research"
            ? researchCandidate(window, input)
            : outcomesCandidate(window, input);
      if (candidate === undefined) continue;
      candidates.push(candidate);
      completed.add(category);
    }
  }

  return {
    candidates,
    completedCategories: canonicalizeResearchCategories([...completed]) as ClosedMetricCategory[],
  };
}
