import "server-only";

import {
  canonicalizeResearchCategories,
  researchResultSchema,
  type ClaimCandidate,
  type ResearchCategory,
  type ResearchFailure,
  type ResearchResult,
  type VerifiedClaim,
} from "@/lib/research/contracts";
import { normalizeResearchIdentity } from "@/lib/research/identity";
import type {
  ResearchCatalogProgram,
  ResearchCatalogUniversity,
} from "@/lib/research/catalog/schema";
import {
  publicClaimEvidenceStatusSchema,
  researchDossierSchema,
  type PublicEvidenceStatus,
  type PublicResearchClaim,
  type PublicResearchFailure,
  type PublicResearchSource,
  type ResearchDossier,
} from "./public-contracts";

export type ResearchDossierTargetSelection = {
  university: ResearchCatalogUniversity;
  program?: ResearchCatalogProgram;
};

export class DossierInvariantError extends Error {
  constructor(message = "research dossier projection failed an internal invariant") {
    super(message);
    this.name = "DossierInvariantError";
  }
}

const failurePrecedence: readonly ResearchFailure["code"][] = [
  "cancelled",
  "timeout",
  "provider-rate-limit",
  "source-limit",
  "normalization",
  "retrieval",
  "source-discovery",
  "provider-error",
  "unknown",
];

const failureMessages: Record<PublicResearchFailure["code"], string> = {
  cancelled: "Research was cancelled before this category completed.",
  timeout: "Research did not finish within the available time.",
  "source-discovery": "Sources could not be discovered completely.",
  retrieval: "Available sources could not be retrieved completely.",
  normalization: "Available sources could not be processed completely.",
  "source-limit": "Bounded source selection left this category incomplete.",
  "provider-rate-limit": "Research provider limits prevented completion.",
  "provider-error": "Research could not complete this category.",
  unknown: "Research could not complete this category.",
};

function invariant(condition: boolean, message?: string): asserts condition {
  if (!condition) throw new DossierInvariantError(message);
}

function assertFinalClaimsMatchSelectedTarget(
  claims: readonly VerifiedClaim[],
  selectedTarget: ResearchDossierTargetSelection,
): void {
  const selectedUniversityName = normalizeResearchIdentity(selectedTarget.university.name);
  const selectedProgramName = selectedTarget.program === undefined
    ? undefined
    : normalizeResearchIdentity(selectedTarget.program.name);

  for (const claim of claims) {
    invariant(
      claim.universityId === selectedTarget.university.id,
      "final claim does not match the selected university",
    );
    if (claim.universityName !== undefined) {
      invariant(
        normalizeResearchIdentity(claim.universityName) === selectedUniversityName,
        "final claim university name does not match the selected university",
      );
    }

    if (selectedTarget.program === undefined) {
      invariant(
        claim.programId === undefined && claim.programName === undefined,
        "university-level dossier cannot include a program-scoped final claim",
      );
      continue;
    }

    invariant(
      claim.programId === selectedTarget.program.id,
      "final claim does not match the selected program",
    );
    if (claim.programName !== undefined) {
      invariant(
        normalizeResearchIdentity(claim.programName) === selectedProgramName,
        "final claim program name does not match the selected program",
      );
    }
  }
}

function resolveRepresentativeSourceId(
  claim: VerifiedClaim,
  candidatesById: ReadonlyMap<string, ClaimCandidate>,
): string {
  const candidates = claim.candidateIds.map((id) => {
    const candidate = candidatesById.get(id);
    invariant(candidate !== undefined, "claim candidate provenance is missing");
    return candidate;
  });

  const representative = candidates.find((candidate) =>
    candidate.supportingText === claim.supportingText &&
    (claim.sourceId === undefined || candidate.sourceId === claim.sourceId)
  );
  invariant(representative !== undefined, "claim supporting passage has no representative source");
  return representative.sourceId;
}

function publicClaimFor(claim: VerifiedClaim, candidatesById: ReadonlyMap<string, ClaimCandidate>): PublicResearchClaim {
  return {
    id: claim.id,
    category: claim.category,
    property: claim.property,
    value: claim.value,
    unit: claim.unit,
    currency: claim.currency,
    academicYear: claim.academicYear,
    effectiveDate: claim.effectiveDate,
    intake: claim.intake,
    verificationStatus: claim.verificationStatus as PublicEvidenceStatus,
    representativeSourceId: resolveRepresentativeSourceId(claim, candidatesById),
    sourceIds: claim.sourceIds,
    supportingText: claim.supportingText,
  };
}

function publicFailureFor(
  category: ResearchCategory,
  failures: readonly ResearchFailure[],
  runFailureCode: ResearchFailure["code"] | undefined,
): PublicResearchFailure {
  const categoryFailures = failures.filter((failure) => failure.category === category);
  const code = categoryFailures
      .map((failure) => failure.code)
      .sort((left, right) => failurePrecedence.indexOf(left) - failurePrecedence.indexOf(right))[0] ??
    runFailureCode ??
    "unknown";
  invariant(code !== "validation", "validated research cannot produce a category-level validation failure");
  return { code, message: failureMessages[code] };
}

function publicSourceGapFor(
  category: ResearchCategory,
  failures: readonly ResearchFailure[],
): PublicResearchFailure | undefined {
  const code = failures
    .filter((failure) => failure.category === category)
    .map((failure) => failure.code)
    .filter((failureCode) => failureCode === "retrieval" || failureCode === "normalization")
    .sort((left, right) => failurePrecedence.indexOf(left) - failurePrecedence.indexOf(right))[0];
  return code === undefined ? undefined : { code, message: failureMessages[code] };
}

function publicSourceFor(source: ResearchResult["sources"][number]): PublicResearchSource {
  return {
    id: source.id,
    url: source.url,
    title: source.title,
    publisher: source.publisher,
    sourceType: source.sourceType,
    retrievedAt: source.retrievedAt,
    effectiveDate: source.effectiveDate,
    academicYear: source.academicYear,
  };
}

export function composeResearchDossier(
  result: ResearchResult,
  selectedTarget: ResearchDossierTargetSelection,
): ResearchDossier {
  const parsed = researchResultSchema.safeParse(result);
  if (!parsed.success) throw new DossierInvariantError("research result failed contract validation");
  const validated = parsed.data;

  invariant(
    selectedTarget.program === undefined ||
      selectedTarget.program.universityId === selectedTarget.university.id,
    "selected program does not belong to the selected university",
  );
  assertFinalClaimsMatchSelectedTarget(validated.claims, selectedTarget);
  invariant(validated.run.startedAt !== undefined && validated.run.completedAt !== undefined);

  const processed = canonicalizeResearchCategories(validated.run.processedCategories);
  const unprocessed = canonicalizeResearchCategories(validated.run.unprocessedCategories);
  const requested = canonicalizeResearchCategories([...processed, ...unprocessed]);
  invariant(requested.length > 0, "research result has no requested categories");

  const candidatesById = new Map(validated.candidates.map((candidate) => [candidate.id, candidate]));
  const sourcesById = new Map(validated.sources.map((source) => [source.id, source]));
  const explanationsByCategory = new Map(validated.explanations.map((item) => [item.category, item]));
  const claimsByCategory = new Map(
    requested.map((category) => [
      category,
      validated.claims
        .filter((claim) => claim.category === category)
        .sort((left, right) => left.id.localeCompare(right.id, "en-US")),
    ]),
  );

  const publicClaims = requested.flatMap((category) =>
    (claimsByCategory.get(category) ?? []).map((claim) => publicClaimFor(claim, candidatesById)),
  );
  const referencedSourceIds = new Set(publicClaims.flatMap((claim) => claim.sourceIds));
  const publicSources = [...referencedSourceIds]
    .sort((left, right) => left.localeCompare(right, "en-US"))
    .map((id) => {
      const source = sourcesById.get(id);
      invariant(source !== undefined, "public claim source provenance is missing");
      return publicSourceFor(source);
    });

  const categories = requested.map((category) => {
    const categoryClaims = publicClaims.filter((claim) => claim.category === category);
    if (unprocessed.includes(category)) {
      return {
        category,
        state: "incomplete" as const,
        claims: [],
        failure: publicFailureFor(category, validated.failures, validated.run.failureCode),
        hasConflict: false as const,
        hasOutdated: false as const,
      };
    }

    const explanation = explanationsByCategory.get(category);
    invariant(explanation !== undefined, "processed category explanation is missing");
    if (categoryClaims.length === 0) {
      return {
        category,
        state: "unknown" as const,
        claims: [],
        explanation: {
          category,
          referencedClaimIds: explanation.referencedClaimIds,
          summary: explanation.summary,
          fallback: explanation.fallback ?? true,
        },
        hasConflict: false as const,
        hasOutdated: false as const,
      };
    }

    const sourceGap = publicSourceGapFor(category, validated.failures);
    return {
      category,
      state: "ready" as const,
      claims: categoryClaims,
      explanation: {
        category,
        referencedClaimIds: explanation.referencedClaimIds,
        summary: explanation.summary,
        fallback: explanation.fallback,
      },
      ...(sourceGap === undefined ? {} : { sourceGap }),
      hasConflict: categoryClaims.some((claim) => claim.verificationStatus === "conflicting"),
      hasOutdated: categoryClaims.some((claim) => claim.verificationStatus === "outdated"),
    };
  });

  const statusCounts = Object.fromEntries(
    publicClaimEvidenceStatusSchema.options.map((status) => [
      status,
      publicClaims.filter((claim) => claim.verificationStatus === status).length,
    ]),
  ) as Record<PublicEvidenceStatus, number>;

  const composed = {
    target: {
      university: {
        id: selectedTarget.university.id,
        name: selectedTarget.university.name,
        countryCode: selectedTarget.university.countryCode,
        websiteUrl: selectedTarget.university.websiteUrl,
      },
      ...(selectedTarget.program === undefined ? {} : {
        program: {
          id: selectedTarget.program.id,
          name: selectedTarget.program.name,
          degreeLevel: selectedTarget.program.degreeLevel,
          subjectArea: selectedTarget.program.subjectArea,
          officialUrl: selectedTarget.program.officialUrl,
        },
      }),
    },
    run: {
      id: validated.run.id,
      status: validated.run.status,
      createdAt: validated.run.createdAt,
      startedAt: validated.run.startedAt!,
      updatedAt: validated.run.updatedAt,
      completedAt: validated.run.completedAt!,
    },
    summary: {
      totalClaims: publicClaims.length,
      statusCounts,
      processedCategories: processed,
      unprocessedCategories: unprocessed,
    },
    categories,
    sources: publicSources,
  };

  const output = researchDossierSchema.safeParse(composed);
  if (!output.success) throw new DossierInvariantError("composed research dossier failed public validation");
  return output.data;
}
