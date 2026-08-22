import {
  researchRequestSchema,
  type ResearchCategory,
  type ResearchRequest,
} from "@/lib/research/contracts";
import {
  RESEARCH_MAX_DISCOVERY_QUERIES,
  RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS,
  RESEARCH_MAX_DISCOVERY_QUERY_WORDS,
  RESEARCH_MAX_DISCOVERY_RESULTS,
} from "@/lib/security/research-limits";
import type { DiscoveryQuery, ResolvedResearchTarget, TargetResolutionResult } from "./types";

const CATEGORY_INTENTS: Record<ResearchCategory, readonly string[]> = {
  admissions: ["admissions requirements", "entry requirements", "English language", "application deadline"],
  tuition: ["tuition", "fees", "cost", "academic year"],
  scholarships: ["scholarships", "funding", "eligibility", "deadline"],
  "program-structure": ["curriculum", "modules courses", "credits", "duration", "core elective structure"],
  research: ["research groups", "labs", "faculty", "research areas"],
  outcomes: ["graduate outcomes", "employment", "career outcomes"],
  support: ["international student support", "academic services", "student services"],
};

export function researchCategoryIntentTerms(category: ResearchCategory): readonly string[] {
  return CATEGORY_INTENTS[category];
}

function words(value: string): string[] {
  return value.trim().split(/\s+/u).filter(Boolean);
}

/**
 * Search providers receive only public research intent. These checks are
 * deliberately conservative around personal values while allowing ordinary
 * public questions such as "What is the GPA requirement?".
 */
export function containsSensitiveResearchData(value: string): boolean {
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (normalized.length === 0) return false;

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(normalized)) return true;

  const digitCount = (normalized.match(/\d/g) ?? []).length;
  if (
    digitCount >= 8 &&
    /\b(?:phone|mobile|telephone|tel|whatsapp|contact\s+(?:number|no\.?)|call)\b/iu.test(normalized)
  ) {
    return true;
  }

  if (
    /\b(?:gpa|cgpa|grade|score)\b\s*(?:is|:|=)?\s*\d(?:\.\d+)?/iu.test(normalized) ||
    /\b(?:my|i(?:'m| am)?|student)\b[\s\S]{0,48}\b(?:gpa|cgpa|grade|score)\b[\s\S]{0,18}\d/iu.test(normalized)
  ) {
    return true;
  }

  if (
    /\b(?:my|i(?:'m| am| have| got| scored)?)\b[\s\S]{0,48}\b(?:ielts|toefl|pte|duolingo)\b[\s\S]{0,18}\d/iu.test(normalized) ||
    /\b(?:my|i(?:'m| am| have| got| scored)?)\b[\s\S]{0,48}\d(?:\.\d+)?[\s\S]{0,18}\b(?:ielts|toefl|pte|duolingo)\b/iu.test(normalized) ||
    /\b(?:my|i(?:'m| am| have)?)\b[\s\S]{0,48}\bbudget\b[\s\S]{0,24}\d/iu.test(normalized) ||
    /\b[\p{L}][\p{L}\p{M}'’-]{1,30}\s+(?:citizen|national)\b/iu.test(normalized) ||
    /\b(?:citizen|national)\s+of\s+[\p{L}][\p{L}\p{M}'’ -]{1,40}/iu.test(normalized)
  ) {
    return true;
  }

  if (
    /\b(?:my|i(?:'m| am)?|student)\b[\s\S]{0,48}\b(?:citizenship|nationality|passport|national\s+id|transcript|bank\s+statement|recommendation\s+letter|visa\s+document)\b/iu.test(normalized) ||
    /\b(?:citizenship|nationality|passport|national\s+id)\b\s*(?:is|:|=)\s*[^,.;!?]{2,}/iu.test(normalized) ||
    /\b(?:passport(?:\s+number)?|national\s+id(?:\s+number)?|student\s+id)\b[\s:#=-]*[A-Z0-9-]*\d[A-Z0-9-]*\b/iu.test(normalized) ||
    /\b(?:transcript|bank\s+statement|recommendation\s+letter|visa\s+document)\b\s*[:=]/iu.test(normalized) ||
    /\b(?:attached|uploaded|here\s+is)\b[\s\S]{0,48}\b(?:transcript|passport|national\s+id|bank\s+statement|recommendation\s+letter|visa\s+document)\b/iu.test(normalized)
  ) {
    return true;
  }

  return false;
}

export function boundDiscoveryQuery(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const boundedWords = words(normalized).slice(0, RESEARCH_MAX_DISCOVERY_QUERY_WORDS);
  let bounded = boundedWords.join(" ");
  if (bounded.length > RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS) {
    bounded = bounded.slice(0, RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS).trim();
    const lastSpace = bounded.lastIndexOf(" ");
    if (lastSpace > 0) bounded = bounded.slice(0, lastSpace);
  }
  return bounded;
}

function targetLabel(target: ResolvedResearchTarget): string {
  const labels = [target.universityName, target.programName, target.subjectArea].filter(
    (value): value is string => value !== undefined,
  );
  return labels.join(" ");
}

function categoryQueryText(
  target: ResolvedResearchTarget,
  category: ResearchCategory,
  request: ResearchRequest,
  includeQuestion: boolean,
): string {
  const label = targetLabel(target);
  const context = [request.intake, request.academicYear].filter(Boolean).join(" ");
  const question = includeQuestion ? request.question ?? "" : "";
  const intent = CATEGORY_INTENTS[category].join(" ");
  return boundDiscoveryQuery([label, intent, context, question].filter(Boolean).join(" "));
}

export function planDiscoveryQueries(
  input: ResearchRequest | unknown,
  resolution: TargetResolutionResult,
): readonly DiscoveryQuery[] {
  const parsed = researchRequestSchema.safeParse(input);
  if (!parsed.success || !resolution.resolved) return [];

  const request = parsed.data;
  const target = resolution.target;
  const includeQuestion = request.question === undefined || !containsSensitiveResearchData(request.question);
  const planned: DiscoveryQuery[] = [];

  // A sensitive question may not be the only thing that gets sent to a
  // provider. If it is the sole target, fail closed instead of replacing it
  // with a generic query that would not answer the user's request.
  if (!includeQuestion && targetLabel(target) === "") return [];

  for (const category of request.categories) {
    planned.push({
      id: `category-${category}`,
      kind: "category",
      category,
      text: categoryQueryText(target, category, request, includeQuestion),
      target,
      locale: request.locale,
      countryCode: target.countryCode,
      maxResults: RESEARCH_MAX_DISCOVERY_RESULTS,
    });
  }

  if (
    planned.length < RESEARCH_MAX_DISCOVERY_QUERIES &&
    target.universityName !== undefined &&
    target.officialUrl === undefined
  ) {
    planned.push({
      id: "identity-university",
      kind: "identity",
      text: boundDiscoveryQuery(`${target.universityName} official university website`),
      target,
      locale: request.locale,
      countryCode: target.countryCode,
      maxResults: RESEARCH_MAX_DISCOVERY_RESULTS,
    });
  }

  return planned.slice(0, RESEARCH_MAX_DISCOVERY_QUERIES);
}

export function categoryIntent(category: ResearchCategory): readonly string[] {
  return CATEGORY_INTENTS[category];
}
