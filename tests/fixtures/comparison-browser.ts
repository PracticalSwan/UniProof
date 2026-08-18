import { researchModeResponseSchema, type ResearchModeResponse, type ResearchModeCategory } from "@/lib/research/mode/public-contracts";
import { makeComparisonDossier, type ComparisonFixtureClaim, type ComparisonFixtureCategoryState } from "./comparison-dossiers";

export const comparisonBrowserTargets = {
  mit: { universityId: "university-mit", programId: "program-mit-artificial-intelligence-decision-making-bs" },
  stanford: { universityId: "university-stanford", programId: "program-stanford-computer-science-bs" },
  georgiaTech: { universityId: "university-georgia-tech", programId: "program-georgia-tech-computer-science-bs" },
  berkeley: { universityId: "university-berkeley", programId: "program-berkeley-computer-science-ba" },
} as const;

export const comparisonBrowserCategories = [
  "admissions",
  "tuition",
  "scholarships",
  "program-structure",
  "research",
  "outcomes",
  "support",
] as const satisfies readonly ResearchModeCategory[];

const defaultStates: Partial<Record<ResearchModeCategory, ComparisonFixtureCategoryState>> = {
  admissions: "unknown",
  "program-structure": "unknown",
};

export function makeComparisonBrowserResponse(options: {
  target: typeof comparisonBrowserTargets[keyof typeof comparisonBrowserTargets];
  tuition: number;
  employment: number;
  research: boolean;
  scholarship: boolean;
  support?: boolean;
  extraClaims?: readonly ComparisonFixtureClaim[];
  states?: Partial<Record<ResearchModeCategory, ComparisonFixtureCategoryState>>;
  canonicalUniversityName?: string;
  canonicalProgramName?: string;
}): ResearchModeResponse {
  const key = options.target.programId;
  const claims: ComparisonFixtureClaim[] = [
    { id: `${key}-tuition`, category: "tuition", property: "annual tuition", value: options.tuition, currency: "USD", academicYear: "2027-28" },
    { id: `${key}-research`, category: "research", property: "research opportunity available", value: options.research },
    { id: `${key}-scholarship`, category: "scholarships", property: "scholarship available", value: options.scholarship },
    { id: `${key}-employment`, category: "outcomes", property: "employment rate", value: options.employment, unit: "%", academicYear: "2027-28" },
    { id: `${key}-support`, category: "support", property: "international student services available", value: options.support ?? true },
    ...(options.extraClaims ?? []),
  ];
  const dossier = makeComparisonDossier({
    ...options.target,
    categories: comparisonBrowserCategories,
    claims,
    states: { ...defaultStates, ...options.states },
    canonicalUniversityName: options.canonicalUniversityName,
    canonicalProgramName: options.canonicalProgramName,
  });
  return researchModeResponseSchema.parse({ ok: true, dossier });
}

export function defaultComparisonBrowserResponses(): readonly ResearchModeResponse[] {
  return [
    makeComparisonBrowserResponse({ target: comparisonBrowserTargets.mit, tuition: 10_000, employment: 82, research: true, scholarship: true }),
    makeComparisonBrowserResponse({ target: comparisonBrowserTargets.stanford, tuition: 20_000, employment: 91, research: true, scholarship: false }),
  ];
}
