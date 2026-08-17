import { searchResearchCatalog } from "@/lib/research/catalog/search";
import {
  normalizeResearchCatalogText,
  type ResearchCatalog,
  type ResearchCatalogProgram,
  type ResearchCatalogUniversity,
} from "@/lib/research/catalog/schema";
import { freezeResearchSubmission, type ResearchSubmissionSnapshot } from "./client-state";
import {
  RESEARCH_MODE_MAX_QUESTION_UTF16,
  researchModeCategoryOrder,
  researchModeRequestSchema,
  type ResearchModeCategory,
} from "./public-contracts";

export type ResearchFormState = {
  search: string;
  countryCode?: "US" | "GB" | "TH";
  degreeLevel?: "bachelor" | "master";
  subjectArea?: string;
  universityId?: string;
  programId?: string;
  categories: ResearchModeCategory[];
  question: string;
  intake: string;
  academicYear: string;
};

export type ResearchFormField =
  | "universityId"
  | "programId"
  | "categories"
  | "question"
  | "intake"
  | "academicYear"
  | "freeText";

const RESEARCH_MODE_MAX_SHORT_TEXT_UTF16 = 40;

export function createInitialResearchFormState(): ResearchFormState {
  return {
    search: "",
    categories: [...researchModeCategoryOrder],
    question: "",
    intake: "",
    academicYear: "",
  };
}

export function selectResearchUniversity(
  state: ResearchFormState,
  universityId: string,
  catalog: ResearchCatalog,
): ResearchFormState {
  if (!catalog.universities.some((university) => university.id === universityId)) {
    return state;
  }
  return { ...state, universityId, programId: undefined };
}

export function selectResearchProgram(
  state: ResearchFormState,
  programId: string,
  catalog: ResearchCatalog,
): ResearchFormState {
  const program = catalog.programs.find((item) => item.id === programId);
  if (program === undefined) return state;
  return {
    ...state,
    universityId: program.universityId,
    programId,
  };
}

export function clearResearchTarget(state: ResearchFormState): ResearchFormState {
  return { ...state, universityId: undefined, programId: undefined };
}

export function toggleResearchCategory(
  categories: readonly ResearchModeCategory[],
  category: ResearchModeCategory,
): ResearchModeCategory[] {
  const selected = new Set(categories);
  if (selected.has(category)) {
    selected.delete(category);
  } else {
    selected.add(category);
  }
  return researchModeCategoryOrder.filter((item) => selected.has(item));
}

export function listResearchSubjectFilters(catalog: ResearchCatalog): readonly string[] {
  const byNormalized = new Map<string, string>();
  for (const program of catalog.programs) {
    const normalized = normalizeResearchCatalogText(program.subjectArea);
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, program.subjectArea);
    }
  }
  return [...byNormalized.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "en-US"))
    .map(([, display]) => display);
}

function optionalTextField(
  value: string,
  field: Extract<ResearchFormField, "question" | "intake" | "academicYear">,
  maxLength: number,
  errors: Partial<Record<ResearchFormField, string>>,
): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > maxLength) {
    const noun = field === "question" ? "question" : field === "intake" ? "intake" : "academic year";
    errors[field] = `Keep the ${noun} to ${maxLength} characters or fewer.`;
    return undefined;
  }
  return trimmed;
}

export function buildResearchSubmission(
  state: ResearchFormState,
  catalog: ResearchCatalog,
): { ok: true; submission: ResearchSubmissionSnapshot } | { ok: false; fieldErrors: Partial<Record<ResearchFormField, string>> } {
  const fieldErrors: Partial<Record<ResearchFormField, string>> = {};

  const university: ResearchCatalogUniversity | undefined = catalog.universities.find(
    (item) => item.id === state.universityId,
  );
  if (university === undefined) {
    fieldErrors.universityId = "Select a supported university.";
  }

  let program: ResearchCatalogProgram | undefined;
  if (state.programId !== undefined) {
    program = catalog.programs.find((item) => item.id === state.programId);
    if (program === undefined || university === undefined || program.universityId !== university.id) {
      fieldErrors.programId = "Select a program that belongs to the chosen university.";
    }
  }

  if (state.categories.length === 0) {
    fieldErrors.categories = "Select at least one research category.";
  }

  const question = optionalTextField(
    state.question,
    "question",
    RESEARCH_MODE_MAX_QUESTION_UTF16,
    fieldErrors,
  );
  const intake = optionalTextField(
    state.intake,
    "intake",
    RESEARCH_MODE_MAX_SHORT_TEXT_UTF16,
    fieldErrors,
  );
  const academicYear = optionalTextField(
    state.academicYear,
    "academicYear",
    RESEARCH_MODE_MAX_SHORT_TEXT_UTF16,
    fieldErrors,
  );

  if (Object.keys(fieldErrors).length > 0 || university === undefined) {
    return { ok: false, fieldErrors };
  }

  const request = {
    universityId: university.id,
    ...(program === undefined ? {} : { programId: program.id }),
    categories: [...state.categories],
    ...(question === undefined ? {} : { question }),
    ...(intake === undefined ? {} : { intake }),
    ...(academicYear === undefined ? {} : { academicYear }),
  };

  const parsed = researchModeRequestSchema.safeParse(request);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: {
        universityId: fieldErrors.universityId ?? "Check the research request and try again.",
        ...(fieldErrors.programId !== undefined ? { programId: fieldErrors.programId } : {}),
        ...(fieldErrors.categories !== undefined ? { categories: fieldErrors.categories } : {}),
      },
    };
  }

  const targetLabel = program === undefined
    ? university.name
    : `${university.name} • ${program.name}`;

  return {
    ok: true,
    submission: freezeResearchSubmission({
      request: parsed.data,
      targetLabel,
    }),
  };
}

export function searchResearchFormCatalog(
  state: ResearchFormState,
  catalog: ResearchCatalog,
) {
  return searchResearchCatalog(catalog, {
    query: state.search,
    countryCode: state.countryCode,
    degreeLevel: state.degreeLevel,
    subjectArea: state.subjectArea,
  });
}
