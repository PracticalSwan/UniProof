import { describe, expect, it } from "vitest";

import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { targetHostMatches } from "@/lib/research/discovery/resolve-target";

describe("Side Phase UCE official-host ownership", () => {
  it("normalizes one leading www for the official root and true subdomains", () => {
    const target = { officialHost: "www.example.edu" };

    expect(targetHostMatches("example.edu", target)).toBe(true);
    expect(targetHostMatches("cs.example.edu", target)).toBe(true);
    expect(targetHostMatches("WWW.EXAMPLE.EDU.", target)).toBe(true);
  });

  it.each([
    "evil-example.edu",
    "example.edu.evil.test",
    "notexample.edu",
    "example.com",
  ])("rejects official-host lookalike %s", (hostname) => {
    expect(targetHostMatches(hostname, { officialHost: "www.example.edu" })).toBe(false);
  });

  it("uses the same narrow official-host match when promoting discovered candidates", () => {
    const official = normalizeCandidateSource(
      { url: "https://cs.example.edu/admissions", sourceType: "independent" },
      { discoveryProvider: "tavily", trustedOfficialHost: "www.example.edu" },
    );
    expect(official?.sourceType).toBe("university");

    const lookalike = normalizeCandidateSource(
      { url: "https://evil-example.edu/admissions", sourceType: "independent" },
      { discoveryProvider: "tavily", trustedOfficialHost: "www.example.edu" },
    );
    expect(lookalike?.sourceType).toBe("independent");
  });
});
