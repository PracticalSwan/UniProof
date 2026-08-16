import "server-only";

import {
  researchRequestSchema,
  researchResultSchema,
  type ResearchCategory,
  type ResearchResult,
} from "@/lib/research/contracts";
import { RESEARCH_MAX_SOURCES_PER_RUN } from "@/lib/security/research-limits";
import { discoverResearch } from "./discovery/orchestrator";
import type { DiscoveryOptions } from "./discovery/types";
import { normalizeRetrievedDocument } from "./normalization/document";
import { fetchPublicUrl } from "./retrieval/fetch-public";
import type { RetrievalResult } from "./retrieval/types";

function retrievalFailureCode(code: string): "retrieval" | "normalization" | "timeout" | "source-discovery" {
  if (code.includes("timeout")) return "timeout";
  if (code === "normalization" || code.includes("content-type") || code.includes("encoding")) return "normalization";
  if (code === "blocked-target" || code === "invalid-url" || code === "dns-failed") return "source-discovery";
  return "retrieval";
}

export async function runDiscoveryRetrieval(
  input: unknown,
  options: {
    discovery?: DiscoveryOptions;
    retrieve?: (url: string) => Promise<RetrievalResult>;
    runId?: string;
    now?: () => string;
  } = {},
): Promise<ResearchResult> {
  const request = researchRequestSchema.parse(input);
  const now = options.now ?? (() => new Date().toISOString());
  const timestamp = now();
  const discovery = await discoverResearch(request, options.discovery);
  const sources: ResearchResult["sources"] = [];
  const documents: ResearchResult["documents"] = [];
  const failures: ResearchResult["failures"] = [];
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const retrieve = options.retrieve ?? fetchPublicUrl;

  for (const candidate of discovery.candidateSources.slice(0, RESEARCH_MAX_SOURCES_PER_RUN)) {
    const retrieval = await retrieve(candidate.url);
    if (!retrieval.ok) {
      failures.push({
        category: candidate.requestedCategory,
        code: retrievalFailureCode(retrieval.code),
        message: "source retrieval did not produce a usable document",
      });
      continue;
    }
    if (seenUrls.has(retrieval.canonicalUrl)) continue;
    const normalized = normalizeRetrievedDocument(candidate, retrieval);
    if (!normalized.ok) {
      failures.push({
        category: candidate.requestedCategory,
        code: "normalization",
        message: normalized.message,
      });
      continue;
    }
    if (seenHashes.has(normalized.document.contentHash)) {
      failures.push({
        category: candidate.requestedCategory,
        code: "source-limit",
        message: "duplicate normalized source content was omitted",
      });
      continue;
    }
    seenUrls.add(retrieval.canonicalUrl);
    seenHashes.add(normalized.document.contentHash);
    sources.push(normalized.source);
    documents.push(normalized.document);
  }

  const categories: ResearchCategory[] = [...request.categories];
  const discoveryFailures: ResearchResult["failures"] = discovery.uncoveredCategories.map((category) => ({
    category,
    code: "source-discovery" as const,
    message: "no usable discovery candidate was found",
  }));
  const allFailures = [...failures, ...discoveryFailures];
  const failedCategories = [...new Set(
    allFailures
      .filter((failure) => failure.category !== undefined)
      .map((failure) => failure.category as ResearchCategory),
  )];
  const run = {
    id: options.runId ?? `run-${timestamp.replace(/[^0-9A-Za-z]+/g, "-").slice(0, 80)}`,
    status: "partial" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp,
    partial: true,
    providerAttempts: discovery.providerAttempts,
    discoveryProvider: discovery.providerAttempts[0]?.provider,
    processedCategories: [],
    unprocessedCategories: categories,
  };
  const result = researchResultSchema.safeParse({
    run,
    candidateSources: discovery.candidateSources,
    sources,
    documents,
    candidates: [],
    claims: [],
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
    failures: allFailures,
    warnings: [...discovery.warnings],
  });
  if (!result.success) {
    throw new Error("research pipeline produced an invalid result");
  }
  return result.data;
}

export const runResearchPipeline = runDiscoveryRetrieval;
