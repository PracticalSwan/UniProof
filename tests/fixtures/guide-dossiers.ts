import { researchDossierSchema, type PublicResearchClaim, type PublicResearchSource, type ResearchDossier } from "@/lib/research/mode/public-contracts";

const baseSource: PublicResearchSource = {
  id: "source-1",
  url: "https://example.edu/admissions",
  title: "Example University Admissions",
  publisher: "Example University",
  sourceType: "university",
  retrievedAt: "2026-08-01T10:00:00.000Z",
};

const baseClaim: PublicResearchClaim = {
  id: "claim-1",
  category: "admissions",
  property: "Minimum GPA",
  value: 3.0,
  unit: "4.0",
  verificationStatus: "verified",
  representativeSourceId: "source-1",
  sourceIds: ["source-1"],
  supportingText: "Applicants must have a minimum GPA of 3.0 on a 4.0 scale.",
};

function makeSources(count: number): PublicResearchSource[] {
  return Array.from({ length: count }, (_, i) => ({
    ...baseSource,
    id: `source-${i + 1}`,
    url: `https://example.edu/page-${i + 1}`,
    title: `Example University Page ${i + 1}`,
  }));
}

function makeClaim(overrides: Partial<PublicResearchClaim> & { id: string }): PublicResearchClaim {
  return { ...baseClaim, ...overrides };
}

export function buildGuideDossier(options: {
  universityId?: string;
  programId?: string;
  universityName?: string;
  programName?: string;
  universityWebsiteUrl?: string;
  programOfficialUrl?: string;
  runStatus?: "succeeded" | "partial" | "failed";
  admissionsClaims?: PublicResearchClaim[];
  tuitionClaims?: PublicResearchClaim[];
  scholarshipClaims?: PublicResearchClaim[];
  admissionsState?: "ready" | "unknown" | "incomplete";
  tuitionState?: "ready" | "unknown" | "incomplete";
  scholarshipState?: "ready" | "unknown" | "incomplete";
  sourceCount?: number;
}): ResearchDossier {
  const universityId = options.universityId ?? "us-nyu";
  const programId = options.programId ?? "us-nyu-mscs";
  const universityName = options.universityName ?? "Example University";
  const programName = options.programName ?? "MS Computer Science";

  const admissionsClaims = options.admissionsClaims ?? [];
  const tuitionClaims = options.tuitionClaims ?? [];
  const scholarshipClaims = options.scholarshipClaims ?? [];
  const allClaims = [...admissionsClaims, ...tuitionClaims, ...scholarshipClaims];

  const usedSourceIds = new Set(allClaims.flatMap((c) => c.sourceIds));
  const sources = makeSources(Math.max(1, options.sourceCount ?? (usedSourceIds.size || 1)));
  if (usedSourceIds.size > sources.length) {
    sources.length = 0;
    sources.push(...makeSources(usedSourceIds.size));
  }

  const admissionsState = options.admissionsState ?? (admissionsClaims.length > 0 ? "ready" : "unknown");
  const tuitionState = options.tuitionState ?? (tuitionClaims.length > 0 ? "ready" : "unknown");
  const scholarshipState = options.scholarshipState ?? (scholarshipClaims.length > 0 ? "ready" : "unknown");
  const runStatus = options.runStatus ?? (admissionsState === "incomplete" || tuitionState === "incomplete" || scholarshipState === "incomplete" ? "partial" : "succeeded");

  const claimsByCategory = new Map<string, PublicResearchClaim[]>();
  if (admissionsState === "ready" && admissionsClaims.length > 0) claimsByCategory.set("admissions", admissionsClaims);
  if (tuitionState === "ready" && tuitionClaims.length > 0) claimsByCategory.set("tuition", tuitionClaims);
  if (scholarshipState === "ready" && scholarshipClaims.length > 0) claimsByCategory.set("scholarships", scholarshipClaims);

  const processedCategories: string[] = [];
  const unprocessedCategories: string[] = [];
  const categoryOrder = ["admissions", "tuition", "scholarships"];
  const stateByCategory: Record<string, string> = {
    admissions: admissionsState,
    tuition: tuitionState,
    scholarships: scholarshipState,
  };
  for (const category of categoryOrder) {
    if (stateByCategory[category] === "incomplete") {
      unprocessedCategories.push(category);
    } else {
      processedCategories.push(category);
    }
  }

  const finalRunStatus = runStatus === "failed"
    ? "failed"
    : unprocessedCategories.length > 0 && processedCategories.length > 0
      ? "partial"
      : runStatus;

  const effectiveProcessed = finalRunStatus === "failed" ? [] : processedCategories;
  const effectiveUnprocessed = finalRunStatus === "failed" ? categoryOrder : unprocessedCategories;

  const statusCounts = {
    verified: 0, corroborated: 0, "university-reported": 0,
    conflicting: 0, anecdotal: 0, inferred: 0, outdated: 0,
  };
  const allProcessedClaims = [...admissionsClaims, ...tuitionClaims, ...scholarshipClaims];
  if (finalRunStatus !== "failed") {
    for (const claim of allProcessedClaims) {
      statusCounts[claim.verificationStatus]++;
    }
  }

  const categories = categoryOrder.map((category) => {
    const state = finalRunStatus === "failed" ? "incomplete" : stateByCategory[category];
    const claims = finalRunStatus === "failed" ? [] : claimsByCategory.get(category) ?? [];
    const hasConflict = claims.some((c) => c.verificationStatus === "conflicting");
    const hasOutdated = claims.some((c) => c.verificationStatus === "outdated");

    if (state === "incomplete") {
      return {
        category,
        state: "incomplete" as const,
        claims: [],
        failure: { code: "retrieval" as const, message: "The category could not be fully researched." },
        hasConflict: false,
        hasOutdated: false,
      };
    }
    if (state === "unknown" || claims.length === 0) {
      return {
        category,
        state: "unknown" as const,
        claims: [],
        explanation: {
          category,
          referencedClaimIds: [],
          summary: `No reliable ${category} evidence was found for this program.`,
          fallback: true,
        },
        hasConflict: false,
        hasOutdated: false,
      };
    }
    return {
      category,
      state: "ready" as const,
      claims,
      explanation: {
        category,
        referencedClaimIds: claims.map((c) => c.id),
        summary: `${claims.length} ${category} claims were verified for this program.`,
      },
      hasConflict,
      hasOutdated,
    };
  });

  const finalClaims = finalRunStatus === "failed" ? [] : categories.flatMap((row) => row.state === "ready" ? row.claims : []);
  const finalSources = sources.filter((source) =>
    finalClaims.some((claim) => claim.sourceIds.includes(source.id))
  );

  const finalCounts = { ...statusCounts };
  for (const key of Object.keys(finalCounts) as Array<keyof typeof finalCounts>) {
    finalCounts[key] = 0;
  }
  for (const claim of finalClaims) {
    finalCounts[claim.verificationStatus]++;
  }

  return researchDossierSchema.parse({
    target: {
      university: {
        id: universityId,
        name: universityName,
        countryCode: "US",
        websiteUrl: options.universityWebsiteUrl ?? "https://example.edu",
      },
      program: {
        id: programId,
        name: programName,
        degreeLevel: "master",
        subjectArea: "Computer Science",
        officialUrl: options.programOfficialUrl ?? "https://example.edu/mscs",
      },
    },
    run: {
      id: "run-1",
      status: finalRunStatus,
      createdAt: "2026-08-01T10:00:00.000Z",
      startedAt: "2026-08-01T10:00:01.000Z",
      updatedAt: "2026-08-01T10:05:00.000Z",
      completedAt: "2026-08-01T10:05:00.000Z",
    },
    summary: {
      totalClaims: finalClaims.length,
      statusCounts: finalCounts,
      processedCategories: effectiveProcessed,
      unprocessedCategories: effectiveUnprocessed,
    },
    categories,
    sources: finalSources,
  });
}

export { makeClaim, makeSources, baseClaim, baseSource };
