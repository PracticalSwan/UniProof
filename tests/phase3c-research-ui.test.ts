import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ResearchDossier } from "@/components/research/research-dossier";
import { ResearchForm } from "@/components/research/research-form";
import { ResearchRunBanner } from "@/components/research/research-run-banner";
import { researchCatalog } from "@/lib/research/catalog/data";
import { createInitialResearchFormState } from "@/lib/research/mode/client-form";
import {
  researchDossierSchema,
  type ResearchDossier as ResearchDossierData,
} from "@/lib/research/mode/public-contracts";

const mit = researchCatalog.universities.find((item) => item.id === "university-mit")!;
const mitProgram = researchCatalog.programs.find(
  (item) => item.id === "program-mit-artificial-intelligence-decision-making-bs",
)!;

function elementWithId(markup: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<[^>]+id="${escaped}"[^>]*>`));
  expect(match, `missing element #${id}`).not.toBeNull();
  return match![0];
}

function makeDossier(): ResearchDossierData {
  const source = {
    id: "source-1",
    url: "https://example.edu/evidence",
    title: "Evidence page",
    publisher: "Example University",
    sourceType: "university" as const,
    retrievedAt: "2026-08-17T00:00:00.000Z",
  };
  const claim = {
    id: "claim-1",
    category: "admissions" as const,
    property: "Application deadline",
    value: "2027-01-15",
    verificationStatus: "verified" as const,
    representativeSourceId: source.id,
    sourceIds: [source.id],
    supportingText: "The application deadline is 15 January 2027.",
  };

  return researchDossierSchema.parse({
    target: {
      university: {
        id: mit.id,
        name: "Server Canonical University Name",
        countryCode: "US",
        websiteUrl: mit.websiteUrl,
      },
      program: {
        id: mitProgram.id,
        name: "Server Canonical Program Name",
        degreeLevel: mitProgram.degreeLevel,
        subjectArea: mitProgram.subjectArea,
        officialUrl: mitProgram.officialUrl,
      },
    },
    run: {
      id: "run-ui",
      status: "succeeded",
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
      state: "ready",
      claims: [claim],
      explanation: {
        category: "admissions",
        referencedClaimIds: [claim.id],
        summary: "The source supports the claim.",
      },
      hasConflict: false,
      hasOutdated: false,
    }],
    sources: [source],
  });
}

function makePartialDossier(): ResearchDossierData {
  const base = makeDossier();
  return researchDossierSchema.parse({
    ...base,
    run: { ...base.run, status: "partial" },
    summary: {
      ...base.summary,
      unprocessedCategories: ["tuition"],
    },
    categories: [
      ...base.categories,
      {
        category: "tuition",
        state: "incomplete",
        claims: [],
        failure: {
          code: "provider-error",
          message: "Research could not complete this category.",
        },
        hasConflict: false,
        hasOutdated: false,
      },
    ],
  });
}

describe("Phase 3C rendered accessibility and target labeling", () => {
  it("associates target and free-text field errors with the controls users must correct", () => {
    const markup = renderToStaticMarkup(React.createElement(ResearchForm, {
      formState: {
        ...createInitialResearchFormState(),
        question: "Public context that needs correction",
      },
      catalog: researchCatalog,
      disabled: false,
      fieldErrors: {
        universityId: "Select a supported university.",
        question: "Keep the question to 500 characters or fewer.",
      },
      serverErrorCode: null,
      onPatch: vi.fn(),
      onSelectUniversity: vi.fn(),
      onSelectProgram: vi.fn(),
      onClearTarget: vi.fn(),
      onSubmit: vi.fn(),
      onReset: vi.fn(),
    }));

    const search = elementWithId(markup, "research-search");
    expect(search).toContain('aria-invalid="true"');
    expect(search).toContain("research-university-error");
    expect(markup).toContain('id="research-university-error"');

    const question = elementWithId(markup, "research-question");
    expect(question).toContain('aria-invalid="true"');
    expect(question).toContain("research-question-error");
    expect(markup).toContain('id="research-question-error"');
  });

  it("marks only populated free-text controls invalid for a sensitive-input group error", () => {
    const markup = renderToStaticMarkup(React.createElement(ResearchForm, {
      formState: {
        ...createInitialResearchFormState(),
        universityId: mit.id,
        question: "Sensitive-looking submitted text",
        intake: "",
        academicYear: "",
      },
      catalog: researchCatalog,
      disabled: false,
      fieldErrors: {},
      serverErrorCode: "sensitive-input",
      onPatch: vi.fn(),
      onSelectUniversity: vi.fn(),
      onSelectProgram: vi.fn(),
      onClearTarget: vi.fn(),
      onSubmit: vi.fn(),
      onReset: vi.fn(),
    }));

    expect(elementWithId(markup, "research-question")).toContain('aria-invalid="true"');
    expect(elementWithId(markup, "research-intake")).toContain('aria-invalid="false"');
    expect(elementWithId(markup, "research-year")).toContain('aria-invalid="false"');
  });

  it("labels a validated dossier from the server-returned target rather than a stale client snapshot", () => {
    const dossier = makeDossier();
    const markup = renderToStaticMarkup(React.createElement(ResearchRunBanner, {
      dossier,
      submission: {
        request: {
          universityId: mit.id,
          programId: mitProgram.id,
          categories: ["admissions"],
        },
        targetLabel: "Stale Client University • Stale Client Program",
      },
      formMatchesSubmission: true,
      busy: false,
      onRetry: vi.fn(),
      onClear: vi.fn(),
    }));

    expect(markup).toContain("Server Canonical University Name • Server Canonical Program Name");
    expect(markup).not.toContain("Stale Client University • Stale Client Program");
  });

  it("can suppress a prior partial dossier retry when a newer request error owns retry", () => {
    const markup = renderToStaticMarkup(React.createElement(
      ResearchRunBanner,
      {
        dossier: makePartialDossier(),
        submission: {
          request: {
            universityId: mit.id,
            programId: mitProgram.id,
            categories: ["admissions", "tuition"],
          },
          targetLabel: `${mit.name} • ${mitProgram.name}`,
        },
        formMatchesSubmission: true,
        busy: false,
        allowRetry: false,
        onRetry: vi.fn(),
        onClear: vi.fn(),
      },
    ));

    expect(markup).not.toContain("Retry this research");
    expect(markup).toContain("Clear result");
  });

  it("keeps prior dossier evidence navigation available while a refresh is active", () => {
    const dossier = makeDossier();
    const markup = renderToStaticMarkup(React.createElement(ResearchDossier, {
      dossier,
      submission: {
        request: {
          universityId: mit.id,
          programId: mitProgram.id,
          categories: ["admissions"],
        },
        targetLabel: `${mit.name} • ${mitProgram.name}`,
      },
      formMatchesSubmission: true,
      busy: true,
      updating: true,
      allowRetry: true,
      selectedClaimId: null,
      claimTrigger: null,
      onSelectClaim: vi.fn(),
      onClearClaim: vi.fn(),
      onRetry: vi.fn(),
      onClear: vi.fn(),
    }));

    const evidenceButton = markup.match(/<button[^>]*aria-label="View evidence for Application deadline"[^>]*>/)?.[0];
    expect(evidenceButton).toBeDefined();
    expect(evidenceButton).not.toContain("disabled");
  });
});
