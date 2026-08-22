import "server-only";

import {
  GEMINI_PRIMARY_MODEL,
  runGeminiStructuredTask,
} from "@/lib/integrations/gemini/structured";
import {
  GROQ_STRUCTURED_MODEL,
  runGroqStructuredTask,
} from "@/lib/integrations/groq/structured";
import {
  OPENROUTER_FREE_MODEL,
  runOpenRouterStructuredTask,
} from "@/lib/integrations/openrouter/structured";
import {
  accountInjectedStructuredAttempts,
  assertValidExtractionBudget,
  createExtractionBudget,
  type StructuredAdapterInput,
  type StructuredProviderResult,
} from "@/lib/research/ai/types";
import { researchCategoryIntentTerms } from "@/lib/research/discovery/query-plan";
import { buildExtractionPrompt, portableExtractionJsonSchema } from "./schema";
import { segmentResearchDocument } from "./segments";
import { dedupePromotedCandidates, promoteExtractedClaims } from "./promote";
import type {
  ExtractionFailure,
  ExtractionOptions,
  ExtractionSegment,
  ExtractionStageResult,
  ExtractionTargetIdentity,
  ExtractionTask,
} from "./types";
import {
  canonicalizeResearchCategories,
  researchProviderAttemptSchema,
  type ResearchCategory,
  type ResearchExtractionProvider,
  type ResearchProviderAttempt,
} from "@/lib/research/contracts";

type TaskOutcome = {
  candidates: readonly import("@/lib/research/contracts").ClaimCandidate[];
  attempts: readonly ResearchProviderAttempt[];
  failureKind?: ExtractionFailure["kind"];
  aborted?: boolean;
  succeeded: boolean;
};

function providerInput(
  task: ExtractionTask,
  options: ExtractionOptions,
): Omit<StructuredAdapterInput, "apiKey"> {
  return {
    prompt: buildExtractionPrompt({
      segment: task.segment,
      categories: task.categories,
      target: task.target,
    }),
    schema: portableExtractionJsonSchema,
    ...options.providerOptions,
    signal: options.signal,
    budget: options.budget,
    requireOpenRouterZdr: options.requireOpenRouterZdr ?? options.providerOptions?.requireOpenRouterZdr,
  };
}

function appendAttempts(target: ResearchProviderAttempt[], attempts: readonly ResearchProviderAttempt[]): void {
  target.push(...attempts);
}

function markLastSuccessfulAttemptInvalid(
  attempts: readonly ResearchProviderAttempt[],
): ResearchProviderAttempt[] {
  const updated = [...attempts];
  for (let index = updated.length - 1; index >= 0; index -= 1) {
    if (updated[index]?.outcome !== "success") continue;
    updated[index] = researchProviderAttemptSchema.parse({
      ...updated[index],
      outcome: "failed",
      failureKind: "invalid-response",
    });
    break;
  }
  return updated;
}

function hasConfiguredKey(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function appendConfigurationSkip(
  attempts: ResearchProviderAttempt[],
  recordedProviders: Set<ResearchExtractionProvider>,
  provider: ResearchExtractionProvider,
  model: string,
): void {
  if (recordedProviders.has(provider)) return;
  recordedProviders.add(provider);
  attempts.push(researchProviderAttemptSchema.parse({
    stage: "extraction",
    provider,
    model,
    outcome: "skipped",
    retryCount: 0,
    durationMs: 0,
    failureKind: "configuration",
  }));
}

function promoteResult(
  task: ExtractionTask,
  providerResult: Extract<StructuredProviderResult, { ok: true }>,
): { candidates: readonly import("@/lib/research/contracts").ClaimCandidate[]; validEmpty: boolean } {
  const promotion = promoteExtractedClaims({
    payload: providerResult.payload,
    task,
    provider: providerResult.provider,
    model: providerResult.model,
  });
  return {
    candidates: promotion.candidates,
    validEmpty: promotion.empty,
  };
}

async function runSegmentTask(
  task: ExtractionTask,
  options: ExtractionOptions,
  recordedConfigurationProviders: Set<ResearchExtractionProvider>,
): Promise<TaskOutcome> {
  if (options.signal?.aborted) {
    return { candidates: [], attempts: [], aborted: true, succeeded: false };
  }

  if (options.runTask !== undefined) {
    const injected = await options.runTask(task);
    const attempts = [...injected.attempts];
    const provider = injected.provider === "gemini" || injected.provider === "groq" || injected.provider === "openrouter"
      ? injected.provider
      : undefined;
    accountInjectedStructuredAttempts({
      budget: options.budget!,
      attempts,
      provider,
      hasPayload: injected.payload !== undefined,
      stage: "extraction",
    });
    if (injected.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
    if (injected.payload === undefined) {
      return { candidates: [], attempts, failureKind: injected.failureKind ?? "upstream", succeeded: false };
    }
    const model = injected.model ?? "injected-model";
    const promotion = promoteExtractedClaims({ payload: injected.payload, task, provider: injected.provider ?? "gemini", model });
    if (promotion.empty || promotion.candidates.length > 0) {
      return { candidates: promotion.candidates, attempts, succeeded: true };
    }
    return {
      candidates: [],
      attempts: markLastSuccessfulAttemptInvalid(attempts),
      failureKind: "invalid-response",
      succeeded: false,
    };
  }

  const input = providerInput(task, options);
  const attempts: ResearchProviderAttempt[] = [];
  const call = async (
    provider: "gemini" | "groq" | "openrouter",
    apiKey: string | undefined,
    mode?: "normal" | "quality",
  ): Promise<StructuredProviderResult> => {
    const adapterInput = { ...input, apiKey };
    if (provider === "gemini") return runGeminiStructuredTask(adapterInput, mode ?? "normal");
    if (provider === "groq") return runGroqStructuredTask(adapterInput);
    return runOpenRouterStructuredTask(adapterInput);
  };

  let lastFailure: ExtractionFailure["kind"] | undefined;
  let geminiQualityEligible = false;

  if (!hasConfiguredKey(options.geminiApiKey)) {
    appendConfigurationSkip(attempts, recordedConfigurationProviders, "gemini", GEMINI_PRIMARY_MODEL);
  }
  const primary = hasConfiguredKey(options.geminiApiKey)
    ? await call("gemini", options.geminiApiKey, "normal")
    : undefined;
  if (primary?.ok) {
    const promotion = promoteResult(task, primary);
    if (promotion.validEmpty || promotion.candidates.length > 0) {
      appendAttempts(attempts, primary.attempts);
      return { candidates: promotion.candidates, attempts, succeeded: true };
    }
    appendAttempts(attempts, markLastSuccessfulAttemptInvalid(primary.attempts));
    geminiQualityEligible = true;
    lastFailure = "invalid-response";
  } else if (primary !== undefined) {
    appendAttempts(attempts, primary.attempts);
    if (primary.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
    lastFailure = primary.failureKind;
    geminiQualityEligible = primary.failureKind === "invalid-response";
    if (primary.failureKind === "budget" && primary.budgetScope !== "provider") {
      return { candidates: [], attempts, failureKind: "budget", succeeded: false };
    }
  }

  if (geminiQualityEligible && hasConfiguredKey(options.geminiApiKey)) {
    const quality = await call("gemini", options.geminiApiKey, "quality");
    if (quality.ok) {
      const promotion = promoteResult(task, quality);
      if (promotion.validEmpty || promotion.candidates.length > 0) {
        appendAttempts(attempts, quality.attempts);
        return { candidates: promotion.candidates, attempts, succeeded: true };
      }
      appendAttempts(attempts, markLastSuccessfulAttemptInvalid(quality.attempts));
      lastFailure = "invalid-response";
    } else {
      appendAttempts(attempts, quality.attempts);
      if (quality.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
      lastFailure = quality.failureKind;
      if (quality.failureKind === "budget" && quality.budgetScope !== "provider") {
        return { candidates: [], attempts, failureKind: "budget", succeeded: false };
      }
    }
  }

  if (!hasConfiguredKey(options.groqApiKey)) {
    appendConfigurationSkip(attempts, recordedConfigurationProviders, "groq", GROQ_STRUCTURED_MODEL);
  }
  if (hasConfiguredKey(options.groqApiKey)) {
    if (options.signal?.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
    const groq = await call("groq", options.groqApiKey);
    if (groq.ok) {
      const promotion = promoteResult(task, groq);
      if (promotion.validEmpty || promotion.candidates.length > 0) {
        appendAttempts(attempts, groq.attempts);
        return { candidates: promotion.candidates, attempts, succeeded: true };
      }
      appendAttempts(attempts, markLastSuccessfulAttemptInvalid(groq.attempts));
      lastFailure = "invalid-response";
    } else {
      appendAttempts(attempts, groq.attempts);
      if (groq.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
      lastFailure = groq.failureKind;
      if (groq.failureKind === "budget" && groq.budgetScope !== "provider") {
        return { candidates: [], attempts, failureKind: "budget", succeeded: false };
      }
    }
  }

  if (!hasConfiguredKey(options.openrouterApiKey)) {
    appendConfigurationSkip(attempts, recordedConfigurationProviders, "openrouter", OPENROUTER_FREE_MODEL);
  }
  if (hasConfiguredKey(options.openrouterApiKey)) {
    if (options.signal?.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
    const openrouter = await call("openrouter", options.openrouterApiKey);
    if (openrouter.ok) {
      const promotion = promoteResult(task, openrouter);
      if (promotion.validEmpty || promotion.candidates.length > 0) {
        appendAttempts(attempts, openrouter.attempts);
        return { candidates: promotion.candidates, attempts, succeeded: true };
      }
      appendAttempts(attempts, markLastSuccessfulAttemptInvalid(openrouter.attempts));
      lastFailure = "invalid-response";
    } else {
      appendAttempts(attempts, openrouter.attempts);
      if (openrouter.aborted) return { candidates: [], attempts, aborted: true, succeeded: false };
      lastFailure = openrouter.failureKind;
      if (openrouter.failureKind === "budget" && openrouter.budgetScope !== "provider") {
        return { candidates: [], attempts, failureKind: "budget", succeeded: false };
      }
    }
  }

  return {
    candidates: [],
    attempts,
    failureKind: lastFailure ?? "configuration",
    succeeded: false,
  };
}

function normalizedIntentText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function segmentCategoryScore(segment: ExtractionSegment, category: ResearchCategory): number {
  const text = normalizedIntentText([segment.heading, segment.text].filter(Boolean).join(" "));
  if (text === "") return 0;
  let score = 0;
  for (const rawTerm of researchCategoryIntentTerms(category)) {
    const term = normalizedIntentText(rawTerm);
    if (term !== "" && text.includes(term)) score += 4;
    const tokens = term.split(" ").filter((token) => token.length >= 4);
    for (const token of tokens) {
      if (text.includes(token)) score += 1;
    }
  }
  return score;
}

function routeDocumentSegments(
  segments: readonly ExtractionSegment[],
  scopedCategories: readonly ResearchCategory[],
): Array<{ segment: ExtractionSegment; categories: readonly ResearchCategory[] }> {
  if (scopedCategories.length <= 1) {
    return segments.map((segment) => ({ segment, categories: scopedCategories }));
  }

  const scores = segments.map((segment) => new Map(
    scopedCategories.map((category) => [category, segmentCategoryScore(segment, category)]),
  ));
  const assigned = segments.map((segment, index) => ({
    segment,
    categories: scopedCategories.filter((category) => (scores[index]?.get(category) ?? 0) > 0),
  }));

  for (const category of scopedCategories) {
    if (assigned.some((entry) => entry.categories.includes(category)) || segments.length === 0) continue;
    let bestIndex = 0;
    let bestScore = -1;
    for (let index = 0; index < segments.length; index += 1) {
      const score = scores[index]?.get(category) ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    assigned[bestIndex] = {
      ...assigned[bestIndex]!,
      categories: canonicalizeResearchCategories([...assigned[bestIndex]!.categories, category]),
    };
  }

  return assigned.filter((entry) => entry.categories.length > 0);
}

function scheduleCategoryFairly(
  entries: ReadonlyArray<{ segment: ExtractionSegment; categories: readonly ResearchCategory[] }>,
  categories: readonly ResearchCategory[],
): Array<{ segment: ExtractionSegment; categories: readonly ResearchCategory[] }> {
  const remaining = entries.map((entry, index) => ({ entry, index }));
  const counts = new Map<ResearchCategory, number>(categories.map((category) => [category, 0]));
  const scheduled: Array<{ segment: ExtractionSegment; categories: readonly ResearchCategory[] }> = [];

  while (remaining.length > 0) {
    let bestPosition = 0;
    let bestLoad = Number.POSITIVE_INFINITY;
    let bestIndex = Number.POSITIVE_INFINITY;
    for (let position = 0; position < remaining.length; position += 1) {
      const candidate = remaining[position]!;
      const load = candidate.entry.categories.reduce(
        (total, category) => total + (counts.get(category) ?? 0),
        0,
      ) / candidate.entry.categories.length;
      if (load < bestLoad || (load === bestLoad && candidate.index < bestIndex)) {
        bestPosition = position;
        bestLoad = load;
        bestIndex = candidate.index;
      }
    }
    const [{ entry }] = remaining.splice(bestPosition, 1);
    scheduled.push(entry);
    for (const category of entry.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return scheduled;
}

function targetForTask(target: ExtractionTargetIdentity | undefined): ExtractionTargetIdentity {
  return target ?? {};
}

export async function extractResearchDocuments(
  documents: readonly import("@/lib/research/contracts").ResearchDocument[],
  options: ExtractionOptions,
): Promise<ExtractionStageResult> {
  const categories = canonicalizeResearchCategories(options.categories);
  if (categories.length === 0) throw new Error("at least one extraction category is required");
  const budget = options.budget ?? createExtractionBudget();
  assertValidExtractionBudget(budget);
  const effectiveOptions: ExtractionOptions = { ...options, categories, budget };

  const routedEntries: Array<{ segment: ExtractionSegment; categories: readonly ResearchCategory[] }> = [];
  for (const document of documents) {
    const requested = options.categoriesByDocumentId === undefined
      ? categories
      : options.categoriesByDocumentId[document.id] ?? [];
    const scoped = canonicalizeResearchCategories(requested.filter((category) => categories.includes(category)));
    if (scoped.length === 0) continue;
    routedEntries.push(...routeDocumentSegments(segmentResearchDocument(document), scoped));
  }
  const segmentEntries = scheduleCategoryFairly(routedEntries, categories);
  const categorySegmentIds = new Map<ResearchCategory, Set<string>>(categories.map((category) => [category, new Set<string>()]));
  for (const entry of segmentEntries) {
    for (const category of entry.categories) categorySegmentIds.get(category)?.add(entry.segment.id);
  }
  const segments = segmentEntries.map((entry) => entry.segment);
  const candidates: import("@/lib/research/contracts").ClaimCandidate[] = [];
  const providerAttempts: ResearchProviderAttempt[] = [];
  const recordedConfigurationProviders = new Set<ResearchExtractionProvider>();
  const failures: ExtractionFailure[] = [];
  const warnings: string[] = [];
  const processedSegmentIds: string[] = [];
  const unprocessedSegmentIds: string[] = [];
  let aborted = false;

  const categoryCompletion = () => {
    const unprocessed = new Set(unprocessedSegmentIds);
    const incompleteCategories = categories.filter((category) =>
      [...(categorySegmentIds.get(category) ?? [])].some((segmentId) => unprocessed.has(segmentId)),
    );
    return {
      completedCategories: categories.filter((category) => !incompleteCategories.includes(category)),
      incompleteCategories,
    };
  };

  if (effectiveOptions.runTask === undefined && !effectiveOptions.signal?.aborted) {
    const providerConfigurations = [
      { provider: "gemini" as const, key: effectiveOptions.geminiApiKey, model: GEMINI_PRIMARY_MODEL },
      { provider: "groq" as const, key: effectiveOptions.groqApiKey, model: GROQ_STRUCTURED_MODEL },
      { provider: "openrouter" as const, key: effectiveOptions.openrouterApiKey, model: OPENROUTER_FREE_MODEL },
    ];
    const unavailable = providerConfigurations.filter((entry) => !hasConfiguredKey(entry.key));
    if (unavailable.length > 0 && segments.length > 0) {
      warnings.push("unconfigured extraction providers: " + unavailable.map((entry) => entry.provider).join(", "));
    }
    if (unavailable.length === providerConfigurations.length && segments.length > 0) {
      for (const entry of unavailable) {
        appendConfigurationSkip(providerAttempts, recordedConfigurationProviders, entry.provider, entry.model);
        failures.push({ kind: "configuration", provider: entry.provider });
      }
      unprocessedSegmentIds.push(...segments.map((segment) => segment.id));
      warnings.push("no extraction provider is configured; no segments were dispatched");
      const completion = categoryCompletion();
      return {
        candidates: [],
        providerAttempts,
        failures,
        warnings,
        processedSegmentIds,
        unprocessedSegmentIds,
        ...completion,
        unfinished: true,
        budget: { limit: budget.limit, used: budget.used },
      };
    }
  }

  for (let index = 0; index < segmentEntries.length; index += 1) {
    const { segment, categories: taskCategories } = segmentEntries[index]!;
    if (effectiveOptions.signal?.aborted || budget.used >= budget.limit) {
      unprocessedSegmentIds.push(...segmentEntries.slice(index).map((entry) => entry.segment.id));
      aborted ||= effectiveOptions.signal?.aborted === true;
      break;
    }
    const document = documents.find((item) => item.id === segment.documentId);
    if (document === undefined) {
      unprocessedSegmentIds.push(segment.id);
      failures.push({ kind: "invalid-response", segmentId: segment.id });
      continue;
    }
    const task: ExtractionTask = {
      segment,
      categories: taskCategories,
      target: targetForTask(effectiveOptions.target),
      document,
    };
    const outcome = await runSegmentTask(task, effectiveOptions, recordedConfigurationProviders);
    appendAttempts(providerAttempts, outcome.attempts);
    candidates.push(...outcome.candidates);
    if (outcome.succeeded) {
      processedSegmentIds.push(segment.id);
    } else {
      unprocessedSegmentIds.push(segment.id);
      if (outcome.failureKind !== undefined) failures.push({ kind: outcome.failureKind, segmentId: segment.id });
    }
    if (outcome.aborted) {
      aborted = true;
      unprocessedSegmentIds.push(...segmentEntries.slice(index + 1).map((entry) => entry.segment.id));
      break;
    }
  }

  if (unprocessedSegmentIds.length > 0 && !aborted) {
    warnings.push("some extraction segments were not completed by the bounded provider chain");
  }
  if (budget.used >= budget.limit && unprocessedSegmentIds.length > 0) failures.push({ kind: "budget" });
  if (aborted) warnings.push("extraction stopped because the caller cancelled the run");
  const completion = categoryCompletion();

  return {
    candidates: dedupePromotedCandidates(candidates),
    providerAttempts,
    failures,
    warnings,
    processedSegmentIds,
    unprocessedSegmentIds: [...new Set(unprocessedSegmentIds)],
    ...completion,
    unfinished: unprocessedSegmentIds.length > 0,
    budget: { limit: budget.limit, used: budget.used },
  };
}

export const runExtraction = extractResearchDocuments;
export const extractClaims = extractResearchDocuments;
