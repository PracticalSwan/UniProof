import { expect, it } from "vitest";

import { researchDocumentSchema } from "@/lib/research/contracts";
import { extractResearchDocuments } from "@/lib/research/extraction/orchestrator";

it("routes a single-category document to relevant segments instead of dispatching the entire page", async () => {
  const currentDocument = researchDocumentSchema.parse({
    id: "document-routing",
    sourceId: "source-routing",
    originalUrl: "https://example.edu/admissions",
    canonicalUrl: "https://example.edu/admissions",
    title: "Admissions",
    publisher: "Example University",
    sourceType: "university",
    retrievedAt: "2026-08-23T00:00:00.000Z",
    contentType: "text/plain",
    normalizedText: "Admissions requirements include prior study.\n\nCampus history and news.\n\nAlumni events and athletics.",
    sections: [
      { heading: "Admissions requirements", text: "Admissions requirements include prior study." },
      { heading: "Campus history", text: "Campus history and news." },
      { heading: "Alumni", text: "Alumni events and athletics." },
    ],
    contentHash: "b".repeat(64),
  });
  const dispatched: Array<{ heading?: string; categories: readonly string[] }> = [];

  const result = await extractResearchDocuments([currentDocument], {
    categories: ["admissions"],
    categoriesByDocumentId: { [currentDocument.id]: ["admissions"] },
    target: { universityName: "Example University" },
    runTask: async (currentTask) => {
      dispatched.push({ heading: currentTask.segment.heading, categories: currentTask.categories });
      return { payload: { claims: [] }, provider: "groq", attempts: [] };
    },
  });

  expect(dispatched).toEqual([{ heading: "Admissions requirements", categories: ["admissions"] }]);
  expect(result.completedCategories).toEqual(["admissions"]);
});
