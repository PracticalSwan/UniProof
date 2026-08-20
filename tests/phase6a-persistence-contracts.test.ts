import { afterEach, describe, expect, it, vi } from "vitest";

import { comparisonSubmissionSchema, freezeComparisonSubmission, type ComparisonPriorityWeights } from "@/lib/comparison/contracts";
import { scoreComparison } from "@/lib/comparison/scoring";
import { buildComparisonTradeoffs } from "@/lib/comparison/tradeoffs";
import { finalizeGuideResult } from "@/lib/guide/client-state";
import type { GuideApplicantProfile, GuideSubmission } from "@/lib/guide/contracts";
import { researchCatalog } from "@/lib/research/catalog/data";
import {
  parseSavedArtifact,
  savedArtifactMetadataSchema,
  savedArtifactSaveRequestSchema,
  serializedUtf8Bytes,
  validateSavedArtifact,
} from "@/lib/persistence/contracts";
import { deleteSavedArtifact, saveSavedArtifact } from "@/lib/persistence/client";
import type { ResearchModeRequest } from "@/lib/research/mode/public-contracts";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";
import { makeComparisonDossier } from "@/tests/fixtures/comparison-dossiers";
import {
  guideCatalogTarget,
  persistenceComparisonTargets,
  requireCatalogProgram,
  requireCatalogUniversity,
} from "@/tests/helpers/catalog-targets";

const { university, program } = guideCatalogTarget;
const differentUniversity = requireCatalogUniversity("university-edinburgh");

const profile: GuideApplicantProfile = {
  citizenship: "Malaysia",
  currentCountry: "Thailand",
  qualification: {
    level: "bachelor",
    title: "BSc Computer Science",
    subject: "Computer Science",
  },
  englishTest: { kind: "not-provided" },
  scholarshipNeed: false,
};

const guideSubmission: GuideSubmission = {
  target: { universityId: university.id, programId: program.id },
  publicContext: {},
  profile,
  assessmentDate: "2026-08-18",
};

const guideRequest: ResearchModeRequest = {
  universityId: university.id,
  programId: program.id,
  categories: ["admissions", "tuition", "scholarships"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function guideResult() {
  const dossier = buildGuideDossier({
    universityId: university.id,
    programId: program.id,
    universityWebsiteUrl: "https://attacker.example/university",
    programOfficialUrl: "https://attacker.example/program",
    admissionsClaims: [
      makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" }),
      makeClaim({ id: "gpa-2", property: "GPA requirement", value: 3.0, unit: "4.00" }),
    ],
  });
  const result = finalizeGuideResult(guideSubmission, guideRequest, dossier, researchCatalog);
  if (!result.ok) throw new Error("guide fixture failed finalization");
  return result.result;
}

function comparisonResult(weights: ComparisonPriorityWeights = { affordability: 30, research: 30, scholarships: 20, outcomes: 20, support: 0 }) {
  const targetA = {
    universityId: persistenceComparisonTargets[0].university.id,
    programId: persistenceComparisonTargets[0].program.id,
  };
  const targetB = {
    universityId: persistenceComparisonTargets[1].university.id,
    programId: persistenceComparisonTargets[1].program.id,
  };
  const submission = freezeComparisonSubmission(comparisonSubmissionSchema.parse({
    targets: [targetA, targetB],
    categories: ["tuition", "scholarships", "research", "outcomes", "support"],
    weights,
    showRankingEvidence: false,
    showAnecdotalEvidence: false,
  }));
  const dossierA = makeComparisonDossier({
    ...targetA,
    categories: submission.categories,
    claims: [
      { id: "same-id", category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
    ],
  });
  const dossierB = makeComparisonDossier({
    ...targetB,
    categories: submission.categories,
    claims: [
      { id: "same-id", category: "tuition", property: "annual tuition", value: 20_000, currency: "USD", academicYear: "2027-28" },
    ],
  });
  const score = scoreComparison(submission, [dossierA, dossierB]);
  return {
    submission,
    status: "complete" as const,
    outcomes: [
      { target: targetA, state: "dossier" as const, dossier: dossierA },
      { target: targetB, state: "dossier" as const, dossier: dossierB },
    ],
    score,
    tradeoffs: buildComparisonTradeoffs(score, [dossierA, dossierB], submission),
  };
}

describe("saved artifact request contract", () => {
  it("accepts only the exact version-1 shape", () => {
    expect(savedArtifactSaveRequestSchema.safeParse({
      kind: "profile",
      schemaVersion: 1,
      payload: profile,
    }).success).toBe(true);
  });

  it.each([
    ["ownerId", { ownerId: university.id }],
    ["email", { email: "invented@example.com" }],
    ["free-form title", { title: "User title" }],
    ["target URL", { targetUrl: "https://attacker.example" }],
  ])("rejects caller-supplied %s", (_label, extra) => {
    expect(savedArtifactSaveRequestSchema.safeParse({
      kind: "profile",
      schemaVersion: 1,
      payload: profile,
      ...extra,
    }).success).toBe(false);
  });

  it("rejects unknown kinds, versions, and payload mismatches", () => {
    expect(savedArtifactSaveRequestSchema.safeParse({
      kind: "unknown", schemaVersion: 1, payload: profile,
    }).success).toBe(false);
    expect(savedArtifactSaveRequestSchema.safeParse({
      kind: "profile", schemaVersion: 2, payload: profile,
    }).success).toBe(false);
    expect(savedArtifactSaveRequestSchema.safeParse({
      kind: "research", schemaVersion: 1, payload: profile,
    }).success).toBe(false);
  });

  it("preserves the exact public Research request needed for explicit refresh", () => {
    const dossier = guideResult().dossier;
    const request: ResearchModeRequest = {
      universityId: university.id,
      programId: program.id,
      categories: ["admissions", "tuition", "scholarships"],
      question: "Public admissions requirements",
      intake: "Fall 2027",
      academicYear: "2027-28",
    };
    const parsed = savedArtifactSaveRequestSchema.parse({
      kind: "research",
      schemaVersion: 1,
      payload: { request, dossier },
    });
    expect(parsed.kind).toBe("research");
    if (parsed.kind !== "research") throw new Error("expected research artifact");
    expect(parsed.payload.request).toEqual(request);
  });

  it("accepts PostgREST timestamptz offsets in saved metadata", () => {
    expect(savedArtifactMetadataSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      kind: "profile",
      schemaVersion: 1,
      title: "Applicant profile",
      createdAt: "2026-08-19T09:00:00.123456+00:00",
    }).success).toBe(true);
  });

  it("measures UTF-8 bytes rather than JavaScript character count", () => {
    expect(serializedUtf8Bytes("a")).toBe(1);
    expect(serializedUtf8Bytes("é")).toBe(2);
    expect(serializedUtf8Bytes("ป")).toBe(3);
  });
});

describe("saved artifact mutation outcome ownership", () => {
  it("treats Save and Delete 5xx responses as ambiguous and never retries automatically", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "persistence-unavailable",
        message: "Private saved snapshots are temporarily unavailable.",
      }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "persistence-unavailable",
        message: "Private saved snapshots are temporarily unavailable.",
      }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveSavedArtifact({ kind: "profile", schemaVersion: 1, payload: profile });
    const deleted = await deleteSavedArtifact("00000000-0000-4000-8000-000000000001");

    expect(saved).toMatchObject({ ok: false, ambiguousMutation: true });
    expect(deleted).toMatchObject({ ok: false, ambiguousMutation: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps semantic Save and Delete 4xx responses definitive", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "snapshot-capacity-reached",
        message: "Delete an older saved snapshot before saving another one.",
      }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "snapshot-not-found",
        message: "The requested saved snapshot was not found.",
      }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveSavedArtifact({ kind: "profile", schemaVersion: 1, payload: profile });
    const deleted = await deleteSavedArtifact("00000000-0000-4000-8000-000000000001");

    expect(saved).toMatchObject({ ok: false, error: { error: "snapshot-capacity-reached" } });
    expect(saved).not.toHaveProperty("ambiguousMutation");
    expect(deleted).toMatchObject({ ok: false, error: { error: "snapshot-not-found" } });
    expect(deleted).not.toHaveProperty("ambiguousMutation");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("saved artifact runtime validation", () => {
  it("rejects a Research request that does not bind to the stored dossier target/categories", () => {
    const dossier = guideResult().dossier;
    const wrongTarget = validateSavedArtifact({
      kind: "research",
      schemaVersion: 1,
      payload: {
        request: { ...guideRequest, universityId: differentUniversity.id },
        dossier,
      },
    }, researchCatalog);
    expect(wrongTarget).toMatchObject({ ok: false, code: "snapshot-invalid" });

    const wrongCategories = validateSavedArtifact({
      kind: "research",
      schemaVersion: 1,
      payload: {
        request: { ...guideRequest, categories: ["admissions", "tuition"] },
        dossier,
      },
    }, researchCatalog);
    expect(wrongCategories).toMatchObject({ ok: false, code: "snapshot-invalid" });
  });

  it("rebinds application-owned URLs, preserves evidence, and derives the title", () => {
    const result = guideResult();
    const validation = validateSavedArtifact({
      kind: "guide",
      schemaVersion: 1,
      payload: result,
    }, researchCatalog);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.artifact.kind).toBe("guide");
    if (validation.artifact.kind !== "guide") throw new Error("expected guide artifact");
    expect(validation.boundArtifact.kind).toBe("guide");
    expect(validation.title).toBe(`${program.name} — ${university.name}`.slice(0, 120));
    if (validation.boundArtifact.kind !== "guide") throw new Error("expected guide artifact");
    expect(validation.boundArtifact.payload.dossier.target.university.websiteUrl).toBe(university.websiteUrl);
    expect(validation.boundArtifact.payload.dossier.target.program?.officialUrl).toBe(program.officialUrl);
    expect(validation.boundArtifact.payload.dossier.sources).toEqual(result.dossier.sources);
    expect(validation.artifact.payload.assessments[0]?.evidenceRefs).toHaveLength(2);
  });

  it("rejects a Guide snapshot whose derived assessment was tampered independently of its evidence", () => {
    const result = guideResult();
    const tampered = structuredClone(result);
    (tampered.assessments[0]! as { detail: string }).detail = "Forged historical assessment detail.";

    expect(validateSavedArtifact({
      kind: "guide",
      schemaVersion: 1,
      payload: tampered,
    }, researchCatalog)).toMatchObject({ ok: false, code: "snapshot-invalid" });
  });

  it("validates and rebinds a new-country version-1 Research snapshot", () => {
    const delft = requireCatalogUniversity("university-tu-delft");
    const delftProgram = requireCatalogProgram("program-tu-delft-computer-science-msc");
    const dossier = buildGuideDossier({
      universityId: delft.id,
      programId: delftProgram.id,
      universityName: delft.name,
      programName: delftProgram.name,
      universityWebsiteUrl: "https://stored.example/university",
      programOfficialUrl: "https://stored.example/program",
    });
    dossier.target.university.countryCode = delft.countryCode;
    dossier.target.program!.degreeLevel = delftProgram.degreeLevel;
    dossier.target.program!.subjectArea = delftProgram.subjectArea;

    const validation = validateSavedArtifact({
      kind: "research",
      schemaVersion: 1,
      payload: {
        request: {
          universityId: delft.id,
          programId: delftProgram.id,
          categories: ["admissions", "tuition", "scholarships"],
        },
        dossier,
      },
    }, researchCatalog);

    expect(validation.ok).toBe(true);
    if (
      !validation.ok ||
      validation.artifact.kind !== "research" ||
      validation.boundArtifact.kind !== "research"
    ) return;
    expect(validation.boundArtifact.payload.dossier.target.university.countryCode).toBe("NL");
    expect(validation.boundArtifact.payload.dossier.target.university.websiteUrl).toBe(delft.websiteUrl);
    expect(validation.boundArtifact.payload.dossier.target.program?.officialUrl).toBe(delftProgram.officialUrl);
    expect(validation.artifact.payload.dossier.target.university.websiteUrl).toBe("https://stored.example/university");
  });

  it("rejects a removed catalog target without using stored official URLs", () => {
    const result = guideResult();
    result.dossier.target.university.id = "removed-university";
    const validation = validateSavedArtifact({
      kind: "guide",
      schemaVersion: 1,
      payload: result,
    }, researchCatalog);

    expect(validation).toMatchObject({ ok: false, code: "snapshot-target-unavailable" });
  });

  it("preserves target-scoped refs when two dossiers reuse one claim ID", () => {
    const result = comparisonResult();
    const validation = validateSavedArtifact({
      kind: "comparison",
      schemaVersion: 1,
      payload: result,
    }, researchCatalog);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    if (validation.artifact.kind !== "comparison") throw new Error("expected comparison artifact");
    if (validation.boundArtifact.kind !== "comparison") throw new Error("expected comparison artifact");
    const refs = validation.artifact.payload.tradeoffs.flatMap((item) => item.evidenceRefs);
    expect(refs).toContainEqual({ targetKey: `${result.outcomes[0]!.target.universityId}::${result.outcomes[0]!.target.programId}`, claimId: "same-id" });
    expect(refs).toContainEqual({ targetKey: `${result.outcomes[1]!.target.universityId}::${result.outcomes[1]!.target.programId}`, claimId: "same-id" });
  });

  it("keeps version-1 Comparison snapshots compatible with legacy total-100 and new relative raw weights", () => {
    const cases: ComparisonPriorityWeights[] = [
      { affordability: 30, research: 30, scholarships: 20, outcomes: 20, support: 0 },
      { affordability: 100, research: 50, scholarships: 50, outcomes: 0, support: 0 },
    ];

    for (const weights of cases) {
      const result = comparisonResult(weights);
      const validation = validateSavedArtifact({
        kind: "comparison",
        schemaVersion: 1,
        payload: result,
      }, researchCatalog);
      expect(validation.ok).toBe(true);
      if (!validation.ok || validation.artifact.kind !== "comparison") continue;
      expect(validation.artifact.payload.submission.weights).toEqual(weights);
    }
  });

  it("rejects a Comparison snapshot whose derived score was tampered independently of its evidence", () => {
    const result = comparisonResult();
    const tampered = structuredClone(result);
    const scored = Object.values(tampered.score.targets[0]!.dimensions).find((dimension) => dimension.state === "scored");
    if (scored === undefined || scored.state !== "scored") throw new Error("expected a scored fixture dimension");
    (scored as { score: number }).score = scored.score === 0 ? 1 : 0;

    expect(validateSavedArtifact({
      kind: "comparison",
      schemaVersion: 1,
      payload: tampered,
    }, researchCatalog)).toMatchObject({ ok: false, code: "snapshot-invalid" });
  });

  it("accepts only a deployment-stopped sequential Comparison outcome prefix", () => {
    const base = comparisonResult();
    const extraPrograms = [
      requireCatalogProgram("program-ucl-computer-science-bsc"),
      requireCatalogProgram("program-imperial-computing-beng"),
    ];
    const extraTargets = extraPrograms.map((item) => ({
      universityId: item.universityId,
      programId: item.id,
    }));
    const submission = freezeComparisonSubmission(comparisonSubmissionSchema.parse({
      ...base.submission,
      targets: [...base.submission.targets, ...extraTargets],
    }));
    const dossiers = base.outcomes.flatMap((outcome) => outcome.state === "dossier" ? [outcome.dossier] : []);
    const outcomes = [
      ...base.outcomes,
      {
        target: extraTargets[0]!,
        state: "transport-error" as const,
        error: {
          code: "deployment-rate-limit" as const,
          message: "The deployment is temporarily limiting research requests. Try again explicitly in a moment.",
        },
      },
    ];
    const score = scoreComparison(submission, dossiers);
    const payload = {
      submission,
      status: "partial" as const,
      outcomes,
      score,
      tradeoffs: buildComparisonTradeoffs(score, dossiers, submission),
    };

    expect(validateSavedArtifact({
      kind: "comparison",
      schemaVersion: 1,
      payload,
    }, researchCatalog)).toMatchObject({ ok: true });

    expect(validateSavedArtifact({
      kind: "comparison",
      schemaVersion: 1,
      payload: { ...payload, outcomes: base.outcomes },
    }, researchCatalog)).toMatchObject({ ok: false, code: "snapshot-invalid" });
  });

  it("rejects reordered comparison outcomes as internally invalid", () => {
    const result = comparisonResult();
    const tampered = {
      ...result,
      outcomes: [...result.outcomes].reverse(),
    };
    const validation = validateSavedArtifact({
      kind: "comparison",
      schemaVersion: 1,
      payload: tampered,
    }, researchCatalog);

    expect(validation).toMatchObject({ ok: false, code: "snapshot-invalid" });
  });

  it("fails closed for unsupported saved versions", () => {
    const parsed = parseSavedArtifact({
      kind: "profile",
      schemaVersion: 2,
      payload: profile,
    });
    expect(parsed).toMatchObject({ ok: false, code: "snapshot-unsupported-version" });
  });
});
