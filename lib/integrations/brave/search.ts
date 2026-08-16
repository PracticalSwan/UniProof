import "server-only";

import {
  RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS,
  RESEARCH_MAX_DISCOVERY_QUERY_WORDS,
  RESEARCH_MAX_DISCOVERY_RESULTS,
  RESEARCH_REQUEST_TIMEOUT_MS,
} from "@/lib/security/research-limits";
import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { readBoundedJson } from "@/lib/integrations/read-bounded-response";
import type { DiscoveryQuery, ProviderSearchResult } from "@/lib/research/discovery/types";

type BraveFetch = typeof fetch;
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

function queryIsBounded(query: string): boolean {
  return query.length <= RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS && query.trim().split(/\s+/u).length <= RESEARCH_MAX_DISCOVERY_QUERY_WORDS;
}

function safeRetryAfter(value: string | null): number {
  if (value === null) return 0;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.min(Math.round(seconds * 1_000), 1_000);
}

export async function searchBrave(
  query: DiscoveryQuery,
  options: {
    apiKey?: string;
    fetchImpl?: BraveFetch;
    sleep?: (milliseconds: number) => Promise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<ProviderSearchResult> {
  const startedAt = Date.now();
  const apiKey = options.apiKey ?? process.env.BRAVE_SEARCH_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    return {
      outcome: "skipped",
      candidates: [],
      retryCount: 0,
      durationMs: 0,
      failureKind: "configuration",
      warning: "Brave Search is not configured",
    };
  }
  if (!queryIsBounded(query.text)) {
    return {
      outcome: "failed",
      candidates: [],
      retryCount: 0,
      durationMs: 0,
      failureKind: "policy",
      warning: "discovery query exceeds the server bound",
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let retryCount = 0;
  while (true) {
    if (options.signal?.aborted) {
      return { outcome: "skipped", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: "budget", warning: "Brave call budget was reached" };
    }
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abortListener = externalSignal === undefined ? undefined : () => controller.abort();
    if (externalSignal !== undefined && abortListener !== undefined) externalSignal.addEventListener("abort", abortListener, { once: true });
    const timeout = setTimeout(() => controller.abort(), RESEARCH_REQUEST_TIMEOUT_MS);
    try {
      const url = new URL(BRAVE_ENDPOINT);
      url.searchParams.set("q", query.text);
      url.searchParams.set("count", String(Math.min(query.maxResults, RESEARCH_MAX_DISCOVERY_RESULTS)));
      if (query.countryCode !== undefined) url.searchParams.set("country", query.countryCode.toUpperCase());
      if (query.locale !== undefined) url.searchParams.set("search_lang", query.locale.split("-")[0].toLowerCase());
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "X-Subscription-Token": apiKey,
        },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        return { outcome: "failed", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: "authentication", warning: "Brave authentication failed" };
      }
      if (response.status === 429 || response.status >= 500) {
        if (retryCount < 1) {
          retryCount += 1;
          await sleep(safeRetryAfter(response.headers.get("retry-after")));
          continue;
        }
        return { outcome: "failed", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: response.status === 429 ? "rate-limit" : "upstream", warning: "Brave did not return a usable response" };
      }
      if (!response.ok) {
        return { outcome: "failed", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: "upstream", warning: "Brave did not return a usable response" };
      }
      const payload = await readBoundedJson(response, 250_000);
      const results =
        payload !== null && typeof payload === "object" && payload !== null &&
        typeof (payload as { web?: unknown }).web === "object" && (payload as { web?: { results?: unknown } }).web !== null &&
        Array.isArray((payload as { web: { results?: unknown } }).web.results)
          ? (payload as { web: { results: unknown[] } }).web.results
          : null;
      if (results === null) {
        return { outcome: "failed", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: "invalid-response", warning: "Brave returned an invalid response" };
      }
      const candidates = results.flatMap((result, index) => {
        if (typeof result !== "object" || result === null) return [];
        const record = result as { url?: unknown; title?: unknown };
        if (typeof record.url !== "string") return [];
        const candidate = normalizeCandidateSource(
          {
            url: record.url,
            title: typeof record.title === "string" ? record.title : undefined,
            rank: index + 1,
            sourceType: "independent",
          },
          {
            discoveryProvider: "brave",
            requestedCategory: query.category,
            discoveryQueryId: query.id,
            discoveredAt: new Date().toISOString(),
            trustedOfficialHost: query.target.officialHost,
          },
        );
        return candidate === null ? [] : [candidate];
      });
      return { outcome: candidates.length === 0 ? "empty" : "success", candidates, retryCount, durationMs: Date.now() - startedAt };
    } catch (error) {
      if (options.signal?.aborted) {
        return { outcome: "skipped", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: "budget", warning: "Brave call budget was reached" };
      }
      if (retryCount < 1) {
        retryCount += 1;
        await sleep(0);
        continue;
      }
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return { outcome: "failed", candidates: [], retryCount, durationMs: Date.now() - startedAt, failureKind: isTimeout ? "timeout" : "upstream", warning: "Brave request failed" };
    } finally {
      clearTimeout(timeout);
      if (abortListener !== undefined) options.signal?.removeEventListener("abort", abortListener);
    }
  }
}

export const search = searchBrave;
