import type {
  ResearchCategory,
  ResearchExtractionProvider,
  ResearchProvider,
  ResearchProviderAttempt,
  ResearchProviderAttemptFailureKind,
} from "@/lib/research/contracts";
import {
  RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN,
} from "@/lib/security/research-limits";

/** A deliberately small JSON-Schema value type shared by the provider adapters. */
export type JsonSchemaValue =
  | string
  | number
  | boolean
  | null
  | JsonSchemaValue[]
  | { [key: string]: JsonSchemaValue };

export type JsonSchemaObject = { [key: string]: JsonSchemaValue };

export type StructuredTaskKind = "extraction" | "reconciliation" | "explanation";

export const structuredTaskKinds = ["extraction", "reconciliation", "explanation"] as const satisfies readonly StructuredTaskKind[];

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

export const structuredTaskProviders = ["gemini", "groq", "openrouter"] as const satisfies readonly ResearchExtractionProvider[];

export type StructuredProviderUnavailableReason = Extract<
  ResearchProviderAttemptFailureKind,
  "rate-limit" | "authentication" | "policy" | "capability"
>;

export type StructuredProviderHealth = {
  readonly unavailable: Partial<Record<ResearchExtractionProvider, StructuredProviderUnavailableReason>>;
};

export function createStructuredProviderHealth(): StructuredProviderHealth {
  return { unavailable: {} };
}

type ProviderBudgetMap = Record<ResearchExtractionProvider, number>;

export type StructuredAiBudget = {
  /** The stage whose server-owned ceiling this mutable counter represents. Omitted only for legacy extraction callers. */
  readonly stage?: StructuredTaskKind;
  readonly limit: number;
  used: number;
  readonly providerLimits: ProviderBudgetMap;
  providerUsed: ProviderBudgetMap;
};

/** Compatibility type retained for Phase 2D callers. */
export type ExtractionBudget = StructuredAiBudget & { readonly stage?: "extraction" };

function stageLimit(stage: StructuredTaskKind): number {
  if (stage === "reconciliation") return RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN;
  if (stage === "explanation") return RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN;
  return RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN;
}

function invalidBudget(stage: StructuredTaskKind): never {
  throw new Error(`invalid ${stage} attempt budget`);
}

export function assertValidAiBudget(
  budget: StructuredAiBudget,
  expectedStage: StructuredTaskKind = budget?.stage ?? "extraction",
): asserts budget is StructuredAiBudget {
  if (!structuredTaskKinds.includes(expectedStage)) invalidBudget(expectedStage);
  if (
    budget === null ||
    typeof budget !== "object" ||
    (budget.stage !== expectedStage && !(expectedStage === "extraction" && budget.stage === undefined)) ||
    !Number.isSafeInteger(budget.limit) ||
    budget.limit < 0 ||
    budget.limit > stageLimit(expectedStage) ||
    !Number.isSafeInteger(budget.used) ||
    budget.used < 0 ||
    budget.used > budget.limit ||
    budget.providerLimits === null ||
    typeof budget.providerLimits !== "object" ||
    budget.providerUsed === null ||
    typeof budget.providerUsed !== "object"
  ) {
    invalidBudget(expectedStage);
  }

  for (const provider of structuredTaskProviders) {
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
      invalidBudget(expectedStage);
    }
  }
}

export function assertValidExtractionBudget(budget: ExtractionBudget): void {
  try {
    assertValidAiBudget(budget, "extraction");
  } catch {
    // Preserve the exact Phase 2D error contract.
    throw new Error("invalid extraction attempt budget");
  }
}

export function createStructuredAiBudget(
  stage: StructuredTaskKind,
  limit = stageLimit(stage),
  providerLimits: Partial<Record<ResearchExtractionProvider, number>> = {},
): StructuredAiBudget {
  const budget: StructuredAiBudget = {
    stage,
    limit,
    used: 0,
    providerLimits: {
      gemini: providerLimits.gemini ?? limit,
      groq: providerLimits.groq ?? limit,
      openrouter: providerLimits.openrouter ?? limit,
    },
    providerUsed: { gemini: 0, groq: 0, openrouter: 0 },
  };
  assertValidAiBudget(budget, stage);
  return budget;
}

export function createExtractionBudget(
  limit = RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN,
  providerLimits: Partial<Record<ResearchExtractionProvider, number>> = {},
): ExtractionBudget {
  try {
    return createStructuredAiBudget("extraction", limit, providerLimits) as ExtractionBudget;
  } catch {
    throw new Error("invalid extraction attempt budget");
  }
}

export function createReconciliationBudget(
  limit = RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN,
  providerLimits: Partial<Record<ResearchExtractionProvider, number>> = {},
): StructuredAiBudget {
  return createStructuredAiBudget("reconciliation", limit, providerLimits);
}

export function createExplanationBudget(
  limit = RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN,
  providerLimits: Partial<Record<ResearchExtractionProvider, number>> = {},
): StructuredAiBudget {
  return createStructuredAiBudget("explanation", limit, providerLimits);
}

export function accountInjectedStructuredAttempts(input: {
  budget: StructuredAiBudget;
  attempts: readonly ResearchProviderAttempt[];
  provider?: ResearchExtractionProvider;
  hasPayload: boolean;
  stage: StructuredTaskKind;
}): void {
  const actual = input.attempts.filter((attempt) => attempt.outcome !== "skipped");
  for (const attempt of input.attempts) {
    if (attempt.stage !== input.stage) {
      throw new Error("injected structured task returned an attempt for the wrong stage");
    }
    if (
      attempt.provider !== "gemini" &&
      attempt.provider !== "groq" &&
      attempt.provider !== "openrouter"
    ) {
      throw new Error("injected structured task returned a non-AI provider attempt");
    }
  }

  const required = actual.length || (input.hasPayload ? 1 : 0);
  if (required > input.budget.limit - input.budget.used) {
    throw new Error("injected structured task exceeded the shared attempt budget");
  }

  const providerCounts = new Map<ResearchExtractionProvider, number>();
  for (const attempt of actual) {
    const provider = attempt.provider as ResearchExtractionProvider;
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
  }
  if (actual.length === 0 && input.hasPayload && input.provider !== undefined) {
    providerCounts.set(input.provider, 1);
  }
  for (const [provider, count] of providerCounts) {
    if (count > input.budget.providerLimits[provider] - input.budget.providerUsed[provider]) {
      throw new Error("injected structured task exceeded the provider attempt budget");
    }
  }

  input.budget.used += required;
  for (const [provider, count] of providerCounts) {
    input.budget.providerUsed[provider] += count;
  }
}

export const createAiBudget = createStructuredAiBudget;
export const createStageBudget = createStructuredAiBudget;

export type StructuredTaskRequest = {
  kind: StructuredTaskKind;
  prompt: string;
  schema: JsonSchemaObject;
  segment: StructuredTaskSegment;
  categories: readonly ResearchCategory[];
  target: StructuredTaskTargetContext;
};

export type StructuredAdapterInput = {
  /** `kind` is the preferred name; `stage` is a compatibility alias. */
  kind?: StructuredTaskKind;
  stage?: StructuredTaskKind;
  prompt: string;
  schema: JsonSchemaObject;
  apiKey?: string;
  signal?: AbortSignal;
  budget?: StructuredAiBudget;
  providerHealth?: StructuredProviderHealth;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  requireOpenRouterZdr?: boolean;
};

export type StructuredProviderOptions = {
  kind?: StructuredTaskKind;
  stage?: StructuredTaskKind;
  apiKey?: string;
  signal?: AbortSignal;
  budget?: StructuredAiBudget;
  providerHealth?: StructuredProviderHealth;
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
