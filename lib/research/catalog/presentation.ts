import type { ResearchCatalog } from "./schema";
import type { ResearchDossier } from "@/lib/research/mode/public-contracts";

export function bindCatalogOwnedResearchTarget(
  dossier: ResearchDossier,
  catalog: ResearchCatalog,
): ResearchDossier | null {
  const university = catalog.universities.find(
    (item) => item.id === dossier.target.university.id,
  );
  if (university === undefined) return null;

  if (dossier.target.program === undefined) {
    return {
      ...dossier,
      target: {
        ...dossier.target,
        university: {
          ...dossier.target.university,
          websiteUrl: university.websiteUrl,
        },
      },
    };
  }

  const program = catalog.programs.find(
    (item) =>
      item.id === dossier.target.program?.id &&
      item.universityId === university.id,
  );
  if (program === undefined) return null;

  return {
    ...dossier,
    target: {
      ...dossier.target,
      university: {
        ...dossier.target.university,
        websiteUrl: university.websiteUrl,
      },
      program: {
        ...dossier.target.program,
        officialUrl: program.officialUrl,
      },
    },
  };
}
