import { describe, expect, it } from "vitest";

import { researchCatalog } from "@/lib/research/catalog/data";
import { bindCatalogOwnedResearchTarget } from "@/lib/research/catalog/presentation";
import { buildGuideDossier, makeClaim } from "@/tests/fixtures/guide-dossiers";
import { guideCatalogTarget, requireCatalogUniversity } from "@/tests/helpers/catalog-targets";

const { university, program } = guideCatalogTarget;
const differentUniversity = requireCatalogUniversity("university-edinburgh");

describe("shared Research dossier catalog binder", () => {
  it("replaces hostile application-owned official URLs with current catalog URLs", () => {
    const dossier = buildGuideDossier({
      universityId: university.id,
      programId: program.id,
      universityWebsiteUrl: "https://attacker.example/university",
      programOfficialUrl: "https://attacker.example/program",
      admissionsClaims: [makeClaim({ id: "claim-1" })],
    });
    dossier.sources[0]!.url = "https://evidence.example/source";

    const bound = bindCatalogOwnedResearchTarget(dossier, researchCatalog);

    expect(bound).not.toBeNull();
    expect(bound!.target.university.websiteUrl).toBe(university.websiteUrl);
    expect(bound!.target.program?.officialUrl).toBe(program.officialUrl);
    expect(bound!.sources).toEqual(dossier.sources);
    expect(bound!.categories).toEqual(dossier.categories);
    expect(dossier.target.university.websiteUrl).toBe("https://attacker.example/university");
  });

  it("rejects a program reassigned to another catalog university", () => {
    const dossier = buildGuideDossier({
      universityId: differentUniversity.id,
      programId: program.id,
    });

    expect(bindCatalogOwnedResearchTarget(dossier, researchCatalog)).toBeNull();
  });

  it("rejects a removed university-only target instead of trusting its stored URL", () => {
    const dossier = buildGuideDossier({
      universityId: "removed-university",
      universityWebsiteUrl: "https://stored.example",
    });
    dossier.target.program = undefined;

    expect(bindCatalogOwnedResearchTarget(dossier, researchCatalog)).toBeNull();
  });
});
