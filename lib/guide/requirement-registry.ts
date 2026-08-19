import type { ResearchModeCategory } from "@/lib/research/mode/public-contracts";
import type { GuideQualificationLevel } from "./contracts";

export type GuideRequirementSemantic =
  | "minimum-qualification-level"
  | "required-subject-background"
  | "minimum-gpa"
  | "ielts-overall-minimum"
  | "ielts-component-minimum"
  | "toefl-ibt-overall-minimum"
  | "toefl-ibt-component-minimum"
  | "pte-academic-overall-minimum"
  | "application-deadline"
  | "application-fee"
  | "required-document"
  | "annual-tuition"
  | "total-tuition"
  | "scholarship-availability"
  | "scholarship-deadline";

export type GuideRequirementDefinition = Readonly<{
  semantic: GuideRequirementSemantic;
  category: ResearchModeCategory;
  aliases: readonly string[];
  scalarType: "number" | "string" | "boolean";
  cardinality: "singleton" | "collection";
  assessmentPolicy:
    | "qualification-minimum"
    | "subject-probable"
    | "definitive-threshold"
    | "manual-only"
    | "timeline"
    | "constraint";
}>;

export function normalizeGuidePropertyKey(input: string): string {
  return input
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/[:\-_]+/g, " ")
    .replace(/[ \t\n\r\f\v]+/g, " ")
    .trim();
}

const definitions: readonly GuideRequirementDefinition[] = [
  {
    semantic: "minimum-qualification-level",
    category: "admissions",
    aliases: ["minimum qualification level", "minimum degree level", "required qualification level", "required degree level"],
    scalarType: "string",
    cardinality: "singleton",
    assessmentPolicy: "qualification-minimum",
  },
  {
    semantic: "required-subject-background",
    category: "admissions",
    aliases: ["required subject background", "required academic background", "required field of study", "required degree subject", "subject background"],
    scalarType: "string",
    cardinality: "singleton",
    assessmentPolicy: "subject-probable",
  },
  {
    semantic: "minimum-gpa",
    category: "admissions",
    aliases: ["minimum gpa", "gpa requirement", "minimum grade point average", "minimum cumulative gpa"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "definitive-threshold",
  },
  {
    semantic: "ielts-overall-minimum",
    category: "admissions",
    aliases: ["minimum ielts overall", "ielts overall minimum", "minimum ielts score", "ielts minimum score"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "definitive-threshold",
  },
  {
    semantic: "ielts-component-minimum",
    category: "admissions",
    aliases: ["minimum ielts component", "ielts component minimum", "minimum ielts band", "ielts band minimum"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "definitive-threshold",
  },
  {
    semantic: "toefl-ibt-overall-minimum",
    category: "admissions",
    aliases: ["minimum toefl ibt overall", "toefl ibt overall minimum", "minimum toefl ibt score", "toefl ibt minimum score"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "definitive-threshold",
  },
  {
    semantic: "toefl-ibt-component-minimum",
    category: "admissions",
    aliases: ["minimum toefl ibt component", "toefl ibt component minimum", "toefl component minimum"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "definitive-threshold",
  },
  {
    semantic: "pte-academic-overall-minimum",
    category: "admissions",
    aliases: ["minimum pte academic score", "pte academic minimum", "pte academic overall minimum"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "definitive-threshold",
  },
  {
    semantic: "application-deadline",
    category: "admissions",
    aliases: ["application deadline", "admissions deadline", "deadline"],
    scalarType: "string",
    cardinality: "singleton",
    assessmentPolicy: "timeline",
  },
  {
    semantic: "application-fee",
    category: "admissions",
    aliases: ["application fee", "admission application fee", "application charge"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "manual-only",
  },
  {
    semantic: "required-document",
    category: "admissions",
    aliases: ["required document", "required documents", "application document", "application documents", "supporting document", "supporting documents"],
    scalarType: "string",
    cardinality: "collection",
    assessmentPolicy: "manual-only",
  },
  {
    semantic: "annual-tuition",
    category: "tuition",
    aliases: ["annual tuition", "annual tuition fee", "annual tuition fees", "tuition per year", "yearly tuition"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "constraint",
  },
  {
    semantic: "total-tuition",
    category: "tuition",
    aliases: ["total tuition", "total tuition fee", "total tuition fees", "total program tuition", "program tuition total"],
    scalarType: "number",
    cardinality: "singleton",
    assessmentPolicy: "constraint",
  },
  {
    semantic: "scholarship-availability",
    category: "scholarships",
    aliases: ["scholarship available", "scholarships available", "scholarship availability", "funding available", "scholarship application available"],
    scalarType: "boolean",
    cardinality: "singleton",
    assessmentPolicy: "manual-only",
  },
  {
    semantic: "scholarship-deadline",
    category: "scholarships",
    aliases: ["scholarship deadline", "scholarship application deadline", "funding deadline"],
    scalarType: "string",
    cardinality: "singleton",
    assessmentPolicy: "timeline",
  },
];

const propertyLookup = new Map<string, GuideRequirementDefinition>();
for (const definition of definitions) {
  for (const alias of definition.aliases) {
    const key = normalizeGuidePropertyKey(alias);
    if (propertyLookup.has(key)) {
      throw new Error(`Guide property alias collision: ${key}`);
    }
    propertyLookup.set(key, definition);
  }
}

export function lookupGuideRequirement(
  property: string,
  category: ResearchModeCategory,
): GuideRequirementDefinition | undefined {
  const definition = propertyLookup.get(normalizeGuidePropertyKey(property));
  if (definition === undefined || definition.category !== category) return undefined;
  return definition;
}

export function getAllGuideRequirementDefinitions(): readonly GuideRequirementDefinition[] {
  return definitions;
}

export const guideQualificationValueAliases: ReadonlyMap<string, GuideQualificationLevel> = new Map([
  ["secondary", "secondary"],
  ["high school", "secondary"],
  ["diploma", "diploma"],
  ["bachelor", "bachelor"],
  ["bachelors", "bachelor"],
  ["bachelor degree", "bachelor"],
  ["undergraduate degree", "bachelor"],
  ["master", "master"],
  ["masters", "master"],
  ["master degree", "master"],
  ["graduate degree", "master"],
  ["doctorate", "doctorate"],
  ["phd", "doctorate"],
  ["doctoral degree", "doctorate"],
]);

export type GuideSubjectFamily = "computing" | "ai" | "data";

export const guideSubjectFamilyAliases: ReadonlyMap<string, GuideSubjectFamily> = new Map([
  ["computer science", "computing"],
  ["computing", "computing"],
  ["software engineering", "computing"],
  ["computer engineering", "computing"],
  ["information technology", "computing"],
  ["information systems", "computing"],
  ["artificial intelligence", "ai"],
  ["machine learning", "ai"],
  ["data science", "data"],
  ["data analytics", "data"],
]);

export const guideGpaScaleUnitAliases: ReadonlyMap<string, number> = new Map([
  ["4.0", 4],
  ["4.00", 4],
  ["4.0 scale", 4],
  ["4.00 scale", 4],
  ["4", 4],
  ["5", 5],
  ["5.0", 5],
  ["5.00", 5],
  ["5.0 scale", 5],
  ["10", 10],
  ["10.0", 10],
  ["10.00", 10],
  ["10 point", 10],
  ["10.0 scale", 10],
  ["100", 100],
  ["100 point", 100],
  ["percentage", 100],
]);

export function lookupGuideSubjectFamily(input: string): GuideSubjectFamily | undefined {
  return guideSubjectFamilyAliases.get(normalizeGuidePropertyKey(input));
}

export function lookupGuideQualificationValue(input: string): GuideQualificationLevel | undefined {
  return guideQualificationValueAliases.get(normalizeGuidePropertyKey(input));
}

export function lookupGuideGpaScale(unit: string): number | undefined {
  return guideGpaScaleUnitAliases.get(normalizeGuidePropertyKey(unit));
}

export const GUIDE_COMPARABLE_CURRENCIES: ReadonlySet<string> = new Set(["USD", "GBP", "THB"]);
