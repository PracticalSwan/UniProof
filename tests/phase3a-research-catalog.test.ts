import { describe, expect, it } from "vitest";

import {
  canonicalizeResearchModeCategories,
  publicClaimEvidenceStatusSchema,
  publicResearchSourceSchema,
  RESEARCH_MODE_MAX_QUESTION_UTF16,
  researchModeCategoryOrder,
  researchModeCategorySchema,
  researchModeRequestSchema,
  researchModeResponseSchema,
  researchDossierSchema,
} from "@/lib/research/mode/public-contracts";
import {
  researchCatalog,
  researchCatalogSchema,
} from "@/lib/research/catalog";
import { normalizeResearchCatalogText } from "@/lib/research/catalog/schema";
import { searchResearchCatalog } from "@/lib/research/catalog/search";
import { createCatalogTargetResolver } from "@/lib/research/catalog/resolver";
import {
  evidenceStatusSchema,
  researchCategoryOrder,
  researchCategorySchema,
  researchRequestSchema,
} from "@/lib/research/contracts";
import {
  RESEARCH_MAX_CATEGORIES,
  RESEARCH_MAX_QUERY_CHARACTERS,
} from "@/lib/security/research-limits";

const validSource = {
  id: "source-1",
  url: "https://official.example/evidence",
  title: "Official evidence page",
  publisher: "Example University",
  sourceType: "university",
  retrievedAt: "2026-08-17T00:00:00.000Z",
  effectiveDate: "2026-09-01",
  academicYear: "2026-2027",
};

const validClaim = {
  id: "claim-1",
  category: "admissions" as const,
  property: "Application deadline",
  value: "2027-01-15",
  academicYear: "2026-2027",
  effectiveDate: "2026-09-01",
  verificationStatus: "verified" as const,
  representativeSourceId: "source-1",
  sourceIds: ["source-1"],
  supportingText: "The application deadline is 15 January 2027.",
};

const validDossier = {
  target: {
    university: {
      id: "university-example",
      name: "Example University",
      countryCode: "US",
      websiteUrl: "https://www.example.edu/",
    },
  },
  run: {
    id: "run-1",
    status: "succeeded" as const,
    createdAt: "2026-08-17T00:00:00.000Z",
    startedAt: "2026-08-17T00:00:01.000Z",
    updatedAt: "2026-08-17T00:00:02.000Z",
    completedAt: "2026-08-17T00:00:03.000Z",
  },
  summary: {
    totalClaims: 1,
    statusCounts: {
      verified: 1,
      corroborated: 0,
      "university-reported": 0,
      conflicting: 0,
      anecdotal: 0,
      inferred: 0,
      outdated: 0,
    },
    processedCategories: ["admissions"],
    unprocessedCategories: [],
  },
  categories: [{
    category: "admissions",
    state: "ready" as const,
    claims: [validClaim],
    explanation: {
      category: "admissions",
      referencedClaimIds: ["claim-1"],
      summary: "The official page establishes the deadline.",
      fallback: false,
    },
    hasConflict: false,
    hasOutdated: false,
  }],
  sources: [validSource],
};

describe("Phase 3A public research contracts", () => {
  it("keeps the canonical seven-category vocabulary and order aligned with Phase 2", () => {
    expect(researchModeCategoryOrder).toEqual([
      "admissions",
      "tuition",
      "scholarships",
      "program-structure",
      "research",
      "outcomes",
      "support",
    ]);
    expect(researchCategoryOrder).toEqual(researchModeCategoryOrder);
    expect(researchCategorySchema.options).toEqual(researchModeCategoryOrder);
    expect(researchModeCategorySchema.options).toEqual(researchCategorySchema.options);
  });

  it("excludes claim-level unknown from public final-claim statuses", () => {
    for (const status of publicClaimEvidenceStatusSchema.options) {
      expect(evidenceStatusSchema.safeParse(status).success).toBe(true);
      expect(status).not.toBe("unknown");
    }
    expect(publicClaimEvidenceStatusSchema.options).toHaveLength(7);
    expect(publicClaimEvidenceStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("canonicalizes request categories without request ordering", () => {
    expect(canonicalizeResearchModeCategories([
      "support",
      "tuition",
      "admissions",
      "tuition",
    ])).toEqual(["admissions", "tuition", "support"]);
  });

  it("accepts and trims a strict public request", () => {
    const parsed = researchModeRequestSchema.parse({
      universityId: " university-mit ",
      programId: " program-mit-6-3 ",
      categories: ["tuition", "admissions", "tuition"],
      question: "  What are the published AI degree requirements?  ",
      intake: " Fall 2027 ",
      academicYear: " 2027-2028 ",
    });
    expect(parsed).toEqual({
      universityId: "university-mit",
      programId: "program-mit-6-3",
      categories: ["admissions", "tuition"],
      question: "What are the published AI degree requirements?",
      intake: "Fall 2027",
      academicYear: "2027-2028",
    });
  });

  it("rejects blank optionals, wrong cardinality, unknown keys, and caller control fields", () => {
    for (const value of [
      { universityId: "u", categories: [] },
      { universityId: "u", categories: ["admissions", "tuition", "scholarships", "program-structure", "research", "outcomes", "support", "admissions"] },
      { universityId: "u", categories: ["admissions"], question: " " },
      { universityId: "u", categories: ["admissions"], universityName: "Example" },
      { universityId: "u", categories: ["admissions"], provider: "tavily" },
      { universityId: "u", categories: ["admissions"], model: "test" },
      { universityId: "u", categories: ["admissions"], apiKey: "secret" },
      { universityId: "u", categories: ["admissions"], retries: 2 },
      { universityId: "u", categories: ["admissions"], sourceUrl: "https://source.example" },
      { universityId: "u", categories: ["admissions"], locale: "en-US" },
      { universityId: "u", categories: ["admissions"], question: "x".repeat(501) },
      { universityId: "u", categories: ["admissions"], intake: "x".repeat(41) },
      { universityId: "u", categories: ["admissions"], academicYear: "x".repeat(41) },
    ]) {
      expect(researchModeRequestSchema.safeParse(value).success).toBe(false);
    }
  });

  it("keeps public request bounds inside the Phase 2 contract", () => {
    expect(RESEARCH_MODE_MAX_QUESTION_UTF16).toBeLessThanOrEqual(RESEARCH_MAX_QUERY_CHARACTERS);
    expect(RESEARCH_MODE_MAX_QUESTION_UTF16).toBe(500);
    expect(RESEARCH_MAX_CATEGORIES).toBe(7);

    const maximumPublicRequest = researchModeRequestSchema.parse({
      universityId: "u".repeat(120),
      programId: "p".repeat(120),
      categories: researchModeCategoryOrder,
      question: "q".repeat(RESEARCH_MODE_MAX_QUESTION_UTF16),
      intake: "i".repeat(40),
      academicYear: "y".repeat(40),
    });
    const phase2 = researchRequestSchema.parse({
      target: {
        university: { id: maximumPublicRequest.universityId },
        program: {
          id: maximumPublicRequest.programId,
          universityId: maximumPublicRequest.universityId,
        },
      },
      categories: maximumPublicRequest.categories,
      question: maximumPublicRequest.question,
      intake: maximumPublicRequest.intake,
      academicYear: maximumPublicRequest.academicYear,
    });
    expect(phase2.target?.university?.id).toBe(maximumPublicRequest.universityId);
  });

  it("accepts public evidence over HTTP or HTTPS without credentials only", () => {
    expect(publicResearchSourceSchema.shape.url.safeParse("http://official.example/evidence").success).toBe(true);
    expect(publicResearchSourceSchema.shape.url.safeParse("https://official.example/evidence").success).toBe(true);
    for (const url of [
      "ftp://official.example/evidence",
      "file:///C:/private",
      "https://user@official.example/evidence",
      "https://user:password@official.example/evidence",
      "javascript:alert(1)",
    ]) {
      expect(publicResearchSourceSchema.shape.url.safeParse(url).success).toBe(false);
    }
  });

  it("validates complete public dossier and response envelopes", () => {
    expect(researchDossierSchema.safeParse(validDossier).success).toBe(true);
    expect(researchModeResponseSchema.safeParse({ ok: true, dossier: validDossier }).success).toBe(true);
    expect(researchModeResponseSchema.safeParse({
      ok: false,
      error: { code: "invalid-request", message: "The research request is invalid." },
    }).success).toBe(true);
  });

  it("rejects malformed dossier state and cross-record provenance", () => {
    const invalidRows = [
      { ...validDossier, documents: [] },
      { ...validDossier, candidates: [] },
      { ...validDossier, providerAttempts: [] },
      { ...validDossier, warnings: [] },
      {
        ...validDossier,
        categories: [{ ...validDossier.categories[0], state: "unknown" }],
      },
      {
        ...validDossier,
        categories: [{ ...validDossier.categories[0], hasConflict: true }],
      },
      {
        ...validDossier,
        categories: [{
          ...validDossier.categories[0],
          claims: [{ ...validClaim, representativeSourceId: "source-missing" }],
        }],
      },
      {
        ...validDossier,
        categories: [{
          ...validDossier.categories[0],
          explanation: { ...validDossier.categories[0].explanation, referencedClaimIds: ["claim-missing"] },
        }],
      },
      {
        ...validDossier,
        categories: [{
          ...validDossier.categories[0],
          claims: [validClaim, validClaim],
        }],
        summary: {
          ...validDossier.summary,
          totalClaims: 2,
          statusCounts: { ...validDossier.summary.statusCounts, verified: 2 },
        },
      },
      {
        ...validDossier,
        categories: [{
          ...validDossier.categories[0],
          explanation: {
            ...validDossier.categories[0].explanation,
            referencedClaimIds: ["claim-1", "claim-1"],
          },
        }],
      },
      {
        ...validDossier,
        sources: [
          ...validDossier.sources,
          { ...validSource, id: "source-unused", url: "https://official.example/unused" },
        ],
      },
      {
        ...validDossier,
        run: { ...validDossier.run, status: "partial" as const },
      },
      {
        ...validDossier,
        run: { ...validDossier.run, status: "failed" as const },
      },
      {
        ...validDossier,
        run: { ...validDossier.run, createdAt: "2026-08-17T00:00:04.000Z" },
      },
    ];
    for (const dossier of invalidRows) {
      expect(researchDossierSchema.safeParse(dossier).success).toBe(false);
    }
    expect(researchDossierSchema.safeParse({
      ...validDossier,
      summary: { ...validDossier.summary, totalClaims: 2 },
    }).success).toBe(false);
  });

  it("rejects server controller-only transport codes", () => {
    expect(researchModeResponseSchema.safeParse({
      ok: false,
      error: { code: "network-error", message: "Network error." },
    }).success).toBe(false);
    expect(researchModeResponseSchema.safeParse({
      ok: false,
      error: { code: "invalid-response", message: "Invalid response." },
    }).success).toBe(false);
  });
});

describe("Phase 3A supported catalog", () => {
  it("checks in a bounded multi-country catalog with degree coverage", () => {
    expect(researchCatalog.universities.length).toBeGreaterThanOrEqual(10);
    expect(researchCatalog.universities.length).toBeLessThanOrEqual(40);
    expect(new Set(researchCatalog.universities.map((item) => item.countryCode))).toEqual(
      new Set(["BE", "CA", "DE", "DK", "FI", "GB", "IT", "NL", "SE", "TH", "US"]),
    );
    expect(researchCatalog.programs.length).toBeGreaterThanOrEqual(10);
    expect(researchCatalog.programs.length).toBeLessThanOrEqual(60);
    expect(new Set(researchCatalog.programs.map((item) => item.degreeLevel))).toEqual(new Set(["bachelor", "master"]));
    expect(researchCatalog.universities.every((item) => item.websiteUrl.startsWith("https://"))).toBe(true);
    expect(researchCatalog.programs.every((item) => item.officialUrl.startsWith("https://"))).toBe(true);
  });

  it("keeps deterministic checked-in catalog ordering", () => {
    const expectedUniversities = [...researchCatalog.universities]
      .sort((left, right) =>
        left.countryCode.localeCompare(right.countryCode, "en-US") ||
        normalizeResearchCatalogText(left.name).localeCompare(normalizeResearchCatalogText(right.name), "en-US") ||
        left.id.localeCompare(right.id, "en-US"))
      .map((item) => item.id);
    expect(researchCatalog.universities.map((item) => item.id)).toEqual(expectedUniversities);

    const universityRank = new Map(researchCatalog.universities.map((item, index) => [item.id, index]));
    const expectedPrograms = [...researchCatalog.programs]
      .sort((left, right) =>
        (universityRank.get(left.universityId) ?? 0) - (universityRank.get(right.universityId) ?? 0) ||
        left.degreeLevel.localeCompare(right.degreeLevel, "en-US") ||
        normalizeResearchCatalogText(left.name).localeCompare(normalizeResearchCatalogText(right.name), "en-US") ||
        left.id.localeCompare(right.id, "en-US"))
      .map((item) => item.id);
    expect(researchCatalog.programs.map((item) => item.id)).toEqual(expectedPrograms);
  });

  it("normalizes catalog text deterministically without fuzzy correction", () => {
    expect(normalizeResearchCatalogText("  M.I.T. Artificial ‑ Intelligence! ")).toBe("m i t artificial intelligence");
    expect(normalizeResearchCatalogText("ＭＩＴ")).toBe(normalizeResearchCatalogText("MIT"));
    expect(searchResearchCatalog(researchCatalog, { query: "definitely-not-a-university" })).toEqual({
      universities: [],
      programs: [],
    });
  });

  it("searches aliases and applies combined filters without mutating the catalog", () => {
    const before = JSON.stringify(researchCatalog);
    const all = searchResearchCatalog(researchCatalog, {});
    expect(all.universities).toEqual(researchCatalog.universities);
    expect(all.programs).toEqual(researchCatalog.programs);

    const gbMasters = searchResearchCatalog(researchCatalog, {
      countryCode: "GB",
      degreeLevel: "master",
    });
    expect(gbMasters.universities.map((item) => item.id)).toEqual(["university-edinburgh"]);
    expect(gbMasters.programs.map((item) => item.id)).toEqual([
      "program-edinburgh-artificial-intelligence-msc",
    ]);

    const query = searchResearchCatalog(researchCatalog, { query: "Artificial Intelligence" });
    expect(query.programs.length).toBeGreaterThan(0);
    expect(query.universities.map((item) => item.id)).toContain("university-edinburgh");
    for (const program of query.programs) {
      expect(query.universities.some((university) => university.id === program.universityId)).toBe(true);
    }
    const alias = searchResearchCatalog(researchCatalog, { query: "MIT" });
    expect(alias.universities.map((item) => item.id)).toContain("university-mit");
    expect(alias.programs.length).toBeGreaterThan(0);
    const combined = searchResearchCatalog(researchCatalog, {
      countryCode: "TH",
      degreeLevel: "master",
      subjectArea: "Computer Science",
    });
    expect(combined.universities.map((item) => item.id)).toEqual([
      "university-chulalongkorn",
      "university-kmutt",
      "university-mahidol",
    ]);
    expect(combined.programs.map((item) => item.id)).toEqual([
      "program-chulalongkorn-csit-msc",
      "program-kmutt-computer-science-msc",
      "program-mahidol-computer-science-msc",
    ]);
    expect(JSON.stringify(researchCatalog)).toBe(before);
  });

  it("resolves exact catalog IDs without names, fuzzy matches, or network work", () => {
    const resolver = createCatalogTargetResolver(researchCatalog);
    const university = researchCatalog.universities[0];
    const program = researchCatalog.programs.find((item) => item.universityId === university.id);
    expect(program).toBeDefined();
    expect(resolver.resolveUniversity?.(university.id)).toEqual({
      id: university.id,
      name: university.name,
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
      rorId: university.rorId,
    });
    expect(resolver.resolveProgram?.(program!.id)).toEqual({
      id: program!.id,
      universityId: program!.universityId,
      name: program!.name,
      degreeLevel: program!.degreeLevel,
      subjectArea: program!.subjectArea,
      officialUrl: program!.officialUrl,
    });
    expect(resolver.resolveUniversity?.(university.name)).toBeUndefined();
    expect(resolver.resolveProgram?.(program!.name)).toBeUndefined();
    expect(resolver.resolveUniversity?.("university-does-not-exist")).toBeUndefined();
    expect(resolver.resolveProgram?.("program-does-not-exist")).toBeUndefined();
  });

  it("rejects duplicate identities and malformed official catalog URLs", () => {
    const first = researchCatalog.universities[0];
    const firstProgram = researchCatalog.programs[0];
    expect(researchCatalogSchema.safeParse({
      universities: [
        ...researchCatalog.universities,
        { ...first, id: "university-duplicate" },
      ],
      programs: researchCatalog.programs,
    }).success).toBe(false);
    expect(researchCatalogSchema.safeParse({
      universities: researchCatalog.universities,
      programs: [
        ...researchCatalog.programs,
        { ...firstProgram, id: "program-duplicate", universityId: "university-missing" },
      ],
    }).success).toBe(false);
    expect(researchCatalogSchema.safeParse({
      universities: researchCatalog.universities.map((item) =>
        item.id === first.id ? { ...item, websiteUrl: "http://official.example/" } : item
      ),
      programs: researchCatalog.programs,
    }).success).toBe(false);
  });
});
