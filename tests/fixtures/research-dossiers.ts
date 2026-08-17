import { researchCatalog } from "@/lib/research/catalog/data";
import {
  publicClaimEvidenceStatusSchema,
  researchModeCategoryOrder,
  researchModeResponseSchema,
  type PublicEvidenceStatus,
  type PublicResearchClaim,
  type PublicResearchSource,
  type PublicResearchTransportErrorCode,
  type ResearchDossier,
  type ResearchModeCategory,
  type ResearchModeResponse,
} from "@/lib/research/mode/public-contracts";

const university = researchCatalog.universities.find((item) => item.id === "university-mit")!;
const program = researchCatalog.programs.find(
  (item) => item.id === "program-mit-artificial-intelligence-decision-making-bs",
)!;
const alternateProgram = researchCatalog.programs.find(
  (item) => item.id === "program-mit-computer-science-engineering-bs",
)!;
const stanford = researchCatalog.universities.find((item) => item.id === "university-stanford")!;

export const fixtureTarget = { university, program } as const;

const timestamps = {
  createdAt: "2026-08-18T00:00:00.000Z",
  startedAt: "2026-08-18T00:00:01.000Z",
  updatedAt: "2026-08-18T00:00:02.000Z",
  completedAt: "2026-08-18T00:00:03.000Z",
} as const;

function makeSource(index: number, overrides: Partial<PublicResearchSource> = {}): PublicResearchSource {
  return {
    id: `source-${index}`,
    url: `https://source-${index}.example/evidence`,
    title: `Evidence source ${index}`,
    publisher: index % 2 === 0 ? "Independent Example Publisher" : "Example University Publisher",
    sourceType: index % 2 === 0 ? "independent" : "university",
    retrievedAt: `2026-08-18T00:${String(index).padStart(2, "0")}:00.000Z`,
    ...overrides,
  };
}

const sourceBank = Array.from({ length: 12 }, (_, index) => makeSource(index + 1));

function makeClaim(options: {
  id: string;
  category: ResearchModeCategory;
  status?: PublicEvidenceStatus;
  property?: string;
  value?: string | number | boolean;
  sourceIds?: string[];
  representativeSourceId?: string;
  supportingText?: string;
  unit?: string;
  currency?: string;
  academicYear?: string;
  effectiveDate?: string;
  intake?: string;
}): PublicResearchClaim {
  const sourceIds = options.sourceIds ?? ["source-1"];
  return {
    id: options.id,
    category: options.category,
    property: options.property ?? `Published ${options.category} fact`,
    value: options.value ?? `Value for ${options.category}`,
    verificationStatus: options.status ?? "verified",
    representativeSourceId: options.representativeSourceId ?? sourceIds[0]!,
    sourceIds,
    supportingText: options.supportingText ?? `Exact supporting text for ${options.category}.`,
    ...(options.unit === undefined ? {} : { unit: options.unit }),
    ...(options.currency === undefined ? {} : { currency: options.currency }),
    ...(options.academicYear === undefined ? {} : { academicYear: options.academicYear }),
    ...(options.effectiveDate === undefined ? {} : { effectiveDate: options.effectiveDate }),
    ...(options.intake === undefined ? {} : { intake: options.intake }),
  };
}

type CategoryRow = ResearchDossier["categories"][number];

type ReadyRow = Extract<CategoryRow, { state: "ready" }>;
type UnknownRow = Extract<CategoryRow, { state: "unknown" }>;
type IncompleteRow = Extract<CategoryRow, { state: "incomplete" }>;

function readyRow(
  category: ResearchModeCategory,
  claims: PublicResearchClaim[],
  summary = `Evidence summary for ${category}.`,
): ReadyRow {
  return {
    category,
    state: "ready",
    claims,
    explanation: {
      category,
      referencedClaimIds: claims.map((claim) => claim.id),
      summary,
    },
    hasConflict: claims.some((claim) => claim.verificationStatus === "conflicting"),
    hasOutdated: claims.some((claim) => claim.verificationStatus === "outdated"),
  };
}

function unknownRow(
  category: ResearchModeCategory,
  summary = `Bounded research did not establish a reliable ${category} claim.`,
): UnknownRow {
  return {
    category,
    state: "unknown",
    claims: [],
    explanation: {
      category,
      referencedClaimIds: [],
      summary,
      fallback: true,
    },
    hasConflict: false,
    hasOutdated: false,
  };
}

function incompleteRow(
  category: ResearchModeCategory,
  code: IncompleteRow["failure"]["code"] = "provider-rate-limit",
  message = "Research could not complete this category because an upstream research step failed.",
): IncompleteRow {
  return {
    category,
    state: "incomplete",
    claims: [],
    failure: { code, message },
    hasConflict: false,
    hasOutdated: false,
  };
}

const zeroStatusCounts = () => Object.fromEntries(
  publicClaimEvidenceStatusSchema.options.map((status) => [status, 0]),
) as Record<PublicEvidenceStatus, number>;

function buildSuccessResponse(
  rows: CategoryRow[],
  options: {
    runId?: string;
    sources?: PublicResearchSource[];
    target?: ResearchDossier["target"];
  } = {},
): Extract<ResearchModeResponse, { ok: true }> {
  const claims = rows.flatMap((row) => row.claims);
  const referencedSourceIds = new Set(claims.flatMap((claim) => claim.sourceIds));
  const sources = options.sources ?? sourceBank.filter((source) => referencedSourceIds.has(source.id));
  const statusCounts = zeroStatusCounts();
  for (const claim of claims) statusCounts[claim.verificationStatus] += 1;

  const processedCategories = rows
    .filter((row) => row.state !== "incomplete")
    .map((row) => row.category);
  const unprocessedCategories = rows
    .filter((row) => row.state === "incomplete")
    .map((row) => row.category);
  const status = unprocessedCategories.length === 0
    ? "succeeded"
    : processedCategories.length === 0
      ? "failed"
      : "partial";

  const response = researchModeResponseSchema.parse({
    ok: true,
    dossier: {
      target: options.target ?? {
        university: {
          id: university.id,
          name: university.name,
          countryCode: university.countryCode,
          websiteUrl: university.websiteUrl,
        },
        program: {
          id: program.id,
          name: program.name,
          degreeLevel: program.degreeLevel,
          subjectArea: program.subjectArea,
          officialUrl: program.officialUrl,
        },
      },
      run: {
        id: options.runId ?? "run-e2e",
        status,
        ...timestamps,
      },
      summary: {
        totalClaims: claims.length,
        statusCounts,
        processedCategories,
        unprocessedCategories,
      },
      categories: rows,
      sources,
    },
  });
  if (!response.ok) throw new Error("valid fixture construction unexpectedly produced an error envelope");
  return response;
}

const allReadyRows: ReadyRow[] = [
  readyRow("admissions", [makeClaim({
    id: "claim-admissions",
    category: "admissions",
    status: "verified",
    property: "Published application code",
    value: "007",
    sourceIds: ["source-2", "source-1"],
    representativeSourceId: "source-1",
    supportingText: "The published application code is the exact string 007.",
    effectiveDate: "2026-08-01",
  })]),
  readyRow("tuition", [makeClaim({
    id: "claim-tuition",
    category: "tuition",
    status: "corroborated",
    property: "Published tuition amount",
    value: 12345,
    currency: "USD",
    sourceIds: ["source-2", "source-3"],
    representativeSourceId: "source-2",
  })]),
  readyRow("scholarships", [makeClaim({
    id: "claim-scholarships",
    category: "scholarships",
    status: "university-reported",
    property: "Scholarship application available",
    value: true,
    sourceIds: ["source-3"],
  })]),
  readyRow("program-structure", [makeClaim({
    id: "claim-program-structure",
    category: "program-structure",
    status: "verified",
    value: "Structured degree requirement",
    sourceIds: ["source-4"],
  })]),
  readyRow("research", [makeClaim({
    id: "claim-research",
    category: "research",
    status: "inferred",
    value: "Research opportunity described from identified evidence",
    sourceIds: ["source-5"],
  })]),
  readyRow("outcomes", [makeClaim({
    id: "claim-outcomes",
    category: "outcomes",
    status: "anecdotal",
    value: "Community-reported outcome",
    sourceIds: ["source-6"],
  })]),
  readyRow("support", [makeClaim({
    id: "claim-support",
    category: "support",
    status: "corroborated",
    value: false,
    sourceIds: ["source-7", "source-8"],
    representativeSourceId: "source-8",
  })]),
];

export const succeededAllReadyResponse = buildSuccessResponse(allReadyRows, {
  runId: "run-all-ready",
});

export const canonicalTargetResponse = buildSuccessResponse(allReadyRows, {
  runId: "run-canonical-target",
  target: {
    university: {
      id: university.id,
      name: "Server Canonical MIT Name",
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
    },
    program: {
      id: program.id,
      name: "Server Canonical AI Program Name",
      degreeLevel: program.degreeLevel,
      subjectArea: program.subjectArea,
      officialUrl: program.officialUrl,
    },
  },
});

export const admissionsOnlyResponse = buildSuccessResponse([
  allReadyRows[0]!,
], { runId: "run-admissions-only" });

export const admissionsTuitionResponse = buildSuccessResponse([
  allReadyRows[0]!,
  allReadyRows[1]!,
], { runId: "run-admissions-tuition" });

export const succeededWithUnknownResponse = buildSuccessResponse([
  allReadyRows[0]!,
  ...researchModeCategoryOrder.slice(1).map((category) => unknownRow(category)),
], { runId: "run-with-unknown" });

export const partialResponse = buildSuccessResponse([
  allReadyRows[0]!,
  unknownRow("tuition", "No reliable tuition claim was established within the bounded run."),
  incompleteRow("scholarships", "provider-rate-limit", "Research stopped after the provider rate limit was reached."),
  ...researchModeCategoryOrder.slice(3).map((category) => unknownRow(category)),
], { runId: "run-partial" });

export const failedResponse = buildSuccessResponse(
  researchModeCategoryOrder.map((category) => incompleteRow(
    category,
    "provider-error",
    `Research could not complete ${category} because the research pipeline failed.`,
  )),
  { runId: "run-failed" },
);

export const conflictResponse = buildSuccessResponse([
  readyRow("admissions", [
    makeClaim({
      id: "claim-conflict-a",
      category: "admissions",
      status: "conflicting",
      property: "Published deadline",
      value: "2027-01-10",
      sourceIds: ["source-1"],
      supportingText: "Source A publishes a January 10 deadline.",
    }),
    makeClaim({
      id: "claim-conflict-b",
      category: "admissions",
      status: "conflicting",
      property: "Published deadline",
      value: "2027-01-20",
      sourceIds: ["source-2"],
      supportingText: "Source B publishes a January 20 deadline.",
    }),
  ], "Two identified sources publish different deadline values; neither is selected as a winner."),
  ...researchModeCategoryOrder.slice(1).map((category) => unknownRow(category)),
], { runId: "run-conflict" });

export const outdatedResponse = buildSuccessResponse([
  readyRow("admissions", [makeClaim({
    id: "claim-outdated",
    category: "admissions",
    status: "outdated",
    property: "Historical application deadline",
    value: "2024-01-15",
    academicYear: "2023-24",
    effectiveDate: "2023-09-01",
    sourceIds: ["source-9"],
    supportingText: "This source explicitly describes the 2023-24 application cycle.",
  })]),
  ...researchModeCategoryOrder.slice(1).map((category) => unknownRow(category)),
], {
  runId: "run-outdated",
  sources: [makeSource(9, {
    retrievedAt: "2026-08-18T00:09:00.000Z",
    effectiveDate: "2023-09-01",
    academicYear: "2023-24",
  })],
});

const longSources = sourceBank.map((source, index) => ({
  ...source,
  url: `https://long-${index + 1}.example/${"segment-".repeat(35)}${index + 1}`,
  title: `${String(index + 1).padStart(2, "0")} ${"Long source title ".repeat(16)}`.slice(0, 300),
  publisher: `Publisher ${"Long publisher name ".repeat(12)}`.slice(0, 200),
}));
const longClaim = makeClaim({
  id: "claim-long",
  category: "admissions",
  status: "verified",
  property: "P".repeat(200),
  value: "V".repeat(500),
  sourceIds: longSources.map((source) => source.id),
  representativeSourceId: longSources[11]!.id,
  supportingText: `${"Evidence😀e\u0301 ".repeat(170)}`.slice(0, 2_000),
  academicYear: "2027-28",
  intake: "Autumn 2027",
  effectiveDate: "2027-01-01",
});

export const longContentResponse = buildSuccessResponse([
  readyRow("admissions", [longClaim], "E".repeat(600)),
  ...researchModeCategoryOrder.slice(1).map((category) => unknownRow(category)),
], {
  runId: "run-long",
  sources: longSources,
  target: {
    university: {
      id: university.id,
      name: `Long University ${"Name ".repeat(45)}`.slice(0, 200),
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
    },
    program: {
      id: program.id,
      name: `Long Program ${"Name ".repeat(46)}`.slice(0, 200),
      degreeLevel: program.degreeLevel,
      subjectArea: program.subjectArea,
      officialUrl: program.officialUrl,
    },
  },
});

const maxClaims = Array.from({ length: 500 }, (_, index) => makeClaim({
  id: `claim-max-${String(index + 1).padStart(3, "0")}`,
  category: "admissions",
  status: index % 2 === 0 ? "verified" : "corroborated",
  property: `Maximum fixture claim ${index + 1}`,
  value: index + 1,
  sourceIds: [`source-${(index % 12) + 1}`],
  supportingText: `Exact supporting text for maximum fixture claim ${index + 1}.`,
}));

export const maxClaimCountResponse = buildSuccessResponse([
  readyRow("admissions", maxClaims, "Maximum public-contract claim-count stress fixture."),
  ...researchModeCategoryOrder.slice(1).map((category) => unknownRow(category)),
], { runId: "run-max-claims", sources: sourceBank });

export const xssLookingResponse = buildSuccessResponse([
  readyRow("admissions", [makeClaim({
    id: "claim-xss-shaped",
    category: "admissions",
    status: "verified",
    property: '<script>alert(1)</script> & "quoted" property',
    value: "javascript: <img src=x onerror=alert(1)> & value",
    sourceIds: ["source-10"],
    supportingText: '<img src=x onerror=alert(1)> <script>alert(1)</script> & "supporting text"',
  })], 'Explanation contains <script>alert(1)</script> & "quotes" as text.'),
  ...researchModeCategoryOrder.slice(1).map((category) => unknownRow(category)),
], {
  runId: "run-xss-shaped",
  sources: [makeSource(10, {
    url: "https://xss-shaped.example/safe-evidence",
    title: "<script>alert(1)</script>",
    publisher: "<img src=x onerror=alert(1)>",
  })],
});

export const publicErrorStatuses: Record<PublicResearchTransportErrorCode, number> = {
  "invalid-content-type": 415,
  "request-too-large": 413,
  "invalid-json": 400,
  "invalid-request": 400,
  "unsupported-target": 404,
  "sensitive-input": 400,
  "forbidden-origin": 403,
  "internal-error": 500,
};

export const publicTransportErrors = Object.fromEntries(
  (Object.keys(publicErrorStatuses) as PublicResearchTransportErrorCode[]).map((code) => [
    code,
    researchModeResponseSchema.parse({
      ok: false,
      error: { code, message: `Sanitized fixture message for ${code}.` },
    }),
  ]),
) as Record<PublicResearchTransportErrorCode, Extract<ResearchModeResponse, { ok: false }>>;

export const rawInvalidEmptyBody = "";
export const rawInvalidNonJsonBody = "not-json";
export const rawInvalidMalformedJsonBody = "{\"ok\":";

export function rawInvalidUnknownTopLevelKey(): unknown {
  return { ...structuredClone(succeededAllReadyResponse), extra: "unexpected" };
}

export function rawInvalidUnknownDossierKey(): unknown {
  const value = structuredClone(succeededAllReadyResponse) as Record<string, unknown>;
  (value.dossier as Record<string, unknown>).extra = "unexpected";
  return value;
}

export function rawInvalidBrokenSourceReference(): unknown {
  const value = structuredClone(succeededAllReadyResponse);
  if (!value.ok) return value;
  const first = value.dossier.categories[0];
  if (first?.state === "ready") {
    first.claims[0]!.sourceIds = ["missing-source"];
    first.claims[0]!.representativeSourceId = "missing-source";
  }
  return value;
}

export function rawInvalidUnusedSource(): unknown {
  const value = structuredClone(succeededAllReadyResponse);
  if (!value.ok) return value;
  value.dossier.sources.push(makeSource(12, { id: "source-unused" }));
  return value;
}

export function rawInvalidDuplicateSource(): unknown {
  const value = structuredClone(succeededAllReadyResponse);
  if (!value.ok) return value;
  value.dossier.sources.push(structuredClone(value.dossier.sources[0]!));
  return value;
}

export function rawInvalidDuplicateClaimIds(): unknown {
  const value = structuredClone(succeededAllReadyResponse);
  if (!value.ok) return value;
  const first = value.dossier.categories[0];
  const second = value.dossier.categories[1];
  if (first?.state === "ready" && second?.state === "ready") {
    second.claims[0]!.id = first.claims[0]!.id;
    second.explanation.referencedClaimIds = [first.claims[0]!.id];
  }
  return value;
}

export function rawInvalidLifecycleTimestamps(): unknown {
  const value = structuredClone(succeededAllReadyResponse);
  if (!value.ok) return value;
  value.dossier.run.updatedAt = "2026-08-17T23:59:59.000Z";
  return value;
}

export function rawInvalidContradictoryLifecycle(): unknown {
  const value = structuredClone(succeededAllReadyResponse);
  if (!value.ok) return value;
  value.dossier.run.status = "failed";
  return value;
}

export const wrongUniversityResponse = buildSuccessResponse(allReadyRows, {
  runId: "run-wrong-university",
  target: {
    university: {
      id: stanford.id,
      name: stanford.name,
      countryCode: stanford.countryCode,
      websiteUrl: stanford.websiteUrl,
    },
    program: {
      id: program.id,
      name: program.name,
      degreeLevel: program.degreeLevel,
      subjectArea: program.subjectArea,
      officialUrl: program.officialUrl,
    },
  },
});

export const wrongProgramResponse = buildSuccessResponse(allReadyRows, {
  runId: "run-wrong-program",
  target: {
    university: {
      id: university.id,
      name: university.name,
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
    },
    program: {
      id: alternateProgram.id,
      name: alternateProgram.name,
      degreeLevel: alternateProgram.degreeLevel,
      subjectArea: alternateProgram.subjectArea,
      officialUrl: alternateProgram.officialUrl,
    },
  },
});

export const universityOnlyResponse = buildSuccessResponse(allReadyRows, {
  runId: "run-university-only",
  target: {
    university: {
      id: university.id,
      name: university.name,
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
    },
  },
});

export const wrongCategorySetResponse = buildSuccessResponse([
  readyRow("admissions", [makeClaim({
    id: "claim-one-category",
    category: "admissions",
    sourceIds: ["source-1"],
  })]),
], { runId: "run-wrong-category-set" });
