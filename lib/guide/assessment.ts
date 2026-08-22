import type {
  GuideApplicantProfile,
  GuideAssessmentOutput,
  GuideAssessmentState,
  GuideBudgetAssessment,
  GuideEvidenceRef,
  GuideManualEvidenceItem,
  GuideRequirementAssessment,
  GuideSubmission,
} from "./contracts";
import { guideTargetKey } from "./contracts";
import {
  GUIDE_COMPARABLE_CURRENCIES,
  lookupGuideGpaScale,
  lookupGuideQualificationValue,
  lookupGuideRequirement,
  lookupGuideSubjectFamily,
  type GuideRequirementDefinition,
} from "./requirement-registry";
import type {
  PublicResearchClaim,
  PublicResearchSource,
  ResearchDossier,
} from "@/lib/research/mode/public-contracts";

const QUALIFICATION_ORDINAL: Record<string, number> = {
  secondary: 1,
  diploma: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
};

type EligibleClaim = Readonly<{
  claim: PublicResearchClaim;
  definition: GuideRequirementDefinition;
  evidenceRefs: readonly GuideEvidenceRef[];
}>;

function sourceIsEligible(source: PublicResearchSource): boolean {
  return source.sourceType !== "ranking" && source.sourceType !== "anecdotal";
}

function claimHasEligibleSource(claim: PublicResearchClaim, dossier: ResearchDossier): boolean {
  const sourcesById = new Map(dossier.sources.map((s) => [s.id, s]));
  return claim.sourceIds.some((id) => {
    const source = sourcesById.get(id);
    return source !== undefined && sourceIsEligible(source);
  });
}

function isDefinitiveStatus(status: string): boolean {
  return status === "verified" || status === "corroborated" || status === "university-reported";
}

export function guideClaimContextApplies(
  claim: PublicResearchClaim,
  submission: GuideSubmission,
  requireSelectedContextMetadata = false,
): boolean {
  const selectedIntake = submission.publicContext.intake;
  if (selectedIntake !== undefined) {
    if (claim.intake === undefined) {
      if (requireSelectedContextMetadata) return false;
    } else if (claim.intake !== selectedIntake) {
      return false;
    }
  }

  const selectedAcademicYear = submission.publicContext.academicYear;
  if (selectedAcademicYear !== undefined) {
    if (claim.academicYear === undefined) {
      if (requireSelectedContextMetadata) return false;
    } else if (claim.academicYear !== selectedAcademicYear) {
      return false;
    }
  }

  return true;
}

export function isGuideClaimDefinitiveEligible(
  claim: PublicResearchClaim,
  dossier: ResearchDossier,
): boolean {
  const categoryRow = dossier.categories.find((row) => row.category === claim.category);
  if (categoryRow?.state !== "ready" || categoryRow.sourceGap !== undefined) return false;
  if (!isDefinitiveStatus(claim.verificationStatus)) return false;
  if (!claimHasEligibleSource(claim, dossier)) return false;
  return true;
}

function formatClaimValue(value: PublicResearchClaim["value"], currency?: string): string {
  if (typeof value === "number") {
    return currency !== undefined ? `${currency} ${value.toLocaleString("en-US")}` : String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function guideAssessmentLabel(semantic: string): string {
  const labels: Record<string, string> = {
    "minimum-qualification-level": "Minimum qualification level",
    "required-subject-background": "Subject background",
    "minimum-gpa": "Minimum GPA",
    "ielts-overall-minimum": "IELTS overall minimum",
    "ielts-component-minimum": "IELTS component minimum",
    "toefl-ibt-overall-minimum": "TOEFL iBT overall minimum",
    "toefl-ibt-component-minimum": "TOEFL iBT component minimum",
    "pte-academic-overall-minimum": "PTE Academic overall minimum",
    "required-document": "Required document",
  };
  return labels[semantic] ?? semantic.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function makeRef(target: GuideSubmission["target"], claimId: string): GuideEvidenceRef {
  return { targetKey: guideTargetKey(target), claimId };
}

function singletonFactKey(
  claim: PublicResearchClaim,
  definition: GuideRequirementDefinition,
): string {
  let normalizedValue: PublicResearchClaim["value"] = claim.value;
  let normalizedUnit: string | number | undefined = claim.unit;

  if (definition.semantic === "minimum-qualification-level" && typeof claim.value === "string") {
    normalizedValue = lookupGuideQualificationValue(claim.value) ?? claim.value;
  } else if (definition.semantic === "required-subject-background" && typeof claim.value === "string") {
    normalizedValue = lookupGuideSubjectFamily(claim.value) ?? claim.value;
  } else if (definition.semantic === "minimum-gpa" && claim.unit !== undefined) {
    normalizedUnit = lookupGuideGpaScale(claim.unit) ?? claim.unit;
  }

  return JSON.stringify([
    normalizedValue,
    normalizedUnit,
    claim.currency,
    claim.intake,
    claim.academicYear,
  ]);
}

function assessQualification(
  claims: readonly EligibleClaim[],
  profile: GuideApplicantProfile,
): GuideRequirementAssessment[] {
  return claims.map(({ claim, definition, evidenceRefs }) => {
    const requiredLevel = lookupGuideQualificationValue(String(claim.value));
    const applicantLevel = profile.qualification.level;
    if (requiredLevel === undefined || requiredLevel === "other" || applicantLevel === "other") {
      return {
        id: `qualification-${claim.id}`,
        semantic: definition.semantic,
        label: "Minimum qualification level",
        state: "manual-confirmation-required" as GuideAssessmentState,
        evidenceRefs,
        detail: "The published qualification level or your qualification needs formal equivalency confirmation.",
        publishedValue: String(claim.value),
        applicantValue: applicantLevel,
      };
    }
    const required = QUALIFICATION_ORDINAL[requiredLevel] ?? 0;
    const applicant = QUALIFICATION_ORDINAL[applicantLevel] ?? 0;
    if (applicant < required) {
      return {
        id: `qualification-${claim.id}`,
        semantic: definition.semantic,
        label: "Minimum qualification level",
        state: "does-not-meet" as GuideAssessmentState,
        evidenceRefs,
        detail: `Published minimum is ${requiredLevel}. Your declared level (${applicantLevel}) is below this threshold.`,
        publishedValue: requiredLevel,
        applicantValue: applicantLevel,
      };
    }
    return {
      id: `qualification-${claim.id}`,
      semantic: definition.semantic,
      label: "Minimum qualification level",
      state: "probably-meets" as GuideAssessmentState,
      evidenceRefs,
      detail: `Your ${applicantLevel} level meets or exceeds the published ${requiredLevel} minimum, but formal equivalency is unconfirmed.`,
      publishedValue: requiredLevel,
      applicantValue: applicantLevel,
    };
  });
}

function assessSubject(
  claims: readonly EligibleClaim[],
  profile: GuideApplicantProfile,
): GuideRequirementAssessment[] {
  const applicantFamily = lookupGuideSubjectFamily(profile.qualification.subject);
  return claims.map(({ claim, definition, evidenceRefs }) => {
    const requiredFamily = lookupGuideSubjectFamily(String(claim.value));
    if (requiredFamily === undefined) {
      return {
        id: `subject-${claim.id}`,
        semantic: definition.semantic,
        label: "Subject background",
        state: "manual-confirmation-required" as GuideAssessmentState,
        evidenceRefs,
        detail: `The published subject requirement "${claim.value}" needs manual curriculum review.`,
        publishedValue: String(claim.value),
        applicantValue: profile.qualification.subject,
      };
    }
    if (applicantFamily === undefined) {
      return {
        id: `subject-${claim.id}`,
        semantic: definition.semantic,
        label: "Subject background",
        state: "manual-confirmation-required" as GuideAssessmentState,
        evidenceRefs,
        detail: `Your subject "${profile.qualification.subject}" needs equivalency confirmation against ${claim.value}.`,
        publishedValue: String(claim.value),
        applicantValue: profile.qualification.subject,
      };
    }
    if (applicantFamily === requiredFamily || (requiredFamily === "computing" && (applicantFamily === "ai" || applicantFamily === "data"))) {
      return {
        id: `subject-${claim.id}`,
        semantic: definition.semantic,
        label: "Subject background",
        state: "probably-meets" as GuideAssessmentState,
        evidenceRefs,
        detail: `Your ${profile.qualification.subject} background appears aligned with the ${claim.value} requirement, but formal curriculum equivalency is unconfirmed.`,
        publishedValue: String(claim.value),
        applicantValue: profile.qualification.subject,
      };
    }
    return {
      id: `subject-${claim.id}`,
      semantic: definition.semantic,
      label: "Subject background",
      state: "manual-confirmation-required" as GuideAssessmentState,
      evidenceRefs,
      detail: `Your ${profile.qualification.subject} may not satisfy the ${claim.value} requirement. Formal review is needed.`,
      publishedValue: String(claim.value),
      applicantValue: profile.qualification.subject,
    };
  });
}

function assessGpa(
  claims: readonly EligibleClaim[],
  profile: GuideApplicantProfile,
): GuideRequirementAssessment[] {
  return claims.map(({ claim, definition, evidenceRefs }) => {
    const scale = claim.unit !== undefined ? lookupGuideGpaScale(claim.unit) : undefined;
    if (typeof claim.value !== "number" || scale === undefined) {
      return {
        id: `gpa-${claim.id}`,
        semantic: definition.semantic,
        label: "Minimum GPA",
        state: "manual-confirmation-required" as GuideAssessmentState,
        evidenceRefs,
        detail: "The published GPA scale cannot be safely compared without conversion. Confirm equivalency with the university.",
        publishedValue: formatClaimValue(claim.value),
        applicantValue: profile.qualification.gpa === undefined
          ? undefined
          : `${profile.qualification.gpa.value} / ${profile.qualification.gpa.scale}`,
      };
    }
    if (profile.qualification.gpa === undefined) {
      return {
        id: `gpa-${claim.id}`,
        semantic: definition.semantic,
        label: "Minimum GPA",
        state: "missing-applicant-information" as GuideAssessmentState,
        evidenceRefs,
        detail: "Add your GPA and scale to compare with this published threshold.",
        publishedValue: `${claim.value} / ${scale}`,
      };
    }
    if (profile.qualification.gpa.scale !== scale) {
      return {
        id: `gpa-${claim.id}`,
        semantic: definition.semantic,
        label: "Minimum GPA",
        state: "manual-confirmation-required" as GuideAssessmentState,
        evidenceRefs,
        detail: `Published scale is ${scale}. Your scale is ${profile.qualification.gpa.scale}. Cross-scale conversion is not performed.`,
        publishedValue: `${claim.value} / ${scale}`,
        applicantValue: `${profile.qualification.gpa.value} / ${profile.qualification.gpa.scale}`,
      };
    }
    const meets = profile.qualification.gpa.value >= claim.value;
    return {
      id: `gpa-${claim.id}`,
      semantic: definition.semantic,
      label: "Minimum GPA",
      state: (meets ? "meets" : "does-not-meet") as GuideAssessmentState,
      evidenceRefs,
      detail: meets
        ? `Your GPA ${profile.qualification.gpa.value} meets the published minimum ${claim.value} on the same ${scale} scale.`
        : `Your GPA ${profile.qualification.gpa.value} is below the published minimum ${claim.value} on the ${scale} scale.`,
      publishedValue: `${claim.value} / ${scale}`,
      applicantValue: `${profile.qualification.gpa.value} / ${profile.qualification.gpa.scale}`,
    };
  });
}

function assessEnglishTest(
  claims: readonly EligibleClaim[],
  profile: GuideApplicantProfile,
): GuideRequirementAssessment[] {
  return claims.map(({ claim, definition, evidenceRefs }) => {
    if (typeof claim.value !== "number") {
      return {
        id: `english-${claim.id}`,
        semantic: definition.semantic,
        label: guideAssessmentLabel(definition.semantic),
        state: "unclear-requirement" as GuideAssessmentState,
        evidenceRefs,
        detail: "The published English requirement is not a machine-comparable numeric threshold.",
        publishedValue: formatClaimValue(claim.value),
      };
    }
    const numericThreshold = claim.value;
    const testKind = definition.semantic.includes("ielts")
      ? "ielts"
      : definition.semantic.includes("toefl")
        ? "toefl-ibt"
        : "pte-academic";
    const test = profile.englishTest;
    if (test.kind === "not-provided") {
      return {
        id: `english-${claim.id}`,
        semantic: definition.semantic,
        label: testKind === "ielts" ? "IELTS requirement" : testKind === "toefl-ibt" ? "TOEFL iBT requirement" : "PTE Academic requirement",
        state: "missing-applicant-information" as GuideAssessmentState,
        evidenceRefs,
        detail: "Add your English test results to compare with this published threshold.",
        publishedValue: String(claim.value),
      };
    }
    if (test.kind !== testKind) {
      return {
        id: `english-${claim.id}`,
        semantic: definition.semantic,
        label: testKind === "ielts" ? "IELTS requirement" : testKind === "toefl-ibt" ? "TOEFL iBT requirement" : "PTE Academic requirement",
        state: "manual-confirmation-required" as GuideAssessmentState,
        evidenceRefs,
        detail: `Cross-test conversion is not performed. The university requires ${testKind}; you provided ${test.kind}.`,
        publishedValue: String(claim.value),
        applicantValue: test.kind === "other" ? `${test.name}: ${test.score}` : String(test.overall),
      };
    }
    const isComponent = definition.semantic.includes("component");
    if (isComponent && (test.kind === "ielts" || test.kind === "toefl-ibt")) {
      if (test.components === undefined) {
        return {
          id: `english-${claim.id}`,
          semantic: definition.semantic,
          label: `${testKind} component minimum`,
          state: "missing-applicant-information" as GuideAssessmentState,
          evidenceRefs,
          detail: "Add all component scores to compare with this published component minimum.",
          publishedValue: String(claim.value),
        };
      }
      const allMeet = Object.values(test.components).every((v) => v >= numericThreshold);
      return {
        id: `english-${claim.id}`,
        semantic: definition.semantic,
        label: `${testKind} component minimum`,
        state: (allMeet ? "meets" : "does-not-meet") as GuideAssessmentState,
        evidenceRefs,
        detail: allMeet
          ? `All your component scores meet the published minimum ${claim.value}.`
          : `One or more component scores are below the published minimum ${claim.value}.`,
        publishedValue: String(claim.value),
        applicantValue: Object.entries(test.components).map(([k, v]) => `${k}: ${v}`).join(", "),
      };
    }
    const meets = test.overall >= numericThreshold;
    return {
      id: `english-${claim.id}`,
      semantic: definition.semantic,
      label: testKind === "ielts" ? "IELTS overall minimum" : testKind === "toefl-ibt" ? "TOEFL iBT overall minimum" : "PTE Academic overall minimum",
      state: (meets ? "meets" : "does-not-meet") as GuideAssessmentState,
      evidenceRefs,
      detail: meets
        ? `Your ${testKind.toUpperCase()} overall score ${test.overall} meets the published minimum ${claim.value}.`
        : `Your ${testKind.toUpperCase()} overall score ${test.overall} is below the published minimum ${claim.value}.`,
      publishedValue: String(claim.value),
      applicantValue: String(test.overall),
    };
  });
}

function assessRequiredDocuments(
  claims: readonly EligibleClaim[],
): GuideRequirementAssessment[] {
  return claims.map(({ claim, definition, evidenceRefs }) => ({
    id: `document-${claim.id}`,
    semantic: definition.semantic,
    label: "Required document",
    state: "manual-confirmation-required" as GuideAssessmentState,
    evidenceRefs,
    detail: `Published requirement: ${claim.value}. Confirm availability and format with the official source.`,
    publishedValue: String(claim.value),
  }));
}

function assessBudget(
  tuitionClaims: readonly EligibleClaim[],
  profile: GuideApplicantProfile,
  dossier: ResearchDossier,
  submission: GuideSubmission,
): GuideBudgetAssessment | undefined {
  if (profile.budget === undefined) return undefined;
  if (tuitionClaims.length === 0) {
    return {
      state: "not-assessable",
      detail: "No comparable tuition evidence was found for this program.",
      evidenceRefs: [],
    };
  }

  const desiredSemantic = profile.budget.scope === "annual" ? "annual-tuition" : "total-tuition";
  const desiredCandidates = tuitionClaims.filter(({ definition }) => definition.semantic === desiredSemantic);
  const desired = desiredCandidates.filter(({ claim }) => guideClaimContextApplies(claim, submission, true));

  if (desired.length === 0) {
    return {
      state: "incomparable",
      detail: `No published ${profile.budget.scope} tuition value is safely applicable to the selected context. Scope conversion is not performed.`,
      evidenceRefs: desiredCandidates.flatMap(({ evidenceRefs }) => evidenceRefs),
    };
  }

  const hasConflict = desired.some(({ claim }) => claim.verificationStatus === "conflicting");
  const hasOutdated = desired.some(({ claim }) => claim.verificationStatus === "outdated");
  if (hasConflict || hasOutdated) {
    return {
      state: "incomparable",
      detail: hasConflict && hasOutdated
        ? "Published tuition values conflict and include outdated evidence."
        : hasConflict
          ? "Published tuition values conflict."
          : "Published tuition evidence is outdated for a definitive budget comparison.",
      evidenceRefs: desired.flatMap(({ evidenceRefs }) => evidenceRefs),
    };
  }

  const eligible = desired.filter(({ claim }) => isGuideClaimDefinitiveEligible(claim, dossier));
  if (eligible.length === 0) {
    return {
      state: "incomparable",
      detail: "The published tuition evidence is not eligible for a definitive budget comparison.",
      evidenceRefs: desired.flatMap(({ evidenceRefs }) => evidenceRefs),
    };
  }

  const factualValues = new Set(
    eligible.map(({ claim }) => JSON.stringify([claim.value, claim.currency, claim.intake, claim.academicYear])),
  );
  if (factualValues.size > 1) {
    return {
      state: "incomparable",
      detail: "Multiple inconsistent tuition values were found for the selected budget scope.",
      evidenceRefs: eligible.flatMap(({ evidenceRefs }) => evidenceRefs),
    };
  }

  const first = eligible[0]!;
  const tuition = first.claim;
  const evidenceRefs = eligible.flatMap(({ evidenceRefs: refs }) => refs);
  if (typeof tuition.value !== "number") {
    return {
      state: "incomparable",
      detail: "The published tuition value is not a comparable number.",
      evidenceRefs,
    };
  }
  const claimCurrency = tuition.currency ?? "";
  if (!GUIDE_COMPARABLE_CURRENCIES.has(claimCurrency) || !GUIDE_COMPARABLE_CURRENCIES.has(profile.budget.currency)) {
    return {
      state: "incomparable",
      detail: "Tuition currency or budget currency is not in the supported comparison set.",
      evidenceRefs,
    };
  }
  if (claimCurrency !== profile.budget.currency) {
    return {
      state: "incomparable",
      detail: `Tuition is in ${claimCurrency}; budget is in ${profile.budget.currency}. Currency conversion is not performed.`,
      evidenceRefs,
    };
  }
  if (profile.budget.amount >= tuition.value) {
    return {
      state: "within-budget",
      detail: `Budget ${profile.budget.currency} ${profile.budget.amount.toLocaleString("en-US")} (${profile.budget.scope}) covers tuition ${formatClaimValue(tuition.value, tuition.currency)}.`,
      evidenceRefs,
    };
  }
  return {
    state: "over-budget",
    detail: `Tuition ${formatClaimValue(tuition.value, tuition.currency)} exceeds budget ${profile.budget.currency} ${profile.budget.amount.toLocaleString("en-US")} (${profile.budget.scope}).`,
    evidenceRefs,
  };
}

export function assessGuideRequirements(
  submission: GuideSubmission,
  dossier: ResearchDossier,
): GuideAssessmentOutput {
  const target = submission.target;
  const profile = submission.profile;

  const mappedClaims = new Map<string, EligibleClaim[]>();
  const unrecognizedAdmissions: GuideManualEvidenceItem[] = [];
  const admissionsRow = dossier.categories.find((row) => row.category === "admissions");

  if (admissionsRow !== undefined && admissionsRow.state === "ready") {
    for (const claim of admissionsRow.claims) {
      const definition = lookupGuideRequirement(claim.property, "admissions");
      if (definition === undefined) {
        unrecognizedAdmissions.push({
          id: `manual-${claim.id}`,
          property: claim.property,
          value: formatClaimValue(claim.value, claim.currency),
          verificationStatus: claim.verificationStatus,
          evidenceRef: makeRef(target, claim.id),
        });
        continue;
      }
      const list = mappedClaims.get(definition.semantic) ?? [];
      list.push({ claim, definition, evidenceRefs: [makeRef(target, claim.id)] });
      mappedClaims.set(definition.semantic, list);
    }
  }

  const tuitionClaims: EligibleClaim[] = [];
  const tuitionRow = dossier.categories.find((row) => row.category === "tuition");
  if (tuitionRow !== undefined && tuitionRow.state === "ready") {
    for (const claim of tuitionRow.claims) {
      const definition = lookupGuideRequirement(claim.property, "tuition");
      if (definition === undefined) continue;
      tuitionClaims.push({ claim, definition, evidenceRefs: [makeRef(target, claim.id)] });
    }
  }

  const scholarshipClaims: EligibleClaim[] = [];
  const scholarshipRow = dossier.categories.find((row) => row.category === "scholarships");
  if (scholarshipRow !== undefined && scholarshipRow.state === "ready") {
    for (const claim of scholarshipRow.claims) {
      const definition = lookupGuideRequirement(claim.property, "scholarships");
      if (definition === undefined) continue;
      scholarshipClaims.push({ claim, definition, evidenceRefs: [makeRef(target, claim.id)] });
    }
  }

  const assessments: GuideRequirementAssessment[] = [];

  function processSemantic(
    semantic: string,
    claims: readonly EligibleClaim[],
    assessor: (eligible: readonly EligibleClaim[], profile: GuideApplicantProfile) => GuideRequirementAssessment[],
  ): void {
    if (claims.length === 0) return;
    const applicable = claims.filter(({ claim }) => guideClaimContextApplies(claim, submission));
    if (applicable.length === 0) return;
    const hasConflict = applicable.some(({ claim }) => claim.verificationStatus === "conflicting");
    const hasOutdated = applicable.some(({ claim }) => claim.verificationStatus === "outdated");
    if (hasConflict || hasOutdated) {
      assessments.push({
        id: `${semantic}-unclear`,
        semantic,
        label: guideAssessmentLabel(claims[0]!.definition.semantic),
        state: "unclear-requirement",
        evidenceRefs: applicable.flatMap(({ evidenceRefs }) => evidenceRefs),
        detail: hasConflict && hasOutdated
          ? "The published values conflict and include outdated evidence."
          : hasConflict
            ? "The published values conflict."
            : "The published values include outdated evidence.",
      });
      return;
    }
    const eligible = applicable.filter(({ claim }) => isGuideClaimDefinitiveEligible(claim, dossier));
    if (eligible.length === 0) {
      const hasConflict = applicable.some(({ claim }) => claim.verificationStatus === "conflicting");
      const hasOutdated = applicable.some(({ claim }) => claim.verificationStatus === "outdated");
      const reason = hasConflict && hasOutdated
        ? "The published values conflict and include outdated evidence."
        : hasConflict
          ? "The published values conflict."
          : hasOutdated
            ? "The published values include outdated evidence."
            : "The published evidence does not meet the eligibility threshold for definitive assessment.";
      assessments.push({
        id: `${semantic}-unclear`,
        semantic,
        label: guideAssessmentLabel(claims[0]!.definition.semantic),
        state: "unclear-requirement",
        evidenceRefs: applicable.flatMap(({ evidenceRefs }) => evidenceRefs),
        detail: reason,
      });
      return;
    }
    const definition = eligible[0]!.definition;
    if (definition.cardinality === "singleton") {
      const values = new Set(eligible.map(({ claim }) => singletonFactKey(claim, definition)));
      if (values.size > 1) {
        assessments.push({
          id: `${semantic}-conflict`,
          semantic,
          label: guideAssessmentLabel(definition.semantic),
          state: "unclear-requirement",
          evidenceRefs: eligible.flatMap(({ evidenceRefs }) => evidenceRefs),
          detail: "Multiple inconsistent published values were found for this requirement.",
        });
        return;
      }
      const representative = eligible[0]!;
      assessments.push(...assessor([{
        ...representative,
        evidenceRefs: eligible.flatMap(({ evidenceRefs }) => evidenceRefs),
      }], profile));
      return;
    }
    assessments.push(...assessor(eligible, profile));
  }

  processSemantic("minimum-qualification-level", mappedClaims.get("minimum-qualification-level") ?? [], assessQualification);
  processSemantic("required-subject-background", mappedClaims.get("required-subject-background") ?? [], assessSubject);
  processSemantic("minimum-gpa", mappedClaims.get("minimum-gpa") ?? [], assessGpa);
  for (const semantic of ["ielts-overall-minimum", "ielts-component-minimum", "toefl-ibt-overall-minimum", "toefl-ibt-component-minimum", "pte-academic-overall-minimum"]) {
    processSemantic(semantic, mappedClaims.get(semantic) ?? [], assessEnglishTest);
  }
  processSemantic("required-document", mappedClaims.get("required-document") ?? [], (claims) => assessRequiredDocuments(claims));

  const budgetAssessment = assessBudget(
    tuitionClaims,
    profile,
    dossier,
    submission,
  );

  return { assessments, budgetAssessment, unrecognizedAdmissions };
}
