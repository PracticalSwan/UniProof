import { describe, expect, it } from "vitest";

import { assessGuideRequirements } from "@/lib/guide/assessment";
import type { GuideApplicantProfile, GuideSubmission } from "@/lib/guide/contracts";
import { buildGuideDossier, makeClaim } from "./fixtures/guide-dossiers";

const baseProfile: GuideApplicantProfile = {
  citizenship: "Malaysia",
  currentCountry: "Thailand",
  qualification: {
    level: "bachelor",
    title: "BSc Computer Science",
    subject: "Computer Science",
    gpa: { value: 3.5, scale: 4 },
  },
  englishTest: { kind: "ielts", overall: 7 },
  scholarshipNeed: false,
};

function makeSubmission(profile: GuideApplicantProfile = baseProfile): GuideSubmission {
  return {
    target: { universityId: "us-nyu", programId: "us-nyu-mscs" },
    publicContext: {},
    profile,
    assessmentDate: "2026-08-18",
  };
}

describe("assessGuideRequirements", () => {
  it("assesses GPA meet on same scale", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" })],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const gpa = output.assessments.find((a) => a.semantic === "minimum-gpa");
    expect(gpa?.state).toBe("meets");
  });

  it("assesses GPA does-not-meet on same scale", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      qualification: { ...baseProfile.qualification, gpa: { value: 2.5, scale: 4 } },
    };
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    const gpa = output.assessments.find((a) => a.semantic === "minimum-gpa");
    expect(gpa?.state).toBe("does-not-meet");
  });

  it("returns manual-confirmation for GPA scale mismatch", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      qualification: { ...baseProfile.qualification, gpa: { value: 8.5, scale: 10 } },
    };
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    const gpa = output.assessments.find((a) => a.semantic === "minimum-gpa");
    expect(gpa?.state).toBe("manual-confirmation-required");
  });

  it("returns missing-applicant-information when GPA absent", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      qualification: { level: "bachelor", title: "BSc Computer Science", subject: "Computer Science" },
    };
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    const gpa = output.assessments.find((a) => a.semantic === "minimum-gpa");
    expect(gpa?.state).toBe("missing-applicant-information");
  });

  it("assesses qualification below minimum as does-not-meet", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      qualification: { ...baseProfile.qualification, level: "secondary" },
    };
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "qual-1", property: "Minimum qualification level", value: "bachelor" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    const qual = output.assessments.find((a) => a.semantic === "minimum-qualification-level");
    expect(qual?.state).toBe("does-not-meet");
  });

  it("assesses qualification equal as probably-meets", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "qual-1", property: "Minimum qualification level", value: "bachelor" })],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const qual = output.assessments.find((a) => a.semantic === "minimum-qualification-level");
    expect(qual?.state).toBe("probably-meets");
  });

  it("assesses IELTS meet", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "ielts-1", property: "Minimum IELTS score", value: 6.5 })],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const ielts = output.assessments.find((a) => a.semantic === "ielts-overall-minimum");
    expect(ielts?.state).toBe("meets");
  });

  it("assesses IELTS below threshold as does-not-meet", () => {
    const profile: GuideApplicantProfile = { ...baseProfile, englishTest: { kind: "ielts", overall: 6 } };
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "ielts-1", property: "Minimum IELTS score", value: 6.5 })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    const ielts = output.assessments.find((a) => a.semantic === "ielts-overall-minimum");
    expect(ielts?.state).toBe("does-not-meet");
  });

  it("returns manual-confirmation for cross-test", () => {
    const profile: GuideApplicantProfile = { ...baseProfile, englishTest: { kind: "toefl-ibt", overall: 90 } };
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "ielts-1", property: "Minimum IELTS score", value: 6.5 })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    const ielts = output.assessments.find((a) => a.semantic === "ielts-overall-minimum");
    expect(ielts?.state).toBe("manual-confirmation-required");
  });

  it("returns unclear for conflicting evidence", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0", verificationStatus: "verified" }),
        makeClaim({ id: "gpa-2", property: "Minimum GPA", value: 3.5, unit: "4.0", verificationStatus: "conflicting" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const gpa = output.assessments.find((a) => a.semantic === "minimum-gpa");
    expect(gpa?.state).toBe("unclear-requirement");
  });

  it("returns unclear for outdated evidence", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0", verificationStatus: "outdated" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const gpa = output.assessments.find((a) => a.semantic === "minimum-gpa");
    expect(gpa?.state).toBe("unclear-requirement");
  });

  it("deduplicates equivalent singleton claims and merges their exact evidence references", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" }),
        makeClaim({ id: "gpa-2", property: "Minimum GPA", value: 3.0, unit: "4.0" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const rows = output.assessments.filter((a) => a.semantic === "minimum-gpa");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["gpa-1", "gpa-2"]);
  });

  it("deduplicates singleton facts that use equivalent reviewed GPA-scale aliases", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "gpa-1", property: "Minimum GPA", value: 3.0, unit: "4.0" }),
        makeClaim({ id: "gpa-2", property: "Minimum GPA", value: 3.0, unit: "4.00" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const rows = output.assessments.filter((a) => a.semantic === "minimum-gpa");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).not.toBe("unclear-requirement");
    expect(rows[0]?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["gpa-1", "gpa-2"]);
  });

  it("deduplicates singleton facts that use equivalent reviewed qualification aliases", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "qual-1", property: "Minimum qualification level", value: "bachelor" }),
        makeClaim({ id: "qual-2", property: "Minimum qualification level", value: "bachelor degree" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const rows = output.assessments.filter((a) => a.semantic === "minimum-qualification-level");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("probably-meets");
    expect(rows[0]?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["qual-1", "qual-2"]);
  });

  it("deduplicates singleton facts that use equivalent reviewed subject-family aliases", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "subject-1", property: "Required subject background", value: "computer science" }),
        makeClaim({ id: "subject-2", property: "Required subject background", value: "computing" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const rows = output.assessments.filter((a) => a.semantic === "required-subject-background");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("probably-meets");
    expect(rows[0]?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["subject-1", "subject-2"]);
  });

  it("requires every selected public-context dimension to match before definitive assessment", () => {
    const submission: GuideSubmission = {
      ...makeSubmission(),
      publicContext: { intake: "September 2027", academicYear: "2027-28" },
    };
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({
          id: "gpa-context",
          property: "Minimum GPA",
          value: 3.0,
          unit: "4.0",
          intake: "September 2027",
          academicYear: "2028-29",
        }),
      ],
    });
    const output = assessGuideRequirements(submission, dossier);
    expect(output.assessments.some((a) => a.semantic === "minimum-gpa" && a.state === "meets")).toBe(false);
  });

  it("keeps unrecognized admissions claims in manual review", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [makeClaim({ id: "manual-1", property: "Interview requirement", value: "Yes" })],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    expect(output.unrecognizedAdmissions).toHaveLength(1);
    expect(output.unrecognizedAdmissions[0]?.property).toBe("Interview requirement");
    expect("claimId" in output.unrecognizedAdmissions[0]!).toBe(false);
    expect(output.unrecognizedAdmissions[0]?.evidenceRef.claimId).toBe("manual-1");
  });

  it("treats required documents as collection, not conflict", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "doc-1", property: "Required documents", value: "Transcript" }),
        makeClaim({ id: "doc-2", property: "Required documents", value: "CV" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const docs = output.assessments.filter((a) => a.semantic === "required-document");
    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.state === "manual-confirmation-required")).toBe(true);
  });

  it("does not split composite document text", () => {
    const dossier = buildGuideDossier({
      admissionsClaims: [
        makeClaim({ id: "doc-1", property: "Required documents", value: "Transcript, CV and two references" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(), dossier);
    const docs = output.assessments.filter((a) => a.semantic === "required-document");
    expect(docs).toHaveLength(1);
  });

  it("budget assessment within budget", () => {
    const profile: GuideApplicantProfile = { ...baseProfile, budget: { amount: 50000, currency: "USD", scope: "annual" } };
    const dossier = buildGuideDossier({
      tuitionClaims: [makeClaim({ id: "tuition-1", category: "tuition", property: "Annual tuition", value: 40000, currency: "USD" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    expect(output.budgetAssessment?.state).toBe("within-budget");
  });

  it("budget assessment over budget", () => {
    const profile: GuideApplicantProfile = { ...baseProfile, budget: { amount: 30000, currency: "USD", scope: "annual" } };
    const dossier = buildGuideDossier({
      tuitionClaims: [makeClaim({ id: "tuition-1", category: "tuition", property: "Annual tuition", value: 40000, currency: "USD" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    expect(output.budgetAssessment?.state).toBe("over-budget");
  });

  it("budget incomparable for currency mismatch", () => {
    const profile: GuideApplicantProfile = { ...baseProfile, budget: { amount: 50000, currency: "EUR", scope: "annual" } };
    const dossier = buildGuideDossier({
      tuitionClaims: [makeClaim({ id: "tuition-1", category: "tuition", property: "Annual tuition", value: 40000, currency: "USD" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    expect(output.budgetAssessment?.state).toBe("incomparable");
  });

  it("keeps context-incompatible tuition evidence linked to the incomparable budget result", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      budget: { amount: 50000, currency: "USD", scope: "annual" },
    };
    const submission: GuideSubmission = {
      ...makeSubmission(profile),
      publicContext: { intake: "September 2027", academicYear: "2027-28" },
    };
    const dossier = buildGuideDossier({
      tuitionClaims: [
        makeClaim({
          id: "tuition-contextless",
          category: "tuition",
          property: "Annual tuition",
          value: 40000,
          currency: "USD",
        }),
      ],
    });
    const output = assessGuideRequirements(submission, dossier);
    expect(output.budgetAssessment?.state).toBe("incomparable");
    expect(output.budgetAssessment?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["tuition-contextless"]);
  });

  it("budget incomparable for unsupported same currency", () => {
    const profile: GuideApplicantProfile = { ...baseProfile, budget: { amount: 50000, currency: "XYZ", scope: "annual" } };
    const dossier = buildGuideDossier({
      tuitionClaims: [makeClaim({ id: "tuition-1", category: "tuition", property: "Annual tuition", value: 40000, currency: "XYZ" })],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    expect(output.budgetAssessment?.state).toBe("incomparable");
  });

  it("selects the tuition semantic matching the applicant budget scope when both annual and total are published", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      budget: { amount: 100000, currency: "USD", scope: "total" },
    };
    const dossier = buildGuideDossier({
      tuitionClaims: [
        makeClaim({ id: "annual", category: "tuition", property: "Annual tuition", value: 40000, currency: "USD" }),
        makeClaim({ id: "total", category: "tuition", property: "Total tuition", value: 90000, currency: "USD" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    expect(output.budgetAssessment?.state).toBe("within-budget");
    expect(output.budgetAssessment?.evidenceRefs.map((ref) => ref.claimId)).toEqual(["total"]);
  });

  it("does not use one verified tuition claim to override conflicting evidence for the same semantic", () => {
    const profile: GuideApplicantProfile = {
      ...baseProfile,
      budget: { amount: 50000, currency: "USD", scope: "annual" },
    };
    const dossier = buildGuideDossier({
      tuitionClaims: [
        makeClaim({ id: "tuition-verified", category: "tuition", property: "Annual tuition", value: 40000, currency: "USD", verificationStatus: "verified" }),
        makeClaim({ id: "tuition-conflict", category: "tuition", property: "Annual tuition", value: 60000, currency: "USD", verificationStatus: "conflicting" }),
      ],
    });
    const output = assessGuideRequirements(makeSubmission(profile), dossier);
    expect(output.budgetAssessment?.state).not.toBe("within-budget");
    expect(output.budgetAssessment?.state).not.toBe("over-budget");
  });
});
