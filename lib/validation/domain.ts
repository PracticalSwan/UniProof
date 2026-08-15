import { z } from "zod";

import { evidenceStatusSchema, sourceTypeSchema } from "./evidence";

export const universitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  countryCode: z.string().length(2).transform((value) => value.toUpperCase()),
  websiteUrl: z.url(),
});

export const programSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  name: z.string().min(1),
  degreeLevel: z.enum(["bachelor", "master"]),
  subjectArea: z.string().min(1).optional(),
  officialUrl: z.url(),
});

export const sourceSchema = z.object({
  id: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  sourceType: sourceTypeSchema,
  retrievedAt: z.iso.datetime(),
  effectiveDate: z.iso.date().optional(),
  academicYear: z.string().min(1).optional(),
});

export const claimSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  programId: z.string().min(1).nullable().optional(),
  category: z.string().min(1),
  property: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().min(1).optional(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
  academicYear: z.string().min(1).optional(),
  effectiveDate: z.iso.date().optional(),
  sourceId: z.string().min(1),
  supportingText: z.string().min(1),
  verificationStatus: evidenceStatusSchema,
  confidence: z.number().min(0).max(1).optional(),
});

export type UniversityInput = z.input<typeof universitySchema>;
export type ProgramInput = z.input<typeof programSchema>;
export type SourceInput = z.input<typeof sourceSchema>;
export type ClaimInput = z.input<typeof claimSchema>;
