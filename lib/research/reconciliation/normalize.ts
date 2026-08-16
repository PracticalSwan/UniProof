import {
  type ClaimCandidate,
  type ResearchCategory,
} from "@/lib/research/contracts";
import type { ResolvedResearchTarget } from "@/lib/research/discovery/types";
import { normalizeResearchIdentity } from "@/lib/research/identity";
import type {
  NormalizedCandidateView,
  ResearchPeriodContext,
  SemanticRelationshipKind,
} from "./types";

export function normalizeComparisonText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function normalizeProperty(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

const UNIT_ALIASES: Readonly<Record<string, string>> = {
  month: "month",
  months: "month",
  mo: "month",
  year: "year",
  years: "year",
  yr: "year",
  yrs: "year",
  week: "week",
  weeks: "week",
  day: "day",
  days: "day",
};

export function normalizeUnit(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const key = normalizeProperty(value);
  return UNIT_ALIASES[key] ?? key;
}

export function normalizeCurrency(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(normalized) ? normalized : normalizeComparisonText(value).toUpperCase();
}

function opaquePeriod(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return normalizeComparisonText(value).toLocaleLowerCase("en-US");
}

/** Normalize only unambiguous academic-year forms; leave unknown tokens opaque. */
export function normalizeAcademicYear(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeComparisonText(value).toLocaleLowerCase("en-US");
  const match = /^(?:ay\s*)?(\d{4})(?:\s*[/\-]\s*(\d{2,4}))?$/u.exec(normalized);
  if (match === null) return normalized;
  if (match[2] === undefined) return match[1];
  const firstYear = Number(match[1]);
  const rawSecond = match[2];
  let secondYear = Number(rawSecond);
  if (rawSecond.length === 2) {
    secondYear += Math.floor(firstYear / 100) * 100;
    if (secondYear <= firstYear) secondYear += 100;
  }
  if (!Number.isSafeInteger(firstYear) || !Number.isSafeInteger(secondYear) || secondYear !== firstYear + 1) return normalized;
  return `${match[1]}-${String(secondYear).padStart(4, "0")}`;
}

export function normalizeIntake(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeComparisonText(value).toLocaleLowerCase("en-US");
  const month = /^(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)$/u.exec(normalized);
  if (month !== null) {
    const months: Record<string, string> = {
      january: "january", jan: "january", february: "february", feb: "february",
      march: "march", mar: "march", april: "april", apr: "april", may: "may",
      june: "june", jun: "june", july: "july", jul: "july", august: "august", aug: "august",
      september: "september", sept: "september", sep: "september", october: "october", oct: "october",
      november: "november", nov: "november", december: "december", dec: "december",
    };
    return months[month[1]];
  }
  return opaquePeriod(value);
}

export function normalizeEffectiveDate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return opaquePeriod(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (!Number.isInteger(year) || day < 1 || day > daysInMonth) return opaquePeriod(value);
  return value;
}

function scalarValueKey(value: string | number | boolean): { type: "string" | "number" | "boolean"; key: string } {
  if (typeof value === "number") return { type: "number", key: Number.isFinite(value) ? String(value) : "non-finite" };
  if (typeof value === "boolean") return { type: "boolean", key: value ? "true" : "false" };
  return { type: "string", key: normalizeComparisonText(value) };
}

function targetUniversityKey(candidate: ClaimCandidate, target: ResolvedResearchTarget): string {
  if (candidate.universityId !== undefined) return `id:${candidate.universityId}`;
  if (candidate.universityName !== undefined) {
    const candidateName = normalizeResearchIdentity(candidate.universityName);
    const targetName = target.universityName === undefined ? undefined : normalizeResearchIdentity(target.universityName);
    if (target.universityId !== undefined && targetName !== undefined && candidateName === targetName) {
      return `id:${target.universityId}`;
    }
    return `name:${candidateName}`;
  }
  if (target.universityId !== undefined) return `id:${target.universityId}`;
  return target.universityName === undefined ? "" : `name:${normalizeResearchIdentity(target.universityName)}`;
}

function targetProgramKey(candidate: ClaimCandidate, target: ResolvedResearchTarget): string | undefined {
  if (candidate.programId !== undefined && candidate.programId !== null) return `id:${candidate.programId}`;
  if (candidate.programName !== undefined) {
    const candidateName = normalizeResearchIdentity(candidate.programName);
    const targetName = target.programName === undefined ? undefined : normalizeResearchIdentity(target.programName);
    if (target.programId !== undefined && targetName !== undefined && candidateName === targetName) {
      return `id:${target.programId}`;
    }
    return `name:${candidateName}`;
  }
  // An absent program scope must not be silently filled from the requested
  // target.  It may be a general university rule, not a program-specific fact.
  if (target.programId !== undefined || target.programName !== undefined) return "unscoped";
  return undefined;
}

export function buildNormalizedCandidateView(
  candidate: ClaimCandidate,
  target: ResolvedResearchTarget,
): NormalizedCandidateView {
  const scalar = scalarValueKey(candidate.value);
  const academicYearKey = normalizeAcademicYear(candidate.academicYear);
  const intakeKey = normalizeIntake(candidate.intake);
  const effectiveDateKey = normalizeEffectiveDate(candidate.effectiveDate);
  const programKey = targetProgramKey(candidate, target);
  const universityKey = targetUniversityKey(candidate, target);
  const propertyKey = normalizeProperty(candidate.property);
  const unitKey = normalizeUnit(candidate.unit);
  const currencyKey = normalizeCurrency(candidate.currency);
  const passageKey = normalizeComparisonText(candidate.supportingText);
  const scopeKey = JSON.stringify([
    universityKey,
    programKey ?? null,
    target.degreeLevel ?? null,
    candidate.category,
    propertyKey,
    academicYearKey ?? null,
    intakeKey ?? null,
    effectiveDateKey ?? null,
  ]);
  const valueKey = JSON.stringify([scalar.type, scalar.key, unitKey ?? null, currencyKey ?? null]);
  return {
    candidate,
    universityKey,
    programKey,
    propertyKey,
    valueKey,
    valueType: scalar.type,
    unitKey,
    currencyKey,
    academicYearKey,
    intakeKey,
    effectiveDateKey,
    passageKey,
    scopeKey,
  };
}

export function normalizedCandidateViews(
  candidates: readonly ClaimCandidate[],
  target: ResolvedResearchTarget,
): NormalizedCandidateView[] {
  return [...candidates]
    .map((candidate) => buildNormalizedCandidateView(candidate, target))
    .sort((left, right) => left.candidate.id.localeCompare(right.candidate.id));
}

export function hardScopeRelationship(
  left: NormalizedCandidateView,
  right: NormalizedCandidateView,
  requestedPeriod?: ResearchPeriodContext,
): SemanticRelationshipKind | undefined {
  if (left.universityKey !== right.universityKey || left.programKey !== right.programKey) return "different-scope";
  if (left.candidate.category !== right.candidate.category || left.propertyKey !== right.propertyKey) return "different-scope";
  if (left.academicYearKey !== undefined && right.academicYearKey !== undefined && left.academicYearKey !== right.academicYearKey) {
    return "different-period";
  }
  if (left.intakeKey !== undefined && right.intakeKey !== undefined && left.intakeKey !== right.intakeKey) {
    return "different-period";
  }
  if (left.effectiveDateKey !== undefined && right.effectiveDateKey !== undefined && left.effectiveDateKey !== right.effectiveDateKey) {
    return "different-period";
  }
  if (requestedPeriod?.academicYear !== undefined) {
    const requestedAcademicYear = normalizeAcademicYear(requestedPeriod.academicYear);
    if ((left.academicYearKey !== undefined && requestedAcademicYear !== left.academicYearKey) ||
        (right.academicYearKey !== undefined && requestedAcademicYear !== right.academicYearKey)) return "different-period";
  }
  if (requestedPeriod?.intake !== undefined) {
    const requestedIntake = normalizeIntake(requestedPeriod.intake);
    if ((left.intakeKey !== undefined && requestedIntake !== left.intakeKey) ||
        (right.intakeKey !== undefined && requestedIntake !== right.intakeKey)) return "different-period";
  }
  if (requestedPeriod?.effectiveDate !== undefined) {
    const requestedEffectiveDate = normalizeEffectiveDate(requestedPeriod.effectiveDate);
    if ((left.effectiveDateKey !== undefined && requestedEffectiveDate !== left.effectiveDateKey) ||
        (right.effectiveDateKey !== undefined && requestedEffectiveDate !== right.effectiveDateKey)) return "different-period";
  }
  return undefined;
}

function couldContainUnmodeledQualifier(left: string, right: string): boolean {
  const qualifier = /\b(campus|campuses|modality|online|on[- ]campus|residen(?:t|cy)|cohort|exception|except|conditional|condition|international|domestic|full[- ]time|part[- ]time)\b/iu;
  return qualifier.test(left) || qualifier.test(right);
}

export function passagesEquivalent(left: string, right: string): boolean {
  return normalizeComparisonText(left) === normalizeComparisonText(right);
}

export function exactEquivalentRelationship(
  left: NormalizedCandidateView,
  right: NormalizedCandidateView,
  requestedPeriod?: ResearchPeriodContext,
): "equivalent" | "different-period" | "different-scope" | undefined {
  const hard = hardScopeRelationship(left, right, requestedPeriod);
  if (hard !== undefined) return hard === "different-period" || hard === "different-scope" ? hard : undefined;
  if (left.valueKey !== right.valueKey) return undefined;
  const hasUnknownPeriodDimension =
    (left.academicYearKey === undefined) !== (right.academicYearKey === undefined) ||
    (left.intakeKey === undefined) !== (right.intakeKey === undefined) ||
    (left.effectiveDateKey === undefined) !== (right.effectiveDateKey === undefined);
  if (hasUnknownPeriodDimension) return undefined;
  if (!passagesEquivalent(left.candidate.supportingText, right.candidate.supportingText)) return undefined;
  if (couldContainUnmodeledQualifier(left.candidate.supportingText, right.candidate.supportingText)) return undefined;
  return "equivalent";
}

export function deterministicRelationshipForPair(
  left: ClaimCandidate,
  right: ClaimCandidate,
  target: ResolvedResearchTarget,
  requestedPeriod?: ResearchPeriodContext,
): SemanticRelationshipKind | undefined {
  const leftView = buildNormalizedCandidateView(left, target);
  const rightView = buildNormalizedCandidateView(right, target);
  return exactEquivalentRelationship(leftView, rightView, requestedPeriod);
}

export function typedValuesEqual(left: ClaimCandidate, right: ClaimCandidate): boolean {
  const leftValue = scalarValueKey(left.value);
  const rightValue = scalarValueKey(right.value);
  return leftValue.type === rightValue.type && leftValue.key === rightValue.key && normalizeUnit(left.unit) === normalizeUnit(right.unit) && normalizeCurrency(left.currency) === normalizeCurrency(right.currency);
}

export function categoryOf(candidate: ClaimCandidate): ResearchCategory {
  return candidate.category;
}
