import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  evidenceStatusLabel,
  formatClaimValue,
  formatIsoDate,
  formatRetrievedAt,
} from "@/lib/research/mode/format";
import type { PublicResearchClaim } from "@/lib/research/mode/public-contracts";

function claim(overrides: Partial<PublicResearchClaim> = {}): PublicResearchClaim {
  return {
    id: "claim-format",
    category: "tuition",
    property: "International tuition",
    value: "10000",
    verificationStatus: "verified",
    representativeSourceId: "source-1",
    sourceIds: ["source-1"],
    supportingText: "Tuition is 10000.",
    ...overrides,
  };
}

describe("formatClaimValue", () => {
  it("preserves string values verbatim without numeric parsing", () => {
    expect(formatClaimValue(claim({ value: "10000" }))).toBe("10000");
    expect(formatClaimValue(claim({ value: "2027-01-15" }))).toBe("2027-01-15");
    expect(formatClaimValue(claim({ value: "about fifty thousand" }))).toBe("about fifty thousand");
  });

  it("renders numbers without conversion and booleans as Yes or No", () => {
    expect(formatClaimValue(claim({ value: 10000 }))).toBe("10000");
    expect(formatClaimValue(claim({ value: 12.5 }))).toBe("12.5");
    expect(formatClaimValue(claim({ value: true }))).toBe("Yes");
    expect(formatClaimValue(claim({ value: false }))).toBe("No");
  });

  it("appends explicit currency codes and units without conversion", () => {
    expect(formatClaimValue(claim({ value: 10000, currency: "USD" }))).toBe("USD 10000");
    expect(formatClaimValue(claim({ value: 10000, unit: "per year" }))).toBe("10000 per year");
    expect(formatClaimValue(claim({ value: 10000, currency: "USD", unit: "per year" }))).toBe(
      "USD 10000 per year",
    );
    expect(formatClaimValue(claim({ value: "10000", currency: "THB" }))).toBe("THB 10000");
  });

  it("emits no metadata placeholder when currency and unit are absent", () => {
    const formatted = formatClaimValue(claim());
    expect(formatted).toBe("10000");
    expect(formatted).not.toContain("Unknown");
  });

  it("keeps Unicode astral values intact", () => {
    expect(formatClaimValue(claim({ value: "𝕒𝕓𝕔" }))).toBe("𝕒𝕓𝕔");
  });

  it("returns malicious-looking markup as ordinary text", () => {
    expect(formatClaimValue(claim({ value: "<script>alert('x')</script>" }))).toBe(
      "<script>alert('x')</script>",
    );
  });
});

describe("explicit date and timestamp formatting", () => {
  it("formats ISO dates in UTC without local-time shifting", () => {
    expect(formatIsoDate("2026-09-01")).toBe("Sep 1, 2026");
    expect(formatIsoDate("2026-12-31")).toBe("Dec 31, 2026");
    expect(formatIsoDate("2027-01-15")).toBe("Jan 15, 2027");
  });

  it("formats retrieved timestamps as deterministic UTC observation metadata", () => {
    expect(formatRetrievedAt("2026-08-17T23:30:00.000Z")).toBe("Aug 17, 2026, 23:30 UTC");
    expect(formatRetrievedAt("2026-01-02T00:05:00.000Z")).toBe("Jan 2, 2026, 00:05 UTC");
  });
});

describe("labels", () => {
  it("maps every category to a deterministic label", () => {
    expect(categoryLabel("admissions")).toBe("Admissions");
    expect(categoryLabel("tuition")).toBe("Tuition");
    expect(categoryLabel("scholarships")).toBe("Scholarships");
    expect(categoryLabel("program-structure")).toBe("Program structure");
    expect(categoryLabel("research")).toBe("Research");
    expect(categoryLabel("outcomes")).toBe("Outcomes");
    expect(categoryLabel("support")).toBe("Support");
  });

  it("maps every public claim evidence status to a deterministic label", () => {
    expect(evidenceStatusLabel("verified")).toBe("Verified");
    expect(evidenceStatusLabel("corroborated")).toBe("Corroborated");
    expect(evidenceStatusLabel("university-reported")).toBe("University-reported");
    expect(evidenceStatusLabel("conflicting")).toBe("Conflicting");
    expect(evidenceStatusLabel("anecdotal")).toBe("Anecdotal");
    expect(evidenceStatusLabel("inferred")).toBe("Inferred");
    expect(evidenceStatusLabel("outdated")).toBe("Outdated");
  });
});
