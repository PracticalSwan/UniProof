import { z } from "zod";

import {
  claimSchema,
  programSchema,
  sourceSchema,
  universitySchema,
} from "@/lib/validation/domain";
import { evidenceStatusSchema, sourceTypeSchema } from "@/lib/validation/evidence";

export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type University = z.infer<typeof universitySchema>;
export type Program = z.infer<typeof programSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Claim = z.infer<typeof claimSchema>;
