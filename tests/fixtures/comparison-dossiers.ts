import { researchCatalog } from "@/lib/research/catalog/data";
import {
  publicClaimEvidenceStatusSchema,
  researchDossierSchema,
  researchModeCategoryOrder,
  type PublicEvidenceStatus,
  type ResearchDossier,
  type ResearchModeCategory,
} from "@/lib/research/mode/public-contracts";
import type { SourceType } from "@/lib/validation/evidence";

export type ComparisonFixtureClaim = {
  id: string;
  category: ResearchModeCategory;
  property: string;
  value: string | number | boolean;
  verificationStatus?: PublicEvidenceStatus;
  unit?: string;
  currency?: string;
  academicYear?: string;
  effectiveDate?: string;
  intake?: string;
  sourceTypes?: SourceType[];
  supportingText?: string;
};

export type ComparisonFixtureCategoryState = "ready" | "unknown" | "incomplete";

export function makeComparisonDossier(options: {
  universityId: string;
  programId?: string;
  categories: readonly ResearchModeCategory[];
  claims?: readonly ComparisonFixtureClaim[];
  states?: Partial<Record<ResearchModeCategory, ComparisonFixtureCategoryState>>;
  runId?: string;
  canonicalUniversityName?: string;
  canonicalProgramName?: string;
}): ResearchDossier {
  const university = researchCatalog.universities.find((item) => item.id === options.universityId);
  if (university === undefined) throw new Error(`unknown fixture university ${options.universityId}`);
  const program = options.programId === undefined
    ? undefined
    : researchCatalog.programs.find((item) => item.id === options.programId);
  if (options.programId !== undefined && (program === undefined || program.universityId !== university.id)) {
    throw new Error(`invalid fixture program ${options.programId}`);
  }

  const claims = [...(options.claims ?? [])];
  const sourceRecords = new Map<string, ResearchDossier["sources"][number]>();
  const publicClaims = claims.map((claim) => {
    const sourceTypes = claim.sourceTypes ?? ["university"];
    const sourceIds = sourceTypes.map((sourceType, index) => {
      const sourceId = `source-${claim.id}-${index + 1}`;
      sourceRecords.set(sourceId, {
        id: sourceId,
        url: `https://fixture-${claim.id}-${index + 1}.example/evidence`,
        title: `Evidence for ${claim.id} ${index + 1}`,
        publisher: sourceType === "university" ? university.name : `Fixture ${sourceType} publisher`,
        sourceType,
        retrievedAt: "2026-08-18T00:00:00.000Z",
        ...(claim.academicYear === undefined ? {} : { academicYear: claim.academicYear }),
        ...(claim.effectiveDate === undefined ? {} : { effectiveDate: claim.effectiveDate }),
      });
      return sourceId;
    });
    return {
      id: claim.id,
      category: claim.category,
      property: claim.property,
      value: claim.value,
      verificationStatus: claim.verificationStatus ?? "verified",
      representativeSourceId: sourceIds[0]!,
      sourceIds,
      supportingText: claim.supportingText ?? `Exact evidence text for ${claim.id}.`,
      ...(claim.unit === undefined ? {} : { unit: claim.unit }),
      ...(claim.currency === undefined ? {} : { currency: claim.currency }),
      ...(claim.academicYear === undefined ? {} : { academicYear: claim.academicYear }),
      ...(claim.effectiveDate === undefined ? {} : { effectiveDate: claim.effectiveDate }),
      ...(claim.intake === undefined ? {} : { intake: claim.intake }),
    };
  });

  const categories = researchModeCategoryOrder
    .filter((category) => options.categories.includes(category))
    .map((category) => {
      const categoryClaims = publicClaims.filter((claim) => claim.category === category);
      const requestedState = options.states?.[category];
      const state = requestedState ?? (categoryClaims.length > 0 ? "ready" : "unknown");
      if (state === "incomplete") {
        return {
          category,
          state: "incomplete" as const,
          claims: [],
          failure: { code: "provider-error" as const, message: `Fixture research for ${category} was incomplete.` },
          hasConflict: false as const,
          hasOutdated: false as const,
        };
      }
      if (state === "unknown") {
        return {
          category,
          state: "unknown" as const,
          claims: [],
          explanation: {
            category,
            referencedClaimIds: [],
            summary: `No reliable fixture ${category} claim was established.`,
            fallback: true as const,
          },
          hasConflict: false as const,
          hasOutdated: false as const,
        };
      }
      if (categoryClaims.length === 0) throw new Error(`ready fixture category ${category} needs claims`);
      return {
        category,
        state: "ready" as const,
        claims: categoryClaims,
        explanation: {
          category,
          referencedClaimIds: categoryClaims.map((claim) => claim.id),
          summary: `Fixture evidence summary for ${category}.`,
        },
        hasConflict: categoryClaims.some((claim) => claim.verificationStatus === "conflicting"),
        hasOutdated: categoryClaims.some((claim) => claim.verificationStatus === "outdated"),
      };
    });

  const finalClaims = categories.flatMap((row) => row.claims);
  const usedSourceIds = new Set(finalClaims.flatMap((claim) => claim.sourceIds));
  const sources = [...sourceRecords.values()].filter((source) => usedSourceIds.has(source.id));
  const processedCategories = categories.filter((row) => row.state !== "incomplete").map((row) => row.category);
  const unprocessedCategories = categories.filter((row) => row.state === "incomplete").map((row) => row.category);
  const status = unprocessedCategories.length === 0
    ? "succeeded"
    : processedCategories.length === 0
      ? "failed"
      : "partial";
  const statusCounts = Object.fromEntries(
    publicClaimEvidenceStatusSchema.options.map((statusName) => [statusName, 0]),
  ) as Record<PublicEvidenceStatus, number>;
  for (const claim of finalClaims) statusCounts[claim.verificationStatus] += 1;

  return researchDossierSchema.parse({
    target: {
      university: {
        id: university.id,
        name: options.canonicalUniversityName ?? university.name,
        countryCode: university.countryCode,
        websiteUrl: university.websiteUrl,
      },
      ...(program === undefined ? {} : {
        program: {
          id: program.id,
          name: options.canonicalProgramName ?? program.name,
          degreeLevel: program.degreeLevel,
          subjectArea: program.subjectArea,
          officialUrl: program.officialUrl,
        },
      }),
    },
    run: {
      id: options.runId ?? `run-${university.id}-${program?.id ?? "university"}`,
      status,
      createdAt: "2026-08-18T00:00:00.000Z",
      startedAt: "2026-08-18T00:00:01.000Z",
      updatedAt: "2026-08-18T00:00:02.000Z",
      completedAt: "2026-08-18T00:00:03.000Z",
    },
    summary: {
      totalClaims: finalClaims.length,
      statusCounts,
      processedCategories,
      unprocessedCategories,
    },
    categories,
    sources,
  });
}
