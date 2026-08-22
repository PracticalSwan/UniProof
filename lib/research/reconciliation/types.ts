import type {
  ClaimCandidate,
  EvidenceExplanation,
  ResearchCategory,
  ResearchDocument,
  ResearchProviderAttempt,
  ResearchSource,
  VerifiedClaim,
} from "@/lib/research/contracts";
import type { ResolvedResearchTarget } from "@/lib/research/discovery/types";
import type {
  StructuredAiBudget,
  StructuredProviderOptions,
} from "@/lib/research/ai/types";

export type ResearchPeriodContext = {
  academicYear?: string;
  intake?: string;
  effectiveDate?: string;
};

export type SemanticRelationshipKind =
  | "equivalent"
  | "contradictory"
  | "different-period"
  | "different-scope"
  | "general-specific-compatible"
  | "conditional-exception"
  | "broader-narrower-compatible"
  | "insufficient-evidence";

export type SemanticResolution = "deterministic" | "model";

export type SemanticQuestion = {
  questionId: string;
  leftCandidateId: string;
  rightCandidateId: string;
  category: ResearchCategory;
  property: string;
};

export type ValidatedSemanticRelationship = SemanticQuestion & {
  relationship: SemanticRelationshipKind;
  resolution: SemanticResolution;
};

export type NormalizedCandidateView = {
  candidate: ClaimCandidate;
  universityKey: string;
  programKey?: string;
  propertyKey: string;
  valueKey: string;
  valueType: "string" | "number" | "boolean";
  unitKey?: string;
  currencyKey?: string;
  academicYearKey?: string;
  intakeKey?: string;
  effectiveDateKey?: string;
  passageKey: string;
  scopeKey: string;
};

export type PairPlanningResult = {
  questions: readonly SemanticQuestion[];
  deterministicRelationships: readonly ValidatedSemanticRelationship[];
  overflow: boolean;
  overflowCategories: readonly ResearchCategory[];
  overflowQuestionIds: readonly string[];
};

export type ReconciliationFailure = {
  kind:
    | "configuration"
    | "authentication"
    | "rate-limit"
    | "timeout"
    | "upstream"
    | "invalid-response"
    | "capability"
    | "policy"
    | "budget";
  provider?: string;
  questionIds?: readonly string[];
};

export type ReconciliationWarning = string;

export type ReconciliationBudgetUsage = {
  limit: number;
  used: number;
  providerUsed: Readonly<Record<"gemini" | "groq" | "openrouter", number>>;
};

export type ReconciliationRunTaskResult = {
  payload?: unknown;
  provider?: "gemini" | "groq" | "openrouter";
  model?: string;
  attempts: readonly ResearchProviderAttempt[];
  failureKind?: ReconciliationFailure["kind"];
  aborted?: boolean;
};

export type ReconciliationTask = {
  questions: readonly SemanticQuestion[];
  candidates: readonly ClaimCandidate[];
  target: ResolvedResearchTarget;
  requestedPeriod?: ResearchPeriodContext;
};

export type ExplanationTask = {
  claims: readonly VerifiedClaim[];
  categories: readonly ResearchCategory[];
};

export type ReconciliationOptions = {
  candidates: readonly ClaimCandidate[];
  sources: readonly ResearchSource[];
  documents: readonly ResearchDocument[];
  target: ResolvedResearchTarget;
  requestedPeriod?: ResearchPeriodContext;
  decisionEligibleCategories: readonly ResearchCategory[];
  geminiApiKey?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  requireOpenRouterZdr?: boolean;
  signal?: AbortSignal;
  budget?: StructuredAiBudget;
  providerOptions?: Omit<StructuredProviderOptions, "apiKey" | "signal" | "budget" | "stage" | "kind">;
  /** Offline seam for deterministic tests. It receives only the public semantic task, never source authority metadata, URLs, or provider secrets. */
  runTask?: (task: ReconciliationTask) => Promise<ReconciliationRunTaskResult>;
  /** Set false to skip optional explanations; true enables the bounded explanation stage. */
  explain?: boolean;
  /** Use the evidence-bound deterministic fallback instead of another provider request. */
  deterministicExplanations?: boolean;
  enableExplanations?: boolean;
  explanation?: boolean;
  explanationBudget?: StructuredAiBudget;
  explanationRunTask?: (input: ExplanationTask) => Promise<{
    payload?: unknown;
    provider?: "gemini" | "groq" | "openrouter";
    model?: string;
    attempts: readonly ResearchProviderAttempt[];
    failureKind?: ReconciliationFailure["kind"];
    aborted?: boolean;
  }>;
};

export type ReconciliationStageResult = {
  claims: readonly VerifiedClaim[];
  relationships: readonly ValidatedSemanticRelationship[];
  unresolvedQuestionIds: readonly string[];
  completedCategories: readonly ResearchCategory[];
  incompleteCategories: readonly ResearchCategory[];
  unknownCategories: readonly ResearchCategory[];
  providerAttempts: readonly ResearchProviderAttempt[];
  failures: readonly ReconciliationFailure[];
  warnings: readonly ReconciliationWarning[];
  explanations: readonly EvidenceExplanation[];
  reconciliationBudget: ReconciliationBudgetUsage;
  explanationBudget: ReconciliationBudgetUsage;
};
