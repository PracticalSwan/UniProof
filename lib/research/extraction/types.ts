import type {
  ClaimCandidate,
  ResearchCategory,
  ResearchDocument,
  ResearchProviderAttempt,
} from "@/lib/research/contracts";
import type { ExtractionBudget, StructuredProviderOptions, StructuredTaskTargetContext } from "@/lib/research/ai/types";
import type { PortableExtractionPayload } from "./schema";

export type ExtractionSegment = {
  id: string;
  sourceId: string;
  documentId: string;
  sectionOrdinal: number;
  chunkOrdinal: number;
  text: string;
  heading?: string;
};

export type ExtractionTargetIdentity = StructuredTaskTargetContext & {
  universityId?: string;
  programId?: string;
};

export type ExtractionTask = {
  segment: ExtractionSegment;
  categories: readonly ResearchCategory[];
  target: ExtractionTargetIdentity;
  document: ResearchDocument;
};

export type PromotionRejectionReason =
  | "invalid-category"
  | "unknown-segment"
  | "supporting-text-not-exact"
  | "supporting-text-empty"
  | "domain-contract";

export type PromotionResult = {
  candidates: readonly ClaimCandidate[];
  rejectedCount: number;
  rejectionReasons: readonly PromotionRejectionReason[];
  validClaimCount: number;
  allClaimsFailedIntegrity: boolean;
  empty: boolean;
  validEnvelope: boolean;
};

export type ExtractionFailure = {
  kind: "invalid-response" | "configuration" | "authentication" | "rate-limit" | "timeout" | "upstream" | "capability" | "policy" | "budget";
  segmentId?: string;
  provider?: string;
};

export type ExtractionStageResult = {
  candidates: readonly ClaimCandidate[];
  providerAttempts: readonly ResearchProviderAttempt[];
  failures: readonly ExtractionFailure[];
  warnings: readonly string[];
  processedSegmentIds: readonly string[];
  unprocessedSegmentIds: readonly string[];
  unfinished: boolean;
  budget: { limit: number; used: number };
};

export type ExtractionOptions = {
  categories: readonly ResearchCategory[];
  target?: ExtractionTargetIdentity;
  geminiApiKey?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  requireOpenRouterZdr?: boolean;
  signal?: AbortSignal;
  budget?: ExtractionBudget;
  providerOptions?: Omit<StructuredProviderOptions, "apiKey" | "signal" | "budget">;
  /** Test seam for the complete per-segment provider chain. */
  runTask?: (task: ExtractionTask, options: ExtractionOptions) => Promise<{
    payload?: PortableExtractionPayload;
    model?: string;
    provider?: string;
    attempts: readonly ResearchProviderAttempt[];
    failureKind?: ExtractionFailure["kind"];
    aborted?: boolean;
  }>;
};

export type PromotionInput = {
  payload: unknown;
  task: ExtractionTask;
  provider: string;
  model: string;
};
