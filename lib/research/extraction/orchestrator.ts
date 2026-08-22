import "server-only";

import { createHash } from "node:crypto";

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
import { extractDeterministicClosedMetrics } from "./deterministic-closed-metrics";
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
import { RESEARCH_MAX_EXTRACTION_BATCH_CHARACTERS } from "@/lib/security/research-limits";

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

type RoutedSegmentEntry = { segment: ExtractionSegment; categories: readonly ResearchCategory[] };

type ExtractionExecutionUnit = {
  task: ExtractionTask;
  segmentIds: readonly string[];
};

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function batchSegmentId(documentId: string, segmentIds: readonly string[], batchOrdinal: number): string {
  const digest = createHash("sha256")
    .update(`${documentId}\u0000${batchOrdinal}\u0000${segmentIds.join("\u0000")}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `segment-batch-${digest}`;
}

function buildExecutionUnits(
  entries: readonly RoutedSegmentEntry[],
  documents: readonly import("@/lib/research/contracts").ResearchDocument[],
  target: ExtractionTargetIdentity,
  batchProductionWork: boolean,
): ExtractionExecutionUnit[] {
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  if (!batchProductionWork) {
    return entries.flatMap((entry) => {
      const document = documentsById.get(entry.segment.documentId);
      return document === undefined ? [] : [{
        task: { segment: entry.segment, categories: entry.categories, target, document },
        segmentIds: [entry.segment.id],
      }];
    });
  }

  const byDocument = new Map<string, RoutedSegmentEntry[]>();
  for (const entry of entries) {
    const current = byDocument.get(entry.segment.documentId) ?? [];
    current.push(entry);
    byDocument.set(entry.segment.documentId, current);
  }

  const unitsByDocument: ExtractionExecutionUnit[][] = [];
  for (const [documentId, documentEntries] of byDocument) {
    const document = documentsById.get(documentId);
    if (document === undefined) continue;
    const documentUnits: ExtractionExecutionUnit[] = [];
    let batch: RoutedSegmentEntry[] = [];
    let batchCharacters = 0;
    let batchOrdinal = 0;

    const flush = () => {
      if (batch.length === 0) return;
      const categories = canonicalizeResearchCategories(batch.flatMap((entry) => entry.categories));
      const segmentIds = batch.map((entry) => entry.segment.id);
      const segment = batch.length === 1
        ? batch[0]!.segment
        : {
            id: batchSegmentId(document.id, segmentIds, batchOrdinal),
            sourceId: document.sourceId,
            documentId: document.id,
            sectionOrdinal: batch[0]!.segment.sectionOrdinal,
            chunkOrdinal: batchOrdinal,
            text: batch.map((entry) => entry.segment.text).join("\n\n"),
          };
      documentUnits.push({ task: { segment, ...(batch.length > 1 ? { provenanceSegments: batch.map((entry) => entry.segment) } : {}), categories, target, document }, segmentIds });
      batch = [];
      batchCharacters = 0;
      batchOrdinal += 1;
    };

    for (const entry of documentEntries) {
      const separatorCharacters = batch.length === 0 ? 0 : 2;
      const nextCharacters = codePointLength(entry.segment.text) + separatorCharacters;
      if (batch.length > 0 && batchCharacters + nextCharacters > RESEARCH_MAX_EXTRACTION_BATCH_CHARACTERS) flush();
      batch.push(entry);
      batchCharacters += codePointLength(entry.segment.text) + (batch.length === 1 ? 0 : 2);
    }
    flush();
    if (documentUnits.length > 0) unitsByDocument.push(documentUnits);
  }

  const units: ExtractionExecutionUnit[] = [];
  const maximumBatches = Math.max(0, ...unitsByDocument.map((documentUnits) => documentUnits.length));
  for (let batchIndex = 0; batchIndex < maximumBatches; batchIndex += 1) {
    for (const documentUnits of unitsByDocument) {
      const unit = documentUnits[batchIndex];
      if (unit !== undefined) units.push(unit);
    }
  }
  return units;
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
  const scheduledEntries = scheduleCategoryFairly(routedEntries, categories);
  const categorySegmentIds = new Map<ResearchCategory, Set<string>>(categories.map((category) => [category, new Set<string>()]));
  for (const entry of scheduledEntries) {
    for (const category of entry.categories) categorySegmentIds.get(category)?.add(entry.segment.id);
  }
  const categorySegmentKey = (category: ResearchCategory, segmentId: string) => `${category}\u0000${segmentId}`;
  const completedCategorySegments = new Set<string>();
  const deterministicCandidates: import("@/lib/research/contracts").ClaimCandidate[] = [];
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const segmentEntries = scheduledEntries.flatMap((entry) => {
    if (effectiveOptions.runTask !== undefined) return [entry];
    const document = documentsById.get(entry.segment.documentId);
    if (document === undefined) return [entry];
    const deterministic = extractDeterministicClosedMetrics({
      segment: entry.segment,
      categories: entry.categories,
      document,
      target: targetForTask(effectiveOptions.target),
    });
    deterministicCandidates.push(...deterministic.candidates);
    const resolved = new Set<ResearchCategory>(deterministic.completedCategories);
    for (const category of resolved) {
      completedCategorySegments.add(categorySegmentKey(category, entry.segment.id));
    }
    const remainingCategories = entry.categories.filter((category) => !resolved.has(category));
    return remainingCategories.length === 0 ? [] : [{ ...entry, categories: remainingCategories }];
  });
  const unresolvedCategoriesBySegmentId = new Map(
    segmentEntries.map((entry) => [entry.segment.id, entry.categories] as const),
  );
  const executionUnits = buildExecutionUnits(
    segmentEntries,
    documents,
    targetForTask(effectiveOptions.target),
    effectiveOptions.runTask === undefined,
  );
  const candidates: import("@/lib/research/contracts").ClaimCandidate[] = [...deterministicCandidates];
  const providerAttempts: ResearchProviderAttempt[] = [];
  const recordedConfigurationProviders = new Set<ResearchExtractionProvider>();
  const failures: ExtractionFailure[] = [];
  const warnings: string[] = [];
  const processedSegmentIds: string[] = scheduledEntries
    .filter((entry) => !unresolvedCategoriesBySegmentId.has(entry.segment.id))
    .map((entry) => entry.segment.id);
  const unprocessedSegmentIds: string[] = [];
  let aborted = false;

  const categoryCompletion = () => {
    const incompleteCategories = categories.filter((category) =>
      [...(categorySegmentIds.get(category) ?? [])]
        .some((segmentId) => !completedCategorySegments.has(categorySegmentKey(category, segmentId))),
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
    if (unavailable.length > 0 && executionUnits.length > 0) {
      warnings.push("unconfigured extraction providers: " + unavailable.map((entry) => entry.provider).join(", "));
    }
    if (unavailable.length === providerConfigurations.length && executionUnits.length > 0) {
      for (const entry of unavailable) {
        appendConfigurationSkip(providerAttempts, recordedConfigurationProviders, entry.provider, entry.model);
        failures.push({ kind: "configuration", provider: entry.provider });
      }
      unprocessedSegmentIds.push(...executionUnits.flatMap((unit) => unit.segmentIds));
      warnings.push("no extraction provider is configured; no segments were dispatched");
      const completion = categoryCompletion();
      return {
        candidates: dedupePromotedCandidates(candidates),
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

  for (let index = 0; index < executionUnits.length; index += 1) {
    const unit = executionUnits[index]!;
    if (effectiveOptions.signal?.aborted || budget.used >= budget.limit) {
      unprocessedSegmentIds.push(...executionUnits.slice(index).flatMap((entry) => entry.segmentIds));
      aborted ||= effectiveOptions.signal?.aborted === true;
      break;
    }
    const outcome = await runSegmentTask(unit.task, effectiveOptions, recordedConfigurationProviders);
    appendAttempts(providerAttempts, outcome.attempts);
    candidates.push(...outcome.candidates);
    if (outcome.succeeded) {
      processedSegmentIds.push(...unit.segmentIds);
      for (const segmentId of unit.segmentIds) {
        for (const category of unresolvedCategoriesBySegmentId.get(segmentId) ?? []) {
          completedCategorySegments.add(categorySegmentKey(category, segmentId));
        }
      }
    } else {
      unprocessedSegmentIds.push(...unit.segmentIds);
      if (outcome.failureKind !== undefined) failures.push({ kind: outcome.failureKind, segmentId: unit.task.segment.id });
    }
    if (outcome.aborted) {
      aborted = true;
      unprocessedSegmentIds.push(...executionUnits.slice(index + 1).flatMap((entry) => entry.segmentIds));
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
