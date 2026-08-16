import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  TAVILY_API_KEY: z.string().min(1).optional(),
  BRAVE_SEARCH_API_KEY: z.string().min(1).optional(),
  COLLEGE_SCORECARD_API_KEY: z.string().min(1).optional(),
  UNIPROOF_RESEARCH_MODE: z.enum(["seed", "live"]).default("seed"),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
    COLLEGE_SCORECARD_API_KEY: process.env.COLLEGE_SCORECARD_API_KEY,
    UNIPROOF_RESEARCH_MODE: process.env.UNIPROOF_RESEARCH_MODE,
  });
}
