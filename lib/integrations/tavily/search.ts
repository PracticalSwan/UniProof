import "server-only";

import {
  RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS,
  RESEARCH_MAX_DISCOVERY_QUERY_WORDS,
  RESEARCH_REQUEST_TIMEOUT_MS,
  RESEARCH_MAX_DISCOVERY_RESULTS,
} from "@/lib/security/research-limits";
import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { readBoundedJson } from "@/lib/integrations/read-bounded-response";
import { waitForRetryDelay } from "@/lib/integrations/abortable-delay";
import type { DiscoveryQuery, ProviderSearchResult } from "@/lib/research/discovery/types";

type TavilyFetch = typeof fetch;

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

function queryIsBounded(query: string): boolean {
  return query.length <= RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS && query.trim().split(/\s+/u).length <= RESEARCH_MAX_DISCOVERY_QUERY_WORDS;
}

function boundedRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  const milliseconds = Math.round(seconds * 1_000);
  return milliseconds <= 1_000 ? milliseconds : undefined;
}

function failure(
  outcome: ProviderSearchResult["outcome"],
  failureKind: ProviderSearchResult["failureKind"],
  retryCount: number,
  startedAt: number,
  warning: string,
): ProviderSearchResult {
  return {
    outcome,
    candidates: [],
    retryCount,
    durationMs: Math.max(0, Date.now() - startedAt),
    ...(failureKind === undefined ? {} : { failureKind }),
    warning,
  };
}

export async function searchTavily(
  query: DiscoveryQuery,
  options: {
    apiKey?: string;
    fetchImpl?: TavilyFetch;
    sleep?: (milliseconds: number) => Promise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<ProviderSearchResult> {
  const startedAt = Date.now();
  const apiKey = options.apiKey ?? process.env.TAVILY_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    return failure("skipped", "configuration", 0, startedAt, "Tavily is not configured");
  }
  if (!queryIsBounded(query.text)) {
    return failure("failed", "policy", 0, startedAt, "discovery query exceeds the server bound");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let retryCount = 0;
  while (true) {
    if (options.signal?.aborted) {
      return failure("skipped", "budget", retryCount, startedAt, "Tavily call budget was reached");
    }
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abortListener = externalSignal === undefined ? undefined : () => controller.abort();
    if (externalSignal !== undefined && abortListener !== undefined) externalSignal.addEventListener("abort", abortListener, { once: true });
    const timeout = setTimeout(() => controller.abort(), RESEARCH_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(TAVILY_ENDPOINT, {
        method: "POST",
        redirect: "error",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: query.text,
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false,
          auto_parameters: false,
          max_results: Math.min(query.maxResults, RESEARCH_MAX_DISCOVERY_RESULTS),
        }),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return failure("failed", "authentication", retryCount, startedAt, "Tavily authentication failed");
      }
      if (response.status === 429 || response.status >= 500) {
        try {
          void response.body?.cancel("provider status body discarded")?.catch(() => undefined);
        } catch {
          // Status classification and bounded retry behavior must not depend
          // on an untrusted provider body cleanup promise.
        }
        const retryDelay = response.status === 429
          ? boundedRetryAfter(response.headers.get("retry-after"))
          : 0;
        if (retryCount < 1 && retryDelay !== undefined) {
          retryCount += 1;
          const mayRetry = await waitForRetryDelay(retryDelay, options.signal, sleep);
          if (!mayRetry) {
            return failure("skipped", "budget", retryCount, startedAt, "Tavily call budget was reached");
          }
          continue;
        }
        return failure("failed", response.status === 429 ? "rate-limit" : "upstream", retryCount, startedAt, "Tavily did not return a usable response");
      }
      if (!response.ok) {
        return failure("failed", "upstream", retryCount, startedAt, "Tavily did not return a usable response");
      }

      const payload = await readBoundedJson(response, 250_000);
      if (payload === null || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
        return failure("failed", "invalid-response", retryCount, startedAt, "Tavily returned an invalid response");
      }

      const candidates = (payload as { results: unknown[] }).results.flatMap((result, index) => {
        if (typeof result !== "object" || result === null) return [];
        const record = result as { url?: unknown; title?: unknown; score?: unknown };
        if (typeof record.url !== "string") return [];
        const candidate = normalizeCandidateSource(
          {
            url: record.url,
            title: typeof record.title === "string" ? record.title : undefined,
            relevanceScore: typeof record.score === "number" ? record.score : undefined,
            rank: index + 1,
            sourceType: "independent",
          },
          {
            discoveryProvider: "tavily",
            requestedCategory: query.category,
            discoveryQueryId: query.id,
            discoveredAt: new Date().toISOString(),
            trustedOfficialHost: query.target.officialHost,
          },
        );
        return candidate === null ? [] : [candidate];
      });

      return {
        outcome: candidates.length === 0 ? "empty" : "success",
        candidates,
        retryCount,
        durationMs: Math.max(0, Date.now() - startedAt),
      };
    } catch (error) {
      if (options.signal?.aborted) {
        return failure("skipped", "budget", retryCount, startedAt, "Tavily call budget was reached");
      }
      if (retryCount < 1) {
        retryCount += 1;
        const mayRetry = await waitForRetryDelay(0, options.signal, sleep);
        if (!mayRetry) {
          return failure("skipped", "budget", retryCount, startedAt, "Tavily call budget was reached");
        }
        continue;
      }
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return failure("failed", isTimeout ? "timeout" : "upstream", retryCount, startedAt, "Tavily request failed");
    } finally {
      clearTimeout(timeout);
      if (abortListener !== undefined) options.signal?.removeEventListener("abort", abortListener);
    }
  }
}

export const search = searchTavily;
