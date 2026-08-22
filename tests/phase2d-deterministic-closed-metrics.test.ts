import { describe, expect, it } from "vitest";

import { researchDocumentSchema, researchSourceSchema } from "@/lib/research/contracts";
import { extractDeterministicClosedMetrics } from "@/lib/research/extraction/deterministic-closed-metrics";
import { extractResearchDocuments } from "@/lib/research/extraction/orchestrator";
import { segmentResearchDocument } from "@/lib/research/extraction/segments";
import { reconcileResearchClaims } from "@/lib/research/reconciliation/orchestrator";

const timestamp = "2026-08-23T00:00:00.000Z";

function source(overrides: Record<string, unknown> = {}) {
  return researchSourceSchema.parse({
    id: "source-deterministic",
    url: "https://example.edu/fees",
    title: "Official facts",
    publisher: "Example University",
    sourceType: "university",
    retrievedAt: timestamp,
    ...overrides,
  });
}

function document(text: string, overrides: Record<string, unknown> = {}) {
  return researchDocumentSchema.parse({
    id: "document-deterministic",
    sourceId: "source-deterministic",
    originalUrl: "https://example.edu/fees",
    canonicalUrl: "https://example.edu/fees",
    title: "Official facts",
    publisher: "Example University",
    sourceType: "university",
    retrievedAt: timestamp,
    contentType: "text/plain",
    normalizedText: text,
    sections: [{ heading: "Official facts", text }],
    contentHash: "d".repeat(64),
    ...overrides,
  });
}

function extract(text: string, categories: Array<"tuition" | "scholarships" | "research" | "outcomes">) {
  const currentDocument = document(text);
  const segment = segmentResearchDocument(currentDocument)[0];
  if (segment === undefined) throw new Error("fixture segment missing");
  return extractDeterministicClosedMetrics({
    segment,
    categories,
    document: currentDocument,
    target: {
      universityId: "university-example",
      universityName: "Example University",
      officialHost: "example.edu",
    },
  });
}

describe("deterministic closed Compare metrics", () => {
  it("extracts exact official annual tuition with currency and stated academic year", () => {
    const supportingText = "For academic year 2026/27, the annual tuition fee is £32,500 per year.";
    const result = extract(supportingText, ["tuition"]);

    expect(result.completedCategories).toEqual(["tuition"]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      category: "tuition",
      property: "annual tuition",
      value: 32_500,
      currency: "GBP",
      unit: "per year",
      academicYear: "2026/27",
      supportingText,
      extractionMethod: "rule",
    });
    expect(result.candidates[0]?.extractionProvider).toBeUndefined();
    expect(result.candidates[0]?.extractionModel).toBeUndefined();
  });

  it("extracts explicit scholarship and research availability without inferring negatives", () => {
    const result = extract(
      "Scholarships are available. Research opportunities are available.",
      ["scholarships", "research"],
    );

    expect(result.completedCategories).toEqual(["scholarships", "research"]);
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "scholarships", property: "scholarship available", value: true, extractionMethod: "rule" }),
      expect.objectContaining({ category: "research", property: "research opportunity available", value: true, extractionMethod: "rule" }),
    ]));

    const negative = extract("Scholarships are not available for this programme.", ["scholarships"]);
    expect(negative).toMatchObject({ candidates: [], completedCategories: [] });
  });

  it("extracts only a dated explicit employment rate", () => {
    const supportingText = "In 2025, the graduate employment rate was 94%.";
    const result = extract(supportingText, ["outcomes"]);
    expect(result.completedCategories).toEqual(["outcomes"]);
    expect(result.candidates[0]).toMatchObject({
      category: "outcomes",
      property: "employment rate",
      value: 94,
      unit: "%",
      academicYear: "2025",
      supportingText,
    });

    expect(extract("The graduate employment rate was 94%.", ["outcomes"]).candidates).toEqual([]);
  });

  it("fails closed for ambiguous tuition values and non-official hosts", () => {
    expect(extract(
      "For academic year 2026/27, annual tuition is GBP 20,000 for home students and GBP 35,000 for international students.",
      ["tuition"],
    )).toMatchObject({ candidates: [], completedCategories: [] });

    const currentDocument = document("For academic year 2026/27, annual tuition is GBP 20,000 per year.", {
      canonicalUrl: "https://example.com/fees",
      originalUrl: "https://example.com/fees",
    });
    const segment = segmentResearchDocument(currentDocument)[0];
    if (segment === undefined) throw new Error("fixture segment missing");
    expect(extractDeterministicClosedMetrics({
      segment,
      categories: ["tuition"],
      document: currentDocument,
      target: { universityName: "Example University", officialHost: "example.edu" },
    })).toMatchObject({ candidates: [], completedCategories: [] });
  });

  it("completes closed metric categories without spending structured-provider calls", async () => {
    const currentDocument = document([
      "For academic year 2026/27, the annual tuition fee is GBP 32,500 per year.",
      "Scholarships are available.",
      "Research opportunities are available.",
      "In 2025, the graduate employment rate was 94%.",
    ].join(" "));
    const result = await extractResearchDocuments([currentDocument], {
      categories: ["tuition", "scholarships", "research", "outcomes"],
      target: {
        universityId: "university-example",
        universityName: "Example University",
        officialHost: "example.edu",
      },
    });

    expect(result.completedCategories).toEqual(["tuition", "scholarships", "research", "outcomes"]);
    expect(result.incompleteCategories).toEqual([]);
    expect(result.providerAttempts).toEqual([]);
    expect(result.budget.used).toBe(0);
    expect(result.candidates.map((candidate) => candidate.category)).toEqual([
      "tuition", "scholarships", "research", "outcomes",
    ]);
  });

  it("promotes explicit closed metrics to score-eligible official evidence without reconciliation provider calls", async () => {
    const currentDocument = document([
      "For academic year 2026/27, the annual tuition fee is GBP 32,500 per year.",
      "Scholarships are available.",
      "Research opportunities are available.",
      "In 2025, the graduate employment rate was 94%.",
    ].join(" "));
    const extraction = await extractResearchDocuments([currentDocument], {
      categories: ["tuition", "scholarships", "research", "outcomes"],
      target: {
        universityId: "university-example",
        universityName: "Example University",
        officialHost: "example.edu",
      },
    });
    const reconciliation = await reconcileResearchClaims({
      candidates: extraction.candidates,
      sources: [source()],
      documents: [currentDocument],
      target: {
        universityId: "university-example",
        universityName: "Example University",
        officialHost: "example.edu",
      },
      decisionEligibleCategories: ["tuition", "scholarships", "research", "outcomes"],
    });

    expect(reconciliation.providerAttempts).toEqual([]);
    expect(reconciliation.incompleteCategories).toEqual([]);
    expect(reconciliation.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "tuition", property: "annual tuition", verificationStatus: "verified" }),
      expect.objectContaining({ category: "scholarships", property: "scholarship available", value: true, verificationStatus: "verified" }),
      expect.objectContaining({ category: "research", property: "research opportunity available", value: true, verificationStatus: "university-reported" }),
      expect.objectContaining({ category: "outcomes", property: "employment rate", verificationStatus: "university-reported" }),
    ]));
  });

  it("keeps unresolved categories incomplete when deterministic evidence covers only a subset", async () => {
    const currentDocument = document("Scholarships are available. Tuition details are published separately.");
    const result = await extractResearchDocuments([currentDocument], {
      categories: ["tuition", "scholarships"],
      target: {
        universityId: "university-example",
        universityName: "Example University",
        officialHost: "example.edu",
      },
    });

    expect(result.completedCategories).toEqual(["scholarships"]);
    expect(result.incompleteCategories).toEqual(["tuition"]);
    expect(result.candidates).toEqual([
      expect.objectContaining({ category: "scholarships", property: "scholarship available", value: true }),
    ]);
    expect(result.unfinished).toBe(true);
    expect(result.providerAttempts).toHaveLength(3);
  });
});
