import {
  guideApplicantProfileSchema,
  guidePublicContextSchema,
  guideSubmissionSchema,
  GUIDE_RESEARCH_CATEGORIES,
  formatLocalAssessmentDate,
  type GuideApplicantProfile,
  type GuideSubmission,
} from "./contracts";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import { researchModeRequestSchema, type ResearchModeRequest } from "@/lib/research/mode/public-contracts";

export type GuideDraft = Readonly<{
  universityId: string;
  programId: string;
  citizenship: string;
  currentCountry: string;
  qualificationLevel: string;
  qualificationTitle: string;
  qualificationSubject: string;
  gpaValue: string;
  gpaScale: string;
  englishKind: string;
  englishOverall: string;
  englishListening: string;
  englishReading: string;
  englishWriting: string;
  englishSpeaking: string;
  otherEnglishName: string;
  otherEnglishScore: string;
  budgetAmount: string;
  budgetCurrency: string;
  budgetScope: string;
  scholarshipNeed: boolean;
  intake: string;
  academicYear: string;
}>;

export type GuideFieldErrors = Readonly<Record<string, string>>;

export type GuideDraftValidationResult =
  | { ok: true; submission: GuideSubmission; researchRequest: ResearchModeRequest }
  | { ok: false; errors: GuideFieldErrors };

const STRICT_ASCII_DECIMAL = /^-?\d+(\.\d+)?$/;

function parseStrictAsciiNumber(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  if (!STRICT_ASCII_DECIMAL.test(trimmed)) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

export type GuideProfileDraftValidationResult =
  | { ok: true; profile: GuideApplicantProfile }
  | { ok: false; errors: GuideFieldErrors };

export function validateGuideProfileDraft(draft: GuideDraft): GuideProfileDraftValidationResult {
  const errors: Record<string, string> = {};
  const gpaValue = draft.gpaValue.trim() === "" ? undefined : parseStrictAsciiNumber(draft.gpaValue);
  const gpaScale = draft.gpaScale.trim() === "" ? undefined : parseStrictAsciiNumber(draft.gpaScale);
  if (draft.gpaValue.trim() !== "" && gpaValue === undefined) {
    errors.gpaValue = "Enter a plain number such as 3.25.";
  }
  if (draft.gpaScale.trim() !== "" && gpaScale === undefined) {
    errors.gpaScale = "Enter a plain number such as 4.0.";
  }
  if ((gpaValue === undefined) !== (gpaScale === undefined)) {
    if (gpaValue === undefined) errors.gpaValue = "Enter both GPA value and scale.";
    if (gpaScale === undefined) errors.gpaScale = "Enter both GPA value and scale.";
  }

  const englishValues: Record<string, unknown> = { kind: draft.englishKind };
  if (draft.englishKind === "ielts" || draft.englishKind === "toefl-ibt") {
    const overallText = draft.englishOverall.trim();
    const overall = overallText === "" ? undefined : parseStrictAsciiNumber(draft.englishOverall);
    if (overallText === "") errors.englishOverall = "Enter your overall score.";
    else if (overall === undefined) errors.englishOverall = "Enter a plain number.";
    if (overall !== undefined) englishValues.overall = overall;

    const hasAnyComponent = [draft.englishListening, draft.englishReading, draft.englishWriting, draft.englishSpeaking]
      .some((value) => value.trim() !== "");
    if (hasAnyComponent) {
      const listening = parseStrictAsciiNumber(draft.englishListening);
      const reading = parseStrictAsciiNumber(draft.englishReading);
      const writing = parseStrictAsciiNumber(draft.englishWriting);
      const speaking = parseStrictAsciiNumber(draft.englishSpeaking);
      if ([listening, reading, writing, speaking].some((value) => value === undefined)) {
        errors.englishComponents = "Enter all component scores or leave all blank.";
      } else {
        englishValues.components = { listening, reading, writing, speaking };
      }
    }
  } else if (draft.englishKind === "pte-academic") {
    const overallText = draft.englishOverall.trim();
    const overall = overallText === "" ? undefined : parseStrictAsciiNumber(draft.englishOverall);
    if (overallText === "") errors.englishOverall = "Enter your overall score.";
    else if (overall === undefined) errors.englishOverall = "Enter a plain number.";
    if (overall !== undefined) englishValues.overall = overall;
  } else if (draft.englishKind === "other") {
    englishValues.name = draft.otherEnglishName.trim();
    englishValues.score = draft.otherEnglishScore.trim();
  }

  const budgetValues: Record<string, unknown> | undefined = draft.budgetAmount.trim() === "" && draft.budgetCurrency.trim() === ""
    ? undefined
    : {
        amount: parseStrictAsciiNumber(draft.budgetAmount) ?? 0,
        currency: draft.budgetCurrency.trim(),
        scope: draft.budgetScope,
      };

  const profile = guideApplicantProfileSchema.safeParse({
    citizenship: draft.citizenship.trim(),
    currentCountry: draft.currentCountry.trim(),
    qualification: {
      level: draft.qualificationLevel,
      title: draft.qualificationTitle.trim(),
      subject: draft.qualificationSubject.trim(),
      ...(gpaValue === undefined || gpaScale === undefined ? {} : { gpa: { value: gpaValue, scale: gpaScale } }),
    },
    englishTest: englishValues,
    ...(budgetValues === undefined ? {} : { budget: budgetValues }),
    scholarshipNeed: draft.scholarshipNeed,
  });

  if (!profile.success) {
    for (const issue of profile.error.issues) {
      const path = issue.path.join(".");
      const root = path.split(".")[0];
      const field = root === "qualification"
        ? path.includes("gpa")
          ? path.includes("scale") ? "gpaScale" : "gpaValue"
          : path.endsWith(".title")
            ? "qualificationTitle"
            : path.endsWith(".subject")
              ? "qualificationSubject"
              : path.endsWith(".level") ? "qualificationLevel" : "qualification"
        : root === "englishTest"
          ? path.includes("overall")
            ? "englishOverall"
            : path.includes("components")
              ? "englishComponents"
              : path.includes("name")
                ? "otherEnglishName"
                : path.includes("score") ? "otherEnglishScore" : "englishKind"
          : root === "budget"
            ? path.includes("amount") ? "budgetAmount" : path.includes("currency") ? "budgetCurrency" : "budgetScope"
            : path;
      if (errors[field] === undefined) errors[field] = issue.message;
    }
  }

  return Object.keys(errors).length > 0 || !profile.success
    ? { ok: false, errors }
    : { ok: true, profile: profile.data };
}

export function createDefaultGuideDraft(): GuideDraft {
  return {
    universityId: "",
    programId: "",
    citizenship: "",
    currentCountry: "",
    qualificationLevel: "bachelor",
    qualificationTitle: "",
    qualificationSubject: "",
    gpaValue: "",
    gpaScale: "",
    englishKind: "not-provided",
    englishOverall: "",
    englishListening: "",
    englishReading: "",
    englishWriting: "",
    englishSpeaking: "",
    otherEnglishName: "",
    otherEnglishScore: "",
    budgetAmount: "",
    budgetCurrency: "",
    budgetScope: "annual",
    scholarshipNeed: false,
    intake: "",
    academicYear: "",
  };
}

function resolveTarget(
  draft: GuideDraft,
  catalog: ResearchCatalog,
): { universityId: string; programId: string } | { error: string } {
  if (draft.universityId === "" || draft.programId === "") {
    return { error: "Select a supported program." };
  }
  const university = catalog.universities.find((u) => u.id === draft.universityId);
  if (university === undefined) return { error: "The selected university is no longer supported." };
  const program = catalog.programs.find(
    (p) => p.id === draft.programId && p.universityId === draft.universityId,
  );
  if (program === undefined) {
    return { error: "The selected program does not belong to the selected university." };
  }
  return { universityId: draft.universityId, programId: draft.programId };
}

export function validateGuideDraft(
  draft: GuideDraft,
  catalog: ResearchCatalog,
  assessmentDate: string = formatLocalAssessmentDate(),
): GuideDraftValidationResult {
  const errors: Record<string, string> = {};

  const target = resolveTarget(draft, catalog);
  if ("error" in target) {
    errors.target = target.error;
  }

  const publicContext = guidePublicContextSchema.safeParse({
    ...(draft.intake.trim() === "" ? {} : { intake: draft.intake.trim() }),
    ...(draft.academicYear.trim() === "" ? {} : { academicYear: draft.academicYear.trim() }),
  });
  if (!publicContext.success) {
    for (const issue of publicContext.error.issues) {
      const field = issue.path[0] ?? "publicContext";
      errors[String(field)] = "Enter 1-40 characters.";
    }
  }

  const profileValidation = validateGuideProfileDraft(draft);
  if (!profileValidation.ok) Object.assign(errors, profileValidation.errors);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const submissionParsed = guideSubmissionSchema.safeParse({
    target,
    publicContext: publicContext.success ? publicContext.data : {},
    profile: profileValidation.ok ? profileValidation.profile : {},
    assessmentDate,
  });
  if (!submissionParsed.success) {
    return {
      ok: false,
      errors: { form: "The profile could not be validated. Check each field." },
    };
  }

  const researchRequest = buildGuideResearchRequest(submissionParsed.data);
  return { ok: true, submission: submissionParsed.data, researchRequest };
}

export function buildGuideResearchRequest(submission: GuideSubmission): ResearchModeRequest {
  const request = {
    universityId: submission.target.universityId,
    programId: submission.target.programId,
    categories: [...GUIDE_RESEARCH_CATEGORIES],
    ...(submission.publicContext.intake === undefined ? {} : { intake: submission.publicContext.intake }),
    ...(submission.publicContext.academicYear === undefined ? {} : { academicYear: submission.publicContext.academicYear }),
  };
  const parsed = researchModeRequestSchema.parse(request);
  return parsed;
}
