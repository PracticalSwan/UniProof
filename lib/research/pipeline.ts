import "server-only";

import {
  canonicalizeResearchCategories,
  researchRequestSchema,
  researchResultSchema,
  type CandidateSource,
  type ResearchCategory,
  type ResearchFailure,
  type ResearchProviderAttempt,
  type ResearchRequest,
  type ResearchResult,
  type ResearchSource,
  type ResearchDocument,
} from "@/lib/research/contracts";
import { RESEARCH_MAX_SOURCES_PER_RUN } from "@/lib/security/research-limits";
import { discoverResearch } from "./discovery/orchestrator";
import type {
  DiscoveryCategoryStatus,
  DiscoveryOptions,
  TargetResolutionResult,
} from "./discovery/types";
import { normalizeRetrievedDocument } from "./normalization/document";
import { fetchPublicUrl } from "./retrieval/fetch-public";
import type { RetrievalResult } from "./retrieval/types";

export type DiscoveryRetrievalCategoryState = {
  category: ResearchCategory;
  discoveryStatus: DiscoveryCategoryStatus;
  complete: boolean;
  reason?: ResearchFailure["code"];
};

export type ResearchDiscoveryRetrievalStageResult = {
  request: ResearchRequest;
  resolution: TargetResolutionResult;
  candidateSources: readonly CandidateSource[];
  sources: readonly ResearchSource[];
  documents: readonly ResearchDocument[];
  providerAttempts: readonly ResearchProviderAttempt[];
  categoryStates: readonly DiscoveryRetrievalCategoryState[];
  documentCategories: Readonly<Record<string, readonly ResearchCategory[]>>;
  failures: readonly ResearchFailure[];
  warnings: readonly string[];
  duplicateCategories: readonly ResearchCategory[];
};

export type DiscoveryRetrievalOptions = {
  discovery?: DiscoveryOptions;
  retrieve?: (url: string, options?: { signal?: AbortSignal }) => Promise<RetrievalResult>;
  signal?: AbortSignal;
};

function retrievalFailureCode(code: string): ResearchFailure["code"] {
  if (code === "cancelled") return "cancelled";
  if (code.includes("timeout")) return "timeout";
  if (code === "normalization" || code.includes("content-type") || code.includes("encoding")) return "normalization";
  if (code === "blocked-target" || code === "invalid-url" || code === "dns-failed") return "source-discovery";
  return "retrieval";
}

function addCategories(target: Map<string, Set<ResearchCategory>>, key: string, categories: readonly ResearchCategory[]): void {
  const existing = target.get(key) ?? new Set<ResearchCategory>();
  for (const category of categories) existing.add(category);
  target.set(key, existing);
}

const categoryFailurePriority: readonly ResearchFailure["code"][] = [
  "cancelled",
  "timeout",
  "source-discovery",
  "retrieval",
  "normalization",
  "source-limit",
  "provider-rate-limit",
  "provider-error",
  "unknown",
];

function recordCategoryFailure(
  failures: Map<ResearchCategory, ResearchFailure["code"]>,
  category: ResearchCategory,
  code: ResearchFailure["code"],
): void {
  const existing = failures.get(category);
  if (existing === undefined || categoryFailurePriority.indexOf(code) < categoryFailurePriority.indexOf(existing)) {
    failures.set(category, code);
  }
}

export async function runDiscoveryRetrievalStage(
  input: unknown,
  options: DiscoveryRetrievalOptions = {},
): Promise<ResearchDiscoveryRetrievalStageResult> {
  const parsed = researchRequestSchema.safeParse(input);
  if (!parsed.success) throw new Error("research request failed contract validation");
  const request: ResearchRequest = {
    ...parsed.data,
    categories: canonicalizeResearchCategories(parsed.data.categories),
  };
  const signal = options.signal ?? options.discovery?.signal;
  const discovery = await discoverResearch(request, { ...options.discovery, signal });
  const associationByUrl = new Map(
    discovery.categoryAssociations.map((entry) => [entry.url, new Set(entry.categories)]),
  );
  const sources: ResearchSource[] = [];
  const documents: ResearchDocument[] = [];
  const failures: ResearchFailure[] = [];
  const duplicateCategories = new Set<ResearchCategory>();
  const documentCategorySets = new Map<string, Set<ResearchCategory>>();
  const canonicalUrlToDocument = new Map<string, string>();
  const contentHashToDocument = new Map<string, string>();
  const failedCategories = new Map<ResearchCategory, ResearchFailure["code"]>();
  const retrieve = options.retrieve ?? ((url, retrievalOptions) => fetchPublicUrl(url, retrievalOptions));

  for (const candidate of discovery.candidateSources.slice(0, RESEARCH_MAX_SOURCES_PER_RUN)) {
    const categories = canonicalizeResearchCategories([
      ...(associationByUrl.get(candidate.url) ?? (candidate.requestedCategory === undefined ? [] : [candidate.requestedCategory])),
    ]);
    if (signal?.aborted) {
      for (const category of categories) recordCategoryFailure(failedCategories, category, "cancelled");
      continue;
    }
    const retrieval = await retrieve(candidate.url, { signal });
    if (!retrieval.ok) {
      const code = retrievalFailureCode(retrieval.code);
      for (const category of categories) {
        recordCategoryFailure(failedCategories, category, code);
        failures.push({
          category,
          code,
          message: code === "cancelled"
            ? "source retrieval was cancelled before completion"
            : "source retrieval did not produce a usable document",
        });
      }
      continue;
    }

    const canonicalDocumentId = canonicalUrlToDocument.get(retrieval.canonicalUrl);
    if (canonicalDocumentId !== undefined) {
      addCategories(documentCategorySets, canonicalDocumentId, categories);
      for (const category of categories) duplicateCategories.add(category);
      continue;
    }

    const normalized = normalizeRetrievedDocument(candidate, retrieval);
    if (!normalized.ok) {
      for (const category of categories) {
        recordCategoryFailure(failedCategories, category, "normalization");
        failures.push({
          category,
          code: "normalization",
          message: "source normalization did not produce a usable document",
        });
      }
      continue;
    }

    const duplicateDocumentId = contentHashToDocument.get(normalized.document.contentHash);
    if (duplicateDocumentId !== undefined) {
      canonicalUrlToDocument.set(retrieval.canonicalUrl, duplicateDocumentId);
      addCategories(documentCategorySets, duplicateDocumentId, categories);
      for (const category of categories) duplicateCategories.add(category);
      continue;
    }

    canonicalUrlToDocument.set(retrieval.canonicalUrl, normalized.document.id);
    contentHashToDocument.set(normalized.document.contentHash, normalized.document.id);
    addCategories(documentCategorySets, normalized.document.id, categories);
    sources.push(normalized.source);
    documents.push(normalized.document);
  }

  const discoveryByCategory = new Map(discovery.categoryOutcomes.map((entry) => [entry.category, entry]));
  const categoryStates: DiscoveryRetrievalCategoryState[] = request.categories.map((category) => {
    const discoveryState = discoveryByCategory.get(category);
    const discoveryStatus = discoveryState?.status ?? "failed";
    if (discoveryStatus === "empty") return { category, discoveryStatus, complete: true };
    if (discoveryStatus !== "covered") {
      const reason: ResearchFailure["code"] = discoveryState?.reason === "cancelled"
        ? "cancelled"
        : discoveryState?.reason === "timeout"
          ? "timeout"
          : discoveryState?.reason === "source-limit"
            ? "source-limit"
            : "source-discovery";
      return { category, discoveryStatus, complete: false, reason };
    }
    const retrievalReason = failedCategories.get(category);
    return retrievalReason === undefined
      ? { category, discoveryStatus, complete: true }
      : { category, discoveryStatus, complete: false, reason: retrievalReason };
  });

  const documentCategories = Object.fromEntries(
    documents.map((document) => [
      document.id,
      canonicalizeResearchCategories([...(documentCategorySets.get(document.id) ?? new Set<ResearchCategory>())]),
    ]),
  );

  return {
    request,
    resolution: discovery.resolution,
    candidateSources: discovery.candidateSources,
    sources,
    documents,
    providerAttempts: discovery.providerAttempts,
    categoryStates,
    documentCategories,
    failures,
    warnings: discovery.warnings,
    duplicateCategories: canonicalizeResearchCategories([...duplicateCategories]),
  };
}

export async function runDiscoveryRetrieval(
  input: unknown,
  options: DiscoveryRetrievalOptions & {
    runId?: string;
    now?: () => string;
  } = {},
): Promise<ResearchResult> {
  const stage = await runDiscoveryRetrievalStage(input, options);
  const now = options.now ?? (() => new Date().toISOString());
  const timestamp = now();
  const categories = [...stage.request.categories];
  const compatibilityFailures: ResearchFailure[] = [...stage.failures];
  for (const state of stage.categoryStates) {
    if (state.discoveryStatus === "covered") continue;
    compatibilityFailures.push({
      category: state.category,
      code: state.reason ?? "source-discovery",
      message: "no usable discovery candidate was found",
    });
  }
  for (const category of stage.duplicateCategories) {
    compatibilityFailures.push({
      category,
      code: "source-limit",
      message: "duplicate normalized source content was omitted",
    });
  }
  const failures = compatibilityFailures;
  const failedCategories = canonicalizeResearchCategories(
    failures.flatMap((failure) => failure.category === undefined ? [] : [failure.category]),
  );
  const result = researchResultSchema.safeParse({
    run: {
      id: options.runId ?? `run-${timestamp.replace(/[^0-9A-Za-z]+/g, "-").slice(0, 80)}`,
      status: "running",
      createdAt: timestamp,
      updatedAt: timestamp,
      partial: false,
      providerAttempts: stage.providerAttempts,
      processedCategories: [],
      unprocessedCategories: categories,
    },
    candidateSources: stage.candidateSources,
    sources: stage.sources,
    documents: stage.documents,
    candidates: [],
    claims: [],
    explanations: [],
    evidenceSummary: {
      statusCounts: {
        verified: 0,
        corroborated: 0,
        "university-reported": 0,
        conflicting: 0,
        anecdotal: 0,
        inferred: 0,
        unknown: 0,
        outdated: 0,
      },
      totalClaims: 0,
      categoryCoverage: [],
      categoriesProcessed: [],
      categoriesWithConflicts: [],
      categoriesUnknown: [],
      categoriesOutdated: [],
      categoriesUnprocessed: categories,
      categoriesFailed: failedCategories,
    },
    failures,
    warnings: [...stage.warnings],
  });
  if (!result.success) throw new Error("research pipeline produced an invalid result");
  return result.data;
}

export const runResearchPipeline = runDiscoveryRetrieval;
