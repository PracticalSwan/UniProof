import type { ResearchResult } from "@/lib/research/contracts";
import type { ExtractionOptions } from "@/lib/research/extraction/types";
import type { DiscoveryOptions } from "@/lib/research/discovery/types";
import type { ReconciliationOptions } from "@/lib/research/reconciliation/types";
import type { RetrievalResult } from "@/lib/research/retrieval/types";

export type Phase2ResearchOptions = {
  createRunId?: () => string;
  now?: () => string;
  signal?: AbortSignal;
  discovery?: DiscoveryOptions;
  retrieve?: (url: string, options?: { signal?: AbortSignal }) => Promise<RetrievalResult>;
  extraction?: Omit<
    ExtractionOptions,
    "categories" | "categoriesByDocumentId" | "target" | "signal"
  >;
  reconciliation?: Omit<
    ReconciliationOptions,
    | "candidates"
    | "sources"
    | "documents"
    | "target"
    | "requestedPeriod"
    | "decisionEligibleCategories"
    | "signal"
    | "explain"
    | "enableExplanations"
    | "explanation"
  >;
};

export type Phase2ResearchResult = ResearchResult;
