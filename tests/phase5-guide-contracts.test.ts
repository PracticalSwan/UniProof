import { describe, expect, it } from "vitest";

import {
  guideApplicantProfileSchema,
  guideSubmissionSchema,
  formatLocalAssessmentDate,
  type GuideApplicantProfile,
} from "@/lib/guide/contracts";
import {
  buildGuideResearchRequest,
  createDefaultGuideDraft,
  validateGuideDraft,
  validateGuideProfileDraft,
} from "@/lib/guide/client-form";
import { researchCatalog } from "@/lib/research/catalog/data";

const validProfile: GuideApplicantProfile = {
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

const validSubmission = {
  target: { universityId: "example-uni", programId: "example-program" },
  publicContext: {},
  profile: validProfile,
  assessmentDate: "2026-08-18",
};

describe("guide applicant profile schema", () => {
  it("accepts a valid minimal profile", () => {
    const result = guideApplicantProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("rejects unknown top-level keys", () => {
    const result = guideApplicantProfileSchema.safeParse({ ...validProfile, name: "Jane" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown qualification keys", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, extra: "field" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank citizenship", () => {
    const result = guideApplicantProfileSchema.safeParse({ ...validProfile, citizenship: " " });
    expect(result.success).toBe(false);
  });

  it("rejects over-length title", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, title: "a".repeat(161) },
    });
    expect(result.success).toBe(false);
  });
});

describe("guide GPA schema", () => {
  it("accepts valid GPA with both value and scale", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, gpa: { value: 3.5, scale: 4 } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects value greater than scale", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, gpa: { value: 4.5, scale: 4 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero scale", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, gpa: { value: 3, scale: 0 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, gpa: { value: NaN, scale: 4 } },
    }).success).toBe(false);
    expect(guideApplicantProfileSchema.safeParse({
      ...validProfile,
      qualification: { ...validProfile.qualification, gpa: { value: Infinity, scale: 4 } },
    }).success).toBe(false);
  });
});

describe("guide English test schema", () => {
  it("accepts valid IELTS overall 6.5", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      englishTest: { kind: "ielts", overall: 6.5 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects IELTS 6.3 (non 0.5 increment)", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      englishTest: { kind: "ielts", overall: 6.3 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid TOEFL iBT", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      englishTest: { kind: "toefl-ibt", overall: 90, components: { listening: 22, reading: 22, writing: 22, speaking: 22 } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects TOEFL decimal", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      englishTest: { kind: "toefl-ibt", overall: 90.5 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid PTE integer", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      englishTest: { kind: "pte-academic", overall: 65 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects PTE decimal", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      englishTest: { kind: "pte-academic", overall: 65.5 },
    });
    expect(result.success).toBe(false);
  });
});

describe("guide budget schema", () => {
  it("accepts valid budget", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      budget: { amount: 50000, currency: "usd", scope: "annual" },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budget?.currency).toBe("USD");
  });

  it("rejects two-letter currency", () => {
    const result = guideApplicantProfileSchema.safeParse({
      ...validProfile,
      budget: { amount: 50000, currency: "US", scope: "annual" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    expect(guideApplicantProfileSchema.safeParse({
      ...validProfile,
      budget: { amount: 0, currency: "USD", scope: "annual" },
    }).success).toBe(false);
    expect(guideApplicantProfileSchema.safeParse({
      ...validProfile,
      budget: { amount: -100, currency: "USD", scope: "annual" },
    }).success).toBe(false);
  });
});

describe("guide submission schema", () => {
  it("accepts a valid submission", () => {
    const result = guideSubmissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it("rejects missing programId", () => {
    const result = guideSubmissionSchema.safeParse({
      ...validSubmission,
      target: { universityId: "example-uni" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid assessment date", () => {
    const result = guideSubmissionSchema.safeParse({
      ...validSubmission,
      assessmentDate: "2027-02-29",
    });
    expect(result.success).toBe(false);
  });
});

describe("guide research request derivation", () => {
  it("derives only public fields", () => {
    const parsed = guideSubmissionSchema.parse({
      ...validSubmission,
      profile: {
        ...validProfile,
        citizenship: "UNIQUE-CITIZENSHIP-MARKER",
        currentCountry: "UNIQUE-COUNTRY-MARKER",
        qualification: {
          level: "bachelor",
          title: "UNIQUE-TITLE-MARKER",
          subject: "UNIQUE-SUBJECT-MARKER",
          gpa: { value: 3.9, scale: 4 },
        },
        englishTest: { kind: "ielts", overall: 7 },
        budget: { amount: 123456, currency: "USD", scope: "annual" },
        scholarshipNeed: true,
      },
    });
    const request = buildGuideResearchRequest(parsed);
    const serialized = JSON.stringify(request);

    expect(serialized).not.toContain("citizenship");
    expect(serialized).not.toContain("currentCountry");
    expect(serialized).not.toContain("qualification");
    expect(serialized).not.toContain("englishTest");
    expect(serialized).not.toContain("budget");
    expect(serialized).not.toContain("scholarshipNeed");
    expect(serialized).not.toContain("UNIQUE-CITIZENSHIP-MARKER");
    expect(serialized).not.toContain("UNIQUE-COUNTRY-MARKER");
    expect(serialized).not.toContain("UNIQUE-TITLE-MARKER");
    expect(serialized).not.toContain("UNIQUE-SUBJECT-MARKER");
    expect(serialized).not.toContain("3.9");
    expect(serialized).not.toContain("123456");

    expect(request.universityId).toBe("example-uni");
    expect(request.programId).toBe("example-program");
    expect(request.categories).toEqual(["admissions", "tuition", "scholarships"]);
    expect("question" in request).toBe(false);
  });
});

describe("formatLocalAssessmentDate", () => {
  it("uses local civil date components", () => {
    const date = new Date(2026, 7, 18, 23, 30, 0);
    expect(formatLocalAssessmentDate(date)).toBe("2026-08-18");
  });
});

describe("guide draft validation", () => {
  function validDraft() {
    const university = researchCatalog.universities[0]!;
    const program = researchCatalog.programs.find((item) => item.universityId === university.id)!;
    return {
      ...createDefaultGuideDraft(),
      universityId: university.id,
      programId: program.id,
      citizenship: "Testland",
      currentCountry: "Thailand",
      qualificationTitle: "BSc Computer Science",
      qualificationSubject: "Computer Science",
    };
  }

  it("maps qualification title and subject validation failures to their exact form fields", () => {
    const result = validateGuideProfileDraft({
      ...validDraft(),
      qualificationTitle: "",
      qualificationSubject: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.qualificationTitle).toBeDefined();
      expect(result.errors.qualificationSubject).toBeDefined();
      expect(result.errors["qualification.title"]).toBeUndefined();
      expect(result.errors["qualification.subject"]).toBeUndefined();
    }
  });

  it.each(["ielts", "toefl-ibt", "pte-academic"] as const)(
    "rejects a selected %s test when overall score is blank instead of manufacturing a default score",
    (englishKind) => {
      const result = validateGuideDraft(
        { ...validDraft(), englishKind, englishOverall: "" },
        researchCatalog,
        "2026-08-18",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.englishOverall).toBeDefined();
    },
  );

  it("reports Other English test name and score errors on their exact fields", () => {
    const result = validateGuideDraft(
      { ...validDraft(), englishKind: "other", otherEnglishName: "", otherEnglishScore: "" },
      researchCatalog,
      "2026-08-18",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.otherEnglishName).toBeDefined();
      expect(result.errors.otherEnglishScore).toBeDefined();
      expect(result.errors.englishKind).toBeUndefined();
    }
  });
});
