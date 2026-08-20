import {
  normalizeResearchCatalogText,
  type ResearchCatalog,
  type ResearchCatalogProgram,
  type ResearchCatalogUniversity,
} from "./schema";
import type { ResearchCatalogCountryCode } from "./countries";

export type ResearchCatalogFilters = {
  query?: string;
  countryCode?: ResearchCatalogCountryCode;
  degreeLevel?: "bachelor" | "master";
  subjectArea?: string;
};

export type ResearchCatalogSearchResult = {
  universities: readonly ResearchCatalogUniversity[];
  programs: readonly ResearchCatalogProgram[];
};

function textMatches(value: string, query: string): boolean {
  if (query === "") return true;
  return normalizeResearchCatalogText(value).includes(query);
}

export function searchResearchCatalog(
  catalog: ResearchCatalog,
  filters: ResearchCatalogFilters = {},
): ResearchCatalogSearchResult {
  const query = normalizeResearchCatalogText(filters.query ?? "");
  const subject = normalizeResearchCatalogText(filters.subjectArea ?? "");
  const hasProgramFilters = filters.degreeLevel !== undefined || subject !== "";

  const countryUniversities = catalog.universities.filter((university) =>
    filters.countryCode === undefined || university.countryCode === filters.countryCode
  );
  const countryUniversityIds = new Set(countryUniversities.map((university) => university.id));
  const queryMatchedUniversityIds = new Set(
    query === "" ? [] : countryUniversities
      .filter((university) =>
        textMatches(university.name, query) ||
        (university.aliases ?? []).some((alias) => textMatches(alias, query))
      )
      .map((university) => university.id),
  );

  const programs = catalog.programs.filter((program) => {
    const matchesCountry = countryUniversityIds.has(program.universityId);
    const matchesDegree = filters.degreeLevel === undefined || program.degreeLevel === filters.degreeLevel;
    const matchesSubject = subject === "" || textMatches(program.subjectArea, subject);
    const matchesQuery = query === "" ||
      queryMatchedUniversityIds.has(program.universityId) ||
      textMatches(program.name, query) ||
      textMatches(program.subjectArea, query) ||
      (program.aliases ?? []).some((alias) => textMatches(alias, query));
    return matchesCountry && matchesDegree && matchesSubject && matchesQuery;
  });

  const programUniversityIds = new Set(programs.map((program) => program.universityId));
  const visibleUniversities = countryUniversities.filter((university) => {
    if (hasProgramFilters) return programUniversityIds.has(university.id);
    if (query === "") return true;
    return queryMatchedUniversityIds.has(university.id) || programUniversityIds.has(university.id);
  });

  return {
    universities: visibleUniversities,
    programs,
  };
}
