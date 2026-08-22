import "server-only";

import {
  GEMINI_PRIMARY_MODEL,
  runGeminiStructuredTask,
} from "@/lib/integrations/gemini/structured";
import { GROQ_STRUCTURED_MODEL, runGroqStructuredTask } from "@/lib/integrations/groq/structured";
import { OPENROUTER_FREE_MODEL, runOpenRouterStructuredTask } from "@/lib/integrations/openrouter/structured";
import {
  accountInjectedStructuredAttempts,
  assertValidAiBudget,
  createReconciliationBudget,
  type StructuredAdapterInput,
} from "@/lib/research/ai/types";
import {
  researchProviderAttemptSchema,
  type ResearchCategory,
  type ResearchExtractionProvider,
  type ResearchProviderAttempt,
} from "@/lib/research/contracts";
import {
  buildSemanticQuestions,
} from "./semantic";
import {
  buildReconciliationPrompt,
  portableReconciliationJsonSchema,
  validateRelationshipEnvelope,
} from "./schema";
import type {
  ReconciliationFailure,
  ReconciliationOptions,
  ReconciliationStageResult,
  ReconciliationTask,
  SemanticQuestion,
  ValidatedSemanticRelationship,
} from "./types";
import { evaluateEvidenceGate } from "@/lib/research/verification/evidence-policy";
import { generateEvidenceExplanations } from "@/lib/research/verification/explanation";
import { RESEARCH_MAX_SEMANTIC_QUESTIONS_PER_REQUEST } from "@/lib/security/research-limits";

function hasKey(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function appendStage(attempt: ResearchProviderAttempt, stage: "reconciliation" | "explanation"): ResearchProviderAttempt {
  return researchProviderAttemptSchema.parse({ ...attempt, stage });
}

function appendAttempts(target: ResearchProviderAttempt[], attempts: readonly ResearchProviderAttempt[], stage: "reconciliation" | "explanation" = "reconciliation"): void {
  target.push(...attempts.map((attempt) => appendStage(attempt, stage)));
}

function markLastSuccessfulInvalid(attempts: readonly ResearchProviderAttempt[], stage: "reconciliation" | "explanation" = "reconciliation"): ResearchProviderAttempt[] {
  const result = attempts.map((attempt) => appendStage(attempt, stage));
  for (let index = result.length - 1; index >= 0; index -= 1) {
    if (result[index]?.outcome !== "success") continue;
    result[index] = researchProviderAttemptSchema.parse({ ...result[index], outcome: "failed", failureKind: "invalid-response" });
    break;
  }
  return result;
}

function recordConfigurationSkip(
  attempts: ResearchProviderAttempt[],
  recorded: Set<ResearchExtractionProvider>,
  provider: ResearchExtractionProvider,
  model: string,
): void {
  if (recorded.has(provider)) return;
  recorded.add(provider);
  attempts.push(researchProviderAttemptSchema.parse({
    stage: "reconciliation",
    provider,
    model,
    outcome: "skipped",
    retryCount: 0,
    durationMs: 0,
    failureKind: "configuration",
  }));
}

function failure(value: string | undefined): ReconciliationFailure["kind"] {
  return (value as ReconciliationFailure["kind"] | undefined) ?? "upstream";
}

type ProviderCallResult = Awaited<ReturnType<typeof runGeminiStructuredTask>>;

async function runProvider(
  provider: "gemini" | "groq" | "openrouter",
  input: StructuredAdapterInput,
  mode?: "normal" | "quality",
): Promise<ProviderCallResult> {
  if (provider === "gemini") return runGeminiStructuredTask(input, mode ?? "normal");
  if (provider === "groq") return runGroqStructuredTask(input);
  return runOpenRouterStructuredTask(input);
}

function affectedCategories(
  questionIds: readonly string[],
  questions: readonly SemanticQuestion[],
): ResearchCategory[] {
  const ids = new Set(questionIds);
  return [...new Set(questions.filter((question) => ids.has(question.questionId)).map((question) => question.category))].sort();
}

export async function reconcileResearchClaims(options: ReconciliationOptions): Promise<ReconciliationStageResult> {
  const decisionEligibleCategories = [...new Set(options.decisionEligibleCategories)].sort();
  const budget = options.budget ?? createReconciliationBudget();
  assertValidAiBudget(budget, "reconciliation");
  const eligibleCandidates = options.candidates.filter((candidate) => decisionEligibleCategories.includes(candidate.category));
  const planning = buildSemanticQuestions({
    candidates: eligibleCandidates,
    target: options.target,
    requestedPeriod: options.requestedPeriod,
  });
  const providerAttempts: ResearchProviderAttempt[] = [];
  const failures: ReconciliationFailure[] = [];
  const warnings: string[] = [];
  const relationships: ValidatedSemanticRelationship[] = [...planning.deterministicRelationships];
  const unresolved = new Set<string>(planning.questions.map((question) => question.questionId));
  for (const questionId of planning.overflowQuestionIds) unresolved.add(questionId);
  const configuredProviders = new Set<ResearchExtractionProvider>();
  let totalBudgetExhausted = false;

  if (planning.overflow) {
    warnings.push("semantic pair-question limit exceeded; overflow remains operationally incomplete");
    failures.push({ kind: "budget", questionIds: planning.overflowQuestionIds });
  }

  const questionsById = new Map(planning.questions.map((question) => [question.questionId, question]));
  const batches: SemanticQuestion[][] = [];
  let current: SemanticQuestion[] = [];
  for (const question of planning.questions) {
    current.push(question);
    if (current.length === RESEARCH_MAX_SEMANTIC_QUESTIONS_PER_REQUEST) {
      batches.push(current);
      current = [];
    }
  }
  if (current.length > 0) batches.push(current);

  for (const originalBatch of batches) {
    if (budget.used >= budget.limit) {
      totalBudgetExhausted = true;
      failures.push({ kind: "budget" });
      break;
    }
    const batch = originalBatch.filter((question) => unresolved.has(question.questionId));
    if (batch.length === 0) continue;
    if (options.signal?.aborted) {
      warnings.push("reconciliation stopped because the caller cancelled the run");
      break;
    }

    const task: ReconciliationTask = {
      questions: batch,
      candidates: eligibleCandidates.filter((candidate) => batch.some((question) => question.leftCandidateId === candidate.id || question.rightCandidateId === candidate.id)),
      target: options.target,
      requestedPeriod: options.requestedPeriod,
    };

    if (options.runTask !== undefined) {
      const injected = await options.runTask(task);
      accountInjectedStructuredAttempts({
        budget,
        attempts: injected.attempts,
        provider: injected.provider,
        hasPayload: injected.payload !== undefined,
        stage: "reconciliation",
      });
      appendAttempts(providerAttempts, injected.attempts);
      if (injected.aborted) {
        warnings.push("reconciliation stopped because the caller cancelled the run");
        break;
      }
      if (injected.payload !== undefined) {
        const validation = validateRelationshipEnvelope(injected.payload, batch, task.candidates);
        if (validation.validEnvelope && validation.usable) {
          for (const relationship of validation.relationships) {
            relationships.push(relationship);
            unresolved.delete(relationship.questionId);
          }
          if (validation.invalidCount > 0) failures.push({ kind: "invalid-response", provider: injected.provider, questionIds: validation.unresolvedQuestionIds });
        } else {
          failures.push({ kind: "invalid-response", provider: injected.provider, questionIds: batch.map((question) => question.questionId) });
        }
      } else if (injected.failureKind !== undefined) {
        failures.push({ kind: failure(injected.failureKind), provider: injected.provider, questionIds: batch.map((question) => question.questionId) });
      }
      if (budget.used >= budget.limit) totalBudgetExhausted = true;
      continue;
    }

    const baseInput = {
      ...options.providerOptions,
      prompt: buildReconciliationPrompt({ questions: batch, candidates: task.candidates, target: options.target }),
      schema: portableReconciliationJsonSchema,
      signal: options.signal,
      budget,
      stage: "reconciliation" as const,
      requireOpenRouterZdr: options.requireOpenRouterZdr ?? options.providerOptions?.requireOpenRouterZdr,
    };
    const providers = [
      { provider: "gemini" as const, key: options.geminiApiKey, model: GEMINI_PRIMARY_MODEL },
      { provider: "groq" as const, key: options.groqApiKey, model: GROQ_STRUCTURED_MODEL },
      { provider: "openrouter" as const, key: options.openrouterApiKey, model: OPENROUTER_FREE_MODEL },
    ];
    let remaining = [...batch];
    for (const entry of providers) {
      if (remaining.length === 0) break;
      if (!hasKey(entry.key)) {
        recordConfigurationSkip(providerAttempts, configuredProviders, entry.provider, entry.model);
        continue;
      }
      if (options.signal?.aborted) break;
      const result = await runProvider(entry.provider, { ...baseInput, apiKey: entry.key, prompt: buildReconciliationPrompt({ questions: remaining, candidates: task.candidates, target: options.target }) });
      appendAttempts(providerAttempts, result.attempts);
      let qualityTried = false;
      const validateResult = (candidateResult: ProviderCallResult) => candidateResult.ok
        ? validateRelationshipEnvelope(candidateResult.payload, remaining, task.candidates)
        : undefined;
      const validation = validateResult(result);
      if (result.ok && validation?.validEnvelope && validation.usable) {
        for (const relationship of validation.relationships) {
          relationships.push(relationship);
          unresolved.delete(relationship.questionId);
        }
        remaining = remaining.filter((question) => unresolved.has(question.questionId));
        if (validation.invalidCount > 0) failures.push({ kind: "invalid-response", provider: result.provider, questionIds: validation.unresolvedQuestionIds });
        if (remaining.length === 0) break;
        // A schema-valid mixed response is not a quality-escalation trigger;
        // only unresolved questions move to the next provider.
        continue;
      }
      if (result.ok && (!validation?.usable || !validation.validEnvelope)) {
        providerAttempts.splice(Math.max(0, providerAttempts.length - result.attempts.length), result.attempts.length, ...markLastSuccessfulInvalid(result.attempts));
        qualityTried = true;
      } else if (!result.ok && result.aborted) {
        warnings.push("reconciliation stopped because the caller cancelled the run");
        break;
      } else if (!result.ok && result.failureKind === "budget" && result.budgetScope === "total") {
        failures.push({ kind: "budget", provider: result.provider, questionIds: remaining.map((question) => question.questionId) });
        totalBudgetExhausted = true;
        break;
      } else if (!result.ok && result.failureKind !== "invalid-response") {
        failures.push({ kind: failure(result.failureKind), provider: result.provider, questionIds: remaining.map((question) => question.questionId) });
      } else if (!result.ok && result.failureKind === "invalid-response") {
        qualityTried = true;
      }

      if (entry.provider === "gemini" && qualityTried && hasKey(entry.key) && !options.signal?.aborted) {
        const quality = await runProvider("gemini", { ...baseInput, apiKey: entry.key, prompt: buildReconciliationPrompt({ questions: remaining, candidates: task.candidates, target: options.target }), stage: "reconciliation" }, "quality");
        appendAttempts(providerAttempts, quality.attempts);
        const qualityValidation = validateResult(quality);
        if (quality.ok && qualityValidation?.validEnvelope && qualityValidation.usable) {
          for (const relationship of qualityValidation.relationships) {
            relationships.push(relationship);
            unresolved.delete(relationship.questionId);
          }
          remaining = remaining.filter((question) => unresolved.has(question.questionId));
          if (qualityValidation.invalidCount > 0) failures.push({ kind: "invalid-response", provider: quality.provider, questionIds: qualityValidation.unresolvedQuestionIds });
          if (remaining.length === 0) break;
        } else if (!quality.ok && quality.aborted) {
          warnings.push("reconciliation stopped because the caller cancelled the run");
          break;
        } else {
          if (quality.ok) providerAttempts.splice(Math.max(0, providerAttempts.length - quality.attempts.length), quality.attempts.length, ...markLastSuccessfulInvalid(quality.attempts));
          failures.push({ kind: quality.ok ? "invalid-response" : failure(quality.failureKind), provider: quality.provider, questionIds: remaining.map((question) => question.questionId) });
          if (!quality.ok && quality.failureKind === "budget" && quality.budgetScope === "total") totalBudgetExhausted = true;
        }
      }
      if (remaining.length === 0) break;
      if (totalBudgetExhausted) break;
      if (!result.ok && result.failureKind === "budget" && result.budgetScope === "total") break;
    }
    if (totalBudgetExhausted || budget.used >= budget.limit) break;
  }

  const unresolvedQuestionIds = [...unresolved].sort();
  const semanticIncomplete = new Set<ResearchCategory>([
    ...affectedCategories(unresolvedQuestionIds, planning.questions),
    ...planning.overflowCategories,
  ]);
  if (options.signal?.aborted) {
    for (const questionId of planning.questions.map((question) => question.questionId)) {
      if (unresolved.has(questionId)) semanticIncomplete.add(questionsById.get(questionId)?.category as ResearchCategory);
    }
  }

  const gate = evaluateEvidenceGate({
    candidates: options.candidates,
    sources: options.sources,
    documents: options.documents,
    target: options.target,
    requestedPeriod: options.requestedPeriod,
    decisionEligibleCategories,
    relationships,
    questions: planning.questions,
    unresolvedQuestionIds,
    forcedIncompleteCategories: [...semanticIncomplete],
  });
  const incompleteCategories = [...new Set([...gate.incompleteCategories, ...semanticIncomplete])].filter((category) => decisionEligibleCategories.includes(category)).sort();
  const completedCategories = gate.completedCategories.filter((category) => !incompleteCategories.includes(category)).sort();
  const unknownCategories = gate.unknownCategories.filter((category) => completedCategories.includes(category)).sort();

  let explanations: ReconciliationStageResult["explanations"] = [];
  let explanationBudget: ReconciliationStageResult["explanationBudget"] = { limit: 0, used: 0, providerUsed: { gemini: 0, groq: 0, openrouter: 0 } };
  if (options.explain === true || options.enableExplanations === true || options.explanation === true) {
    const explanation = await generateEvidenceExplanations({
      claims: gate.claims.filter((claim) => completedCategories.includes(claim.category)),
      categories: completedCategories,
      geminiApiKey: options.geminiApiKey,
      groqApiKey: options.groqApiKey,
      openrouterApiKey: options.openrouterApiKey,
      requireOpenRouterZdr: options.requireOpenRouterZdr,
      signal: options.signal,
      budget: options.explanationBudget,
      deterministicOnly: options.deterministicExplanations === true,
      providerOptions: options.providerOptions,
      runTask: options.explanationRunTask === undefined ? undefined : async ({ claims, categories }) => options.explanationRunTask?.({ claims, categories }) ?? { attempts: [] },
    });
    appendAttempts(providerAttempts, explanation.providerAttempts, "explanation");
    explanations = explanation.explanations;
    explanationBudget = explanation.budget;
    failures.push(...explanation.failures);
  }

  return {
    claims: gate.claims,
    relationships: [...new Map(relationships.map((relationship) => [relationship.questionId, relationship])).values()].sort((left, right) => left.questionId.localeCompare(right.questionId)),
    unresolvedQuestionIds,
    completedCategories,
    incompleteCategories,
    unknownCategories,
    providerAttempts,
    failures,
    warnings: [...new Set([...warnings, ...gate.warnings])],
    explanations,
    reconciliationBudget: { limit: budget.limit, used: budget.used, providerUsed: budget.providerUsed },
    explanationBudget,
  };
}

export const runReconciliation = reconcileResearchClaims;
export const runReconciliationStage = reconcileResearchClaims;
export const runPhase2E = reconcileResearchClaims;
export const reconcileClaims = reconcileResearchClaims;
