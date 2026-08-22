import { describe, expect, it } from "vitest";

import {
  comparisonPriorityOrder,
  comparisonPriorityWeightsSchema,
  comparisonSubmissionSchema,
  comparisonTargetKey,
  normalizeComparisonPriorityWeights,
} from "@/lib/comparison/contracts";
import {
  createInitialComparisonFormState,
  setComparisonPriorityWeight,
  searchComparisonCatalog,
  validateComparisonForm,
  type ComparisonFormState,
} from "@/lib/comparison/client-form";
import { researchCatalog } from "@/lib/research/catalog/data";

const bachelorA = { universityId: "university-mit", programId: "program-mit-artificial-intelligence-decision-making-bs" };
const bachelorB = { universityId: "university-mit", programId: "program-mit-computer-science-engineering-bs" };
const bachelorC = { universityId: "university-stanford", programId: "program-stanford-computer-science-bs" };
const masterA = { universityId: "university-edinburgh", programId: "program-edinburgh-artificial-intelligence-msc" };
const universityA = { universityId: "university-mit" };
const universityB = { universityId: "university-stanford" };

function form(overrides: Partial<ComparisonFormState> = {}): ComparisonFormState {
  return { ...createInitialComparisonFormState(), targets: [bachelorA, bachelorC], ...overrides };
}

describe("Phase 4 comparison contracts", () => {
  it("defaults Research work to positive-weight scoring categories and adds a backing category when its weight becomes positive", () => {
    const initial = createInitialComparisonFormState();
    expect(initial.categories).toEqual(["tuition", "scholarships", "research", "outcomes"]);
    expect(initial.categories).not.toContain("admissions");
    expect(initial.categories).not.toContain("program-structure");
    expect(initial.categories).not.toContain("support");

    const withSupport = setComparisonPriorityWeight(initial, "support", "25");
    expect(withSupport.weights.support).toBe("25");
    expect(withSupport.categories).toEqual(["tuition", "scholarships", "research", "outcomes", "support"]);

    const backToZero = setComparisonPriorityWeight(withSupport, "support", "0");
    expect(backToZero.categories).toContain("support");
  });

  it("accepts exactly 2, 3, or 4 unique homogeneous targets", () => {
    for (const targets of [
      [universityA, universityB],
      [bachelorA, bachelorB, bachelorC],
      [bachelorA, bachelorB, bachelorC, { universityId: "university-georgia-tech", programId: "program-georgia-tech-computer-science-bs" }],
    ]) {
      expect(validateComparisonForm(form({ targets }), researchCatalog).submission).toBeDefined();
    }
  });

  it("rejects 0, 1, or 5 targets and exact duplicate target keys", () => {
    for (const targets of [
      [],
      [universityA],
      [bachelorA, bachelorB, bachelorC, { universityId: "university-georgia-tech", programId: "program-georgia-tech-computer-science-bs" }, { universityId: "university-berkeley", programId: "program-berkeley-computer-science-ba" }],
      [universityA, universityA],
      [bachelorA, bachelorA],
    ]) {
      expect(validateComparisonForm(form({ targets }), researchCatalog).fieldErrors.targets).toBeDefined();
    }
    expect(comparisonTargetKey(bachelorA)).not.toBe(comparisonTargetKey(bachelorB));
  });

  it("fails closed for unknown IDs, ownership mismatch, mixed scope, and mixed degree", () => {
    const invalidSets = [
      [{ universityId: "missing" }, universityB],
      [{ universityId: "university-mit", programId: "missing" }, bachelorC],
      [{ universityId: "university-stanford", programId: bachelorA.programId }, bachelorC],
      [universityA, bachelorC],
      [bachelorA, masterA],
    ];
    for (const targets of invalidSets) {
      expect(validateComparisonForm(form({ targets }), researchCatalog).fieldErrors.targets).toBeDefined();
    }
  });

  it("keeps selected target validation independent from current search/filter visibility", () => {
    const state = form({
      search: "Chulalongkorn",
      countryCode: "TH",
      degreeLevel: "master",
    });
    const results = searchComparisonCatalog(state, researchCatalog);
    expect(results.programs.some((program) => program.id === bachelorA.programId)).toBe(false);
    expect(validateComparisonForm(state, researchCatalog).submission?.targets).toEqual([bachelorA, bachelorC]);
  });

  it("accepts five bounded integer relative weights with any positive total", () => {
    const valid = validateComparisonForm(form(), researchCatalog);
    expect(valid.submission?.weights).toEqual({
      affordability: 30,
      research: 30,
      scholarships: 20,
      outcomes: 20,
      support: 0,
    });
    expect(Object.keys(valid.submission?.weights ?? {})).toEqual([...comparisonPriorityOrder]);

    for (const weights of [
      { affordability: "100", research: "100", scholarships: "100", outcomes: "100", support: "100" },
      { affordability: "100", research: "50", scholarships: "50", outcomes: "0", support: "0" },
      { affordability: "1", research: "0", scholarships: "0", outcomes: "0", support: "0" },
    ]) {
      expect(validateComparisonForm(form({
        categories: ["tuition", "scholarships", "research", "outcomes", "support"],
        weights,
      }), researchCatalog).submission?.weights).toEqual(
        Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value)])),
      );
    }
  });

  it("rejects an all-zero relative-weight vector and malformed or non-finite weights", () => {
    expect(validateComparisonForm(form({
      weights: { affordability: "0", research: "0", scholarships: "0", outcomes: "0", support: "0" },
    }), researchCatalog).fieldErrors.weights).toMatch(/at least one/i);

    for (const weights of [
      { affordability: "-1", research: "61", scholarships: "20", outcomes: "20", support: "0" },
      { affordability: "30.5", research: "29.5", scholarships: "20", outcomes: "20", support: "0" },
      { affordability: "NaN", research: "60", scholarships: "20", outcomes: "20", support: "0" },
      { affordability: "Infinity", research: "30", scholarships: "20", outcomes: "20", support: "-Infinity" },
      { affordability: "101", research: "0", scholarships: "0", outcomes: "0", support: "-1" },
    ]) {
      expect(validateComparisonForm(form({ weights }), researchCatalog).fieldErrors.weights).toBeDefined();
    }

    for (const affordability of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 101, 1.5]) {
      expect(comparisonPriorityWeightsSchema.safeParse({
        affordability,
        research: 30,
        scholarships: 20,
        outcomes: 20,
        support: 0,
      }).success).toBe(false);
    }
  });

  it("normalizes relative weights deterministically without mutating raw values", () => {
    const equalRaw = { affordability: 100, research: 100, scholarships: 100, outcomes: 100, support: 100 };
    expect(normalizeComparisonPriorityWeights(equalRaw)).toEqual({
      affordability: 0.2,
      research: 0.2,
      scholarships: 0.2,
      outcomes: 0.2,
      support: 0.2,
    });
    expect(equalRaw).toEqual({ affordability: 100, research: 100, scholarships: 100, outcomes: 100, support: 100 });

    expect(normalizeComparisonPriorityWeights({
      affordability: 100,
      research: 50,
      scholarships: 50,
      outcomes: 0,
      support: 0,
    })).toEqual({
      affordability: 0.5,
      research: 0.25,
      scholarships: 0.25,
      outcomes: 0,
      support: 0,
    });

    expect(() => normalizeComparisonPriorityWeights({
      affordability: 0,
      research: 0,
      scholarships: 0,
      outcomes: 0,
      support: 0,
    })).toThrow(/positive/i);
  });

  it("requires each positive-weight dimension's backing category but permits category exclusion at weight zero", () => {
    const backing = {
      affordability: "tuition",
      research: "research",
      scholarships: "scholarships",
      outcomes: "outcomes",
      support: "support",
    } as const;
    for (const priority of comparisonPriorityOrder) {
      const categories = createInitialComparisonFormState().categories.filter((category) => category !== backing[priority]);
      const weights = { affordability: "0", research: "0", scholarships: "0", outcomes: "0", support: "0", [priority]: "100" };
      expect(validateComparisonForm(form({ categories, weights }), researchCatalog).fieldErrors.categories).toBeDefined();
      expect(validateComparisonForm(form({ categories, weights: { ...weights, [priority]: "0", affordability: "100" } }), researchCatalog).fieldErrors.categories === undefined || priority === "affordability").toBe(true);
    }
  });

  it("keeps ComparisonSubmission strict and excludes private/provider/scoring implementation input", () => {
    const result = validateComparisonForm(form({ intake: "  Fall 2027 ", academicYear: " 2027-28 " }), researchCatalog);
    expect(result.submission).toMatchObject({ intake: "Fall 2027", academicYear: "2027-28" });
    const submission = result.submission!;
    for (const forbidden of ["question", "gpa", "citizenship", "budget", "email", "document", "provider", "model", "url", "applicantProfile"]) {
      expect(comparisonSubmissionSchema.safeParse({ ...submission, [forbidden]: "private" }).success).toBe(false);
    }
    expect(Object.keys(submission).sort()).toEqual([
      "academicYear",
      "categories",
      "intake",
      "showAnecdotalEvidence",
      "showRankingEvidence",
      "targets",
      "weights",
    ].sort());
  });
});
