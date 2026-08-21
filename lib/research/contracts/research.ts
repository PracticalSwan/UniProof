import { z } from "zod";

import {
  claimSchema,
  programSchema,
  sourceSchema,
  universitySchema,
} from "@/lib/validation/domain";
import { evidenceStatusSchema, sourceTypeSchema } from "@/lib/validation/evidence";
import {
  RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES,
  RESEARCH_MAX_CATEGORIES,
  RESEARCH_MAX_CLAIMS_PER_RUN,
  RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN,
  RESEARCH_MAX_FAILURES_PER_RUN,
  RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS,
  RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_EXPLANATION_SUMMARY_UTF16,
  RESEARCH_MAX_QUERY_CHARACTERS,
  RESEARCH_MAX_RESPONSE_BYTES,
  RESEARCH_MAX_SOURCES_PER_RUN,
  RESEARCH_MAX_WARNINGS_PER_RUN,
} from "@/lib/security/research-limits";
import { normalizeResearchIdentity } from "@/lib/research/identity";
import {
  normalizeAcademicYear,
  normalizeComparisonText,
  normalizeCurrency,
  normalizeEffectiveDate,
  normalizeIntake,
  normalizeUnit,
} from "@/lib/research/reconciliation/normalize";

const boundedId = z.string().trim().min(1).max(120);
const boundedName = z.string().trim().min(1).max(200);
const boundedSupportingText = z.string().trim().min(1).max(2_000);
const boundedClaimProperty = z.string().trim().min(1).max(200);
const boundedClaimValue = z.union([
  z.string().trim().min(1).max(500),
  z.number().finite(),
  z.boolean(),
]);
const boundedUnit = z.string().trim().min(1).max(40);
const boundedAcademicYear = z.string().trim().min(1).max(40);
const boundedIntake = z.string().trim().min(1).max(40);
const boundedWarning = z.string().min(1).max(500);

function sameIdentityValue(left: string | undefined, right: string | undefined): boolean {
  if (left === undefined || right === undefined) return true;
  const normalizedLeft = normalizeResearchIdentity(left);
  const normalizedRight = normalizeResearchIdentity(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

function sameRequiredIdentityReference(
  leftId: string | undefined,
  leftName: string | undefined,
  rightId: string | undefined,
  rightName: string | undefined,
): boolean {
  if (leftId !== undefined && rightId !== undefined && leftId !== rightId) return false;
  if (leftName !== undefined && rightName !== undefined && !sameIdentityValue(leftName, rightName)) return false;
  return (leftId !== undefined && rightId !== undefined) || (leftName !== undefined && rightName !== undefined);
}

function sameOptionalIdentityReference(
  leftId: string | undefined,
  leftName: string | undefined,
  rightId: string | undefined,
  rightName: string | undefined,
): boolean {
  const leftPresent = leftId !== undefined || leftName !== undefined;
  const rightPresent = rightId !== undefined || rightName !== undefined;
  if (!leftPresent && !rightPresent) return true;
  if (!leftPresent || !rightPresent) return false;
  return sameRequiredIdentityReference(leftId, leftName, rightId, rightName);
}

function normalizedPropertyValue(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function sameTypedScalar(left: string | number | boolean, right: string | number | boolean): boolean {
  if (typeof left !== typeof right) return false;
  if (typeof left === "string" && typeof right === "string") {
    return normalizeComparisonText(left) === normalizeComparisonText(right);
  }
  return left === right;
}





const researchHttpUrlSchema = z.url().refine((value) => {
  const parsed = new URL(value);
  return (
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    parsed.username === "" &&
    parsed.password === ""
  );
}, { message: "research URLs must use HTTP(S) without embedded credentials" });

const candidateDomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((value) => {
    const normalized = value.toLowerCase().replace(/\.+$/, "");
    if (normalized === "" || /[\/@?#:]/.test(normalized)) {
      return false;
    }
    try {
      return new URL(`https://${normalized}/`).hostname !== "";
    } catch {
      return false;
    }
  }, { message: "candidate domain must be a DNS hostname" })
  .transform((value) => {
    const normalized = value.toLowerCase().replace(/\.+$/, "");
    return new URL(`https://${normalized}/`).hostname.toLowerCase().replace(/\.+$/, "");
  })
  .refine((value) => value.length > 0, { message: "candidate domain cannot be empty" });

const canonicalResearchUrlSchema = researchHttpUrlSchema.transform((value) => {
  const parsed = new URL(value);
  parsed.hash = "";
  if (!parsed.hostname.startsWith("[") && parsed.hostname.endsWith(".")) {
    parsed.hostname = parsed.hostname.slice(0, -1);
  }
  return parsed.toString();
});

export const researchCategorySchema = z.enum([
  "admissions",
  "tuition",
  "scholarships",
  "program-structure",
  "research",
  "outcomes",
  "support",
]);

export type ResearchCategory = z.infer<typeof researchCategorySchema>;

const uniqueCategoriesSchema = z
  .array(researchCategorySchema)
  .max(RESEARCH_MAX_CATEGORIES)
  .transform((categories) => [...new Set(categories)]);

const universityReferenceSchema = universitySchema
  .pick({ id: true, name: true })
  .partial()
  .extend({
    id: boundedId.optional(),
    name: boundedName.optional(),
  })
  .strict()
  .superRefine((reference, context) => {
    if (reference.id === undefined && reference.name === undefined) {
      context.addIssue({
        code: "custom",
        message: "a university ID or name is required",
        path: ["id"],
      });
    }
  });

const programReferenceSchema = programSchema
  .pick({ id: true, universityId: true, name: true })
  .partial()
  .extend({
    id: boundedId.optional(),
    universityId: boundedId.optional(),
    name: boundedName.optional(),
  })
  .strict()
  .superRefine((reference, context) => {
    if (reference.id === undefined && reference.name === undefined) {
      context.addIssue({
        code: "custom",
        message: "a program ID or name is required",
        path: ["id"],
      });
    }
  });

export const researchTargetSchema = z
  .object({
    university: universityReferenceSchema.optional(),
    program: programReferenceSchema.optional(),
    subjectArea: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .superRefine((target, context) => {
    if (
      target.university === undefined &&
      target.program === undefined &&
      target.subjectArea === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "a university, program, or subject area is required",
        path: ["university"],
      });
    }
    if (
      target.university?.id !== undefined &&
      target.program?.universityId !== undefined &&
      target.university.id !== target.program.universityId
    ) {
      context.addIssue({
        code: "custom",
        message: "program universityId must match the target university ID",
        path: ["program", "universityId"],
      });
    }
  });

/**
 * A request contains only user research intent. Provider names, URLs, model
 * IDs, retry counts, and server-owned limits are intentionally not accepted.
 * The top-level name/id fields are kept as a small compatibility convenience;
 * new callers can use the structured `target` reference.
 */
export const researchRequestSchema = z
  .object({
    target: researchTargetSchema.optional(),
    universityId: boundedId.optional(),
    universityName: boundedName.optional(),
    programId: boundedId.optional(),
    programName: boundedName.optional(),
    categories: z
      .array(researchCategorySchema)
      .min(1)
      .max(RESEARCH_MAX_CATEGORIES)
      .transform((categories) => [...new Set(categories)]),
    intake: z.string().trim().min(1).max(40).optional(),
    academicYear: z.string().trim().min(1).max(40).optional(),
    locale: z.string().regex(/^[A-Za-z]{2}(?:-[A-Za-z]{2})?$/).optional(),
    question: z.string().trim().min(1).max(RESEARCH_MAX_QUERY_CHARACTERS).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const hasLegacyTarget =
      request.universityId !== undefined ||
      request.universityName !== undefined ||
      request.programId !== undefined ||
      request.programName !== undefined;
    const hasStructuredTarget = request.target !== undefined;

    if (hasStructuredTarget && hasLegacyTarget) {
      context.addIssue({
        code: "custom",
        message: "use either target or legacy target fields, not both",
        path: ["target"],
      });
    }

    if (!hasStructuredTarget && !hasLegacyTarget && request.question === undefined) {
      context.addIssue({
        code: "custom",
        message: "a target or focused research question is required",
        path: ["target"],
      });
    }
  });

export const researchRunStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "completed",
  "succeeded",
  "partial",
  "failed",
]);

export const researchCategoryOrder = [
  "admissions",
  "tuition",
  "scholarships",
  "program-structure",
  "research",
  "outcomes",
  "support",
] as const satisfies readonly [ResearchCategory, ...ResearchCategory[]];

export function canonicalizeResearchCategories(
  categories: readonly ResearchCategory[],
): ResearchCategory[] {
  const unique = new Set(categories);
  return researchCategoryOrder.filter((category) => unique.has(category));
}

export const researchProviderSchema = z.enum([
  "tavily",
  "brave",
  "ror",
  "direct",
  "gemini",
  "groq",
  "openrouter",
]);

/** Providers that may produce Phase 2D model-extracted candidates. */
export const researchExtractionProviderSchema = z.enum([
  "gemini",
  "groq",
  "openrouter",
]);

export const researchProviderAttemptOutcomeSchema = z.enum([
  "success",
  "empty",
  "skipped",
  "failed",
]);

export const researchProviderAttemptStageSchema = z.enum([
  "discovery",
  "retrieval",
  "extraction",
  "reconciliation",
  "explanation",
]);

export const researchProviderAttemptFailureKindSchema = z.enum([
  "configuration",
  "authentication",
  "rate-limit",
  "timeout",
  "upstream",
  "invalid-response",
  "capability",
  "policy",
  "budget",
]);

/**
 * Ordered, safe provider history for a run. The array order is execution
 * order; raw requests/responses and credentials never belong here.
 */
export const researchProviderAttemptSchema = z
  .object({
    stage: researchProviderAttemptStageSchema.default("discovery"),
    provider: researchProviderSchema,
    queryId: boundedId.optional(),
    category: researchCategorySchema.optional(),
    outcome: researchProviderAttemptOutcomeSchema,
    retryCount: z.number().int().min(0).max(1).default(0),
    durationMs: z.number().int().min(0).max(120_000).optional(),
    model: z.string().trim().min(1).max(80).optional(),
    failureKind: researchProviderAttemptFailureKindSchema.optional(),
    budgetScope: z.enum(["provider", "total"]).optional(),
  })
  .strict()
  .superRefine((attempt, context) => {
    if (attempt.outcome === "success" && attempt.failureKind !== undefined) {
      context.addIssue({
        code: "custom",
        message: "successful provider attempts cannot report a failure kind",
        path: ["failureKind"],
      });
    }
    if (
      (attempt.outcome === "failed" || attempt.outcome === "skipped") &&
      attempt.failureKind === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "failed or skipped provider attempts require a failure kind",
        path: ["failureKind"],
      });
    }
    if (attempt.outcome === "empty" && attempt.failureKind !== undefined) {
      context.addIssue({
        code: "custom",
        message: "empty provider attempts cannot report a failure kind",
        path: ["failureKind"],
      });
    }
    if (attempt.budgetScope !== undefined && (attempt.failureKind !== "budget" || attempt.outcome !== "skipped")) {
      context.addIssue({
        code: "custom",
        message: "budgetScope is valid only for skipped budget attempts",
        path: ["budgetScope"],
      });
    }
  });

export const researchRunSchema = z
  .object({
    id: boundedId,
    status: researchRunStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    startedAt: z.iso.datetime().optional(),
    completedAt: z.iso.datetime().optional(),
    discoveryProvider: z.string().min(1).max(80).optional(),
    providerAttempts: z
      .array(researchProviderAttemptSchema)
      .max(RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN)
      .default([]),
    extractionModel: z.string().min(1).max(80).optional(),
    maxExtractionCalls: z.number().int().min(0).max(RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN).optional(),
    extractionCallsUsed: z.number().int().min(0).max(RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN).optional(),
    partial: z.boolean().default(false),
    processedCategories: uniqueCategoriesSchema.default([]),
    unprocessedCategories: uniqueCategoriesSchema.default([]),
    failureCode: z
      .enum([
        "cancelled",
        "validation",
        "source-discovery",
        "retrieval",
        "normalization",
        "provider-rate-limit",
        "provider-budget",
        "provider-error",
        "timeout",
        "source-limit",
        "unknown",
      ])
      .optional(),
    failureReason: boundedWarning.optional(),
  })
  .strict()
  .superRefine((run, context) => {
    if (
      run.maxExtractionCalls !== undefined &&
      run.extractionCallsUsed !== undefined &&
      run.extractionCallsUsed > run.maxExtractionCalls
    ) {
      context.addIssue({
        code: "custom",
        message: "extraction call usage cannot exceed the run budget",
        path: ["extractionCallsUsed"],
      });
    }
    if (run.partial !== (run.status === "partial")) {
      context.addIssue({
        code: "custom",
        message: "partial must be true exactly for partial run status",
        path: ["partial"],
      });
    }
    const createdAt = Date.parse(run.createdAt);
    const startedAt = run.startedAt === undefined ? undefined : Date.parse(run.startedAt);
    const updatedAt = Date.parse(run.updatedAt);
    const completedAt = run.completedAt === undefined ? undefined : Date.parse(run.completedAt);
    if (startedAt !== undefined && (createdAt > startedAt || startedAt > updatedAt)) {
      context.addIssue({
        code: "custom",
        message: "run timestamps must be chronologically ordered",
        path: ["startedAt"],
      });
    }
    if (completedAt !== undefined && updatedAt > completedAt) {
      context.addIssue({
        code: "custom",
        message: "run timestamps must be chronologically ordered",
        path: ["completedAt"],
      });
    }
    if (run.status === "succeeded" || run.status === "partial" || run.status === "failed") {
      if (run.startedAt === undefined || run.completedAt === undefined) {
        context.addIssue({
          code: "custom",
          message: "terminal runs require startedAt and completedAt",
          path: ["completedAt"],
        });
      }
      if (run.status === "succeeded" && (run.processedCategories.length === 0 || run.unprocessedCategories.length > 0)) {
        context.addIssue({
          code: "custom",
          message: "succeeded runs must process every requested category",
          path: ["processedCategories"],
        });
      }
      if (run.status === "partial" && (run.processedCategories.length === 0 || run.unprocessedCategories.length === 0)) {
        context.addIssue({
          code: "custom",
          message: "partial runs must contain processed and unprocessed categories",
          path: ["processedCategories"],
        });
      }
      if (run.status === "failed" && run.processedCategories.length > 0) {
        context.addIssue({
          code: "custom",
          message: "failed runs cannot contain processed categories",
          path: ["processedCategories"],
        });
      }
    }
    const unprocessed = new Set(run.unprocessedCategories);
    if (run.processedCategories.some((category) => unprocessed.has(category))) {
      context.addIssue({
        code: "custom",
        message: "processed and unprocessed run categories must be disjoint",
        path: ["unprocessedCategories"],
      });
    }
  });

const candidateSourceBaseSchema = z
  .object({
    url: z.url(),
    title: z.string().min(1).max(300).optional(),
    publisher: z.string().min(1).max(200).optional(),
    domain: candidateDomainSchema.optional(),
    sourceType: sourceTypeSchema,
    discoveryProvider: z.string().min(1).max(80),
    discoveryQueryId: boundedId.optional(),
    requestedCategory: researchCategorySchema.optional(),
    discoveredAt: z.iso.datetime().optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    rank: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const candidateSourceSchema = candidateSourceBaseSchema.superRefine((candidate, context) => {
  if (candidate.domain === undefined) {
    return;
  }
  const hostname = new URL(candidate.url).hostname.toLowerCase().replace(/\.+$/, "");
  if (candidate.domain !== hostname) {
    context.addIssue({
      code: "custom",
      message: "candidate domain must match the candidate URL hostname",
      path: ["domain"],
    });
  }
});

const researchDocumentSectionSchema = z
  .object({
    heading: z.string().min(1).max(300).optional(),
    text: z.string().min(1).max(20_000),
  })
  .strict();

const contentTypeSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(?:;.*)?$/)
  .refine(
    (value) =>
      RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES.includes(
        value.split(";", 1)[0].trim().toLowerCase(),
      ),
    { message: "unsupported research content type" },
  );

const researchDocumentBaseSchema = z
  .object({
    id: boundedId,
    sourceId: boundedId,
    originalUrl: researchHttpUrlSchema,
    canonicalUrl: canonicalResearchUrlSchema,
    title: boundedName,
    publisher: z.string().min(1).max(200),
    sourceType: sourceTypeSchema,
    retrievedAt: z.iso.datetime(),
    contentType: contentTypeSchema,
    retrievedBytes: z.number().int().min(0).max(RESEARCH_MAX_RESPONSE_BYTES).optional(),
    truncated: z.boolean().default(false),
    partial: z.boolean().optional(),
    normalizedText: z.string().min(1).max(RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS),
    sections: z.array(researchDocumentSectionSchema).max(100).default([]),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/i).transform((value) => value.toLowerCase()),
  })
  .strict();

export const researchDocumentSchema = researchDocumentBaseSchema.superRefine((document, context) => {
  const sectionCharacters = document.sections.reduce(
    (total, section) => total + section.text.length,
    0,
  );
  if (sectionCharacters > RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS) {
    context.addIssue({
      code: "custom",
      message: "aggregate section text exceeds the normalized document text limit",
      path: ["sections"],
    });
  }
});

const claimCandidateBaseSchema = claimSchema
  .omit({ universityId: true, programId: true, verificationStatus: true })
  .extend({
    id: boundedId,
    universityId: boundedId.optional(),
    universityName: boundedName.optional(),
    programId: boundedId.nullable().optional(),
    programName: boundedName.optional(),
    category: researchCategorySchema,
    property: boundedClaimProperty,
    value: boundedClaimValue,
    unit: boundedUnit.optional(),
    academicYear: boundedAcademicYear.optional(),
    sourceId: boundedId,
    supportingText: boundedSupportingText,
    documentId: boundedId,
    extractionMethod: z.enum(["model", "heuristic", "rule", "manual"]),
    extractionProvider: researchExtractionProviderSchema.optional(),
    extractionModel: z.string().trim().min(1).max(80).optional(),
    intake: boundedIntake.optional(),
    /** Extraction confidence, not final evidence confidence or status. */
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const claimCandidateSchema = claimCandidateBaseSchema.superRefine(
  (candidate, context) => {
    if (candidate.universityId === undefined && candidate.universityName === undefined) {
      context.addIssue({
        code: "custom",
        message: "a university ID or name is required",
        path: ["universityId"],
      });
    }
  },
);

/**
 * Final evidence claims are application-owned. Every final claim requires
 * candidate-backed provenance; the result contract applies the complete
 * cross-record identity, value, and provenance checks.
 */
export const verifiedClaimSchema = z
  .object({
    id: boundedId,
    universityId: boundedId.optional(),
    universityName: boundedName.optional(),
    programId: boundedId.optional(),
    programName: boundedName.optional(),
    category: researchCategorySchema,
    property: boundedClaimProperty,
    value: boundedClaimValue,
    unit: boundedUnit.optional(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    academicYear: boundedAcademicYear.optional(),
    effectiveDate: z.iso.date().optional(),
    intake: boundedIntake.optional(),
    sourceId: boundedId.optional(),
    supportingText: boundedSupportingText,
    verificationStatus: evidenceStatusSchema.refine((value) => value !== "unknown", {
      message: "claim-level unknown is a category outcome, not a final claim status",
    }),
    sourceIds: z.array(boundedId).min(1).max(RESEARCH_MAX_SOURCES_PER_RUN),
    documentIds: z.array(boundedId).min(1).max(RESEARCH_MAX_SOURCES_PER_RUN),
    candidateIds: z.array(boundedId).min(1).max(RESEARCH_MAX_CLAIMS_PER_RUN),
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.universityId === undefined && claim.universityName === undefined) {
      context.addIssue({
        code: "custom",
        message: "a university ID or name is required",
        path: ["universityId"],
      });
    }
    if (claim.programId !== undefined && claim.programName !== undefined &&
      normalizeResearchIdentity(claim.programId) === "") {
      context.addIssue({
        code: "custom",
        message: "program identity cannot be empty",
        path: ["programId"],
      });
    }
    if (new Set(claim.sourceIds).size !== claim.sourceIds.length) {
      context.addIssue({
        code: "custom",
        message: "verified claim source IDs must be unique",
        path: ["sourceIds"],
      });
    }
    if (new Set(claim.documentIds).size !== claim.documentIds.length) {
      context.addIssue({
        code: "custom",
        message: "verified claim document IDs must be unique",
        path: ["documentIds"],
      });
    }
    if (claim.sourceId !== undefined && !claim.sourceIds.includes(claim.sourceId)) {
      context.addIssue({
        code: "custom",
        message: "sourceId must also appear in sourceIds",
        path: ["sourceId"],
      });
    }
    if (JSON.stringify([...claim.sourceIds].sort()) !== JSON.stringify(claim.sourceIds)) {
      context.addIssue({
        code: "custom",
        message: "verified claim source IDs must be deterministically ordered",
        path: ["sourceIds"],
      });
    }
    if (JSON.stringify([...claim.documentIds].sort()) !== JSON.stringify(claim.documentIds)) {
      context.addIssue({
        code: "custom",
        message: "verified claim document IDs must be deterministically ordered",
        path: ["documentIds"],
      });
    }
    if (claim.candidateIds !== undefined && new Set(claim.candidateIds).size !== claim.candidateIds.length) {
      context.addIssue({
        code: "custom",
        message: "verified claim candidate IDs must be unique",
        path: ["candidateIds"],
      });
    }
    const candidateIds = claim.candidateIds;
    if (candidateIds !== undefined &&
      candidateIds.some((candidateId, index) => index > 0 && candidateId < candidateIds[index - 1]!)) {
      context.addIssue({
        code: "custom",
        message: "verified claim candidate IDs must be deterministically ordered",
        path: ["candidateIds"],
      });
    }
  });

export const evidenceExplanationSchema = z
  .object({
    category: researchCategorySchema,
    referencedClaimIds: z
      .array(boundedId)
      .max(RESEARCH_MAX_CLAIMS_PER_RUN)
      .default([])
      .superRefine((ids, context) => {
        if (new Set(ids).size !== ids.length) {
          context.addIssue({
            code: "custom",
            message: "explanation claim references must be unique",
          });
        }
        if (JSON.stringify([...ids].sort()) !== JSON.stringify(ids)) {
          context.addIssue({
            code: "custom",
            message: "explanation claim references must be deterministically ordered",
          });
        }
      }),
    summary: z.string().min(1).max(RESEARCH_MAX_EXPLANATION_SUMMARY_UTF16),
    fallback: z.boolean().optional(),
  })
  .strict();

const evidenceStatusOrder = evidenceStatusSchema.options;

const categoryCoverageSchema = z
  .object({
    category: researchCategorySchema,
    claimCount: z.number().int().min(0),
    hasEvidence: z.boolean(),
    statuses: z
      .array(evidenceStatusSchema)
      .max(8)
      .refine((statuses) => new Set(statuses).size === statuses.length, { message: "coverage statuses must be unique" })
      .default([]),
  })
  .strict();

export const evidenceSummarySchema = z
  .object({
    statusCounts: z
      .object({
        verified: z.number().int().min(0),
        corroborated: z.number().int().min(0),
        "university-reported": z.number().int().min(0),
        conflicting: z.number().int().min(0),
        anecdotal: z.number().int().min(0),
        inferred: z.number().int().min(0),
        unknown: z.number().int().min(0),
        outdated: z.number().int().min(0),
      })
      .strict(),
    totalClaims: z.number().int().min(0),
    categoryCoverage: z.array(categoryCoverageSchema).max(RESEARCH_MAX_CATEGORIES).default([]),
    categoriesProcessed: uniqueCategoriesSchema.default([]),
    categoriesWithConflicts: uniqueCategoriesSchema.default([]),
    categoriesUnknown: uniqueCategoriesSchema.default([]),
    categoriesOutdated: uniqueCategoriesSchema.default([]),
    categoriesUnprocessed: uniqueCategoriesSchema.default([]),
    categoriesFailed: uniqueCategoriesSchema.default([]),
  })
  .strict()
  .superRefine((summary, context) => {
    const statusTotal = Object.values(summary.statusCounts).reduce(
      (total, count) => total + count,
      0,
    );
    if (summary.totalClaims !== statusTotal) {
      context.addIssue({
        code: "custom",
        message: "totalClaims must equal the sum of all status counts",
        path: ["totalClaims"],
      });
    }
    const coverageCategories = summary.categoryCoverage.map((coverage) => coverage.category);
    if (new Set(coverageCategories).size !== coverageCategories.length) {
      context.addIssue({
        code: "custom",
        message: "category coverage entries must be unique by category",
        path: ["categoryCoverage"],
      });
    }
    const coverageClaimTotal = summary.categoryCoverage.reduce(
      (total, coverage) => total + coverage.claimCount,
      0,
    );
    if (coverageClaimTotal > summary.totalClaims) {
      context.addIssue({
        code: "custom",
        message: "category coverage claim counts cannot exceed totalClaims",
        path: ["categoryCoverage"],
      });
    }
    if (summary.statusCounts.unknown !== 0) {
      context.addIssue({
        code: "custom",
        message: "final Phase 2E evidence summaries cannot count claim-level unknown status",
        path: ["statusCounts", "unknown"],
      });
    }
    for (const [index, coverage] of summary.categoryCoverage.entries()) {
      if (coverage.claimCount === 0 && coverage.statuses.length > 0) {
        context.addIssue({
          code: "custom",
          message: "zero-claim category coverage cannot report claim statuses",
          path: ["categoryCoverage", index, "statuses"],
        });
      }
      if (coverage.hasEvidence !== (coverage.claimCount > 0)) {
        context.addIssue({
          code: "custom",
          message: "category coverage hasEvidence must equal claimCount > 0",
          path: ["categoryCoverage", index, "hasEvidence"],
        });
      }
      const expectedStatuses = evidenceStatusOrder.filter((status) => coverage.statuses.includes(status));
      if (JSON.stringify(coverage.statuses) !== JSON.stringify(expectedStatuses)) {
        context.addIssue({
          code: "custom",
          message: "category coverage statuses must use deterministic evidence-status order",
          path: ["categoryCoverage", index, "statuses"],
        });
      }
    }

    const unprocessed = new Set(summary.categoriesUnprocessed);
    if (summary.categoriesProcessed.some((category) => unprocessed.has(category))) {
      context.addIssue({
        code: "custom",
        message: "processed and unprocessed categories must be disjoint",
        path: ["categoriesUnprocessed"],
      });
    }
    const processed = new Set(summary.categoriesProcessed);
    const unknown = new Set(summary.categoriesUnknown);
    const failed = new Set(summary.categoriesFailed);
    if (summary.categoriesFailed.some((category) => !failed.has(category) || !unprocessed.has(category))) {
      context.addIssue({
        code: "custom",
        message: "categoriesFailed must be a subset of unprocessed categories",
        path: ["categoriesFailed"],
      });
    }
    const expectedCoverageOrder = canonicalizeResearchCategories(summary.categoriesProcessed);
    if (JSON.stringify(summary.categoryCoverage.map((coverage) => coverage.category)) !== JSON.stringify(expectedCoverageOrder)) {
      context.addIssue({
        code: "custom",
        message: "category coverage must follow canonical category order",
        path: ["categoryCoverage"],
      });
    }
    for (const category of summary.categoriesUnknown) {
      if (!processed.has(category)) {
        context.addIssue({
          code: "custom",
          message: "unknown categories must be processed categories",
          path: ["categoriesUnknown"],
        });
      }
      const matching = summary.categoryCoverage.filter((coverage) => coverage.category === category);
      if (matching.length !== 1 || matching[0]?.claimCount !== 0 || matching[0]?.hasEvidence !== false || matching[0]?.statuses.length !== 0) {
        context.addIssue({
          code: "custom",
          message: "unknown categories require one zero-claim coverage row",
          path: ["categoryCoverage"],
        });
      }
    }
    for (const coverage of summary.categoryCoverage) {
      if (processed.has(coverage.category) && coverage.claimCount === 0 && !unknown.has(coverage.category)) {
        context.addIssue({
          code: "custom",
          message: "processed zero-claim categories must be reported as unknown",
          path: ["categoriesUnknown"],
        });
      }
      if (!processed.has(coverage.category)) {
        context.addIssue({
          code: "custom",
          message: "category coverage cannot report an unprocessed category",
          path: ["categoryCoverage"],
        });
      }
    }
  });

export const researchSourceSchema = sourceSchema
  .extend({
    id: boundedId,
    url: researchHttpUrlSchema,
    title: z.string().min(1).max(300),
    publisher: z.string().min(1).max(200),
    academicYear: z.string().trim().min(1).max(40).optional(),
    discoveryProvider: researchProviderSchema.optional(),
    discoveryQueryId: boundedId.optional(),
  })
  .strict();

const researchFailureSchema = z
  .object({
    category: researchCategorySchema.optional(),
    code: z.enum([
      "cancelled",
      "validation",
      "source-discovery",
      "retrieval",
      "normalization",
      "provider-rate-limit",
      "provider-budget",
      "provider-error",
      "timeout",
      "source-limit",
      "unknown",
    ]),
    message: boundedWarning,
  })
  .strict();

export const researchResultSchema = z
  .object({
    run: researchRunSchema,
    candidateSources: z.array(candidateSourceSchema).max(RESEARCH_MAX_SOURCES_PER_RUN).default([]),
    sources: z.array(researchSourceSchema).max(RESEARCH_MAX_SOURCES_PER_RUN).default([]),
    documents: z.array(researchDocumentSchema).max(RESEARCH_MAX_SOURCES_PER_RUN).default([]),
    candidates: z.array(claimCandidateSchema).max(RESEARCH_MAX_CLAIMS_PER_RUN).default([]),
    claims: z.array(verifiedClaimSchema).max(RESEARCH_MAX_CLAIMS_PER_RUN).default([]),
    explanations: z.array(evidenceExplanationSchema).max(RESEARCH_MAX_CATEGORIES).default([]),
    evidenceSummary: evidenceSummarySchema,
    failures: z.array(researchFailureSchema).max(RESEARCH_MAX_FAILURES_PER_RUN).default([]),
    warnings: z.array(boundedWarning).max(RESEARCH_MAX_WARNINGS_PER_RUN).default([]),
  })
  .strict()
  .superRefine((result, context) => {
    const ensureUniqueIds = (items: readonly { id: string }[], path: string) => {
      const ids = items.map((item) => item.id);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: "custom", message: `${path} IDs must be unique`, path: [path] });
      }
    };

    ensureUniqueIds(result.sources, "sources");
    ensureUniqueIds(result.documents, "documents");
    ensureUniqueIds(result.candidates, "candidates");
    ensureUniqueIds(result.claims, "claims");

    const sourceIds = new Set(result.sources.map((source) => source.id));
    const documents = new Map(result.documents.map((document) => [document.id, document]));
    const candidates = new Map(result.candidates.map((candidate) => [candidate.id, candidate]));

    for (const [index, document] of result.documents.entries()) {
      if (!sourceIds.has(document.sourceId)) {
        context.addIssue({ code: "custom", message: "document sourceId must reference a result source", path: ["documents", index, "sourceId"] });
      }
    }

    for (const [index, candidate] of result.candidates.entries()) {
      const document = documents.get(candidate.documentId);
      if (!sourceIds.has(candidate.sourceId)) {
        context.addIssue({ code: "custom", message: "candidate sourceId must reference a result source", path: ["candidates", index, "sourceId"] });
      }
      if (document === undefined) {
        context.addIssue({ code: "custom", message: "candidate documentId must reference a result document", path: ["candidates", index, "documentId"] });
      } else if (document.sourceId !== candidate.sourceId) {
        context.addIssue({ code: "custom", message: "candidate sourceId must match its document sourceId", path: ["candidates", index, "sourceId"] });
      }
    }

    const claimedCandidateIds = new Map<string, number>();
    for (const [index, claim] of result.claims.entries()) {
      if (claim.candidateIds !== undefined) {
        let hasSupportingValue = false;
        for (const candidateId of claim.candidateIds) {
          const candidate = candidates.get(candidateId);
          if (candidate === undefined) {
            context.addIssue({
              code: "custom",
              message: "claim candidateIds must reference result candidates",
              path: ["claims", index, "candidateIds"],
            });
            continue;
          }
          const candidateProgramId = candidate.programId ?? undefined;
          const supportsIdentity =
            sameRequiredIdentityReference(
              claim.universityId,
              claim.universityName,
              candidate.universityId,
              candidate.universityName,
            ) &&
            sameOptionalIdentityReference(
              claim.programId,
              claim.programName,
              candidateProgramId,
              candidate.programName,
            );
          const supportsValue = supportsIdentity && candidate.category === claim.category &&
            normalizedPropertyValue(candidate.property) === normalizedPropertyValue(claim.property) &&
            sameTypedScalar(candidate.value, claim.value) &&
            normalizeUnit(candidate.unit) === normalizeUnit(claim.unit) &&
            normalizeCurrency(candidate.currency) === normalizeCurrency(claim.currency) &&
            normalizeAcademicYear(candidate.academicYear) === normalizeAcademicYear(claim.academicYear) &&
            normalizeIntake(candidate.intake) === normalizeIntake(claim.intake) &&
            normalizeEffectiveDate(candidate.effectiveDate) === normalizeEffectiveDate(claim.effectiveDate);
          if (supportsValue) {
            hasSupportingValue = true;
          } else {
            context.addIssue({
              code: "custom",
              message: "every referenced candidate must mechanically support the final claim value",
              path: ["claims", index, "candidateIds"],
            });
          }
          const previous = claimedCandidateIds.get(candidateId);
          if (previous !== undefined) {
            context.addIssue({
              code: "custom",
              message: "one candidate may back at most one final factual claim",
              path: ["claims", index, "candidateIds"],
            });
          } else {
            claimedCandidateIds.set(candidateId, index);
          }
        }
        if (!hasSupportingValue) {
          context.addIssue({
            code: "custom",
            message: "final claim value must originate from a referenced candidate",
            path: ["claims", index, "value"],
          });
        }
        const sortedCandidateIds = [...claim.candidateIds].sort();
        if (JSON.stringify(sortedCandidateIds) !== JSON.stringify(claim.candidateIds)) {
          context.addIssue({
            code: "custom",
            message: "claim candidateIds must be deterministically ordered",
            path: ["claims", index, "candidateIds"],
          });
        }
        const derivedSourceIds = [...new Set(claim.candidateIds.map((candidateId) => candidates.get(candidateId)?.sourceId).filter((id): id is string => id !== undefined))].sort();
        const derivedDocumentIds = [...new Set(claim.candidateIds.map((candidateId) => candidates.get(candidateId)?.documentId).filter((id): id is string => id !== undefined))].sort();
        if (JSON.stringify(derivedSourceIds) !== JSON.stringify([...claim.sourceIds].sort())) {
          context.addIssue({
            code: "custom",
            message: "claim sourceIds must equal candidate-derived provenance",
            path: ["claims", index, "sourceIds"],
          });
        }
        if (JSON.stringify([...claim.sourceIds].sort()) !== JSON.stringify(claim.sourceIds)) {
          context.addIssue({
            code: "custom",
            message: "claim sourceIds must be deterministically ordered",
            path: ["claims", index, "sourceIds"],
          });
        }
        if (JSON.stringify(derivedDocumentIds) !== JSON.stringify([...claim.documentIds].sort())) {
          context.addIssue({
            code: "custom",
            message: "claim documentIds must equal candidate-derived provenance",
            path: ["claims", index, "documentIds"],
          });
        }
        if (JSON.stringify([...claim.documentIds].sort()) !== JSON.stringify(claim.documentIds)) {
          context.addIssue({
            code: "custom",
            message: "claim documentIds must be deterministically ordered",
            path: ["claims", index, "documentIds"],
          });
        }
        const representative = claim.candidateIds
          .map((candidateId) => candidates.get(candidateId))
          .find((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined &&
            (claim.sourceId === undefined || candidate.sourceId === claim.sourceId) &&
            candidate.supportingText === claim.supportingText);
        if (representative === undefined) {
          context.addIssue({
            code: "custom",
            message: "claim supporting provenance must match a referenced candidate",
            path: ["claims", index, "supportingText"],
          });
        }
        const candidateNames = claim.candidateIds
          .map((candidateId) => candidates.get(candidateId)?.universityName)
          .filter((name): name is string => name !== undefined);
        for (const candidateName of candidateNames) {
          if (!sameIdentityValue(claim.universityName, candidateName)) {
            context.addIssue({
              code: "custom",
              message: "claim university identity must match every referenced candidate",
              path: ["claims", index, "universityName"],
            });
            break;
          }
        }
        const candidateUniversityIds = claim.candidateIds
          .map((candidateId) => candidates.get(candidateId)?.universityId)
          .filter((id): id is string => id !== undefined);
        if (claim.universityId !== undefined && candidateUniversityIds.some((id) => id !== claim.universityId)) {
          context.addIssue({
            code: "custom",
            message: "claim university ID must match every referenced candidate",
            path: ["claims", index, "universityId"],
          });
        }
        const candidateProgramIds = claim.candidateIds
          .map((candidateId) => candidates.get(candidateId)?.programId)
          .filter((id): id is string => id !== undefined && id !== null);
        if (claim.programId !== undefined && candidateProgramIds.some((id) => id !== claim.programId)) {
          context.addIssue({
            code: "custom",
            message: "claim program ID must match every referenced candidate",
            path: ["claims", index, "programId"],
          });
        }
        const candidateProgramNames = claim.candidateIds
          .map((candidateId) => candidates.get(candidateId)?.programName)
          .filter((name): name is string => name !== undefined);
        for (const candidateProgramName of candidateProgramNames) {
          if (!sameIdentityValue(claim.programName, candidateProgramName)) {
            context.addIssue({
              code: "custom",
              message: "claim program identity must match every referenced candidate",
              path: ["claims", index, "programName"],
            });
            break;
          }
        }
      }
      const claimDocumentSourceIds = new Set<string>();
      for (const sourceId of claim.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({ code: "custom", message: "claim sourceIds must reference result sources", path: ["claims", index, "sourceIds"] });
        }
      }
      for (const documentId of claim.documentIds) {
        const document = documents.get(documentId);
        if (document === undefined) {
          context.addIssue({ code: "custom", message: "claim documentIds must reference result documents", path: ["claims", index, "documentIds"] });
        } else {
          claimDocumentSourceIds.add(document.sourceId);
          if (!claim.sourceIds.includes(document.sourceId)) {
            context.addIssue({ code: "custom", message: "claim document sources must appear in sourceIds", path: ["claims", index, "sourceIds"] });
          }
        }
      }
      for (const sourceId of claim.sourceIds) {
        if (sourceIds.has(sourceId) && !claimDocumentSourceIds.has(sourceId)) {
          context.addIssue({
            code: "custom",
            message: "every claim sourceId must be backed by a referenced document",
            path: ["claims", index, "sourceIds"],
          });
        }
      }
    }

    const finalClaimsById = new Map(result.claims.map((claim) => [claim.id, claim]));
    const explanationCategories = new Set<ResearchCategory>();
    for (const [index, explanation] of result.explanations.entries()) {
      if (explanationCategories.has(explanation.category)) {
        context.addIssue({
          code: "custom",
          message: "final explanations must be unique by category",
          path: ["explanations", index, "category"],
        });
      }
      explanationCategories.add(explanation.category);
      if (!result.evidenceSummary.categoriesProcessed.includes(explanation.category)) {
        context.addIssue({
          code: "custom",
          message: "final explanations may reference processed categories only",
          path: ["explanations", index, "category"],
        });
      }
      const categoryClaims = result.claims.filter((claim) => claim.category === explanation.category);
      if (categoryClaims.length > 0 && explanation.referencedClaimIds.length === 0) {
        context.addIssue({
          code: "custom",
          message: "claim-bearing category explanations must reference a final claim",
          path: ["explanations", index, "referencedClaimIds"],
        });
      }
      if (result.evidenceSummary.categoriesUnknown.includes(explanation.category)) {
        if (explanation.referencedClaimIds.length > 0) {
          context.addIssue({
            code: "custom",
            message: "unknown category explanations cannot reference factual claims",
            path: ["explanations", index, "referencedClaimIds"],
          });
        }
        if (explanation.fallback !== true) {
          context.addIssue({
            code: "custom",
            message: "unknown category explanations must be deterministic fallbacks",
            path: ["explanations", index, "fallback"],
          });
        }
      }
      for (const claimId of explanation.referencedClaimIds) {
        const claim = finalClaimsById.get(claimId);
        if (claim === undefined || claim.category !== explanation.category) {
          context.addIssue({
            code: "custom",
            message: "explanation claim references must resolve to same-category final claims",
            path: ["explanations", index, "referencedClaimIds"],
          });
          break;
        }
      }
    }
    for (const category of result.evidenceSummary.categoriesProcessed) {
      if (!explanationCategories.has(category)) {
        context.addIssue({
          code: "custom",
          message: "every processed category requires exactly one final explanation",
          path: ["explanations"],
        });
      }
    }

    if (result.evidenceSummary.totalClaims !== result.claims.length) {
      context.addIssue({
        code: "custom",
        message: "evidenceSummary totalClaims must equal the number of verified claims",
        path: ["evidenceSummary", "totalClaims"],
      });
    }
    const actualStatusCounts = new Map(
      evidenceStatusSchema.options.map((status) => [status, 0]),
    );
    for (const claim of result.claims) {
      actualStatusCounts.set(
        claim.verificationStatus,
        (actualStatusCounts.get(claim.verificationStatus) ?? 0) + 1,
      );
    }
    for (const status of evidenceStatusSchema.options) {
      if (result.evidenceSummary.statusCounts[status] !== actualStatusCounts.get(status)) {
        context.addIssue({
          code: "custom",
          message: `evidenceSummary status count for ${status} must match verified claims`,
          path: ["evidenceSummary", "statusCounts", status],
        });
      }
    }

    const requiredStatusCategorySets = [
      ["conflicting", result.evidenceSummary.categoriesWithConflicts, "categoriesWithConflicts"],
      ["unknown", result.evidenceSummary.categoriesUnknown, "categoriesUnknown"],
      ["outdated", result.evidenceSummary.categoriesOutdated, "categoriesOutdated"],
    ] as const;
    for (const [status, reportedCategories, path] of requiredStatusCategorySets) {
      const reported = new Set(reportedCategories);
      const actual = new Set(
        result.claims
          .filter((claim) => claim.verificationStatus === status)
          .map((claim) => claim.category),
      );
      for (const category of actual) {
        if (!reported.has(category)) {
          context.addIssue({
            code: "custom",
            message: `evidence summary ${path} must include claim-level ${status} categories`,
            path: ["evidenceSummary", path],
          });
        }
      }
      if (status !== "unknown") {
        for (const category of reported) {
          if (!actual.has(category)) {
            context.addIssue({
              code: "custom",
              message: `evidence summary ${path} cannot report a category without a ${status} claim`,
              path: ["evidenceSummary", path],
            });
          }
        }
      }
    }

    for (const [index, coverage] of result.evidenceSummary.categoryCoverage.entries()) {
      const actualClaims = result.claims.filter((claim) => claim.category === coverage.category);
      if (coverage.claimCount !== actualClaims.length) {
        context.addIssue({
          code: "custom",
          message: "category coverage claimCount must match verified claims",
          path: ["evidenceSummary", "categoryCoverage", index, "claimCount"],
        });
      }

      const actualStatuses = new Set(actualClaims.map((claim) => claim.verificationStatus));
      const reportedStatuses = new Set(coverage.statuses);
      if (
        actualStatuses.size !== reportedStatuses.size ||
        [...actualStatuses].some((status) => !reportedStatuses.has(status))
      ) {
        context.addIssue({
          code: "custom",
          message: "category coverage statuses must match verified claims",
          path: ["evidenceSummary", "categoryCoverage", index, "statuses"],
        });
      }
    }

    const coveredCategories = new Set(
      result.evidenceSummary.categoryCoverage.map((coverage) => coverage.category),
    );
    for (const category of new Set(result.claims.map((claim) => claim.category))) {
      if (!coveredCategories.has(category)) {
        context.addIssue({
          code: "custom",
          message: "every verified-claim category must have a category coverage entry",
          path: ["evidenceSummary", "categoryCoverage"],
        });
      }
    }

    const processedCategories = new Set(result.evidenceSummary.categoriesProcessed);
    const unknownCategories = new Set(result.evidenceSummary.categoriesUnknown);
    for (const category of unknownCategories) {
      if (!processedCategories.has(category)) {
        context.addIssue({
          code: "custom",
          message: "categoriesUnknown must be a subset of processed categories",
          path: ["evidenceSummary", "categoriesUnknown"],
        });
      }
      if (result.claims.some((claim) => claim.category === category)) {
        context.addIssue({
          code: "custom",
          message: "an unknown category cannot contain a final claim",
          path: ["evidenceSummary", "categoriesUnknown"],
        });
      }
      const coverage = result.evidenceSummary.categoryCoverage.filter((row) => row.category === category);
      if (coverage.length !== 1 || coverage[0]?.claimCount !== 0 || coverage[0]?.hasEvidence !== false || coverage[0]?.statuses.length !== 0) {
        context.addIssue({
          code: "custom",
          message: "unknown categories require exactly one zero-claim coverage row",
          path: ["evidenceSummary", "categoryCoverage"],
        });
      }
    }
    for (const category of processedCategories) {
      if (!coveredCategories.has(category)) {
        context.addIssue({
          code: "custom",
          message: "every processed category requires one coverage row",
          path: ["evidenceSummary", "categoryCoverage"],
        });
      }
    }

    const sameCategorySet = (
      left: readonly ResearchCategory[],
      right: readonly ResearchCategory[],
    ) => left.length === right.length && left.every((category) => right.includes(category));

    if (!sameCategorySet(result.run.processedCategories, result.evidenceSummary.categoriesProcessed)) {
      context.addIssue({
        code: "custom",
        message: "run processedCategories must match evidence summary categoriesProcessed",
        path: ["evidenceSummary", "categoriesProcessed"],
      });
    }
    if (!sameCategorySet(result.run.unprocessedCategories, result.evidenceSummary.categoriesUnprocessed)) {
      context.addIssue({
        code: "custom",
        message: "run unprocessedCategories must match evidence summary categoriesUnprocessed",
        path: ["evidenceSummary", "categoriesUnprocessed"],
      });
    }
  });

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchTarget = z.infer<typeof researchTargetSchema>;
export type ResearchRunStatus = z.infer<typeof researchRunStatusSchema>;
export type ResearchProvider = z.infer<typeof researchProviderSchema>;
export type ResearchExtractionProvider = z.infer<typeof researchExtractionProviderSchema>;
export type ResearchProviderAttempt = z.infer<typeof researchProviderAttemptSchema>;
export type ResearchProviderAttemptFailureKind = z.infer<typeof researchProviderAttemptFailureKindSchema>;
export type ResearchRun = z.infer<typeof researchRunSchema>;
export type CandidateSource = z.infer<typeof candidateSourceSchema>;
export type ResearchDocumentSection = z.infer<typeof researchDocumentSectionSchema>;
export type ResearchDocument = z.infer<typeof researchDocumentSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ClaimCandidate = z.infer<typeof claimCandidateSchema>;
export type VerifiedClaim = z.infer<typeof verifiedClaimSchema>;
export type EvidenceExplanation = z.infer<typeof evidenceExplanationSchema>;
export type EvidenceSummary = z.infer<typeof evidenceSummarySchema>;
export type ResearchFailure = z.infer<typeof researchFailureSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema>;

export { evidenceStatusSchema };
