import "server-only";

import type { ResearchTargetResolver } from "@/lib/research/discovery/types";
import { researchCatalog } from "./data";
import type { ResearchCatalog } from "./schema";

export function createCatalogTargetResolver(
  catalog: ResearchCatalog = researchCatalog,
): ResearchTargetResolver {
  const universities = new Map(catalog.universities.map((item) => [item.id, item]));
  const programs = new Map(catalog.programs.map((item) => [item.id, item]));

  return {
    resolveUniversity: (id) => {
      const item = universities.get(id);
      if (item === undefined) return undefined;
      return {
        id: item.id,
        name: item.name,
        countryCode: item.countryCode,
        websiteUrl: item.websiteUrl,
        rorId: item.rorId,
      };
    },
    resolveProgram: (id) => {
      const item = programs.get(id);
      if (item === undefined) return undefined;
      return {
        id: item.id,
        universityId: item.universityId,
        name: item.name,
        degreeLevel: item.degreeLevel,
        subjectArea: item.subjectArea,
        officialUrl: item.officialUrl,
      };
    },
  };
}
