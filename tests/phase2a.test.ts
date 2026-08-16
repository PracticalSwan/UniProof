import { describe, expect, it, vi } from "vitest";

import {
  candidateSourceSchema,
  claimCandidateSchema,
  evidenceSummarySchema,
  researchDocumentSchema,
  researchRequestSchema,
  researchResultSchema,
  researchRunSchema,
  verifiedClaimSchema,
} from "@/lib/research/contracts";
import {
  assertPublicIpAddress,
  canonicalizeOutboundUrl,
  classifyOutboundIpAddress,
  isPublicIpAddress,
  resolveAndValidateOutboundTarget,
  validateRedirectTarget,
} from "@/lib/security/outbound-url";
import {
  RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES,
  RESEARCH_MAX_CATEGORIES,
  RESEARCH_MAX_REDIRECTS,
  RESEARCH_MAX_RESPONSE_BYTES,
  RESEARCH_MAX_SOURCES_PER_RUN,
  validateResearchRedirectLimit,
} from "@/lib/security/research-limits";

const publicResolver = async () => [
  { address: "93.184.216.34", family: 4 as const },
];

const timestamp = "2026-08-16T00:00:00.000Z";

describe("Phase 2A research contracts", () => {
  it("accepts bounded requests and deduplicates supported categories", () => {
    const parsed = researchRequestSchema.parse({
      universityName: "Example University",
      categories: ["admissions", "admissions", "tuition"],
      locale: "en-US",
    });

    expect(parsed.categories).toEqual(["admissions", "tuition"]);
  });

  it("accepts a focused question without a preselected university", () => {
    expect(
      researchRequestSchema.safeParse({
        categories: ["research"],
        question: "Which computer science programs publish current research opportunities?",
      }).success,
    ).toBe(true);
  });

  it("rejects empty intent, unsupported categories, oversized text, and caller limits", () => {
    expect(researchRequestSchema.safeParse({ categories: ["admissions"] }).success).toBe(false);
    expect(
      researchRequestSchema.safeParse({
        target: { university: {} },
        categories: ["admissions"],
      }).success,
    ).toBe(false);
    expect(
      researchRequestSchema.safeParse({
        universityName: "Example University",
        categories: ["rankings"],
      }).success,
    ).toBe(false);
    expect(
      researchRequestSchema.safeParse({
        universityName: "Example University",
        categories: ["admissions"],
        question: "x".repeat(601),
      }).success,
    ).toBe(false);
    expect(
      researchRequestSchema.safeParse({
        universityName: "Example University",
        categories: ["admissions"],
        maxRetries: 99,
      }).success,
    ).toBe(false);
  });

  it("rejects contradictory legacy and structured target representations", () => {
    expect(
      researchRequestSchema.safeParse({
        target: { university: { id: "university-1" } },
        universityId: "university-2",
        categories: ["admissions"],
      }).success,
    ).toBe(false);
  });

  it("rejects contradictory structured university/program targeting", () => {
    expect(
      researchRequestSchema.safeParse({
        target: {
          university: { id: "university-1" },
          program: { id: "program-1", universityId: "university-2" },
        },
        categories: ["admissions"],
      }).success,
    ).toBe(false);
  });

  it("restricts research claims to supported categories and coherent references", () => {
    const claim = {
      id: "claim-1",
      universityId: "university-1",
      category: "admissions",
      property: "deadline",
      value: "2027-01-01",
      sourceIds: ["source-1"],
      documentIds: ["document-1"],
      supportingText: "Applications close on 1 January 2027.",
      verificationStatus: "verified",
    };

    expect(verifiedClaimSchema.safeParse({ ...claim, category: "rankings" }).success).toBe(false);
    expect(
      claimCandidateSchema.safeParse({
        id: "candidate-unsupported-category",
        universityId: "university-1",
        category: "rankings",
        property: "rank",
        value: 1,
        sourceId: "source-1",
        documentId: "document-1",
        supportingText: "Unsupported research category.",
        extractionMethod: "model",
      }).success,
    ).toBe(false);
    expect(
      verifiedClaimSchema.safeParse({
        ...claim,
        documentIds: ["document-1", "document-1"],
      }).success,
    ).toBe(false);
    expect(verifiedClaimSchema.safeParse({ ...claim, sourceId: "source-2" }).success).toBe(false);
  });

  it("rejects contradictory partial run state and unsupported document MIME types", () => {
    expect(
      researchRunSchema.safeParse({
        id: "run-succeeded-partial",
        status: "succeeded",
        createdAt: timestamp,
        updatedAt: timestamp,
        partial: true,
      }).success,
    ).toBe(false);

    expect(
      researchRunSchema.safeParse({
        id: "run-overlap",
        status: "running",
        createdAt: timestamp,
        updatedAt: timestamp,
        processedCategories: ["admissions"],
        unprocessedCategories: ["admissions"],
      }).success,
    ).toBe(false);

    expect(
      researchRunSchema.safeParse({
        id: "run-partial",
        status: "partial",
        createdAt: timestamp,
        updatedAt: timestamp,
      }).success,
    ).toBe(false);

    expect(
      researchDocumentSchema.safeParse({
        id: "document-unsupported-mime",
        sourceId: "source-1",
        originalUrl: "https://example.edu/file.bin",
        canonicalUrl: "https://example.edu/file.bin",
        title: "Binary",
        publisher: "Example",
        sourceType: "university",
        retrievedAt: timestamp,
        contentType: "application/octet-stream",
        normalizedText: "Not a supported research document.",
        contentHash: "b".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("keeps candidate claims free of final AI evidence status", () => {
    const candidate = {
      id: "candidate-1",
      universityId: "university-1",
      category: "admissions",
      property: "deadline",
      value: "2027-01-01",
      sourceId: "source-1",
      documentId: "document-1",
      supportingText: "Applications close on 1 January 2027.",
      extractionMethod: "model",
      verificationStatus: "verified",
    };

    expect(claimCandidateSchema.safeParse(candidate).success).toBe(false);
  });

  it("parses a result with source, document, claim, coverage, and failure metadata", () => {
    const result = researchResultSchema.safeParse({
      run: {
        id: "run-1",
        status: "partial",
        createdAt: timestamp,
        startedAt: timestamp,
        updatedAt: timestamp,
        completedAt: timestamp,
        partial: true,
        processedCategories: ["admissions"],
        unprocessedCategories: ["tuition"],
        failureCode: "timeout",
        failureReason: "The bounded retrieval window elapsed.",
      },
      sources: [
        {
          id: "source-1",
          url: "https://example.edu/admissions",
          title: "Admissions",
          publisher: "Example University",
          sourceType: "university",
          retrievedAt: timestamp,
        },
      ],
      documents: [
        {
          id: "document-1",
          sourceId: "source-1",
          originalUrl: "https://example.edu/admissions",
          canonicalUrl: "https://example.edu/admissions",
          title: "Admissions",
          publisher: "Example University",
          sourceType: "university",
          retrievedAt: timestamp,
          contentType: "text/html",
          truncated: false,
          normalizedText: "Applications close on 1 January 2027.",
          contentHash: "a".repeat(64),
        },
      ],
      candidates: [
        {
          id: "candidate-1",
          universityId: "university-1",
          category: "admissions",
          property: "deadline",
          value: "2027-01-01",
          sourceId: "source-1",
          documentId: "document-1",
          supportingText: "Applications close on 1 January 2027.",
          extractionMethod: "model",
          confidence: 0.9,
        },
      ],
      claims: [
        {
          id: "claim-1",
          universityId: "university-1",
          category: "admissions",
          property: "deadline",
          value: "2027-01-01",
          sourceIds: ["source-1"],
          documentIds: ["document-1"],
          candidateIds: ["candidate-1"],
          supportingText: "Applications close on 1 January 2027.",
          verificationStatus: "verified",
        },
      ],
      explanations: [{
        category: "admissions",
        referencedClaimIds: ["claim-1"],
        summary: "Verified admissions deadline evidence.",
      }],
      evidenceSummary: {
        statusCounts: {
          verified: 1,
          corroborated: 0,
          "university-reported": 0,
          conflicting: 0,
          anecdotal: 0,
          inferred: 0,
          unknown: 0,
          outdated: 0,
        },
        totalClaims: 1,
        categoryCoverage: [
          {
            category: "admissions",
            claimCount: 1,
            hasEvidence: true,
            statuses: ["verified"],
          },
        ],
        categoriesProcessed: ["admissions"],
        categoriesWithConflicts: [],
        categoriesUnknown: [],
        categoriesOutdated: [],
        categoriesUnprocessed: ["tuition"],
        categoriesFailed: [],
      },
      failures: [{ category: "tuition", code: "timeout", message: "Retrieval timed out." }],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected the valid research result fixture to parse");
    }
    expect(
      researchResultSchema.safeParse({
        ...result.data,
        evidenceSummary: {
          ...result.data.evidenceSummary,
          statusCounts: {
            ...result.data.evidenceSummary.statusCounts,
            verified: 0,
            anecdotal: 1,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("enforces the centralized per-run source bound across result records", () => {
    const sources = Array.from({ length: RESEARCH_MAX_SOURCES_PER_RUN + 1 }, (_, index) => ({
      id: `source-${index}`,
      url: `https://example.edu/source-${index}`,
      title: `Source ${index}`,
      publisher: "Example University",
      sourceType: "university" as const,
      retrievedAt: timestamp,
    }));

    expect(
      researchResultSchema.safeParse({
        run: { id: "run-source-limit", status: "completed", createdAt: timestamp, updatedAt: timestamp },
        sources,
        evidenceSummary: {
          statusCounts: {
            verified: 0,
            corroborated: 0,
            "university-reported": 0,
            conflicting: 0,
            anecdotal: 0,
            inferred: 0,
            unknown: 0,
            outdated: 0,
          },
          totalClaims: 0,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects contradictory evidence summaries and broken result provenance", () => {
    const emptyCounts = {
      verified: 0,
      corroborated: 0,
      "university-reported": 0,
      conflicting: 0,
      anecdotal: 0,
      inferred: 0,
      unknown: 0,
      outdated: 0,
    };

    expect(
      evidenceSummarySchema.safeParse({
        statusCounts: emptyCounts,
        totalClaims: 0,
        categoryCoverage: [
          { category: "admissions", claimCount: 0, hasEvidence: false },
          { category: "admissions", claimCount: 0, hasEvidence: false },
        ],
        categoriesProcessed: ["admissions"],
        categoriesUnprocessed: ["admissions"],
      }).success,
    ).toBe(false);

    expect(
      researchResultSchema.safeParse({
        run: {
          id: "run-broken-provenance",
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        sources: [{
          id: "source-1",
          url: "https://example.edu/a",
          title: "A",
          publisher: "Example",
          sourceType: "university",
          retrievedAt: timestamp,
        }],
        documents: [{
          id: "document-1",
          sourceId: "source-1",
          originalUrl: "https://example.edu/a",
          canonicalUrl: "https://example.edu/a",
          title: "A",
          publisher: "Example",
          sourceType: "university",
          retrievedAt: timestamp,
          contentType: "text/html",
          normalizedText: "Evidence",
          contentHash: "a".repeat(64),
        }],
        claims: [{
          id: "claim-1",
          universityId: "university-1",
          category: "admissions",
          property: "deadline",
          value: "2027-01-01",
          sourceIds: ["missing-source"],
          documentIds: ["document-1"],
          supportingText: "Evidence",
          verificationStatus: "verified",
        }],
        evidenceSummary: { statusCounts: emptyCounts, totalClaims: 0 },
      }).success,
    ).toBe(false);
  });

  it("keeps evidence-state counts consistent", () => {
    expect(
      evidenceSummarySchema.safeParse({
        statusCounts: {
          verified: 1,
          corroborated: 0,
          "university-reported": 0,
          conflicting: 0,
          anecdotal: 0,
          inferred: 0,
          unknown: 0,
          outdated: 0,
        },
        totalClaims: 2,
        categoriesProcessed: [],
        categoriesWithConflicts: [],
        categoriesUnknown: [],
        categoriesOutdated: [],
        categoriesUnprocessed: [],
        categoriesFailed: [],
      }).success,
    ).toBe(false);
  });
});

describe("Phase 2A outbound URL and IP policy", () => {
  it("accepts public HTTPS, explicitly allowed HTTP, IDN, and public literals", async () => {
    expect(
      (await resolveAndValidateOutboundTarget("https://public.example/path", {
        dnsResolver: publicResolver,
      })).valid,
    ).toBe(true);
    expect(
      (await resolveAndValidateOutboundTarget("http://public.example/path", {
        allowHttp: true,
        dnsResolver: publicResolver,
      })).valid,
    ).toBe(true);
    expect(
      (await resolveAndValidateOutboundTarget("https://例え.テスト/", {
        dnsResolver: publicResolver,
      })).valid,
    ).toBe(true);
    expect((await resolveAndValidateOutboundTarget("https://93.184.216.34/")).valid).toBe(true);
    expect((await resolveAndValidateOutboundTarget("https://[2001:4860:4860::8888]/")).valid).toBe(true);
  });

  it("rejects unsupported schemes, malformed URLs, credentials, localhost, and metadata names", async () => {
    for (const rawUrl of [
      "not a URL",
      "ftp://public.example/file",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain,secret",
      "https://user:pass@public.example/",
      "https://localhost/",
      "https://localhost./",
      "https://metadata.google.internal/",
    ]) {
      expect((await resolveAndValidateOutboundTarget(rawUrl, { dnsResolver: publicResolver })).valid).toBe(false);
    }
  });

  it("does not echo URL path, query, or fragment secrets in validation failures", async () => {
    const failure = await resolveAndValidateOutboundTarget(
      "http://public.example/private-token?api_key=super-secret#fragment",
      { dnsResolver: publicResolver },
    );

    expect(failure).toMatchObject({ valid: false, reason: "http-not-allowed" });
    expect(JSON.stringify(failure)).not.toContain("private-token");
    expect(JSON.stringify(failure)).not.toContain("super-secret");
    expect(JSON.stringify(failure)).not.toContain("api_key");

    const opaqueFailure = await resolveAndValidateOutboundTarget(
      "data:text/plain,opaque-secret",
      { dnsResolver: publicResolver },
    );
    expect(opaqueFailure).toMatchObject({ valid: false, reason: "unsupported-protocol" });
    expect(JSON.stringify(opaqueFailure)).not.toContain("opaque-secret");
  });

  it("blocks special-use IPv4, IPv6, and mapped IPv4 destinations", () => {
    const blocked = [
      "127.0.0.1",
      "127.10.20.30",
      "0.0.0.0",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "192.0.2.1",
      "198.18.0.1",
      "224.0.0.1",
      "240.0.0.1",
    ];

    for (const address of blocked) {
      expect(isPublicIpAddress(address)).toBe(false);
      expect(() => assertPublicIpAddress(address)).toThrow();
    }

    for (const address of [
      "::1",
      "::",
      "fc00::1",
      "fe80::1",
      "ff02::1",
      "100:0:0:1::1",
      "2001:10::1",
      "2001:20::1",
      "2001:db8::1",
      "3ffe::1",
      "4000::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isPublicIpAddress(address)).toBe(false);
    }

    expect(classifyOutboundIpAddress("::ffff:127.0.0.1", 6).mappedIpv4Address).toBe("127.0.0.1");
    expect(isPublicIpAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
  });

  it("fails closed when DNS fails, returns no addresses, or returns any blocked address", async () => {
    const dnsFailure = await resolveAndValidateOutboundTarget("https://dns-fails.example/", {
      dnsResolver: async () => {
        throw new Error("resolver unavailable");
      },
    });
    expect(dnsFailure).toMatchObject({
      valid: false,
      reason: "dns-resolution-failed",
      detail: "DNS resolution failed",
    });
    expect(JSON.stringify(dnsFailure)).not.toContain("resolver unavailable");

    const noAddresses = await resolveAndValidateOutboundTarget("https://no-addresses.example/", {
      dnsResolver: async () => [],
    });
    expect(noAddresses).toMatchObject({ valid: false, reason: "dns-no-addresses" });

    const invalidAddresses = await resolveAndValidateOutboundTarget("https://invalid-address.example/", {
      dnsResolver: async () => [{ address: "not-an-ip", family: 4 as const }],
    });
    expect(invalidAddresses).toMatchObject({ valid: false, reason: "dns-invalid-addresses" });

    const invalidFamily = await resolveAndValidateOutboundTarget("https://invalid-family.example/", {
      dnsResolver: async () => [
        { address: "93.184.216.34", family: 5 } as never,
      ],
    });
    expect(invalidFamily).toMatchObject({ valid: false, reason: "dns-invalid-addresses" });

    const mixedAddresses = await resolveAndValidateOutboundTarget("https://mixed.example/", {
      dnsResolver: async () => [
        { address: "93.184.216.34", family: 4 as const },
        { address: "192.168.1.10", family: 4 as const },
      ],
    });
    expect(mixedAddresses).toMatchObject({ valid: false, reason: "blocked-ip-address" });
  });

  it("fails closed when DNS resolution exceeds the bounded lookup window", async () => {
    vi.useFakeTimers();
    try {
      const pending = resolveAndValidateOutboundTarget("https://dns-timeout.example/", {
        dnsResolver: async () => new Promise<never>(() => {}),
      });
      await vi.advanceTimersByTimeAsync(3_000);
      await expect(pending).resolves.toMatchObject({
        valid: false,
        reason: "dns-resolution-failed",
        detail: "DNS resolution failed",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("revalidates relative and absolute redirects and enforces the redirect budget", async () => {
    const publicRedirect = await validateRedirectTarget(
      "https://public.example/start",
      "/next",
      0,
      { dnsResolver: publicResolver },
    );
    expect(publicRedirect.valid).toBe(true);

    const localhostRedirect = await validateRedirectTarget(
      "https://public.example/start",
      "https://localhost/private",
      0,
      { dnsResolver: publicResolver },
    );
    expect(localhostRedirect).toMatchObject({ valid: false, reason: "blocked-hostname" });

    const privateRedirect = await validateRedirectTarget(
      "https://public.example/start",
      "https://192.168.1.10/private",
      0,
      { dnsResolver: publicResolver },
    );
    expect(privateRedirect).toMatchObject({ valid: false, reason: "blocked-ip-address" });

    const metadataRedirect = await validateRedirectTarget(
      "https://public.example/start",
      "https://metadata.google.internal/",
      0,
      { dnsResolver: publicResolver },
    );
    expect(metadataRedirect).toMatchObject({ valid: false, reason: "blocked-hostname" });

    const tooMany = await validateRedirectTarget(
      "https://public.example/start",
      "/next",
      RESEARCH_MAX_REDIRECTS,
      { dnsResolver: publicResolver },
    );
    expect(tooMany).toMatchObject({ valid: false, reason: "too-many-redirects" });
  });

  it("canonicalizes conservatively without erasing meaningful queries", () => {
    expect(canonicalizeOutboundUrl("HTTPS://Example.COM:443/program#overview")).toBe(
      "https://example.com/program",
    );
    expect(canonicalizeOutboundUrl("https://example.com/program?a=1")).not.toBe(
      canonicalizeOutboundUrl("https://example.com/program?a=2"),
    );
  });
});

describe("Phase 2A server-owned limits", () => {
  it("exposes bounded immutable retrieval policy and redirect checks", () => {
    expect(RESEARCH_MAX_CATEGORIES).toBe(7);
    expect(RESEARCH_MAX_RESPONSE_BYTES).toBeGreaterThan(0);
    expect(RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES).toContain("text/html");
    expect(Object.isFrozen(RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES)).toBe(true);
    expect(validateResearchRedirectLimit(0).valid).toBe(true);
    expect(validateResearchRedirectLimit(RESEARCH_MAX_REDIRECTS).valid).toBe(false);
    expect(validateResearchRedirectLimit(0, RESEARCH_MAX_REDIRECTS + 1)).toMatchObject({
      valid: false,
      reason: "invalid-max-redirects",
    });
  });

  it("validates discovered source metadata independently from retrieval", () => {
    expect(
      candidateSourceSchema.safeParse({
        url: "https://example.edu/admissions",
        sourceType: "university",
        discoveryProvider: "direct",
        requestedCategory: "admissions",
      }).success,
    ).toBe(true);
  });
});
