import { describe, expect, it } from "vitest";

import {
  researchCatalog,
  researchCatalogCountryCodes,
  researchCatalogCountryCodeSchema,
  researchCatalogSchema,
  searchResearchCatalog,
} from "@/lib/research/catalog";
import { researchDossierSchema } from "@/lib/research/mode/public-contracts";
import { normalizeResearchCatalogText } from "@/lib/research/catalog/schema";

const originalUniversityIds = [
  "university-imperial",
  "university-edinburgh",
  "university-ucl",
  "university-chulalongkorn",
  "university-kmutt",
  "university-mahidol",
  "university-georgia-tech",
  "university-mit",
  "university-stanford",
  "university-berkeley",
] as const;

const originalProgramOwners = {
  "program-imperial-computing-beng": "university-imperial",
  "program-edinburgh-artificial-intelligence-bsc": "university-edinburgh",
  "program-edinburgh-artificial-intelligence-msc": "university-edinburgh",
  "program-ucl-computer-science-bsc": "university-ucl",
  "program-chulalongkorn-computer-engineering-beng": "university-chulalongkorn",
  "program-chulalongkorn-csit-msc": "university-chulalongkorn",
  "program-kmutt-computer-science-bsc": "university-kmutt",
  "program-kmutt-computer-science-msc": "university-kmutt",
  "program-mahidol-computer-science-msc": "university-mahidol",
  "program-georgia-tech-computer-science-bs": "university-georgia-tech",
  "program-mit-artificial-intelligence-decision-making-bs": "university-mit",
  "program-mit-computer-science-engineering-bs": "university-mit",
  "program-stanford-computer-science-bs": "university-stanford",
  "program-berkeley-computer-science-ba": "university-berkeley",
} as const;

const newUniversityIds = [
  "university-toronto",
  "university-waterloo",
  "university-carnegie-mellon",
  "university-tum",
  "university-kth",
  "university-ubc",
  "university-mcgill",
  "university-uiuc",
  "university-tu-delft",
  "university-aalto",
  "university-alberta",
  "university-cornell",
  "university-ucsd",
  "university-ku-leuven",
  "university-amsterdam",
  "university-michigan",
  "university-washington",
  "university-dtu",
  "university-polimi",
  "university-rwth-aachen",
] as const;

const newProgramOwners = {
  "program-toronto-computer-science-st-george-bsc": "university-toronto",
  "program-toronto-mscac-artificial-intelligence": "university-toronto",
  "program-waterloo-computer-science-bcs": "university-waterloo",
  "program-waterloo-computer-science-mmath": "university-waterloo",
  "program-cmu-computer-science-bs": "university-carnegie-mellon",
  "program-cmu-artificial-intelligence-bs": "university-carnegie-mellon",
  "program-tum-informatics-msc": "university-tum",
  "program-kth-computer-science-msc": "university-kth",
  "program-ubc-computer-science-bsc": "university-ubc",
  "program-ubc-computer-science-msc": "university-ubc",
  "program-mcgill-computer-science-bsc": "university-mcgill",
  "program-mcgill-computer-science-msc-non-thesis": "university-mcgill",
  "program-uiuc-computer-science-bs": "university-uiuc",
  "program-uiuc-computer-science-mcs": "university-uiuc",
  "program-tu-delft-computer-science-msc": "university-tu-delft",
  "program-aalto-machine-learning-data-science-artificial-intelligence-msc": "university-aalto",
  "program-alberta-computing-science-multimedia-msc": "university-alberta",
  "program-cornell-computer-science-bs": "university-cornell",
  "program-cornell-computer-science-meng": "university-cornell",
  "program-ucsd-computer-science-bs": "university-ucsd",
  "program-ucsd-artificial-intelligence-bs": "university-ucsd",
  "program-ucsd-computer-science-ms": "university-ucsd",
  "program-ku-leuven-artificial-intelligence-master": "university-ku-leuven",
  "program-amsterdam-artificial-intelligence-msc": "university-amsterdam",
  "program-michigan-computer-science-engineering-bs": "university-michigan",
  "program-michigan-computer-science-engineering-ms": "university-michigan",
  "program-washington-computer-science-bs": "university-washington",
  "program-dtu-computer-science-engineering-msc": "university-dtu",
  "program-polimi-computer-science-engineering-msc": "university-polimi",
  "program-rwth-aachen-data-science-msc": "university-rwth-aachen",
  "program-rwth-aachen-human-centered-intelligent-systems-msc": "university-rwth-aachen",
} as const;

const supportedCountries = ["BE", "CA", "DE", "DK", "FI", "GB", "IT", "NL", "SE", "TH", "US"] as const;
const euCountries = new Set(["BE", "DE", "DK", "FI", "IT", "NL", "SE"]);

function normalizedUniversityIdentities() {
  return researchCatalog.universities.flatMap((university) =>
    [university.name, ...(university.aliases ?? [])].map((value) => ({
      value: normalizeResearchCatalogText(value),
      universityId: university.id,
    })),
  );
}

describe("Side Phase UCE release manifest", () => {
  it("ships exactly the approved 30-university, 11-country catalog", () => {
    expect(researchCatalog.universities).toHaveLength(30);
    expect(researchCatalogCountryCodes).toEqual(supportedCountries);
    expect(new Set(researchCatalog.universities.map((item) => item.countryCode))).toEqual(new Set(supportedCountries));

    const ids = new Set(researchCatalog.universities.map((item) => item.id));
    for (const id of originalUniversityIds) expect(ids.has(id)).toBe(true);
    for (const id of newUniversityIds) expect(ids.has(id)).toBe(true);

    const countryCounts = new Map<string, number>();
    for (const university of researchCatalog.universities) {
      countryCounts.set(university.countryCode, (countryCounts.get(university.countryCode) ?? 0) + 1);
    }
    expect(countryCounts.get("US")).toBe(10);
    expect(countryCounts.get("CA")).toBe(5);
    expect([...countryCounts].filter(([country]) => euCountries.has(country)).reduce((sum, [, count]) => sum + count, 0)).toBe(9);
    expect(countryCounts.get("GB")).toBe(3);
    expect(countryCounts.get("TH")).toBe(3);
  });

  it("preserves every original program owner and ships the exact new program manifest", () => {
    const owners = new Map(researchCatalog.programs.map((program) => [program.id, program.universityId]));
    for (const [programId, universityId] of Object.entries(originalProgramOwners)) {
      expect(owners.get(programId)).toBe(universityId);
    }
    for (const [programId, universityId] of Object.entries(newProgramOwners)) {
      expect(owners.get(programId)).toBe(universityId);
    }
    expect(researchCatalog.programs).toHaveLength(
      Object.keys(originalProgramOwners).length + Object.keys(newProgramOwners).length,
    );
    for (const universityId of newUniversityIds) {
      expect(researchCatalog.programs.some((program) => program.universityId === universityId)).toBe(true);
    }
  });

  it("keeps country contracts closed and aligned with the public dossier", () => {
    for (const countryCode of supportedCountries) {
      expect(researchCatalogCountryCodeSchema.safeParse(countryCode).success).toBe(true);
      const university = researchCatalog.universities.find((item) => item.countryCode === countryCode)!;
      expect(researchDossierSchema.shape.target.safeParse({
        university: {
          id: university.id,
          name: university.name,
          countryCode,
          websiteUrl: university.websiteUrl,
        },
      }).success).toBe(true);
    }
    for (const countryCode of ["CH", "ZZ", "ca", " CA "]) {
      expect(researchCatalogCountryCodeSchema.safeParse(countryCode).success).toBe(false);
    }
  });

  it("has globally unambiguous normalized university names and aliases", () => {
    const identities = normalizedUniversityIdentities();
    const owners = new Map<string, string>();
    for (const identity of identities) {
      expect(identity.value).not.toBe("");
      const existing = owners.get(identity.value);
      expect(existing === undefined || existing === identity.universityId).toBe(true);
      owners.set(identity.value, identity.universityId);
    }
    expect(owners.has(normalizeResearchCatalogText("UW"))).toBe(false);
  });

  it("rejects a cross-university alias collision after normalization", () => {
    const collided = {
      ...researchCatalog,
      universities: researchCatalog.universities.map((university) =>
        university.id === "university-mcgill" ? { ...university, aliases: ["ＭＩＴ"] } : university
      ),
    };
    expect(researchCatalogSchema.safeParse(collided).success).toBe(false);
  });

  it("keeps canonical HTTPS navigation and the existing bounded program ceiling", () => {
    expect(researchCatalogSchema.safeParse(researchCatalog).success).toBe(true);
    expect(researchCatalog.programs.length).toBeLessThanOrEqual(60);
    for (const university of researchCatalog.universities) {
      expect(new URL(university.websiteUrl).protocol).toBe("https:");
    }
    for (const program of researchCatalog.programs) {
      expect(new URL(program.officialUrl).protocol).toBe("https:");
    }
  });

  it.each([
    ["U of T", "university-toronto"],
    ["Waterloo", "university-waterloo"],
    ["CMU", "university-carnegie-mellon"],
    ["TUM", "university-tum"],
    ["KTH", "university-kth"],
    ["UBC", "university-ubc"],
    ["UIUC", "university-uiuc"],
    ["TU Delft", "university-tu-delft"],
    ["UAlberta", "university-alberta"],
    ["UCSD", "university-ucsd"],
    ["UvA", "university-amsterdam"],
    ["UMich", "university-michigan"],
    ["UW Seattle", "university-washington"],
    ["DTU", "university-dtu"],
    ["Polimi", "university-polimi"],
    ["RWTH", "university-rwth-aachen"],
  ])("resolves intended alias %s without silent retargeting", (query, expectedUniversityId) => {
    const result = searchResearchCatalog(researchCatalog, { query });
    expect(result.universities.map((item) => item.id)).toContain(expectedUniversityId);
  });

  it("projects every matching program owner and preserves filter intersection semantics", () => {
    const aiMasters = searchResearchCatalog(researchCatalog, {
      countryCode: "DE",
      degreeLevel: "master",
      query: "Data Science",
    });
    expect(aiMasters.programs.map((item) => item.id)).toContain("program-rwth-aachen-data-science-msc");
    for (const program of aiMasters.programs) {
      expect(aiMasters.universities.some((university) => university.id === program.universityId)).toBe(true);
    }
    expect(searchResearchCatalog(researchCatalog, { query: "definitely unsupported university" })).toEqual({
      universities: [],
      programs: [],
    });
  });
});
