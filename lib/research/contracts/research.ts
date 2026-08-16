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
  RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS,
  RESEARCH_MAX_QUERY_CHARACTERS,
  RESEARCH_MAX_RESPONSE_BYTES,
  RESEARCH_MAX_SOURCES_PER_RUN,
} from "@/lib/security/research-limits";

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
const boundedWarning = z.string().min(1).max(500);

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

export const researchRunSchema = z
  .object({
    id: boundedId,
    status: researchRunStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    startedAt: z.iso.datetime().optional(),
    completedAt: z.iso.datetime().optional(),
    discoveryProvider: z.string().min(1).max(80).optional(),
    extractionModel: z.string().min(1).max(80).optional(),
    maxExtractionCalls: z.number().int().min(0).max(RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN).optional(),
    extractionCallsUsed: z.number().int().min(0).max(RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN).optional(),
    partial: z.boolean().default(false),
    processedCategories: uniqueCategoriesSchema.default([]),
    unprocessedCategories: uniqueCategoriesSchema.default([]),
    failureCode: z
      .enum([
        "validation",
        "source-discovery",
        "retrieval",
        "provider-rate-limit",
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
    if (run.status === "partial" && !run.partial) {
      context.addIssue({
        code: "custom",
        message: "partial run status requires partial=true",
        path: ["partial"],
      });
    }
    if (run.status === "succeeded" && run.partial) {
      context.addIssue({
        code: "custom",
        message: "succeeded run status cannot be partial",
        path: ["partial"],
      });
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
    extractionModel: z.string().trim().min(1).max(80).optional(),
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

export const verifiedClaimSchema = claimSchema
  .omit({ sourceId: true })
  .extend({
    id: boundedId,
    universityId: boundedId,
    programId: boundedId.nullable().optional(),
    category: researchCategorySchema,
    property: boundedClaimProperty,
    value: boundedClaimValue,
    unit: boundedUnit.optional(),
    academicYear: boundedAcademicYear.optional(),
    supportingText: boundedSupportingText,
    sourceId: boundedId.optional(),
    sourceIds: z.array(boundedId).min(1).max(RESEARCH_MAX_SOURCES_PER_RUN),
    documentIds: z.array(boundedId).min(1).max(RESEARCH_MAX_SOURCES_PER_RUN),
  })
  .strict()
  .superRefine((claim, context) => {
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
  });

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
    for (const [index, coverage] of summary.categoryCoverage.entries()) {
      if (coverage.claimCount === 0 && coverage.statuses.length > 0) {
        context.addIssue({
          code: "custom",
          message: "zero-claim category coverage cannot report claim statuses",
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
  });

const researchSourceSchema = sourceSchema
  .extend({
    id: boundedId,
    url: researchHttpUrlSchema,
    title: z.string().min(1).max(300),
    publisher: z.string().min(1).max(200),
    academicYear: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const researchFailureSchema = z
  .object({
    category: researchCategorySchema.optional(),
    code: z.enum([
      "source-discovery",
      "retrieval",
      "normalization",
      "provider-rate-limit",
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
    evidenceSummary: evidenceSummarySchema,
    failures: z.array(researchFailureSchema).max(RESEARCH_MAX_SOURCES_PER_RUN).default([]),
    warnings: z.array(boundedWarning).max(50).default([]),
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

    for (const [index, claim] of result.claims.entries()) {
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
export type ResearchRun = z.infer<typeof researchRunSchema>;
export type CandidateSource = z.infer<typeof candidateSourceSchema>;
export type ResearchDocumentSection = z.infer<typeof researchDocumentSectionSchema>;
export type ResearchDocument = z.infer<typeof researchDocumentSchema>;
export type ClaimCandidate = z.infer<typeof claimCandidateSchema>;
export type VerifiedClaim = z.infer<typeof verifiedClaimSchema>;
export type EvidenceSummary = z.infer<typeof evidenceSummarySchema>;
export type ResearchFailure = z.infer<typeof researchFailureSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema>;

export { evidenceStatusSchema };
