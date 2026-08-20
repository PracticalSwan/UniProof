import { z } from "zod";

import { researchCatalogCountryCodeSchema } from "./countries";

export function normalizeResearchCatalogText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function isCanonicalHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.hostname !== "";
  } catch {
    return false;
  }
}

const catalogIdSchema = z.string().trim().min(1).max(120);
const catalogNameSchema = z.string().trim().min(1).max(200);
const catalogSubjectSchema = z.string().trim().min(1).max(120);
const catalogAliasSchema = z.string().trim().min(1).max(120);

const canonicalHttpsUrlSchema = z.string().refine(isCanonicalHttpsUrl, {
  message: "catalog official URLs must be canonical HTTPS URLs without credentials",
});

const aliasesSchema = z.array(catalogAliasSchema).max(12)
  .refine((aliases) => {
    const normalized = aliases.map(normalizeResearchCatalogText);
    return new Set(normalized).size === normalized.length && normalized.every((value) => value !== "");
  }, { message: "aliases must be unique after normalization" });

export const researchCatalogUniversitySchema = z.object({
  id: catalogIdSchema,
  name: catalogNameSchema,
  countryCode: researchCatalogCountryCodeSchema,
  websiteUrl: canonicalHttpsUrlSchema,
  rorId: z.string().refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" &&
        parsed.hostname.toLowerCase() === "ror.org" &&
        parsed.username === "" &&
        parsed.password === "";
    } catch {
      return false;
    }
  }, { message: "ROR identifiers must use HTTPS on ror.org" }).optional(),
  aliases: aliasesSchema.optional(),
}).strict();

export const researchCatalogProgramSchema = z.object({
  id: catalogIdSchema,
  universityId: catalogIdSchema,
  name: catalogNameSchema,
  degreeLevel: z.enum(["bachelor", "master"]),
  subjectArea: catalogSubjectSchema,
  officialUrl: canonicalHttpsUrlSchema,
  aliases: aliasesSchema.optional(),
}).strict();

export const researchCatalogSchema = z.object({
  universities: z.array(researchCatalogUniversitySchema).min(10).max(40),
  programs: z.array(researchCatalogProgramSchema).min(10).max(60),
}).strict()
  .superRefine((catalog, context) => {
    const universityIds = new Set(catalog.universities.map((item) => item.id));
    if (universityIds.size !== catalog.universities.length) {
      context.addIssue({ code: "custom", message: "university IDs must be unique", path: ["universities"] });
    }
    const programIds = new Set(catalog.programs.map((item) => item.id));
    if (programIds.size !== catalog.programs.length) {
      context.addIssue({ code: "custom", message: "program IDs must be unique", path: ["programs"] });
    }

    const universityIdentityOwners = new Map<string, string>();
    for (const university of catalog.universities) {
      for (const value of [university.name, ...(university.aliases ?? [])]) {
        const identity = normalizeResearchCatalogText(value);
        const existingOwner = universityIdentityOwners.get(identity);
        if (existingOwner !== undefined && existingOwner !== university.id) {
          context.addIssue({
            code: "custom",
            message: "university names and aliases must be globally unambiguous after normalization",
            path: ["universities"],
          });
        }
        universityIdentityOwners.set(identity, university.id);
      }
    }

    const programIdentities = new Set<string>();
    for (const program of catalog.programs) {
      if (!universityIds.has(program.universityId)) {
        context.addIssue({ code: "custom", message: "program universityId must resolve to a catalog university", path: ["programs"] });
      }
      const identity = `${program.universityId}:${program.degreeLevel}:${normalizeResearchCatalogText(program.name)}`;
      if (programIdentities.has(identity)) {
        context.addIssue({ code: "custom", message: "program identity must be unique within a university and degree level", path: ["programs"] });
      }
      programIdentities.add(identity);
    }

    const universityRank = new Map(
      [...catalog.universities]
        .map((university, index) => [
          university.id,
          index,
        ] as const),
    );
    const orderedUniversityKeys = [...catalog.universities]
      .map((university) => [
        university.countryCode,
        normalizeResearchCatalogText(university.name),
        university.id,
      ] as const);
    const beforeUniversity = (left: readonly string[], right: readonly string[]) =>
      left[0]! < right[0]! ||
        (left[0]! === right[0]! &&
          (left[1]! < right[1]! || (left[1]! === right[1]! && left[2]! < right[2]!)));
    if (orderedUniversityKeys.some((key, index) => index > 0 && beforeUniversity(key, orderedUniversityKeys[index - 1]!))) {
      context.addIssue({
        code: "custom",
        message: "universities must follow country, normalized-name, ID order",
        path: ["universities"],
      });
    }

    const orderedProgramKeys = [...catalog.programs]
      .map((program) => [
        universityRank.get(program.universityId) ?? Number.MAX_SAFE_INTEGER,
        program.degreeLevel,
        normalizeResearchCatalogText(program.name),
        program.id,
      ] as const);
    const beforeProgram = (
      left: readonly [number, string, string, string],
      right: readonly [number, string, string, string],
    ) =>
      left[0] < right[0] ||
        (left[0] === right[0] &&
          (left[1] < right[1] ||
            (left[1] === right[1] &&
              (left[2] < right[2] || (left[2] === right[2] && left[3] < right[3])))));
    if (orderedProgramKeys.some((key, index) => index > 0 && beforeProgram(key, orderedProgramKeys[index - 1]!))) {
      context.addIssue({
        code: "custom",
        message: "programs must follow university, degree, normalized-name, ID order",
        path: ["programs"],
      });
    }
  });

export type ResearchCatalogUniversity = z.infer<typeof researchCatalogUniversitySchema>;
export type ResearchCatalogProgram = z.infer<typeof researchCatalogProgramSchema>;
export type ResearchCatalog = z.infer<typeof researchCatalogSchema>;
