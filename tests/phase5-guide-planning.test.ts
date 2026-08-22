import { describe, expect, it } from "vitest";

import { assessGuideRequirements } from "@/lib/guide/assessment";
import { buildGuidePlan, daysBetweenDateOnly, parseStrictIsoDate } from "@/lib/guide/planning";
import type { GuideApplicantProfile, GuideSubmission } from "@/lib/guide/contracts";
import { researchDossierSchema } from "@/lib/research/mode/public-contracts";
import { buildGuideDossier, makeClaim } from "./fixtures/guide-dossiers";

const profile: GuideApplicantProfile = {
  citizenship: "Malaysia",
  currentCountry: "Thailand",
  qualification: {
    level: "bachelor",
    title: "BSc Computer Science",
    subject: "Computer Science",
    gpa: { value: 3.5, scale: 4 },
  },
  englishTest: { kind: "not-provided" },
  scholarshipNeed: false,
};

function makeSubmission(assessmentDate: string, applicant: GuideApplicantProfile = profile): GuideSubmission {
  return {
    target: { universityId: "us-nyu", programId: "us-nyu-mscs" },
    publicContext: {},
    profile: applicant,
    assessmentDate,
  };
}

describe("parseStrictIsoDate", () => {
  it("accepts valid leap day", () => {
    expect(parseStrictIsoDate("2028-02-29")).not.toBeNull();
  });
  it("rejects invalid leap day", () => {
    expect(parseStrictIsoDate("2027-02-29")).toBeNull();
  });
  it("rejects non-ISO", () => {
    expect(parseStrictIsoDate("January 15")).toBeNull();
    expect(parseStrictIsoDate("15/01/27")).toBeNull();
    expect(parseStrictIsoDate("rolling")).toBeNull();
  });
});

describe("daysBetweenDateOnly", () => {
  it("computes day differences correctly", () => {
    expect(daysBetweenDateOnly("2026-08-18", "2026-08-18")).toBe(0);
    expect(daysBetweenDateOnly("2026-08-18", "2026-08-19")).toBe(1);
    expect(daysBetweenDateOnly("2026-08-18", "2026-09-17")).toBe(30);
    expect(daysBetweenDateOnly("2026-08-18", "2026-09-18")).toBe(31);
    expect(daysBetweenDateOnly("2026-08-18", "2026-08-17")).toBe(-1);
  });

  it("handles leap day arithmetic", () => {
    expect(daysBetweenDateOnly("2028-02-28", "2028-02-29")).toBe(1);
    expect(daysBetweenDateOnly("2028-02-29", "2028-03-01")).toBe(1);
  });
});

describe("buildGuidePlan deadline semantics", () => {
  it("past deadline creates risk and no future timeline item", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-1", property: "Application deadline", value: "2026-08-17" })],
    });
    const assessment = assessGuideRequirements(makeSubmission("2026-08-18"), dossier);
    const plan = buildGuidePlan(makeSubmission("2026-08-18"), dossier, assessment);
    expect(plan.risks.some((r) => r.kind === "deadline-passed")).toBe(true);
    expect(plan.timeline.every((t) => t.date !== "2026-08-17")).toBe(true);
  });

  it("today deadline creates due-today risk", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-1", property: "Application deadline", value: "2026-08-18" })],
    });
    const assessment = assessGuideRequirements(makeSubmission("2026-08-18"), dossier);
    const plan = buildGuidePlan(makeSubmission("2026-08-18"), dossier, assessment);
    expect(plan.risks.some((r) => r.kind === "deadline-due-today")).toBe(true);
    expect(plan.timeline.some((t) => t.date === "2026-08-18")).toBe(true);
  });

  it("30 days out is urgent, 31 days is not", () => {
    const dossier30 = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-1", property: "Application deadline", value: "2026-09-17" })],
    });
    const assessment30 = assessGuideRequirements(makeSubmission("2026-08-18"), dossier30);
    const plan30 = buildGuidePlan(makeSubmission("2026-08-18"), dossier30, assessment30);
    expect(plan30.risks.some((r) => r.kind === "deadline-within-30-days")).toBe(true);

    const dossier31 = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-1", property: "Application deadline", value: "2026-09-18" })],
    });
    const assessment31 = assessGuideRequirements(makeSubmission("2026-08-18"), dossier31);
    const plan31 = buildGuidePlan(makeSubmission("2026-08-18"), dossier31, assessment31);
    expect(plan31.risks.some((r) => r.kind === "deadline-within-30-days")).toBe(false);
  });

  it("non-ISO deadline creates manual task, not machine timeline", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-1", property: "Application deadline", value: "rolling" })],
    });
    const assessment = assessGuideRequirements(makeSubmission("2026-08-18"), dossier);
    const plan = buildGuidePlan(makeSubmission("2026-08-18"), dossier, assessment);
    expect(plan.timeline.every((t) => t.date !== "rolling")).toBe(true);
    expect(plan.checklist.some((c) => c.action.includes("rolling"))).toBe(true);
  });

  it("profile-only day rollover moves deadline from future to past", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-1", property: "Application deadline", value: "2026-08-19" })],
    });
    const day1 = assessGuideRequirements(makeSubmission("2026-08-18"), dossier);
    const plan1 = buildGuidePlan(makeSubmission("2026-08-18"), dossier, day1);
    expect(plan1.risks.some((r) => r.kind === "deadline-within-30-days")).toBe(true);

    const day2 = assessGuideRequirements(makeSubmission("2026-08-20"), dossier);
    const plan2 = buildGuidePlan(makeSubmission("2026-08-20"), dossier, day2);
    expect(plan2.risks.some((r) => r.kind === "deadline-passed")).toBe(true);
  });

  it.each(["outdated", "inferred"] as const)(
    "does not machine-schedule a %s deadline",
    (verificationStatus) => {
      const dossier = buildGuideDossier({
        admissionsClaims: [
          makeClaim({
            id: `dl-${verificationStatus}`,
            property: "Application deadline",
            value: "2026-09-01",
            verificationStatus,
          }),
        ],
      });
      const submission = makeSubmission("2026-08-18");
      const assessment = assessGuideRequirements(submission, dossier);
      const plan = buildGuidePlan(submission, dossier, assessment);
      expect(plan.timeline).toHaveLength(0);
      expect(plan.risks.some((risk) => risk.kind.startsWith("deadline-"))).toBe(false);
    },
  );

  it("does not machine-schedule a deadline whose explicit academic year mismatches the selected context", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({
          id: "dl-context",
          property: "Application deadline",
          value: "2026-09-01",
          intake: "September 2027",
          academicYear: "2028-29",
        }),
      ],
    });
    const submission: GuideSubmission = {
      ...makeSubmission("2026-08-18"),
      publicContext: { intake: "September 2027", academicYear: "2027-28" },
    };
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    expect(plan.timeline).toHaveLength(0);
  });

  it("does not machine-schedule a time-sensitive deadline missing the selected period metadata", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "dl-no-period", property: "Application deadline", value: "2026-09-01" })],
    });
    const submission: GuideSubmission = {
      ...makeSubmission("2026-08-18"),
      publicContext: { academicYear: "2027-28" },
    };
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    expect(plan.timeline).toHaveLength(0);
  });

  it("does not machine-schedule competing conflicting deadline evidence", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "dl-a", property: "Application deadline", value: "2026-09-01", verificationStatus: "verified" }),
        makeClaim({ id: "dl-b", property: "Application deadline", value: "2026-09-15", verificationStatus: "conflicting" }),
      ],
    });
    const submission = makeSubmission("2026-08-18");
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    expect(plan.timeline).toHaveLength(0);
    expect(plan.risks.some((risk) => risk.kind === "conflicting-requirement")).toBe(true);
  });
});

describe("buildGuidePlan application fee semantics", () => {
  it("keeps an eligible published application fee as an evidence-linked checklist item", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "fee-1", property: "Application fee", value: 100, currency: "USD" })],
    });
    const submission = makeSubmission("2026-08-18");
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    const task = plan.checklist.find((item) => item.kind === "application-fee-review");
    expect(task?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["fee-1"]);
  });

  it("flags an outdated application fee instead of presenting it as current", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "fee-old", property: "Application fee", value: 100, currency: "USD", verificationStatus: "outdated" }),
      ],
    });
    const submission = makeSubmission("2026-08-18");
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    expect(plan.risks.some((risk) => risk.kind === "outdated-fee-or-deadline")).toBe(true);
    expect(plan.checklist.some((item) => item.kind === "application-fee-review")).toBe(false);
  });

  it("keeps conflicting and outdated application-fee warnings independent", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "fee-conflict", property: "Application fee", value: 100, currency: "USD", verificationStatus: "conflicting" }),
        makeClaim({ id: "fee-old", property: "Application fee", value: 100, currency: "USD", verificationStatus: "outdated" }),
      ],
    });
    const submission = makeSubmission("2026-08-18");
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);

    expect(plan.risks.filter((risk) => risk.kind === "outdated-fee-or-deadline")).toHaveLength(1);
    expect(plan.risks.filter((risk) => risk.kind === "conflicting-requirement")).toHaveLength(1);
    expect(plan.checklist.some((item) => item.kind === "application-fee-review")).toBe(false);
  });

  it("keeps selected-cycle-incompatible application-fee evidence reachable for manual confirmation", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "fee-contextless", property: "Application fee", value: 100, currency: "USD" })],
    });
    const submission: GuideSubmission = {
      ...makeSubmission("2026-08-18"),
      publicContext: { intake: "September 2027", academicYear: "2027-28" },
    };
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    const task = plan.checklist.find((item) => item.kind === "application-fee-review");

    expect(task?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["fee-contextless"]);
    expect(task?.action).toBe("Confirm the current application fee for the selected intake/academic year; published period metadata is missing or does not match.");
    expect(task?.action).not.toContain("100");
  });

  it("keeps source-gap application-fee evidence reachable as a neutral manual review", () => {
    const feeClaim = makeClaim({ id: "fee-source-gap", property: "Application fee", value: 100, currency: "USD" });
    const base = buildGuideDossier({ admissionsClaims: [feeClaim] });
    const dossier = researchDossierSchema.parse({
      ...base,
      categories: base.categories.map((row) => row.category === "admissions" && row.state === "ready"
        ? {
            ...row,
            sourceGap: {
              code: "provider-rate-limit",
              message: "Research provider limits prevented completion.",
            },
          }
        : row),
    });
    const submission = makeSubmission("2026-08-18");
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    const task = plan.checklist.find((item) => item.kind === "application-fee-review");

    expect(task?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["fee-source-gap"]);
    expect(task?.action).toBe("Confirm the current application fee manually; available evidence is not definitive.");
    expect(task?.action).not.toContain("100");
  });
});

describe("buildGuidePlan scholarship semantics", () => {
  it("no scholarship risk when need is false", () => {
    const dossier = buildGuideDossier({
      scholarshipClaims: [],
      scholarshipState: "unknown",
    });
    const assessment = assessGuideRequirements(makeSubmission("2026-08-18"), dossier);
    const plan = buildGuidePlan(makeSubmission("2026-08-18"), dossier, assessment);
    expect(plan.risks.some((r) => r.kind === "scholarship-uncertainty")).toBe(false);
  });

  it("scholarship uncertainty when need is true and evidence unknown", () => {
    const needingProfile = { ...profile, scholarshipNeed: true };
    const dossier = buildGuideDossier({
      scholarshipState: "unknown",
    });
    const assessment = assessGuideRequirements(makeSubmission("2026-08-18", needingProfile), dossier);
    const plan = buildGuidePlan(makeSubmission("2026-08-18", needingProfile), dossier, assessment);
    expect(plan.risks.some((r) => r.kind === "scholarship-uncertainty")).toBe(true);
  });

  it("treats inferred scholarship-unavailable evidence as uncertainty, not definitive unavailability", () => {
    const needingProfile = { ...profile, scholarshipNeed: true };
    const dossier = buildGuideDossier({
      scholarshipClaims: [
        makeClaim({
          id: "scholarship-inferred",
          category: "scholarships",
          property: "Scholarship availability",
          value: false,
          verificationStatus: "inferred",
        }),
      ],
    });
    const submission = makeSubmission("2026-08-18", needingProfile);
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    expect(plan.risks.some((r) => r.kind === "scholarship-unavailable")).toBe(false);
    expect(plan.risks.some((r) => r.kind === "scholarship-uncertainty")).toBe(true);
  });

  it("retains exact evidence provenance for a definitive scholarship-unavailable risk", () => {
    const needingProfile = { ...profile, scholarshipNeed: true };
    const dossier = buildGuideDossier({
      scholarshipClaims: [
        makeClaim({
          id: "scholarship-no",
          category: "scholarships",
          property: "Scholarship availability",
          value: false,
          verificationStatus: "verified",
        }),
      ],
    });
    const submission = makeSubmission("2026-08-18", needingProfile);
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    const risk = plan.risks.find((r) => r.kind === "scholarship-unavailable");
    expect(risk?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["scholarship-no"]);
  });

  it("does not treat scholarship availability without selected-cycle metadata as definitive", () => {
    const needingProfile = { ...profile, scholarshipNeed: true };
    const dossier = buildGuideDossier({
      scholarshipClaims: [
        makeClaim({
          id: "scholarship-contextless",
          category: "scholarships",
          property: "Scholarship availability",
          value: false,
          verificationStatus: "verified",
        }),
      ],
    });
    const submission: GuideSubmission = {
      ...makeSubmission("2026-08-18", needingProfile),
      publicContext: { intake: "September 2027", academicYear: "2027-28" },
    };
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    expect(plan.risks.some((r) => r.kind === "scholarship-unavailable")).toBe(false);
    const uncertainty = plan.risks.find((r) => r.kind === "scholarship-uncertainty");
    expect(uncertainty).toBeDefined();
    expect(uncertainty?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["scholarship-contextless"]);
  });

  it("adds only a generic browser-local country/citizenship manual action", () => {
    const dossier = buildGuideDossier({});
    const submission = makeSubmission("2026-08-18");
    const assessment = assessGuideRequirements(submission, dossier);
    const plan = buildGuidePlan(submission, dossier, assessment);
    const countryTask = plan.checklist.find((item) => item.kind === "country-specific-manual-check");
    expect(countryTask).toBeDefined();
    expect(countryTask?.evidenceRefs).toEqual([]);
    expect(countryTask?.action).not.toContain(profile.citizenship);
    expect(countryTask?.action).not.toContain(profile.currentCountry);
  });
});
