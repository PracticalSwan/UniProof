import "server-only";

import {
  canonicalizeResearchCategories,
  researchProviderAttemptSchema,
  researchRequestSchema,
  type CandidateSource,
  type ResearchCategory,
} from "@/lib/research/contracts";
import { searchBrave } from "@/lib/integrations/brave/search";
import { resolveRorId, searchRorAffiliation } from "@/lib/integrations/ror/search";
import { searchTavily } from "@/lib/integrations/tavily/search";
import {
  RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS,
  RESEARCH_MAX_WARNINGS_PER_RUN,
} from "@/lib/security/research-limits";
import { dedupeCandidates } from "./dedupe";
import { directDiscovery } from "./direct";
import { containsSensitiveResearchData, planDiscoveryQueries } from "./query-plan";
import { resolveResearchTarget, targetHostMatches } from "./resolve-target";
import type {
  DiscoveryAttempt,
  DiscoveryCategoryOutcome,
  DiscoveryOptions,
  DiscoveryResult,
  DiscoveryTermination,
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
  if (attempts.length >= RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN) return;
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
  associations: Map<string, Set<ResearchCategory>>,
): void {
  for (const rawCandidate of candidates) {
    const candidate = rawCandidate.sourceType === "independent" &&
      rawCandidate.domain !== undefined &&
      targetHostMatches(rawCandidate.domain, resolvedTarget)
      ? { ...rawCandidate, sourceType: "university" as const }
      : rawCandidate;
    target.push(candidate);
    if (candidate.requestedCategory !== undefined) {
      const categories = associations.get(candidate.url) ?? new Set<ResearchCategory>();
      categories.add(candidate.requestedCategory);
      associations.set(candidate.url, categories);
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

async function executeProvider<T>(operation: () => Promise<T>, deadline: number, fallback: T): Promise<T | undefined> {
  try {
    return await withRunBudget(operation(), deadline);
  } catch {
    return fallback;
  }
}

function runBudgetAvailable(attempts: readonly DiscoveryAttempt[], deadline: number): boolean {
  return attempts.length < RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN && Date.now() < deadline;
}

function budgetWarning(warnings: string[]): void {
  warnings.push("discovery provider call budget was reached; remaining calls were skipped");
}

type CategoryProgress = {
  generalWebCompleted: boolean;
  providerFailed: boolean;
  hadAssociatedCandidate: boolean;
};

function completedGeneralWeb(result: ProviderSearchResult): boolean {
  return result.outcome === "success" || result.outcome === "empty";
}

function safeWarnings(warnings: readonly string[]): string[] {
  return [...new Set(warnings)].slice(0, RESEARCH_MAX_WARNINGS_PER_RUN);
}

export async function discoverResearch(input: unknown, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
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
      categoryOutcomes: [],
      categoryAssociations: [],
      termination: options.signal?.aborted ? "caller-cancelled" : "completed",
      warnings: [...resolution.warnings],
    };
  }

  const request = { ...parsed.data, categories: canonicalizeResearchCategories(parsed.data.categories) };
  if (options.signal?.aborted) {
    const resolution: TargetResolutionResult = {
      resolved: false,
      reason: "insufficient-institutional-identity",
      warnings: ["research discovery was cancelled before target resolution"],
    };
    return {
      resolution,
      queries: [],
      candidateSources: [],
      providerAttempts: [],
      coveredCategories: [],
      uncoveredCategories: [...request.categories],
      categoryOutcomes: request.categories.map((category) => ({ category, status: "failed", reason: "cancelled" })),
      categoryAssociations: [],
      termination: "caller-cancelled",
      warnings: [...resolution.warnings],
    };
  }

  const resolution = await resolveResearchTarget(request, options.targetResolver);
  const warnings = resolutionWarnings(resolution);
  if (options.signal?.aborted) {
    warnings.push("research discovery was cancelled during target resolution");
    return {
      resolution,
      queries: [],
      candidateSources: [],
      providerAttempts: [],
      coveredCategories: [],
      uncoveredCategories: [...request.categories],
      categoryOutcomes: request.categories.map((category) => ({ category, status: "failed", reason: "cancelled" })),
      categoryAssociations: [],
      termination: "caller-cancelled",
      warnings: safeWarnings(warnings),
    };
  }
  if (!resolution.resolved) {
    return {
      resolution,
      queries: [],
      candidateSources: [],
      providerAttempts: [],
      coveredCategories: [],
      uncoveredCategories: [...request.categories],
      categoryOutcomes: request.categories.map((category) => ({ category, status: "failed", reason: "provider-failure" })),
      categoryAssociations: [],
      termination: options.signal?.aborted ? "caller-cancelled" : "completed",
      warnings,
    };
  }

  if (request.question !== undefined && containsSensitiveResearchData(request.question)) {
    warnings.push("research question contains private or sensitive data; it was excluded from discovery queries");
  }

  const candidates: CandidateSource[] = [];
  const providerAttempts: DiscoveryAttempt[] = [];
  const associations = new Map<string, Set<ResearchCategory>>();
  const progress = new Map<ResearchCategory, CategoryProgress>(request.categories.map((category) => [category, {
    generalWebCompleted: false,
    providerFailed: false,
    hadAssociatedCandidate: false,
  }]));
  const deadline = Date.now() + RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS;
  const runController = new AbortController();
  let timedOut = false;
  let callerCancelled = false;
  let attemptBudgetReached = false;
  const onCallerAbort = () => {
    callerCancelled = true;
    runController.abort(options.signal?.reason);
  };
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });
  const runTimeout = setTimeout(() => {
    timedOut = true;
    runController.abort();
  }, RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS);
  (runTimeout as unknown as { unref?: () => void }).unref?.();

  try {
    if (resolution.target.rorId !== undefined && (options.rorIdSearch !== undefined || options.enableRor !== false)) {
      const rorId = resolution.target.rorId;
      if (!runBudgetAvailable(providerAttempts, deadline)) {
        attemptBudgetReached = true;
        budgetWarning(warnings);
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
          timedOut = Date.now() >= deadline;
        } else if (!runController.signal.aborted) {
          recordAttempt(providerAttempts, "ror", "identity-ror", undefined, {
            outcome: ror.outcome,
            retryCount: ror.retryCount ?? 0,
            durationMs: ror.durationMs,
            failureKind: ror.failureKind,
          });
          if (ror.identity !== undefined) mergeResolvedInstitution(resolution.target, ror.identity);
          if (ror.candidate !== undefined && ror.candidate !== null) {
            appendCandidates(candidates, [ror.candidate], resolution.target, associations);
          }
          if (ror.warning !== undefined) {
            const warning = boundedWarning(ror.warning);
            if (warning !== undefined) warnings.push(warning);
          }
        }
      }
    }

    const queries = planDiscoveryQueries(request, resolution);
    const tavilySearch = options.tavilySearch ?? searchTavily;
    const braveSearch = options.braveSearch ?? searchBrave;

    for (const query of queries) {
      if (runController.signal.aborted || attemptBudgetReached) break;
      if (query.kind === "identity" && resolution.target.officialUrl !== undefined) continue;
      const categoryProgress = query.category === undefined ? undefined : progress.get(query.category);
      let candidateFound = false;

      if (!runBudgetAvailable(providerAttempts, deadline)) {
        attemptBudgetReached = true;
        budgetWarning(warnings);
        break;
      }
      const tavily = await executeProvider(
        () => tavilySearch(query, { apiKey: options.tavilyApiKey, signal: runController.signal }),
        deadline,
        { outcome: "failed", candidates: [], retryCount: 0, failureKind: "upstream", warning: "Tavily request failed" },
      );
      if (runController.signal.aborted) break;
      if (tavily === undefined) {
        timedOut = true;
        break;
      }
      recordAttempt(providerAttempts, "tavily", query.id, query.category, tavily);
      if (categoryProgress !== undefined) {
        categoryProgress.generalWebCompleted ||= completedGeneralWeb(tavily);
        categoryProgress.providerFailed ||= tavily.outcome === "failed" || tavily.outcome === "skipped";
      }
      if (tavily.outcome === "success" && tavily.candidates.length > 0) {
        appendCandidates(candidates, tavily.candidates, resolution.target, associations);
        candidateFound = true;
      } else if (tavily.warning !== undefined) {
        const warning = boundedWarning(tavily.warning);
        if (warning !== undefined) warnings.push(warning);
      }

      if (!candidateFound) {
        if (!runBudgetAvailable(providerAttempts, deadline)) {
          attemptBudgetReached = true;
          budgetWarning(warnings);
          break;
        }
        const brave = await executeProvider(
          () => braveSearch(query, { apiKey: options.braveApiKey, signal: runController.signal }),
          deadline,
          { outcome: "failed", candidates: [], retryCount: 0, failureKind: "upstream", warning: "Brave request failed" },
        );
        if (runController.signal.aborted) break;
        if (brave === undefined) {
          timedOut = true;
          break;
        }
        recordAttempt(providerAttempts, "brave", query.id, query.category, brave);
        if (categoryProgress !== undefined) {
          categoryProgress.generalWebCompleted ||= completedGeneralWeb(brave);
          categoryProgress.providerFailed ||= brave.outcome === "failed" || brave.outcome === "skipped";
        }
        if (brave.outcome === "success" && brave.candidates.length > 0) {
          appendCandidates(candidates, brave.candidates, resolution.target, associations);
          candidateFound = true;
        } else if (brave.warning !== undefined) {
          const warning = boundedWarning(brave.warning);
          if (warning !== undefined) warnings.push(warning);
        }
      }

      if (!candidateFound && query.kind === "category") {
        const direct = directDiscovery(resolution.target, query);
        const directResult: ProviderSearchResult = {
          outcome: direct.outcome,
          candidates: direct.candidate === null ? [] : [direct.candidate],
          retryCount: 0,
          durationMs: 0,
        };
        recordAttempt(providerAttempts, "direct", query.id, query.category, directResult);
        if (directResult.candidates.length > 0) {
          appendCandidates(candidates, directResult.candidates, resolution.target, associations);
          candidateFound = true;
        }
      }

      if (!candidateFound && resolution.target.universityName !== undefined && (options.rorSearch !== undefined || options.enableRor !== false)) {
        if (!runBudgetAvailable(providerAttempts, deadline)) {
          attemptBudgetReached = true;
          budgetWarning(warnings);
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
        if (runController.signal.aborted) break;
        if (ror === undefined) {
          timedOut = true;
          break;
        }
        if (ror.identity !== undefined) mergeResolvedInstitution(resolution.target, ror.identity);
        const rorResult: ProviderSearchResult = {
          outcome: ror.outcome,
          candidates: ror.candidate === undefined || ror.candidate === null ? [] : [ror.candidate],
          retryCount: ror.retryCount ?? 0,
          durationMs: ror.durationMs,
          failureKind: ror.failureKind,
          warning: ror.warning,
        };
        recordAttempt(providerAttempts, "ror", query.id, query.category, rorResult);
        if (rorResult.candidates.length > 0 && rorResult.outcome === "success") {
          appendCandidates(candidates, rorResult.candidates, resolution.target, associations);
        } else if (rorResult.warning !== undefined) {
          const warning = boundedWarning(rorResult.warning);
          if (warning !== undefined) warnings.push(warning);
        }
      }
    }

    const deduped = dedupeCandidates(candidates);
    const selectedUrls = new Set(deduped.map((candidate) => candidate.url));
    for (const [url, categories] of associations) {
      if (!selectedUrls.has(url)) continue;
      for (const category of categories) {
        const value = progress.get(category);
        if (value !== undefined) value.hadAssociatedCandidate = true;
      }
    }

    const termination: DiscoveryTermination = callerCancelled
      ? "caller-cancelled"
      : timedOut
        ? "discovery-timeout"
        : attemptBudgetReached
          ? "attempt-budget"
          : "completed";
    const categoryOutcomes: DiscoveryCategoryOutcome[] = request.categories.map((category) => {
      const value = progress.get(category)!;
      if (termination === "caller-cancelled") return { category, status: "failed", reason: "cancelled" };
      if (value.generalWebCompleted && value.hadAssociatedCandidate) return { category, status: "covered" };
      if (termination === "discovery-timeout") return { category, status: "failed", reason: "timeout" };
      if (termination === "attempt-budget") return { category, status: "failed", reason: "attempt-budget" };
      if (value.generalWebCompleted) {
        const hadRawAssociation = [...associations.values()].some((categories) => categories.has(category));
        return hadRawAssociation
          ? { category, status: "failed", reason: "source-limit" }
          : { category, status: "empty" };
      }
      if (value.hadAssociatedCandidate) return { category, status: "degraded", reason: "provider-failure" };
      return { category, status: "failed", reason: "provider-failure" };
    });
    const coveredCategories = categoryOutcomes.filter((entry) => entry.status === "covered").map((entry) => entry.category);
    const uncoveredCategories = categoryOutcomes.filter((entry) => entry.status !== "covered").map((entry) => entry.category);
    const categoryAssociations = deduped.map((candidate) => ({
      url: candidate.url,
      categories: canonicalizeResearchCategories([...(associations.get(candidate.url) ?? new Set<ResearchCategory>())]),
    }));

    return {
      resolution,
      queries,
      candidateSources: deduped,
      providerAttempts,
      coveredCategories,
      uncoveredCategories,
      categoryOutcomes,
      categoryAssociations,
      termination,
      warnings: safeWarnings(warnings),
    };
  } finally {
    clearTimeout(runTimeout);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}

export const runDiscovery = discoverResearch;

export function hasInstitutionalIdentity(target: ResolvedResearchTarget): boolean {
  return target.universityId !== undefined || target.universityName !== undefined || target.officialUrl !== undefined;
}
