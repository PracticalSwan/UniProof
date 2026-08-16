import type {
  EvidenceSummary,
  ResearchCategory,
  VerifiedClaim,
} from "@/lib/research/contracts";
import {
  canonicalizeResearchCategories,
  evidenceStatusSchema,
} from "@/lib/research/contracts";

export function buildEvidenceSummary(input: {
  claims: readonly VerifiedClaim[];
  processedCategories: readonly ResearchCategory[];
  unprocessedCategories: readonly ResearchCategory[];
  failedCategories: readonly ResearchCategory[];
}): EvidenceSummary {
  const processedCategories = canonicalizeResearchCategories(input.processedCategories);
  const unprocessedCategories = canonicalizeResearchCategories(input.unprocessedCategories);
  const failedCategories = canonicalizeResearchCategories(
    input.failedCategories.filter((category) => unprocessedCategories.includes(category)),
  );
  const statusCounts: EvidenceSummary["statusCounts"] = {
    verified: 0,
    corroborated: 0,
    "university-reported": 0,
    conflicting: 0,
    anecdotal: 0,
    inferred: 0,
    unknown: 0,
    outdated: 0,
  };
  for (const claim of input.claims) statusCounts[claim.verificationStatus] += 1;

  const categoryCoverage: EvidenceSummary["categoryCoverage"] = processedCategories.map((category) => {
    const claims = input.claims.filter((claim) => claim.category === category);
    const statuses = evidenceStatusSchema.options.filter((status) =>
      status !== "unknown" && claims.some((claim) => claim.verificationStatus === status),
    );
    return {
      category,
      claimCount: claims.length,
      hasEvidence: claims.length > 0,
      statuses,
    };
  });
  const categoriesUnknown = processedCategories.filter((category) =>
    !input.claims.some((claim) => claim.category === category),
  );
  const categoriesWithConflicts = processedCategories.filter((category) =>
    input.claims.some((claim) => claim.category === category && claim.verificationStatus === "conflicting"),
  );
  const categoriesOutdated = processedCategories.filter((category) =>
    input.claims.some((claim) => claim.category === category && claim.verificationStatus === "outdated"),
  );

  return {
    statusCounts,
    totalClaims: input.claims.length,
    categoryCoverage,
    categoriesProcessed: processedCategories,
    categoriesWithConflicts,
    categoriesUnknown,
    categoriesOutdated,
    categoriesUnprocessed: unprocessedCategories,
    categoriesFailed: failedCategories,
  };
}
