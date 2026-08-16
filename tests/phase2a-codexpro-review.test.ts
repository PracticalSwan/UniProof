import { describe, expect, it } from "vitest";

import {
  candidateSourceSchema,
  claimCandidateSchema,
  evidenceSummarySchema,
  researchDocumentSchema,
  researchRequestSchema,
  researchRunSchema,
  researchResultSchema,
  verifiedClaimSchema,
} from "@/lib/research/contracts";
import {
  resolveAndValidateOutboundTarget,
  validateRedirectTarget,
} from "@/lib/security/outbound-url";

const timestamp = "2026-08-16T00:00:00.000Z";

const source = {
  id: "source-review",
  url: "https://example.edu/admissions",
  title: "Admissions",
  publisher: "Example University",
  sourceType: "university" as const,
  retrievedAt: timestamp,
};

const document = {
  id: "document-review",
  sourceId: source.id,
  originalUrl: source.url,
  canonicalUrl: source.url,
  title: source.title,
  publisher: source.publisher,
  sourceType: source.sourceType,
  retrievedAt: timestamp,
  contentType: "text/html",
  normalizedText: "Applications close on 1 January 2027.",
  contentHash: "c".repeat(64),
};

const claim = {
  id: "claim-review",
  universityId: "university-1",
  category: "admissions" as const,
  property: "deadline",
  value: "2027-01-01",
  sourceIds: [source.id],
  documentIds: [document.id],
  supportingText: "Applications close on 1 January 2027.",
  verificationStatus: "verified" as const,
};

const statusCounts = {
  verified: 1,
  corroborated: 0,
  "university-reported": 0,
  conflicting: 0,
  anecdotal: 0,
  inferred: 0,
  unknown: 0,
  outdated: 0,
};

describe("Phase 2A CodexPro follow-up regressions", () => {
  it("bounds and strictly validates verified claim payloads", () => {
    expect.soft(
      verifiedClaimSchema.safeParse({ ...claim, supportingText: "x".repeat(2_001) }).success,
    ).toBe(false);
    expect.soft(
      verifiedClaimSchema.safeParse({ ...claim, value: "x".repeat(501) }).success,
    ).toBe(false);
    expect.soft(
      verifiedClaimSchema.safeParse({ ...claim, providerPayload: { unsafe: true } }).success,
    ).toBe(false);
  });

  it("rejects category coverage that disagrees with verified claims", () => {
    expect(
      researchResultSchema.safeParse({
        run: {
          id: "run-coverage-drift",
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        sources: [source],
        documents: [document],
        claims: [claim],
        evidenceSummary: {
          statusCounts,
          totalClaims: 1,
          categoryCoverage: [
            { category: "admissions", claimCount: 0, hasEvidence: false, statuses: [] },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects run category state that disagrees with the evidence summary", () => {
    expect(
      researchResultSchema.safeParse({
        run: {
          id: "run-category-state-drift",
          status: "running",
          createdAt: timestamp,
          updatedAt: timestamp,
          processedCategories: ["admissions"],
          unprocessedCategories: ["tuition"],
        },
        sources: [source],
        documents: [document],
        claims: [claim],
        evidenceSummary: {
          statusCounts,
          totalClaims: 1,
          categoryCoverage: [
            { category: "admissions", claimCount: 1, hasEvidence: true, statuses: ["verified"] },
          ],
          categoriesProcessed: ["tuition"],
          categoriesUnprocessed: ["admissions"],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate evidence statuses within one category coverage entry", () => {
    expect(
      evidenceSummarySchema.safeParse({
        statusCounts,
        totalClaims: 1,
        categoryCoverage: [
          {
            category: "admissions",
            claimCount: 1,
            hasEvidence: true,
            statuses: ["verified", "verified"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects impossible standalone category coverage counts", () => {
    expect.soft(
      evidenceSummarySchema.safeParse({
        statusCounts,
        totalClaims: 1,
        categoryCoverage: [
          { category: "admissions", claimCount: 2, hasEvidence: true, statuses: ["verified"] },
        ],
      }).success,
    ).toBe(false);
    expect.soft(
      evidenceSummarySchema.safeParse({
        statusCounts,
        totalClaims: 1,
        categoryCoverage: [
          { category: "admissions", claimCount: 0, hasEvidence: false, statuses: ["verified"] },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects extraction call usage above the declared run budget", () => {
    expect(
      researchRunSchema.safeParse({
        id: "run-call-budget",
        status: "running",
        createdAt: timestamp,
        updatedAt: timestamp,
        maxExtractionCalls: 2,
        extractionCallsUsed: 3,
      }).success,
    ).toBe(false);
  });

  it("rejects whitespace-only research intent", () => {
    expect(
      researchRequestSchema.safeParse({
        question: "   ",
        categories: ["research"],
      }).success,
    ).toBe(false);
    expect(
      researchRequestSchema.safeParse({
        universityName: "   ",
        categories: ["admissions"],
      }).success,
    ).toBe(false);
  });

  it("requires every verified-claim source reference to have supporting document provenance", () => {
    const secondSource = {
      ...source,
      id: "source-review-2",
      url: "https://example.edu/tuition",
      title: "Tuition",
    };

    expect(
      researchResultSchema.safeParse({
        run: {
          id: "run-unbacked-source",
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        sources: [source, secondSource],
        documents: [document],
        claims: [
          {
            ...claim,
            sourceIds: [source.id, secondSource.id],
          },
        ],
        evidenceSummary: {
          statusCounts,
          totalClaims: 1,
          categoryCoverage: [
            { category: "admissions", claimCount: 1, hasEvidence: true, statuses: ["verified"] },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("requires category coverage for every category represented by verified claims", () => {
    expect(
      researchResultSchema.safeParse({
        run: {
          id: "run-missing-coverage",
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        sources: [source],
        documents: [document],
        claims: [claim],
        evidenceSummary: {
          statusCounts,
          totalClaims: 1,
          categoryCoverage: [],
        },
      }).success,
    ).toBe(false);
  });

  it("surfaces claim-level state categories in the evidence summary", () => {
    expect.soft(
      researchResultSchema.safeParse({
        run: {
          id: "run-conflict-summary",
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        sources: [source],
        documents: [document],
        claims: [{ ...claim, verificationStatus: "conflicting" }],
        evidenceSummary: {
          statusCounts: { ...statusCounts, verified: 0, conflicting: 1 },
          totalClaims: 1,
          categoryCoverage: [
            { category: "admissions", claimCount: 1, hasEvidence: true, statuses: ["conflicting"] },
          ],
          categoriesWithConflicts: [],
        },
      }).success,
    ).toBe(false);

    for (const verificationStatus of ["unknown", "outdated"] as const) {
      expect.soft(
        researchResultSchema.safeParse({
          run: {
            id: `run-${verificationStatus}-summary`,
            status: "completed",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          sources: [source],
          documents: [document],
          claims: [{ ...claim, verificationStatus }],
          evidenceSummary: {
            statusCounts: { ...statusCounts, verified: 0, [verificationStatus]: 1 },
            totalClaims: 1,
            categoryCoverage: [
              { category: "admissions", claimCount: 1, hasEvidence: true, statuses: [verificationStatus] },
            ],
          },
        }).success,
      ).toBe(false);
    }
  });

  it("blocks alternate loopback literals and unsafe redirect forms", async () => {
    for (const rawUrl of [
      "https://127.1/",
      "https://2130706433/",
      "https://0x7f000001/",
      "https://0177.0.0.1/",
      "https://[::ffff:127.0.0.1]/",
      "https://[fe80::1%25eth0]/",
    ]) {
      expect.soft((await resolveAndValidateOutboundTarget(rawUrl)).valid).toBe(false);
    }

    expect.soft((await resolveAndValidateOutboundTarget("https://[2620:4f:8000::1]/")).valid).toBe(true);
    expect.soft((await resolveAndValidateOutboundTarget("https://[2001:20::1]/")).valid).toBe(false);
    expect.soft((await resolveAndValidateOutboundTarget("https://192.31.196.1/")).valid).toBe(true);
    expect.soft((await resolveAndValidateOutboundTarget("https://192.0.0.9/")).valid).toBe(false);

    const publicResolver = async () => [{ address: "93.184.216.34", family: 4 as const }];
    expect(
      await validateRedirectTarget(
        "https://public.example/start",
        "http://public.example/next",
        0,
        { dnsResolver: publicResolver },
      ),
    ).toMatchObject({ valid: false, reason: "http-not-allowed" });
    expect(
      await validateRedirectTarget(
        "https://public.example/start",
        "https://user:pass@public.example/next",
        0,
        { dnsResolver: publicResolver },
      ),
    ).toMatchObject({ valid: false, reason: "embedded-credentials" });
    expect(
      await validateRedirectTarget(
        "https://public.example/start",
        `/${"x".repeat(4_097)}`,
        0,
        { dnsResolver: publicResolver },
      ),
    ).toMatchObject({ valid: false, reason: "invalid-redirect-location" });
    for (const malformed of ["/has space", "/has\ttab", "/has\nline", "/has\rreturn"]) {
      expect(
        await validateRedirectTarget(
          "https://public.example/start",
          malformed,
          0,
          { dnsResolver: publicResolver },
        ),
      ).toMatchObject({ valid: false, reason: "invalid-redirect-location" });
    }
  });

  it("normalizes candidate domains and rejects URL/domain contradictions", () => {
    const parsed = candidateSourceSchema.parse({
      url: "https://Example.EDU/admissions",
      domain: "Example.EDU.",
      sourceType: "university",
      discoveryProvider: "direct",
    });
    expect.soft(parsed.domain).toBe("example.edu");
    const idn = candidateSourceSchema.parse({
      url: "https://例え.テスト/admissions",
      domain: "例え.テスト",
      sourceType: "university",
      discoveryProvider: "direct",
    });
    expect.soft(idn.domain).toBe("xn--r8jz45g.xn--zckzah");
    expect.soft(
      candidateSourceSchema.safeParse({
        url: "https://example.edu/admissions",
        domain: "different.example",
        sourceType: "university",
        discoveryProvider: "direct",
      }).success,
    ).toBe(false);
  });

  it("bounds meaningful claim identity, property, value, and evidence strings", () => {
    const candidate = {
      id: "candidate-review",
      universityId: "university-1",
      category: "admissions" as const,
      property: "deadline",
      value: "2027-01-01",
      sourceId: source.id,
      documentId: document.id,
      supportingText: "Applications close on 1 January 2027.",
      extractionMethod: "model" as const,
      extractionModel: "model-review",
    };

    for (const invalidCandidate of [
      { ...candidate, id: "x".repeat(121) },
      { ...candidate, sourceId: "x".repeat(121) },
      { ...candidate, property: "   " },
      { ...candidate, value: "   " },
      { ...candidate, supportingText: "   " },
    ]) {
      expect.soft(claimCandidateSchema.safeParse(invalidCandidate).success).toBe(false);
    }

    for (const invalidClaim of [
      { ...claim, id: "x".repeat(121) },
      { ...claim, universityId: "x".repeat(121) },
      { ...claim, property: "   " },
      { ...claim, value: "   " },
      { ...claim, supportingText: "   " },
    ]) {
      expect.soft(verifiedClaimSchema.safeParse(invalidClaim).success).toBe(false);
    }
  });

  it("strictly bounds source records inside research results", () => {
    const baseResult = {
      run: {
        id: "run-source-shape",
        status: "completed" as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      documents: [document],
      claims: [claim],
      evidenceSummary: {
        statusCounts,
        totalClaims: 1,
        categoryCoverage: [
          { category: "admissions" as const, claimCount: 1, hasEvidence: true, statuses: ["verified" as const] },
        ],
      },
    };

    expect.soft(
      researchResultSchema.safeParse({
        ...baseResult,
        sources: [{ ...source, providerPayload: { unsafe: true } }],
      }).success,
    ).toBe(false);
    expect.soft(
      researchResultSchema.safeParse({
        ...baseResult,
        sources: [{ ...source, title: "x".repeat(301) }],
      }).success,
    ).toBe(false);
  });

  it("normalizes canonical document URLs and rejects non-HTTP document URLs", () => {
    const parsed = researchDocumentSchema.parse({
      ...document,
      canonicalUrl: "HTTPS://Example.EDU:443/admissions#overview",
    });

    expect.soft(parsed.canonicalUrl).toBe("https://example.edu/admissions");
    expect.soft(
      researchDocumentSchema.safeParse({
        ...document,
        originalUrl: "file:///tmp/source.html",
      }).success,
    ).toBe(false);
    expect.soft(
      researchDocumentSchema.safeParse({
        ...document,
        canonicalUrl: "https://user:pass@example.edu/admissions",
      }).success,
    ).toBe(false);
  });

  it("canonicalizes document hashes to lowercase", () => {
    const parsed = researchDocumentSchema.parse({
      ...document,
      contentHash: "A".repeat(64),
    });

    expect(parsed.contentHash).toBe("a".repeat(64));
  });

  it("bounds aggregate normalized section text", () => {
    expect(
      researchDocumentSchema.safeParse({
        ...document,
        sections: Array.from({ length: 11 }, (_, index) => ({
          heading: `Section ${index}`,
          text: "x".repeat(20_000),
        })),
      }).success,
    ).toBe(false);
  });
});
