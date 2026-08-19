import { describe, expect, it } from "vitest";

import {
  getAllGuideRequirementDefinitions,
  lookupGuideGpaScale,
  lookupGuideRequirement,
  lookupGuideSubjectFamily,
  normalizeGuidePropertyKey,
} from "@/lib/guide/requirement-registry";

describe("normalizeGuidePropertyKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeGuidePropertyKey("  Minimum GPA  ")).toBe("minimum gpa");
  });

  it("replaces separators with space", () => {
    expect(normalizeGuidePropertyKey("minimum_gpa")).toBe("minimum gpa");
    expect(normalizeGuidePropertyKey("minimum-gpa")).toBe("minimum gpa");
    expect(normalizeGuidePropertyKey("minimum:gpa")).toBe("minimum gpa");
  });

  it("collapses whitespace", () => {
    expect(normalizeGuidePropertyKey("minimum    gpa")).toBe("minimum gpa");
  });

  it("does not collapse non-ASCII whitespace into a reviewed alias", () => {
    expect(normalizeGuidePropertyKey("minimum\u00a0gpa")).toBe("minimum\u00a0gpa");
    expect(lookupGuideRequirement("minimum\u00a0gpa", "admissions")).toBeUndefined();
  });
});

describe("closed value/unit aliases", () => {
  it.each(["Computer Engineering", "Information Technology", "Information Systems"])(
    "maps planned computing-family alias %s exactly",
    (subject) => {
      expect(lookupGuideSubjectFamily(subject)).toBe("computing");
    },
  );

  it.each(["5", "5.0", "5.00", "5.0 scale"])("supports planned 5-point GPA scale alias %s", (unit) => {
    expect(lookupGuideGpaScale(unit)).toBe(5);
  });
});

describe("closed requirement registry", () => {
  it("every alias maps to exactly one semantic", () => {
    const seen = new Map<string, string>();
    for (const definition of getAllGuideRequirementDefinitions()) {
      expect(definition.aliases.length).toBeGreaterThan(0);
      expect(definition.cardinality).toBeDefined();
      for (const alias of definition.aliases) {
        const key = normalizeGuidePropertyKey(alias);
        expect(seen.has(key)).toBe(false);
        seen.set(key, definition.semantic);
      }
    }
    expect(seen.size).toBeGreaterThan(40);
  });

  it("maps exact alias to correct semantic", () => {
    expect(lookupGuideRequirement("minimum gpa", "admissions")?.semantic).toBe("minimum-gpa");
    expect(lookupGuideRequirement("Minimum_GPA", "admissions")?.semantic).toBe("minimum-gpa");
    expect(lookupGuideRequirement("annual tuition", "tuition")?.semantic).toBe("annual-tuition");
  });

  it("does not fuzzy match", () => {
    expect(lookupGuideRequirement("minimum GPAs", "admissions")).toBeUndefined();
    expect(lookupGuideRequirement("estimated IELTS requirement", "admissions")).toBeUndefined();
    expect(lookupGuideRequirement("tuition", "tuition")).toBeUndefined();
    expect(lookupGuideRequirement("international tuition", "tuition")).toBeUndefined();
    expect(lookupGuideRequirement("requirement", "admissions")).toBeUndefined();
    expect(lookupGuideRequirement("scholarship tuition", "scholarships")).toBeUndefined();
  });

  it("rejects wrong category", () => {
    expect(lookupGuideRequirement("minimum gpa", "tuition")).toBeUndefined();
  });

  it("required-document is collection", () => {
    expect(lookupGuideRequirement("required document", "admissions")?.cardinality).toBe("collection");
  });

  it("all thresholds are singleton", () => {
    const singletonSemantics = [
      "minimum-gpa", "ielts-overall-minimum", "ielts-component-minimum",
      "toefl-ibt-overall-minimum", "toefl-ibt-component-minimum",
      "pte-academic-overall-minimum", "application-deadline", "application-fee",
      "annual-tuition", "total-tuition", "scholarship-availability", "scholarship-deadline",
      "minimum-qualification-level", "required-subject-background",
    ];
    for (const semantic of singletonSemantics) {
      const def = getAllGuideRequirementDefinitions().find((d) => d.semantic === semantic);
      expect(def?.cardinality).toBe("singleton");
    }
  });
});
