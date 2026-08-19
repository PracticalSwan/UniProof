import { z } from "zod";

import {
  publicClaimEvidenceStatusSchema,
  researchDossierSchema,
  researchModeRequestSchema,
} from "@/lib/research/mode/public-contracts";

export const guideQualificationLevelOrder = [
  "secondary",
  "diploma",
  "bachelor",
  "master",
  "doctorate",
  "other",
] as const;

export const guideQualificationLevelSchema = z.enum(guideQualificationLevelOrder);
export type GuideQualificationLevel = z.infer<typeof guideQualificationLevelSchema>;

const boundedText = (max: number) => z.string().trim().min(1).max(max);

const finiteNumber = z.number().refine(Number.isFinite, "Must be a finite number");

export const guideGpaSchema = z.object({
  value: finiteNumber.min(0),
  scale: finiteNumber.min(0.01).max(100),
}).strict().superRefine((gpa, context) => {
  if (gpa.value > gpa.scale) {
    context.addIssue({
      code: "custom",
      message: "GPA value cannot exceed its scale",
      path: ["value"],
    });
  }
});
export type GuideGpa = z.infer<typeof guideGpaSchema>;

export const guideQualificationSchema = z.object({
  level: guideQualificationLevelSchema,
  title: boundedText(160),
  subject: boundedText(120),
  gpa: guideGpaSchema.optional(),
}).strict();
export type GuideQualification = z.infer<typeof guideQualificationSchema>;

const ieltsScore = finiteNumber.min(0).max(9).refine((v) => Number.isInteger(v * 2), "IELTS scores must use 0.5 increments");
const toeflScore = finiteNumber.min(0).max(30).refine(Number.isInteger, "TOEFL component scores must be integers");

export const guideEnglishTestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("not-provided") }).strict(),
  z.object({
    kind: z.literal("ielts"),
    overall: ieltsScore,
    components: z.object({
      listening: ieltsScore,
      reading: ieltsScore,
      writing: ieltsScore,
      speaking: ieltsScore,
    }).strict().optional(),
  }).strict(),
  z.object({
    kind: z.literal("toefl-ibt"),
    overall: finiteNumber.min(0).max(120).refine(Number.isInteger, "TOEFL overall must be an integer"),
    components: z.object({
      listening: toeflScore,
      reading: toeflScore,
      writing: toeflScore,
      speaking: toeflScore,
    }).strict().optional(),
  }).strict(),
  z.object({
    kind: z.literal("pte-academic"),
    overall: finiteNumber.min(10).max(90).refine(Number.isInteger, "PTE scores must be integers"),
  }).strict(),
  z.object({
    kind: z.literal("other"),
    name: boundedText(80),
    score: boundedText(40),
  }).strict(),
]);
export type GuideEnglishTest = z.infer<typeof guideEnglishTestSchema>;

export const guideBudgetSchema = z.object({
  amount: finiteNumber.min(0.01).max(1_000_000_000),
  currency: z.string().regex(/^[A-Za-z]{3}$/, "Currency must be exactly three letters").transform((v) => v.toUpperCase()),
  scope: z.enum(["annual", "total"]),
}).strict();
export type GuideBudget = z.infer<typeof guideBudgetSchema>;

export const guideApplicantProfileSchema = z.object({
  citizenship: boundedText(80),
  currentCountry: boundedText(80),
  qualification: guideQualificationSchema,
  englishTest: guideEnglishTestSchema,
  budget: guideBudgetSchema.optional(),
  scholarshipNeed: z.boolean(),
}).strict();
export type GuideApplicantProfile = z.infer<typeof guideApplicantProfileSchema>;

export const guidePublicContextSchema = z.object({
  intake: z.string().trim().min(1).max(40).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
}).strict();
export type GuidePublicContext = z.infer<typeof guidePublicContextSchema>;

const guideIdSchema = z.string().trim().min(1).max(120);

export const guideSubmissionSchema = z.object({
  target: z.object({
    universityId: guideIdSchema,
    programId: guideIdSchema,
  }).strict(),
  publicContext: guidePublicContextSchema,
  profile: guideApplicantProfileSchema,
  assessmentDate: z.iso.date(),
}).strict();
export type GuideSubmission = z.infer<typeof guideSubmissionSchema>;

export const GUIDE_RESEARCH_CATEGORIES = ["admissions", "tuition", "scholarships"] as const;

export type GuideEvidenceRef = Readonly<{
  targetKey: string;
  claimId: string;
}>;

export const guideEvidenceRefSchema = z.object({
  targetKey: z.string().trim().min(1).max(245),
  claimId: z.string().trim().min(1).max(120),
}).strict();

export function guideTargetKey(target: { universityId: string; programId: string }): string {
  return `${target.universityId}::${target.programId}`;
}

export type GuideAssessmentState =
  | "meets"
  | "probably-meets"
  | "does-not-meet"
  | "missing-applicant-information"
  | "unclear-requirement"
  | "manual-confirmation-required";

export type GuideRequirementAssessment = Readonly<{
  id: string;
  semantic: string;
  label: string;
  state: GuideAssessmentState;
  evidenceRefs: readonly GuideEvidenceRef[];
  detail: string;
  publishedValue?: string;
  applicantValue?: string;
}>;

export const guideRequirementAssessmentSchema = z.object({
  id: guideIdSchema,
  semantic: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  state: z.enum([
    "meets",
    "probably-meets",
    "does-not-meet",
    "missing-applicant-information",
    "unclear-requirement",
    "manual-confirmation-required",
  ]),
  evidenceRefs: z.array(guideEvidenceRefSchema).max(24),
  detail: z.string().trim().min(1).max(2_000),
  publishedValue: z.string().trim().min(1).max(500).optional(),
  applicantValue: z.string().trim().min(1).max(500).optional(),
}).strict();

export type GuideBudgetAssessment = Readonly<{
  state: "within-budget" | "over-budget" | "incomparable" | "not-assessable";
  detail: string;
  evidenceRefs: readonly GuideEvidenceRef[];
}>;

export const guideBudgetAssessmentSchema = z.object({
  state: z.enum(["within-budget", "over-budget", "incomparable", "not-assessable"]),
  detail: z.string().trim().min(1).max(2_000),
  evidenceRefs: z.array(guideEvidenceRefSchema).max(24),
}).strict();

export type GuideRisk = Readonly<{
  id: string;
  kind: string;
  severity: "high" | "medium" | "info";
  title: string;
  description: string;
  evidenceRefs: readonly GuideEvidenceRef[];
}>;

export const guideRiskSchema = z.object({
  id: guideIdSchema,
  kind: z.string().trim().min(1).max(120),
  severity: z.enum(["high", "medium", "info"]),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(2_000),
  evidenceRefs: z.array(guideEvidenceRefSchema).max(24),
}).strict();

export type GuideChecklistItem = Readonly<{
  id: string;
  kind: string;
  action: string;
  evidenceRefs: readonly GuideEvidenceRef[];
  dueDate?: string;
}>;

export const guideChecklistItemSchema = z.object({
  id: guideIdSchema,
  kind: z.string().trim().min(1).max(120),
  action: z.string().trim().min(1).max(1_000),
  evidenceRefs: z.array(guideEvidenceRefSchema).max(24),
  dueDate: z.iso.date().optional(),
}).strict();

export type GuideTimelineItem = Readonly<{
  id: string;
  kind: string;
  action: string;
  date: string | null;
  evidenceRefs: readonly GuideEvidenceRef[];
  urgent: boolean;
}>;

export const guideTimelineItemSchema = z.object({
  id: guideIdSchema,
  kind: z.string().trim().min(1).max(120),
  action: z.string().trim().min(1).max(1_000),
  date: z.iso.date().nullable(),
  evidenceRefs: z.array(guideEvidenceRefSchema).max(24),
  urgent: z.boolean(),
}).strict();

export type GuideManualEvidenceItem = Readonly<{
  id: string;
  property: string;
  value: string;
  verificationStatus: string;
  evidenceRef: GuideEvidenceRef;
}>;

export const guideManualEvidenceItemSchema = z.object({
  id: guideIdSchema,
  property: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(500),
  verificationStatus: publicClaimEvidenceStatusSchema,
  evidenceRef: guideEvidenceRefSchema,
}).strict();

export type GuideAssessmentOutput = Readonly<{
  assessments: readonly GuideRequirementAssessment[];
  budgetAssessment?: GuideBudgetAssessment;
  unrecognizedAdmissions: readonly GuideManualEvidenceItem[];
}>;

export type GuideResult = Readonly<{
  submission: GuideSubmission;
  researchRequest: import("@/lib/research/mode/public-contracts").ResearchModeRequest;
  dossier: import("@/lib/research/mode/public-contracts").ResearchDossier;
  status: "complete" | "partial";
  assessments: readonly GuideRequirementAssessment[];
  budgetAssessment?: GuideBudgetAssessment;
  risks: readonly GuideRisk[];
  checklist: readonly GuideChecklistItem[];
  timeline: readonly GuideTimelineItem[];
  unrecognizedAdmissions: readonly GuideManualEvidenceItem[];
}>;

export const guideResultSchema = z.object({
  submission: guideSubmissionSchema,
  researchRequest: researchModeRequestSchema,
  dossier: researchDossierSchema,
  status: z.enum(["complete", "partial"]),
  assessments: z.array(guideRequirementAssessmentSchema).max(200),
  budgetAssessment: guideBudgetAssessmentSchema.optional(),
  risks: z.array(guideRiskSchema).max(200),
  checklist: z.array(guideChecklistItemSchema).max(200),
  timeline: z.array(guideTimelineItemSchema).max(200),
  unrecognizedAdmissions: z.array(guideManualEvidenceItemSchema).max(200),
}).strict();

export type GuideAssessmentError = Readonly<{
  code: "guide-assessment-error";
  message: string;
}>;

export function formatLocalAssessmentDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
