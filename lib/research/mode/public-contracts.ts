import { z } from "zod";

import { researchCatalogCountryCodeSchema } from "@/lib/research/catalog/countries";
import { sourceTypeSchema } from "@/lib/validation/evidence";

export const researchModeCategoryOrder = [
  "admissions",
  "tuition",
  "scholarships",
  "program-structure",
  "research",
  "outcomes",
  "support",
] as const;

export const researchModeCategorySchema = z.enum(researchModeCategoryOrder);
export type ResearchModeCategory = z.infer<typeof researchModeCategorySchema>;

export const publicClaimEvidenceStatusSchema = z.enum([
  "verified",
  "corroborated",
  "university-reported",
  "conflicting",
  "anecdotal",
  "inferred",
  "outdated",
]);
export type PublicEvidenceStatus = z.infer<typeof publicClaimEvidenceStatusSchema>;

export const RESEARCH_MODE_MAX_QUESTION_UTF16 = 500;

const publicIdSchema = z.string().trim().min(1).max(120);

function canonicalizeCategories(
  categories: readonly ResearchModeCategory[],
): ResearchModeCategory[] {
  const requested = new Set(categories);
  return researchModeCategoryOrder.filter((category) => requested.has(category));
}

export function canonicalizeResearchModeCategories(
  categories: readonly ResearchModeCategory[],
): ResearchModeCategory[] {
  return canonicalizeCategories(categories);
}

const optionalResearchQuestionSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESEARCH_MODE_MAX_QUESTION_UTF16);

export const researchModeRequestSchema = z
  .object({
    universityId: publicIdSchema,
    programId: publicIdSchema.optional(),
    categories: z
      .array(researchModeCategorySchema)
      .min(1)
      .max(researchModeCategoryOrder.length)
      .transform(canonicalizeCategories),
    question: optionalResearchQuestionSchema.optional(),
    intake: z.string().trim().min(1).max(40).optional(),
    academicYear: z.string().trim().min(1).max(40).optional(),
  })
  .strict();
export type ResearchModeRequest = z.output<typeof researchModeRequestSchema>;

export const publicHttpUrlSchema = z.url().refine((value) => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.username === "" &&
      parsed.password === "";
  } catch {
    return false;
  }
}, { message: "public source URLs must use HTTP(S) without credentials" });

export const publicResearchSourceSchema = z.object({
  id: publicIdSchema,
  url: publicHttpUrlSchema,
  title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(200),
  sourceType: sourceTypeSchema,
  retrievedAt: z.iso.datetime(),
  effectiveDate: z.iso.date().optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
}).strict();
export type PublicResearchSource = z.infer<typeof publicResearchSourceSchema>;

export const publicResearchClaimSchema = z.object({
  id: publicIdSchema,
  category: researchModeCategorySchema,
  property: z.string().trim().min(1).max(200),
  value: z.union([
    z.string().trim().min(1).max(500),
    z.number().finite(),
    z.boolean(),
  ]),
  unit: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
  effectiveDate: z.iso.date().optional(),
  intake: z.string().trim().min(1).max(40).optional(),
  verificationStatus: publicClaimEvidenceStatusSchema,
  representativeSourceId: publicIdSchema,
  sourceIds: z.array(publicIdSchema).min(1).max(12),
  supportingText: z.string().trim().min(1).max(2_000),
}).strict();
export type PublicResearchClaim = z.output<typeof publicResearchClaimSchema>;

export const publicEvidenceExplanationSchema = z.object({
  category: researchModeCategorySchema,
  referencedClaimIds: z.array(publicIdSchema).max(500),
  summary: z.string().trim().min(1).max(600),
  fallback: z.boolean().optional(),
}).strict();
export type PublicEvidenceExplanation = z.infer<typeof publicEvidenceExplanationSchema>;

export const publicResearchFailureSchema = z.object({
  code: z.enum([
    "cancelled",
    "timeout",
    "source-discovery",
    "retrieval",
    "normalization",
    "source-limit",
    "provider-rate-limit",
    "provider-budget",
    "provider-error",
    "unknown",
  ]),
  message: z.string().trim().min(1).max(300),
}).strict();
export type PublicResearchFailure = z.infer<typeof publicResearchFailureSchema>;

const publicSourceGapFailureSchema = publicResearchFailureSchema.refine(
  (failure) => failure.code === "retrieval" || failure.code === "normalization" || failure.code === "provider-budget",
  { message: "source gaps must describe bounded retrieval, normalization, or extraction-budget gaps" },
);

const researchDossierTargetSchema = z.object({
  university: z.object({
    id: publicIdSchema,
    name: z.string().trim().min(1).max(200),
    countryCode: researchCatalogCountryCodeSchema,
    websiteUrl: z.url().refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "";
      } catch {
        return false;
      }
    }, { message: "catalog official university URLs must use HTTPS" }),
  }).strict(),
  program: z.object({
    id: publicIdSchema,
    name: z.string().trim().min(1).max(200),
    degreeLevel: z.enum(["bachelor", "master"]),
    subjectArea: z.string().trim().min(1).max(120),
    officialUrl: z.url().refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "";
      } catch {
        return false;
      }
    }, { message: "catalog official program URLs must use HTTPS" }),
  }).strict().optional(),
}).strict();

const researchDossierRunSchema = z.object({
  id: publicIdSchema,
  status: z.enum(["succeeded", "partial", "failed"]),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
}).strict();

export const publicEvidenceStatusCountsSchema = z.object({
  verified: z.number().int().min(0),
  corroborated: z.number().int().min(0),
  "university-reported": z.number().int().min(0),
  conflicting: z.number().int().min(0),
  anecdotal: z.number().int().min(0),
  inferred: z.number().int().min(0),
  outdated: z.number().int().min(0),
}).strict();
export type PublicEvidenceStatusCounts = z.infer<typeof publicEvidenceStatusCountsSchema>;

const researchDossierSummarySchema = z.object({
  totalClaims: z.number().int().min(0).max(500),
  statusCounts: publicEvidenceStatusCountsSchema,
  processedCategories: z.array(researchModeCategorySchema).max(7),
  unprocessedCategories: z.array(researchModeCategorySchema).max(7),
}).strict();

const readyCategorySchema = z.object({
  category: researchModeCategorySchema,
  state: z.literal("ready"),
  claims: z.array(publicResearchClaimSchema).min(1).max(500),
  explanation: publicEvidenceExplanationSchema,
  sourceGap: publicSourceGapFailureSchema.optional(),
  hasConflict: z.boolean(),
  hasOutdated: z.boolean(),
}).strict();

const unknownCategorySchema = z.object({
  category: researchModeCategorySchema,
  state: z.literal("unknown"),
  claims: z.array(publicResearchClaimSchema).max(0),
  explanation: publicEvidenceExplanationSchema,
  hasConflict: z.literal(false),
  hasOutdated: z.literal(false),
}).strict();

const incompleteCategorySchema = z.object({
  category: researchModeCategorySchema,
  state: z.literal("incomplete"),
  claims: z.array(publicResearchClaimSchema).max(0),
  failure: publicResearchFailureSchema,
  hasConflict: z.literal(false),
  hasOutdated: z.literal(false),
}).strict();

const researchDossierCategorySchema = z.discriminatedUnion("state", [
  readyCategorySchema,
  unknownCategorySchema,
  incompleteCategorySchema,
]);

export const researchDossierSchema = z.object({
  target: researchDossierTargetSchema,
  run: researchDossierRunSchema,
  summary: researchDossierSummarySchema,
  categories: z.array(researchDossierCategorySchema).min(1).max(7),
  sources: z.array(publicResearchSourceSchema).max(12),
}).strict()
  .superRefine((dossier, context) => {
    if (new Set(dossier.categories.map((row) => row.category)).size !== dossier.categories.length) {
      context.addIssue({ code: "custom", message: "dossier categories must be unique", path: ["categories"] });
    }
    const canonicalCategoryOrder = dossier.categories.map((row) => row.category)
      .filter((category, index, values) => values.indexOf(category) === index)
      .map((category) => researchModeCategoryOrder.indexOf(category));
    if (canonicalCategoryOrder.some((position, index) => index > 0 && position < canonicalCategoryOrder[index - 1]!)) {
      context.addIssue({ code: "custom", message: "dossier categories must follow canonical order", path: ["categories"] });
    }

    const processed = dossier.categories.filter((row) => row.state !== "incomplete").map((row) => row.category);
    const unprocessed = dossier.categories.filter((row) => row.state === "incomplete").map((row) => row.category);
    const normalize = (values: readonly ResearchModeCategory[]) =>
      canonicalizeResearchModeCategories(values);
    if (JSON.stringify(normalize(processed)) !== JSON.stringify(dossier.summary.processedCategories)) {
      context.addIssue({ code: "custom", message: "processed categories must match category rows", path: ["summary", "processedCategories"] });
    }
    if (JSON.stringify(normalize(unprocessed)) !== JSON.stringify(dossier.summary.unprocessedCategories)) {
      context.addIssue({ code: "custom", message: "unprocessed categories must match category rows", path: ["summary", "unprocessedCategories"] });
    }
    if (new Set([...processed, ...unprocessed]).size !== dossier.categories.length) {
      context.addIssue({ code: "custom", message: "processed and unprocessed categories must partition dossier rows", path: ["summary"] });
    }
    if (dossier.run.status === "succeeded" && unprocessed.length !== 0) {
      context.addIssue({ code: "custom", message: "succeeded dossiers cannot contain incomplete categories", path: ["run", "status"] });
    }
    if (dossier.run.status === "partial" && (processed.length === 0 || unprocessed.length === 0)) {
      context.addIssue({ code: "custom", message: "partial dossiers require both processed and incomplete categories", path: ["run", "status"] });
    }
    if (dossier.run.status === "failed" && (processed.length !== 0 || unprocessed.length === 0)) {
      context.addIssue({ code: "custom", message: "failed dossiers require zero processed and at least one incomplete category", path: ["run", "status"] });
    }

    const lifecycleTimes = [
      Date.parse(dossier.run.createdAt),
      Date.parse(dossier.run.startedAt),
      Date.parse(dossier.run.updatedAt),
      Date.parse(dossier.run.completedAt),
    ];
    if (lifecycleTimes.some((value, index) => index > 0 && value < lifecycleTimes[index - 1]!)) {
      context.addIssue({ code: "custom", message: "dossier run timestamps must be monotonic", path: ["run"] });
    }

    const sourceIds = new Set(dossier.sources.map((source) => source.id));
    if (sourceIds.size !== dossier.sources.length) {
      context.addIssue({ code: "custom", message: "dossier source IDs must be unique", path: ["sources"] });
    }

    const claims = dossier.categories.flatMap((row) => row.claims);
    if (new Set(claims.map((claim) => claim.id)).size !== claims.length) {
      context.addIssue({ code: "custom", message: "dossier claim IDs must be unique", path: ["categories"] });
    }
    if (claims.length !== dossier.summary.totalClaims) {
      context.addIssue({ code: "custom", message: "summary totalClaims must equal category claims", path: ["summary", "totalClaims"] });
    }

    const expectedCounts = new Map(publicClaimEvidenceStatusSchema.options.map((status) => [status, 0]));
    const referencedSourceIds = new Set<string>();
    for (const [index, claim] of claims.entries()) {
      const row = dossier.categories.find((item) => item.category === claim.category);
      if (row === undefined || row.state === "incomplete") {
        context.addIssue({ code: "custom", message: "claims must belong to a processed category row", path: ["categories", index] });
      }
      if (!sourceIds.has(claim.representativeSourceId) || !claim.sourceIds.includes(claim.representativeSourceId)) {
        context.addIssue({ code: "custom", message: "representative source must resolve within claim source IDs", path: ["categories", index, "representativeSourceId"] });
      }
      if (new Set(claim.sourceIds).size !== claim.sourceIds.length) {
        context.addIssue({ code: "custom", message: "claim source IDs must be unique", path: ["categories", index, "sourceIds"] });
      }
      for (const sourceId of claim.sourceIds) {
        referencedSourceIds.add(sourceId);
        if (!sourceIds.has(sourceId)) {
          context.addIssue({ code: "custom", message: "claim source IDs must resolve to dossier sources", path: ["categories", index, "sourceIds"] });
        }
      }
      expectedCounts.set(claim.verificationStatus, (expectedCounts.get(claim.verificationStatus) ?? 0) + 1);
    }
    for (const [index, source] of dossier.sources.entries()) {
      if (!referencedSourceIds.has(source.id)) {
        context.addIssue({ code: "custom", message: "dossier sources must be referenced by final claims", path: ["sources", index] });
      }
    }
    for (const status of publicClaimEvidenceStatusSchema.options) {
      if (dossier.summary.statusCounts[status] !== expectedCounts.get(status)) {
        context.addIssue({ code: "custom", message: "status counts must match final claims", path: ["summary", "statusCounts", status] });
      }
    }

    for (const row of dossier.categories) {
      const rowClaims = row.claims;
      if (row.state === "ready" && rowClaims.length === 0) {
        context.addIssue({ code: "custom", message: "ready categories require claims", path: ["categories"] });
      }
      if (row.state === "unknown" && rowClaims.length !== 0) {
        context.addIssue({ code: "custom", message: "unknown categories cannot contain claims", path: ["categories"] });
      }
      if (row.state === "incomplete" && rowClaims.length !== 0) {
        context.addIssue({ code: "custom", message: "incomplete categories cannot contain claims", path: ["categories"] });
      }
      if (row.state === "incomplete") continue;
      if (row.explanation.category !== row.category) {
        context.addIssue({ code: "custom", message: "explanation category must match its row", path: ["categories"] });
      }
      const claimIds = new Set(rowClaims.map((claim) => claim.id));
      const explanationReferences = row.explanation.referencedClaimIds;
      if (new Set(explanationReferences).size !== explanationReferences.length) {
        context.addIssue({ code: "custom", message: "explanation references must be unique", path: ["categories"] });
      }
      for (const claimId of explanationReferences) {
        if (!claimIds.has(claimId)) {
          context.addIssue({ code: "custom", message: "explanation references must resolve in the same category", path: ["categories"] });
        }
      }
      if (row.state === "ready") {
        if (row.hasConflict !== rowClaims.some((claim) => claim.verificationStatus === "conflicting")) {
          context.addIssue({ code: "custom", message: "hasConflict must match final claims", path: ["categories"] });
        }
        if (row.hasOutdated !== rowClaims.some((claim) => claim.verificationStatus === "outdated")) {
          context.addIssue({ code: "custom", message: "hasOutdated must match final claims", path: ["categories"] });
        }
        if (row.explanation.referencedClaimIds.length === 0) {
          context.addIssue({ code: "custom", message: "ready explanations must reference claims", path: ["categories"] });
        }
      }
      if (row.state === "unknown") {
        if (row.explanation.referencedClaimIds.length !== 0 || row.explanation.fallback !== true) {
          context.addIssue({ code: "custom", message: "unknown explanations must be zero-reference fallbacks", path: ["categories"] });
        }
      }
    }
  });
export type ResearchDossier = z.infer<typeof researchDossierSchema>;

export const publicResearchTransportErrorCodeSchema = z.enum([
  "invalid-content-type",
  "request-too-large",
  "invalid-json",
  "invalid-request",
  "unsupported-target",
  "sensitive-input",
  "forbidden-origin",
  "internal-error",
]);
export type PublicResearchTransportErrorCode = z.infer<typeof publicResearchTransportErrorCodeSchema>;

export const publicResearchTransportErrorSchema = z.object({
  code: publicResearchTransportErrorCodeSchema,
  message: z.string().trim().min(1).max(300),
}).strict();
export type PublicResearchTransportError = z.infer<typeof publicResearchTransportErrorSchema>;

export const researchModeResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    dossier: researchDossierSchema,
  }).strict(),
  z.object({
    ok: z.literal(false),
    error: publicResearchTransportErrorSchema,
  }).strict(),
]);
export type ResearchModeResponse = z.infer<typeof researchModeResponseSchema>;
