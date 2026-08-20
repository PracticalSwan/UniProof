import type { ResearchCatalogCountryCode } from "@/lib/research/catalog/countries";
import { searchResearchCatalog } from "@/lib/research/catalog/search";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import { researchModeCategoryOrder, type ResearchModeCategory } from "@/lib/research/mode/public-contracts";
import {
  comparisonDefaultWeights,
  comparisonPriorityCategory,
  comparisonPriorityOrder,
  comparisonSubmissionSchema,
  comparisonTargetKey,
  freezeComparisonSubmission,
  type ComparisonPriority,
  type ComparisonSubmission,
  type ComparisonTarget,
} from "./contracts";

export type ComparisonFormState = {
  search: string;
  countryCode?: ResearchCatalogCountryCode;
  degreeLevel?: "bachelor" | "master";
  subjectArea?: string;
  targets: ComparisonTarget[];
  categories: ResearchModeCategory[];
  weights: Record<ComparisonPriority, string>;
  showRankingEvidence: boolean;
  showAnecdotalEvidence: boolean;
  intake: string;
  academicYear: string;
};

export type ComparisonFormField =
  | "targets"
  | "categories"
  | "weights"
  | "intake"
  | "academicYear"
  | `weight-${ComparisonPriority}`;

export type ComparisonFormValidation = {
  fieldErrors: Partial<Record<ComparisonFormField, string>>;
  submission?: ComparisonSubmission;
};

const MAX_SHORT_TEXT_UTF16 = 40;

export function createInitialComparisonFormState(): ComparisonFormState {
  return {
    search: "",
    targets: [],
    categories: [...researchModeCategoryOrder],
    weights: Object.fromEntries(
      comparisonPriorityOrder.map((priority) => [priority, String(comparisonDefaultWeights[priority])]),
    ) as Record<ComparisonPriority, string>,
    showRankingEvidence: false,
    showAnecdotalEvidence: false,
    intake: "",
    academicYear: "",
  };
}

export function searchComparisonCatalog(state: ComparisonFormState, catalog: ResearchCatalog) {
  return searchResearchCatalog(catalog, {
    query: state.search,
    countryCode: state.countryCode,
    degreeLevel: state.degreeLevel,
    subjectArea: state.subjectArea,
  });
}

export function toggleComparisonCategory(
  categories: readonly ResearchModeCategory[],
  category: ResearchModeCategory,
): ResearchModeCategory[] {
  const selected = new Set(categories);
  if (selected.has(category)) selected.delete(category);
  else selected.add(category);
  return researchModeCategoryOrder.filter((item) => selected.has(item));
}

export function addComparisonTarget(
  state: ComparisonFormState,
  target: ComparisonTarget,
  catalog: ResearchCatalog,
): ComparisonFormState {
  if (state.targets.length >= 4) return state;
  const university = catalog.universities.find((item) => item.id === target.universityId);
  if (university === undefined) return state;
  if (target.programId !== undefined) {
    const program = catalog.programs.find((item) => item.id === target.programId);
    if (program === undefined || program.universityId !== university.id) return state;
  }
  const key = comparisonTargetKey(target);
  if (state.targets.some((item) => comparisonTargetKey(item) === key)) return state;
  return { ...state, targets: [...state.targets, { ...target }] };
}

export function removeComparisonTarget(
  state: ComparisonFormState,
  target: ComparisonTarget,
): ComparisonFormState {
  const key = comparisonTargetKey(target);
  return { ...state, targets: state.targets.filter((item) => comparisonTargetKey(item) !== key) };
}

function optionalShortText(
  value: string,
  field: "intake" | "academicYear",
  errors: Partial<Record<ComparisonFormField, string>>,
): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > MAX_SHORT_TEXT_UTF16) {
    errors[field] = `Keep the ${field === "intake" ? "intake" : "academic year"} to ${MAX_SHORT_TEXT_UTF16} characters or fewer.`;
    return undefined;
  }
  return trimmed;
}

function parseWeights(
  values: ComparisonFormState["weights"],
  errors: Partial<Record<ComparisonFormField, string>>,
): Record<ComparisonPriority, number> | undefined {
  const parsed = {} as Record<ComparisonPriority, number>;
  let invalid = false;
  for (const priority of comparisonPriorityOrder) {
    const raw = values[priority];
    if (!/^(?:0|[1-9]\d{0,2})$/.test(raw)) {
      errors[`weight-${priority}`] = "Enter a whole-number weight from 0 to 100.";
      invalid = true;
      continue;
    }
    const value = Number(raw);
    if (value > 100) {
      errors[`weight-${priority}`] = "Enter a whole-number weight from 0 to 100.";
      invalid = true;
      continue;
    }
    parsed[priority] = value;
  }
  if (invalid) {
    errors.weights = "All five priorities must be whole numbers from 0 to 100.";
    return undefined;
  }
  const total = comparisonPriorityOrder.reduce((sum, priority) => sum + parsed[priority], 0);
  if (total <= 0) {
    errors.weights = "Set at least one comparison priority above 0.";
    return undefined;
  }
  return parsed;
}

function validateTargets(
  targets: readonly ComparisonTarget[],
  catalog: ResearchCatalog,
  errors: Partial<Record<ComparisonFormField, string>>,
): void {
  if (targets.length < 2 || targets.length > 4) {
    errors.targets = "Select exactly two to four unique supported targets.";
    return;
  }
  const keys = targets.map(comparisonTargetKey);
  if (new Set(keys).size !== keys.length) {
    errors.targets = "Each comparison target must be unique.";
    return;
  }

  const programs = [] as NonNullable<ReturnType<typeof catalog.programs.find>>[];
  for (const target of targets) {
    const university = catalog.universities.find((item) => item.id === target.universityId);
    if (university === undefined) {
      errors.targets = "Every comparison target must be in the supported catalog.";
      return;
    }
    if (target.programId !== undefined) {
      const program = catalog.programs.find((item) => item.id === target.programId);
      if (program === undefined || program.universityId !== university.id) {
        errors.targets = "Every selected program must belong to its selected supported university.";
        return;
      }
      programs.push(program);
    }
  }
  if (programs.length !== 0 && programs.length !== targets.length) {
    errors.targets = "Compare university targets together or program targets together, not a mixed scope.";
    return;
  }
  if (programs.length === targets.length && new Set(programs.map((program) => program.degreeLevel)).size !== 1) {
    errors.targets = "Program comparisons must use one degree level.";
  }
}

export function validateComparisonForm(
  state: ComparisonFormState,
  catalog: ResearchCatalog,
): ComparisonFormValidation {
  const fieldErrors: Partial<Record<ComparisonFormField, string>> = {};
  validateTargets(state.targets, catalog, fieldErrors);

  if (state.categories.length === 0) {
    fieldErrors.categories = "Select at least one Research category.";
  }
  const canonicalCategories = researchModeCategoryOrder.filter((category) => state.categories.includes(category));
  if (new Set(state.categories).size !== state.categories.length || canonicalCategories.length !== state.categories.length) {
    fieldErrors.categories = "Use only unique supported Research categories.";
  }

  const weights = parseWeights(state.weights, fieldErrors);
  if (weights !== undefined) {
    const selectedCategories = new Set(canonicalCategories);
    const missing = comparisonPriorityOrder.filter(
      (priority) => weights[priority] > 0 && !selectedCategories.has(comparisonPriorityCategory[priority]),
    );
    if (missing.length > 0) {
      fieldErrors.categories = "Every positive priority needs its backing Research category selected, or set that priority to 0.";
    }
  }

  const intake = optionalShortText(state.intake, "intake", fieldErrors);
  const academicYear = optionalShortText(state.academicYear, "academicYear", fieldErrors);

  if (Object.keys(fieldErrors).length > 0 || weights === undefined) return { fieldErrors };

  const parsed = comparisonSubmissionSchema.safeParse({
    targets: state.targets.map((target) => ({ ...target })),
    categories: canonicalCategories,
    weights,
    showRankingEvidence: state.showRankingEvidence,
    showAnecdotalEvidence: state.showAnecdotalEvidence,
    ...(intake === undefined ? {} : { intake }),
    ...(academicYear === undefined ? {} : { academicYear }),
  });
  if (!parsed.success) {
    return { fieldErrors: { targets: "Check the comparison selections and priorities, then try again." } };
  }

  return { fieldErrors, submission: freezeComparisonSubmission(parsed.data) };
}
