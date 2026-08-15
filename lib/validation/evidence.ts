import { z } from "zod";

export const evidenceStatusSchema = z.enum([
  "verified",
  "corroborated",
  "university-reported",
  "conflicting",
  "anecdotal",
  "inferred",
  "unknown",
  "outdated",
]);

export const sourceTypeSchema = z.enum([
  "university",
  "government",
  "accreditation",
  "dataset",
  "independent",
  "ranking",
  "anecdotal",
]);

export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
