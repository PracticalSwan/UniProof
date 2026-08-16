import type {
  ResearchCategory,
  ResearchExtractionProvider,
  ResearchProvider,
  ResearchProviderAttempt,
  ResearchProviderAttemptFailureKind,
} from "@/lib/research/contracts";
import { RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN } from "@/lib/security/research-limits";

/** A deliberately small JSON-Schema value type shared by the provider adapters. */
export type JsonSchemaValue =
  | string
  | number
  | boolean
  | null
  | JsonSchemaValue[]
  | { [key: string]: JsonSchemaValue };

export type JsonSchemaObject = { [key: string]: JsonSchemaValue };

export type StructuredTaskKind = "extraction";

export type StructuredTaskSegment = {
  id: string;
  sourceId: string;
  documentId: string;
  text: string;
  heading?: string;
};

export type StructuredTaskTargetContext = {
  universityName?: string;
  programName?: string;
  subjectArea?: string;
  countryCode?: string;
  degreeLevel?: "bachelor" | "master";
};

const extractionProviders = ["gemini", "groq", "openrouter"] as const satisfies readonly ResearchExtractionProvider[];

type ProviderBudgetMap = Record<ResearchExtractionProvider, number>;

export type ExtractionBudget = {
  readonly limit: number;
  used: number;
  readonly providerLimits: ProviderBudgetMap;
  providerUsed: ProviderBudgetMap;
};

export function assertValidExtractionBudget(budget: ExtractionBudget): void {
  if (
    budget === null ||
    typeof budget !== "object" ||
    !Number.isSafeInteger(budget.limit) ||
    budget.limit < 0 ||
    budget.limit > RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN ||
    !Number.isSafeInteger(budget.used) ||
    budget.used < 0 ||
    budget.used > budget.limit ||
    budget.providerLimits === null ||
    typeof budget.providerLimits !== "object" ||
    budget.providerUsed === null ||
    typeof budget.providerUsed !== "object"
  ) {
    throw new Error("invalid extraction attempt budget");
  }

  for (const provider of extractionProviders) {
    const providerLimit = budget.providerLimits[provider];
    const providerUsed = budget.providerUsed[provider];
    if (
      !Number.isSafeInteger(providerLimit) ||
      providerLimit < 0 ||
      providerLimit > budget.limit ||
      !Number.isSafeInteger(providerUsed) ||
      providerUsed < 0 ||
      providerUsed > providerLimit
    ) {
      throw new Error("invalid extraction attempt budget");
    }
  }
}

export function createExtractionBudget(
  limit = RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN,
  providerLimits: Partial<Record<ResearchExtractionProvider, number>> = {},
): ExtractionBudget {
  const resolvedProviderLimits: ProviderBudgetMap = {
    gemini: providerLimits.gemini ?? limit,
    groq: providerLimits.groq ?? limit,
    openrouter: providerLimits.openrouter ?? limit,
  };
  const budget: ExtractionBudget = {
    limit,
    used: 0,
    providerLimits: resolvedProviderLimits,
    providerUsed: { gemini: 0, groq: 0, openrouter: 0 },
  };
  assertValidExtractionBudget(budget);
  return budget;
}

export type StructuredTaskRequest = {
  kind: StructuredTaskKind;
  prompt: string;
  schema: JsonSchemaObject;
  segment: StructuredTaskSegment;
  categories: readonly ResearchCategory[];
  target: StructuredTaskTargetContext;
};

export type StructuredAdapterInput = {
  prompt: string;
  schema: JsonSchemaObject;
  apiKey?: string;
  signal?: AbortSignal;
  budget?: ExtractionBudget;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  requireOpenRouterZdr?: boolean;
};

export type StructuredProviderOptions = {
  apiKey?: string;
  signal?: AbortSignal;
  budget?: ExtractionBudget;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  requireOpenRouterZdr?: boolean;
};

export type StructuredProviderSuccess = {
  ok: true;
  provider: ResearchProvider;
  payload: unknown;
  model: string;
  attempts: readonly ResearchProviderAttempt[];
};

export type StructuredProviderFailure = {
  ok: false;
  provider: ResearchProvider;
  failureKind: ResearchProviderAttemptFailureKind;
  attempts: readonly ResearchProviderAttempt[];
  /** Internal scope distinguishes provider-local exhaustion from the shared run ceiling. */
  budgetScope?: "provider" | "total";
  /** Caller cancellation is kept distinct from provider deadline failures. */
  aborted?: boolean;
};

export type StructuredProviderResult = StructuredProviderSuccess | StructuredProviderFailure;
