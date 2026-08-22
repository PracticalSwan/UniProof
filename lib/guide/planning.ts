import {
  guideTargetKey,
  type GuideAssessmentOutput,
  type GuideBudgetAssessment,
  type GuideChecklistItem,
  type GuideEvidenceRef,
  type GuideRisk,
  type GuideSubmission,
  type GuideTimelineItem,
} from "./contracts";
import {
  guideClaimContextApplies,
  isGuideClaimDefinitiveEligible,
} from "./assessment";
import { lookupGuideRequirement } from "./requirement-registry";
import type { PublicResearchClaim, ResearchDossier } from "@/lib/research/mode/public-contracts";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseStrictIsoDate(input: string): Date | null {
  const match = ISO_DATE.exec(input);
  if (match === null) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function civilDateDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000;
}

export function daysBetweenDateOnly(from: string, to: string): number | null {
  const fromDate = parseStrictIsoDate(from);
  const toDate = parseStrictIsoDate(to);
  if (fromDate === null || toDate === null) return null;
  return civilDateDayNumber(toDate) - civilDateDayNumber(fromDate);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function guideEvidenceRef(submission: GuideSubmission, claim: PublicResearchClaim): GuideEvidenceRef {
  return { targetKey: guideTargetKey(submission.target), claimId: claim.id };
}

function formatPublishedValue(claim: PublicResearchClaim): string {
  if (typeof claim.value === "number") {
    return claim.currency === undefined
      ? String(claim.value)
      : `${claim.currency} ${claim.value.toLocaleString("en-US")}`;
  }
  if (typeof claim.value === "boolean") return claim.value ? "Yes" : "No";
  return claim.value;
}

export function buildGuidePlan(
  submission: GuideSubmission,
  dossier: ResearchDossier,
  assessment: GuideAssessmentOutput,
): Readonly<{
  budgetAssessment?: GuideBudgetAssessment;
  risks: readonly GuideRisk[];
  checklist: readonly GuideChecklistItem[];
  timeline: readonly GuideTimelineItem[];
}> {
  const risks: GuideRisk[] = [];
  const checklist: GuideChecklistItem[] = [];
  const timeline: GuideTimelineItem[] = [];

  for (const item of assessment.assessments) {
    if (item.state === "does-not-meet") {
      risks.push({
        id: `risk-not-met-${item.id}`,
        kind: "published-requirement-not-met",
        severity: "high",
        title: `Published threshold not met: ${item.label}`,
        description: item.detail,
        evidenceRefs: item.evidenceRefs,
      });
      checklist.push({
        id: `task-remediate-${item.id}`,
        kind: "review-requirement",
        action: `Review the published ${item.label.toLowerCase()} and consider remediation or confirmation.`,
        evidenceRefs: item.evidenceRefs,
      });
    } else if (item.state === "missing-applicant-information") {
      risks.push({
        id: `risk-missing-${item.id}`,
        kind: "missing-applicant-information",
        severity: "medium",
        title: `Missing applicant information: ${item.label}`,
        description: item.detail,
        evidenceRefs: item.evidenceRefs,
      });
      checklist.push({
        id: `task-profile-${item.id}`,
        kind: "complete-profile",
        action: `Add the missing ${item.label.toLowerCase()} information to your profile.`,
        evidenceRefs: [],
      });
    } else if (item.state === "unclear-requirement") {
      risks.push({
        id: `risk-unclear-${item.id}`,
        kind: "unclear-or-incomplete-requirement",
        severity: "medium",
        title: `Unclear requirement: ${item.label}`,
        description: item.detail,
        evidenceRefs: item.evidenceRefs,
      });
      checklist.push({
        id: `task-clarify-${item.id}`,
        kind: "manual-review",
        action: `Review the published evidence for ${item.label.toLowerCase()} and confirm the current requirement.`,
        evidenceRefs: item.evidenceRefs,
      });
    } else if (item.state === "manual-confirmation-required") {
      if (item.semantic === "required-document") {
        checklist.push({
          id: `task-document-${item.id}`,
          kind: "required-document",
          action: item.publishedValue === undefined
            ? "Prepare or confirm the published required document with the official source."
            : `Prepare or confirm the published required document: ${item.publishedValue}.`,
          evidenceRefs: item.evidenceRefs,
        });
        continue;
      }
      risks.push({
        id: `risk-manual-${item.id}`,
        kind: "manual-equivalency-check",
        severity: "medium",
        title: `Manual confirmation needed: ${item.label}`,
        description: item.detail,
        evidenceRefs: item.evidenceRefs,
      });
      checklist.push({
        id: `task-manual-${item.id}`,
        kind: "manual-confirmation",
        action: `Confirm ${item.label.toLowerCase()} with the official admissions source.`,
        evidenceRefs: item.evidenceRefs,
      });
    }
  }

  checklist.push({
    id: "task-country-specific-manual-check",
    kind: "country-specific-manual-check",
    action: "Check the official program guidance for any citizenship or current-country-specific requirements that need manual confirmation.",
    evidenceRefs: [],
  });

  if (assessment.budgetAssessment !== undefined) {
    const budget = assessment.budgetAssessment;
    if (budget.state === "over-budget") {
      risks.push({
        id: "risk-budget-exceeded",
        kind: "budget-exceeded",
        severity: "high",
        title: "Tuition exceeds budget",
        description: budget.detail,
        evidenceRefs: budget.evidenceRefs,
      });
      checklist.push({
        id: "task-budget-gap",
        kind: "review-budget",
        action: "Review the exact budget gap and funding options.",
        evidenceRefs: budget.evidenceRefs,
      });
    } else if (budget.state === "incomparable") {
      risks.push({
        id: "risk-budget-incomparable",
        kind: "budget-not-comparable",
        severity: "medium",
        title: "Budget cannot be compared",
        description: budget.detail,
        evidenceRefs: budget.evidenceRefs,
      });
      checklist.push({
        id: "task-budget-manual",
        kind: "manual-budget",
        action: "Confirm tuition and budget currency/scope manually.",
        evidenceRefs: budget.evidenceRefs,
      });
    }
  }

  if (submission.profile.scholarshipNeed) {
    const scholarshipRow = dossier.categories.find((row) => row.category === "scholarships");
    const availabilityCandidates = scholarshipRow?.state === "ready"
      ? scholarshipRow.claims.filter((claim) =>
          lookupGuideRequirement(claim.property, "scholarships")?.semantic === "scholarship-availability"
        )
      : [];
    const mappedAvailability = availabilityCandidates.filter((claim) =>
      guideClaimContextApplies(claim, submission, true)
    );
    const allRefs = availabilityCandidates.map((claim) => guideEvidenceRef(submission, claim));
    const hasConflict = mappedAvailability.some((claim) => claim.verificationStatus === "conflicting");
    const hasOutdated = mappedAvailability.some((claim) => claim.verificationStatus === "outdated");
    const eligible = mappedAvailability.filter((claim) =>
      isGuideClaimDefinitiveEligible(claim, dossier) && typeof claim.value === "boolean"
    );
    const eligibleValues = new Set(eligible.map((claim) => claim.value));

    if (hasConflict || hasOutdated || eligible.length === 0 || eligibleValues.size > 1) {
      risks.push({
        id: "risk-scholarship-uncertainty",
        kind: "scholarship-uncertainty",
        severity: "medium",
        title: "Scholarship availability uncertain",
        description: hasConflict && hasOutdated
          ? "Published scholarship evidence conflicts and includes outdated information."
          : hasConflict
            ? "Published scholarship evidence conflicts."
            : hasOutdated
              ? "Published scholarship evidence is outdated."
              : "Scholarship evidence is missing or not eligible for a definitive availability statement.",
        evidenceRefs: allRefs,
      });
    } else if (eligible[0]!.value === false) {
      risks.push({
        id: "risk-scholarship-unavailable",
        kind: "scholarship-unavailable",
        severity: "high",
        title: "Scholarships unavailable",
        description: "Eligible published evidence indicates scholarships are not available for this program.",
        evidenceRefs: eligible.map((claim) => guideEvidenceRef(submission, claim)),
      });
    }

    checklist.push({
      id: "task-scholarship-review",
      kind: "scholarship-review",
      action: "Review scholarship eligibility and application requirements on the official source.",
      evidenceRefs: eligible.map((claim) => guideEvidenceRef(submission, claim)),
    });
  }

  const admissionsRow = dossier.categories.find((row) => row.category === "admissions");
  const feeCandidates = admissionsRow?.state === "ready"
    ? admissionsRow.claims.filter((claim) =>
        lookupGuideRequirement(claim.property, "admissions")?.semantic === "application-fee"
      )
    : [];
  const feeClaims = feeCandidates.filter((claim) => guideClaimContextApplies(claim, submission, true));

  if (feeCandidates.length > 0 && feeClaims.length === 0) {
    checklist.push({
      id: "task-application-fee-context-review",
      kind: "application-fee-review",
      action: "Confirm the current application fee for the selected intake/academic year; published period metadata is missing or does not match.",
      evidenceRefs: feeCandidates.map((claim) => guideEvidenceRef(submission, claim)),
    });
  }

  const outdatedFees = feeClaims.filter((claim) => claim.verificationStatus === "outdated");
  const conflictingFees = feeClaims.filter((claim) => claim.verificationStatus === "conflicting");
  if (outdatedFees.length > 0) {
    risks.push({
      id: "risk-outdated-application-fee",
      kind: "outdated-fee-or-deadline",
      severity: "medium",
      title: "Published application fee may be outdated",
      description: "Confirm the current application fee on the official source before relying on it.",
      evidenceRefs: outdatedFees.map((claim) => guideEvidenceRef(submission, claim)),
    });
  }
  if (conflictingFees.length > 0) {
    risks.push({
      id: "risk-conflicting-application-fee",
      kind: "conflicting-requirement",
      severity: "high",
      title: "Published application fee conflicts",
      description: "Published sources disagree about the application fee. Confirm the current fee manually.",
      evidenceRefs: feeClaims.map((claim) => guideEvidenceRef(submission, claim)),
    });
  }
  if (outdatedFees.length === 0 && conflictingFees.length === 0) {
    const eligibleFees = feeClaims.filter((claim) =>
      isGuideClaimDefinitiveEligible(claim, dossier) && typeof claim.value === "number"
    );
    const feeValues = new Set(eligibleFees.map((claim) => JSON.stringify([claim.value, claim.currency])));
    if (eligibleFees.length === 0 && feeClaims.length > 0) {
      checklist.push({
        id: "task-application-fee-review",
        kind: "application-fee-review",
        action: "Confirm the current application fee manually; available evidence is not definitive.",
        evidenceRefs: feeClaims.map((claim) => guideEvidenceRef(submission, claim)),
      });
    } else if (feeValues.size === 1 && eligibleFees.length > 0) {
      const representative = eligibleFees[0]!;
      checklist.push({
        id: "task-application-fee-review",
        kind: "application-fee-review",
        action: `Confirm and prepare for the published application fee (${formatPublishedValue(representative)}).`,
        evidenceRefs: eligibleFees.map((claim) => guideEvidenceRef(submission, claim)),
      });
    } else if (feeValues.size > 1) {
      risks.push({
        id: "risk-conflicting-application-fee-values",
        kind: "conflicting-requirement",
        severity: "high",
        title: "Published application fee values conflict",
        description: "Multiple different eligible application-fee values were found. Confirm the current fee manually.",
        evidenceRefs: eligibleFees.map((claim) => guideEvidenceRef(submission, claim)),
      });
    }
  }

  const deadlineGroups = new Map<"application-deadline" | "scholarship-deadline", PublicResearchClaim[]>();
  for (const row of dossier.categories) {
    if (row.state !== "ready") continue;
    for (const claim of row.claims) {
      const definition = lookupGuideRequirement(claim.property, row.category);
      if (definition?.semantic !== "application-deadline" && definition?.semantic !== "scholarship-deadline") continue;
      if (definition.semantic === "scholarship-deadline" && !submission.profile.scholarshipNeed) continue;
      const group = deadlineGroups.get(definition.semantic) ?? [];
      group.push(claim);
      deadlineGroups.set(definition.semantic, group);
    }
  }

  for (const [semantic, claims] of deadlineGroups) {
    const isScholarship = semantic === "scholarship-deadline";
    const applicable = claims.filter((claim) => guideClaimContextApplies(claim, submission, true));
    const allRefs = claims.map((claim) => guideEvidenceRef(submission, claim));
    if (applicable.length === 0) {
      checklist.push({
        id: `task-deadline-context-${semantic}`,
        kind: "manual-deadline",
        action: `Confirm the ${isScholarship ? "scholarship" : "application"} deadline for the selected intake/academic year; published period metadata is missing or does not match.`,
        evidenceRefs: allRefs,
      });
      continue;
    }

    const conflicting = applicable.filter((claim) => claim.verificationStatus === "conflicting");
    const outdated = applicable.filter((claim) => claim.verificationStatus === "outdated");
    if (conflicting.length > 0) {
      risks.push({
        id: `risk-deadline-conflict-${semantic}`,
        kind: "conflicting-requirement",
        severity: "high",
        title: `${isScholarship ? "Scholarship" : "Application"} deadline conflicts`,
        description: "Published deadline evidence conflicts. Confirm the current deadline manually.",
        evidenceRefs: applicable.map((claim) => guideEvidenceRef(submission, claim)),
      });
    }
    if (outdated.length > 0) {
      risks.push({
        id: `risk-deadline-outdated-${semantic}`,
        kind: "outdated-fee-or-deadline",
        severity: "medium",
        title: `${isScholarship ? "Scholarship" : "Application"} deadline evidence is outdated`,
        description: "Outdated deadline evidence cannot be machine-scheduled. Confirm the current deadline manually.",
        evidenceRefs: outdated.map((claim) => guideEvidenceRef(submission, claim)),
      });
    }
    if (conflicting.length > 0 || outdated.length > 0) {
      checklist.push({
        id: `task-deadline-clarify-${semantic}`,
        kind: "manual-deadline",
        action: `Confirm the current ${isScholarship ? "scholarship" : "application"} deadline on the official source.`,
        evidenceRefs: applicable.map((claim) => guideEvidenceRef(submission, claim)),
      });
      continue;
    }

    const eligible = applicable.filter((claim) => isGuideClaimDefinitiveEligible(claim, dossier));
    if (eligible.length === 0) {
      checklist.push({
        id: `task-deadline-eligibility-${semantic}`,
        kind: "manual-deadline",
        action: `Confirm the ${isScholarship ? "scholarship" : "application"} deadline manually; current evidence is not eligible for machine scheduling.`,
        evidenceRefs: applicable.map((claim) => guideEvidenceRef(submission, claim)),
      });
      continue;
    }

    const values = new Set(eligible.map((claim) => JSON.stringify([claim.value, claim.intake, claim.academicYear])));
    if (values.size > 1) {
      risks.push({
        id: `risk-deadline-values-${semantic}`,
        kind: "conflicting-requirement",
        severity: "high",
        title: `${isScholarship ? "Scholarship" : "Application"} deadline values conflict`,
        description: "Multiple different eligible deadline values were found for the same context.",
        evidenceRefs: eligible.map((claim) => guideEvidenceRef(submission, claim)),
      });
      continue;
    }

    const claim = eligible[0]!;
    const evidenceRefs = eligible.map((item) => guideEvidenceRef(submission, item));
    if (typeof claim.value !== "string") {
      checklist.push({
        id: `task-deadline-type-${semantic}`,
        kind: "manual-deadline",
        action: `Confirm the published ${isScholarship ? "scholarship" : "application"} deadline manually; it is not a supported date value.`,
        evidenceRefs,
      });
      continue;
    }
    const deadlineDate = parseStrictIsoDate(claim.value);
    if (deadlineDate === null) {
      checklist.push({
        id: `task-deadline-manual-${semantic}`,
        kind: "manual-deadline",
        action: `Confirm the published deadline "${claim.value}" manually; it is not a machine-scheduled ISO date.`,
        evidenceRefs,
      });
      continue;
    }

    const deadline = formatDate(deadlineDate);
    const days = daysBetweenDateOnly(submission.assessmentDate, deadline);
    if (days === null) continue;

    if (days < 0) {
      risks.push({
        id: `risk-deadline-passed-${semantic}`,
        kind: "deadline-passed",
        severity: "high",
        title: `${isScholarship ? "Scholarship" : "Application"} deadline has passed`,
        description: `The published deadline ${deadline} is before the assessment date ${submission.assessmentDate}.`,
        evidenceRefs,
      });
      checklist.push({
        id: `task-next-cycle-${semantic}`,
        kind: "confirm-next-cycle",
        action: `The ${isScholarship ? "scholarship" : "application"} deadline has passed. Confirm the next available cycle.`,
        evidenceRefs,
      });
    } else if (days === 0) {
      risks.push({
        id: `risk-deadline-today-${semantic}`,
        kind: "deadline-due-today",
        severity: "high",
        title: `${isScholarship ? "Scholarship" : "Application"} deadline is today`,
        description: `The published deadline is ${deadline}.`,
        evidenceRefs,
      });
      timeline.push({
        id: `timeline-deadline-${semantic}`,
        kind: "deadline-due-today",
        action: `Submit before the ${isScholarship ? "scholarship" : "application"} deadline today.`,
        date: deadline,
        evidenceRefs,
        urgent: true,
      });
    } else if (days <= 30) {
      risks.push({
        id: `risk-deadline-urgent-${semantic}`,
        kind: "deadline-within-30-days",
        severity: "high",
        title: `${isScholarship ? "Scholarship" : "Application"} deadline within 30 days`,
        description: `The published deadline is ${deadline}, ${days} days away.`,
        evidenceRefs,
      });
      timeline.push({
        id: `timeline-deadline-${semantic}`,
        kind: "deadline-urgent",
        action: `Submit before the ${isScholarship ? "scholarship" : "application"} deadline.`,
        date: deadline,
        evidenceRefs,
        urgent: true,
      });
    } else {
      timeline.push({
        id: `timeline-deadline-${semantic}`,
        kind: "deadline",
        action: `Submit before the ${isScholarship ? "scholarship" : "application"} deadline.`,
        date: deadline,
        evidenceRefs,
        urgent: false,
      });
    }
  }

  timeline.sort((a, b) => {
    if (a.date !== null && b.date !== null) return a.date.localeCompare(b.date);
    if (a.date === null && b.date !== null) return 1;
    if (a.date !== null && b.date === null) return -1;
    return a.id.localeCompare(b.id);
  });

  const severityRank: Record<GuideRisk["severity"], number> = { high: 0, medium: 1, info: 2 };
  risks.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));
  checklist.sort((a, b) => a.id.localeCompare(b.id));

  return {
    ...(assessment.budgetAssessment === undefined ? {} : { budgetAssessment: assessment.budgetAssessment }),
    risks,
    checklist,
    timeline,
  };
}
