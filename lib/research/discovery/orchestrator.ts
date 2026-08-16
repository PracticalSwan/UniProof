import "server-only";

import {
  researchProviderAttemptSchema,
  researchRequestSchema,
  type CandidateSource,
  type ResearchCategory,
} from "@/lib/research/contracts";
import { searchBrave } from "@/lib/integrations/brave/search";
import { resolveRorId, searchRorAffiliation } from "@/lib/integrations/ror/search";
import { searchTavily } from "@/lib/integrations/tavily/search";
import {
  RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_RUN_TIMEOUT_MS,
} from "@/lib/security/research-limits";
import { dedupeCandidates } from "./dedupe";
import { directDiscovery } from "./direct";
import { containsSensitiveResearchData, planDiscoveryQueries } from "./query-plan";
import { resolveResearchTarget, targetHostMatches } from "./resolve-target";
import type {
  DiscoveryAttempt,
  DiscoveryOptions,
  DiscoveryResult,
  ProviderSearchResult,
  ResolvedResearchTarget,
  TargetResolutionResult,
} from "./types";

function boundedWarning(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length === 0 ? undefined : normalized.slice(0, 500);
}

function recordAttempt(
  attempts: DiscoveryAttempt[],
  provider: DiscoveryAttempt["provider"],
  queryId: string,
  category: ResearchCategory | undefined,
  result: Pick<ProviderSearchResult, "outcome" | "retryCount" | "durationMs" | "failureKind">,
): void {
  if (attempts.length >= RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN) return;
  const parsed = researchProviderAttemptSchema.safeParse({
    stage: "discovery",
    provider,
    queryId,
    category,
    outcome: result.outcome,
    retryCount: result.retryCount,
    durationMs: result.durationMs,
    failureKind:
      result.outcome === "failed" || result.outcome === "skipped"
        ? result.failureKind ?? "upstream"
        : result.failureKind,
  });
  if (parsed.success) attempts.push(parsed.data);
}

function appendCandidates(
  target: CandidateSource[],
  candidates: readonly CandidateSource[],
  resolvedTarget: ResolvedResearchTarget,
): void {
  for (const candidate of candidates) {
    if (candidate.sourceType === "independent" && candidate.domain !== undefined && targetHostMatches(candidate.domain, resolvedTarget)) {
      target.push({ ...candidate, sourceType: "university" });
    } else {
      target.push(candidate);
    }
  }
}

function resolutionWarnings(resolution: TargetResolutionResult): string[] {
  return [...resolution.warnings].map((warning) => boundedWarning(warning)).filter(
    (warning): warning is string => warning !== undefined,
  );
}

function mergeResolvedInstitution(target: ResolvedResearchTarget, identity: ResolvedResearchTarget): void {
  target.universityName ??= identity.universityName;
  target.officialUrl ??= identity.officialUrl;
  target.officialHost ??= identity.officialHost;
  target.countryCode ??= identity.countryCode;
  target.rorId ??= identity.rorId;
}

async function withRunBudget<T>(operation: Promise<T>, deadline: number): Promise<T | undefined> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => resolve(undefined), remaining);
  });
  try {
    return await Promise.race([operation, budget]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function executeProvider<T>(
  operation: () => Promise<T>,
  deadline: number,
  fallback: T,
): Promise<T | undefined> {
  try {
    return await withRunBudget(operation(), deadline);
  } catch {
    return fallback;
  }
}

function runBudgetAvailable(attempts: readonly DiscoveryAttempt[], deadline: number): boolean {
  return attempts.length < RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN && Date.now() < deadline;
}

function recordBudgetSkip(
  attempts: DiscoveryAttempt[],
  warnings: string[],
  provider: DiscoveryAttempt["provider"],
  queryId: string,
  category: ResearchCategory | undefined,
): void {
  recordAttempt(attempts, provider, queryId, category, {
    outcome: "skipped",
    retryCount: 0,
    durationMs: 0,
    failureKind: "budget",
  });
  warnings.push("discovery provider call budget was reached; remaining calls were skipped");
}

export async function discoverResearch(
  input: unknown,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const parsed = researchRequestSchema.safeParse(input);
  if (!parsed.success) {
    const resolution: TargetResolutionResult = {
      resolved: false,
      reason: "insufficient-institutional-identity",
      warnings: ["research request failed contract validation"],
    };
    return {
      resolution,
      queries: [],
      candidateSources: [],
      providerAttempts: [],
      coveredCategories: [],
      uncoveredCategories: [],
      warnings: [...resolution.warnings],
    };
  }

  const resolution = await resolveResearchTarget(parsed.data, options.targetResolver);
  const warnings = resolutionWarnings(resolution);
  if (!resolution.resolved) {
    return {
      resolution,
      queries: [],
      candidateSources: [],
      providerAttempts: [],
      coveredCategories: [],
      uncoveredCategories: [...parsed.data.categories],
      warnings,
    };
  }

  if (parsed.data.question !== undefined && containsSensitiveResearchData(parsed.data.question)) {
    warnings.push("research question contains private or sensitive data; it was excluded from discovery queries");
  }

  const candidates: CandidateSource[] = [];
  const providerAttempts: DiscoveryAttempt[] = [];
  const discoveryCoveredCategories = new Set<ResearchCategory>();
  const deadline = Date.now() + RESEARCH_MAX_RUN_TIMEOUT_MS;
  const runController = new AbortController();
  const runTimeout = setTimeout(() => runController.abort(), RESEARCH_MAX_RUN_TIMEOUT_MS);
  (runTimeout as unknown as { unref?: () => void }).unref?.();
  if (resolution.target.rorId !== undefined && (options.rorIdSearch !== undefined || options.enableRor !== false)) {
    const rorId = resolution.target.rorId;
    if (!runBudgetAvailable(providerAttempts, deadline)) {
      recordBudgetSkip(providerAttempts, warnings, "ror", "identity-ror", undefined);
    } else {
      const ror = options.rorIdSearch === undefined
        ? await executeProvider(() => resolveRorId(rorId, {
            universityName: resolution.target.universityName,
            countryCode: resolution.target.countryCode,
            officialHost: resolution.target.officialHost,
            signal: runController.signal,
          }), deadline, { outcome: "failed", failureKind: "upstream", warning: "ROR request failed", retryCount: 0 })
        : await executeProvider(() => options.rorIdSearch!(rorId, {
            universityName: resolution.target.universityName,
            countryCode: resolution.target.countryCode,
            officialHost: resolution.target.officialHost,
            signal: runController.signal,
          }), deadline, { outcome: "failed", failureKind: "upstream", warning: "ROR request failed", retryCount: 0 });
      if (ror === undefined) {
        recordBudgetSkip(providerAttempts, warnings, "ror", "identity-ror", undefined);
      } else {
        recordAttempt(providerAttempts, "ror", "identity-ror", undefined, {
          outcome: ror.outcome,
          retryCount: ror.retryCount ?? 0,
          durationMs: ror.durationMs,
          failureKind: ror.failureKind,
        });
        if (ror.identity !== undefined) {
          mergeResolvedInstitution(resolution.target, ror.identity);
          if (ror.candidate !== undefined && ror.candidate !== null) {
            appendCandidates(candidates, [ror.candidate], resolution.target);
          }
        }
        if (ror.warning !== undefined) {
          const warning = boundedWarning(ror.warning);
          if (warning !== undefined) warnings.push(warning);
        }
      }
    }
  }
  const queries = planDiscoveryQueries(parsed.data, resolution);
  const tavilySearch = options.tavilySearch ?? searchTavily;
  const braveSearch = options.braveSearch ?? searchBrave;

  for (const query of queries) {
    if (query.kind === "identity" && resolution.target.officialUrl !== undefined) continue;
    if (!runBudgetAvailable(providerAttempts, deadline)) {
      recordBudgetSkip(providerAttempts, warnings, "tavily", query.id, query.category);
      break;
    }
    let satisfied = false;
    const tavily = await executeProvider(
      () => tavilySearch(query, { apiKey: options.tavilyApiKey, signal: runController.signal }),
      deadline,
      { outcome: "failed", candidates: [], retryCount: 0, failureKind: "upstream", warning: "Tavily request failed" },
    );
    if (tavily === undefined) {
      recordBudgetSkip(providerAttempts, warnings, "tavily", query.id, query.category);
      break;
    }
    recordAttempt(providerAttempts, "tavily", query.id, query.category, tavily);
    if (tavily.candidates.length > 0) {
      appendCandidates(candidates, tavily.candidates, resolution.target);
      satisfied = true;
      if (query.category !== undefined) discoveryCoveredCategories.add(query.category);
    } else if (tavily.warning !== undefined) {
      const warning = boundedWarning(tavily.warning);
      if (warning !== undefined) warnings.push(warning);
    }

    if (!satisfied) {
      if (!runBudgetAvailable(providerAttempts, deadline)) {
        recordBudgetSkip(providerAttempts, warnings, "brave", query.id, query.category);
        break;
      }
      const brave = await executeProvider(
        () => braveSearch(query, { apiKey: options.braveApiKey, signal: runController.signal }),
        deadline,
        { outcome: "failed", candidates: [], retryCount: 0, failureKind: "upstream", warning: "Brave request failed" },
      );
      if (brave === undefined) {
        recordBudgetSkip(providerAttempts, warnings, "brave", query.id, query.category);
        break;
      }
      recordAttempt(providerAttempts, "brave", query.id, query.category, brave);
      if (brave.candidates.length > 0) {
        appendCandidates(candidates, brave.candidates, resolution.target);
        satisfied = true;
        if (query.category !== undefined) discoveryCoveredCategories.add(query.category);
      } else if (brave.warning !== undefined) {
        const warning = boundedWarning(brave.warning);
        if (warning !== undefined) warnings.push(warning);
      }
    }

    if (!satisfied && query.kind === "category") {
      const direct = directDiscovery(resolution.target, query);
      const directResult: ProviderSearchResult = {
        outcome: direct.outcome,
        candidates: direct.candidate === null ? [] : [direct.candidate],
        retryCount: 0,
        durationMs: 0,
      };
      recordAttempt(providerAttempts, "direct", query.id, query.category, directResult);
      if (directResult.candidates.length > 0) {
        appendCandidates(candidates, directResult.candidates, resolution.target);
        satisfied = true;
        if (query.category !== undefined) discoveryCoveredCategories.add(query.category);
      }
    }

    if (!satisfied && resolution.target.universityName !== undefined && (options.rorSearch !== undefined || options.enableRor !== false)) {
      if (!runBudgetAvailable(providerAttempts, deadline)) {
        recordBudgetSkip(providerAttempts, warnings, "ror", query.id, query.category);
        break;
      }
      const ror = options.rorSearch === undefined
        ? await executeProvider(() => searchRorAffiliation(resolution.target.universityName!, {
            countryCode: resolution.target.countryCode,
            officialHost: resolution.target.officialHost,
            requestedCategory: query.category,
            discoveryQueryId: query.id,
            signal: runController.signal,
          }), deadline, { outcome: "failed", failureKind: "upstream", warning: "ROR request failed", retryCount: 0 })
        : await executeProvider(() => options.rorSearch!(resolution.target.universityName!, {
            countryCode: resolution.target.countryCode,
            officialHost: resolution.target.officialHost,
            requestedCategory: query.category,
            discoveryQueryId: query.id,
            signal: runController.signal,
          }), deadline, { outcome: "failed", failureKind: "upstream", warning: "ROR request failed", retryCount: 0 });
      if (ror === undefined) {
        recordBudgetSkip(providerAttempts, warnings, "ror", query.id, query.category);
        break;
      }
      if (ror.identity !== undefined) {
        mergeResolvedInstitution(resolution.target, ror.identity);
      }
      const rorResult: ProviderSearchResult = {
        outcome: ror.outcome,
        candidates: ror.candidate === undefined || ror.candidate === null ? [] : [ror.candidate],
        retryCount: ror.retryCount ?? 0,
        durationMs: ror.durationMs,
        failureKind: ror.failureKind,
        warning: ror.warning,
      };
      recordAttempt(providerAttempts, "ror", query.id, query.category, rorResult);
      if (rorResult.candidates.length > 0) {
        appendCandidates(candidates, rorResult.candidates, resolution.target);
        satisfied = true;
        if (query.category !== undefined) discoveryCoveredCategories.add(query.category);
      } else if (rorResult.warning !== undefined) {
        const warning = boundedWarning(rorResult.warning);
        if (warning !== undefined) warnings.push(warning);
      }
    }
  }

  const deduped = dedupeCandidates(candidates);
  const coveredCategories = parsed.data.categories.filter((category) => discoveryCoveredCategories.has(category));
  const uncoveredCategories = parsed.data.categories.filter((category) => !discoveryCoveredCategories.has(category));
  clearTimeout(runTimeout);
  return {
    resolution,
    queries,
    candidateSources: deduped,
    providerAttempts,
    coveredCategories,
    uncoveredCategories,
    warnings: [...new Set(warnings)].slice(0, 50),
  };
}

export const runDiscovery = discoverResearch;

export function hasInstitutionalIdentity(target: ResolvedResearchTarget): boolean {
  return target.universityId !== undefined || target.universityName !== undefined || target.officialUrl !== undefined;
}
