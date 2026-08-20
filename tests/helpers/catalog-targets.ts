import { researchCatalog } from "@/lib/research/catalog/data";

export function requireCatalogUniversity(id: string) {
  const university = researchCatalog.universities.find((item) => item.id === id);
  if (university === undefined) throw new Error(`Missing catalog university fixture: ${id}`);
  return university;
}

export function requireCatalogProgram(id: string) {
  const program = researchCatalog.programs.find((item) => item.id === id);
  if (program === undefined) throw new Error(`Missing catalog program fixture: ${id}`);
  return program;
}

export const guideCatalogTarget = {
  university: requireCatalogUniversity("university-imperial"),
  program: requireCatalogProgram("program-imperial-computing-beng"),
} as const;

export const persistenceComparisonTargets = [
  {
    university: requireCatalogUniversity("university-kmutt"),
    program: requireCatalogProgram("program-kmutt-computer-science-bsc"),
  },
  {
    university: requireCatalogUniversity("university-mahidol"),
    program: requireCatalogProgram("program-mahidol-computer-science-msc"),
  },
] as const;
