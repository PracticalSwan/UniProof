import "server-only";

import {
  canonicalizeResearchCategories,
  researchRequestSchema,
  researchResultSchema,
  type EvidenceExplanation,
  type ResearchCategory,
  type ResearchFailure,
  type ResearchProviderAttempt,
  type ResearchRequest,
  type ResearchResult,
} from "@/lib/research/contracts";
import { createStructuredProviderHealth } from "@/lib/research/ai/types";
import type { ResolvedResearchTarget } from "@/lib/research/discovery/types";
import { extractResearchDocuments } from "@/lib/research/extraction/orchestrator";
import type { ExtractionFailure, ExtractionStageResult, ExtractionTargetIdentity } from "@/lib/research/extraction/types";
import { runDiscoveryRetrievalStage } from "@/lib/research/pipeline";
import { researchAbortFailureCode } from "./execution-budget";
import { reconcileResearchClaims } from "@/lib/research/reconciliation/orchestrator";
import type { ReconciliationFailure, ReconciliationStageResult } from "@/lib/research/reconciliation/types";
import {
  RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN,
  RESEARCH_MAX_WARNINGS_PER_RUN,
} from "@/lib/security/research-limits";
import {
  createDefaultRunId,
  createMonotonicResearchClock,
  primaryFailureCode,
  terminalStatus,
} from "./lifecycle";
import { buildEvidenceSummary } from "./summary";
import type { Phase2ResearchOptions } from "./types";

function sanitizeWarning(value: string): string | undefined {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
  return normalized.length === 0 ? undefined : normalized.slice(0, 500);
}

function aggregateWarnings(...groups: readonly (readonly string[])[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const value of group) {
      const warning = sanitizeWarning(value);
      if (warning === undefined || seen.has(warning)) continue;
      seen.add(warning);
      unique.push(warning);
    }
  }
  if (unique.length <= RESEARCH_MAX_WARNINGS_PER_RUN) return unique;
  return [...unique.slice(0, RESEARCH_MAX_WARNINGS_PER_RUN - 1), "additional warnings omitted"];
}

function normalizeProviderAttempts(attempts: readonly ResearchProviderAttempt[]): ResearchProviderAttempt[] {
  const result: ResearchProviderAttempt[] = [];
  const providerScopedSkips = new Set<string>();
  const totalBudgetSkips = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.stage === "discovery" || attempt.outcome !== "skipped") {
      result.push(attempt);
      continue;
    }
    if (
      attempt.failureKind === "configuration" ||
      attempt.failureKind === "rate-limit" ||
      attempt.failureKind === "authentication" ||
      attempt.failureKind === "policy" ||
      attempt.failureKind === "capability" ||
      (attempt.failureKind === "budget" && attempt.budgetScope !== "total")
    ) {
      const key = attempt.stage + ":" + attempt.provider + ":" + attempt.failureKind;
      if (providerScopedSkips.has(key)) continue;
      providerScopedSkips.add(key);
      result.push(attempt);
      continue;
    }
    if (attempt.failureKind === "budget" && attempt.budgetScope === "total") {
      if (totalBudgetSkips.has(attempt.stage)) continue;
      totalBudgetSkips.add(attempt.stage);
      result.push(attempt);
      continue;
    }
    result.push(attempt);
  }
  if (result.length > RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN) {
    throw new Error("research orchestration provider history exceeded the derived bound");
  }
  return result;
}

function extractionFailureCode(failures: readonly ExtractionFailure[], aborted: boolean): ResearchFailure["code"] {
  if (aborted) return "cancelled";
  if (failures.some((failure) => failure.kind === "budget")) return "provider-budget";
  if (failures.length > 0 && failures.every((failure) => failure.kind === "rate-limit")) return "provider-rate-limit";
  if (failures.length > 0 && failures.every((failure) => failure.kind === "timeout")) return "timeout";
  return "provider-error";
}

function reconciliationFailureCode(failures: readonly ReconciliationFailure[], aborted: boolean): ResearchFailure["code"] {
  if (aborted) return "cancelled";
  if (failures.some((failure) => failure.kind === "budget")) return "provider-budget";
  if (failures.length > 0 && failures.every((failure) => failure.kind === "rate-limit")) return "provider-rate-limit";
  if (failures.length > 0 && failures.every((failure) => failure.kind === "timeout")) return "timeout";
  return "provider-error";
}

function failureMessage(code: ResearchFailure["code"]): string {
  switch (code) {
    case "cancelled": return "research work was cancelled before this category completed";
    case "validation": return "research request failed contract validation";
    case "timeout": return "bounded research work timed out before this category completed";
    case "source-discovery": return "source discovery did not complete for this category";
    case "retrieval": return "source retrieval did not complete for this category";
    case "normalization": return "source normalization did not complete for this category";
    case "source-limit": return "bounded source selection left this category incomplete";
    case "provider-rate-limit": return "AI provider rate limits prevented this category from completing";
    case "provider-budget": return "bounded AI work reached its attempt budget before this category completed";
    case "provider-error": return "bounded AI provider work did not complete for this category";
    default: return "research work did not complete for this category";
  }
}

function buildFailures(
  requestedCategories: readonly ResearchCategory[],
  processedCategories: readonly ResearchCategory[],
  reasons: ReadonlyMap<ResearchCategory, ResearchFailure["code"]>,
): ResearchFailure[] {
  const processed = new Set(processedCategories);
  return requestedCategories
    .filter((category) => !processed.has(category))
    .map((category) => {
      const code = reasons.get(category) ?? "unknown";
      return { category, code, message: failureMessage(code) };
    });
}

function extractionTarget(request: ResearchRequest, target: ResolvedResearchTarget): ExtractionTargetIdentity {
  return {
    universityId: target.universityId,
    universityName: target.universityName,
    programId: target.programId,
    programName: target.programName,
    subjectArea: target.subjectArea ?? request.target?.subjectArea,
    countryCode: target.countryCode,
    degreeLevel: target.degreeLevel,
    officialHost: target.officialHost,
  };
}

function resultOrThrow(value: unknown): ResearchResult {
  const parsed = researchResultSchema.safeParse(value);
  if (!parsed.success) throw new Error("research orchestration produced an invalid final result");
  return parsed.data;
}

export async function runPhase2Research(
  input: unknown,
  options: Phase2ResearchOptions = {},
): Promise<ResearchResult> {
  const clock = createMonotonicResearchClock(options.now ?? (() => new Date().toISOString()));
  const runId = (options.createRunId ?? createDefaultRunId)();
  const createdAt = clock.next();
  const startedAt = clock.next();
  const parsed = researchRequestSchema.safeParse(input);

  if (!parsed.success) {
    const updatedAt = clock.next();
    const completedAt = clock.next();
    const failure: ResearchFailure = { code: "validation", message: "research request failed contract validation" };
    return resultOrThrow({
      run: {
        id: runId, status: "failed", createdAt, startedAt, updatedAt, completedAt, partial: false,
        providerAttempts: [], processedCategories: [], unprocessedCategories: [],
        failureCode: "validation", failureReason: failure.message,
      },
      candidateSources: [], sources: [], documents: [], candidates: [], claims: [], explanations: [],
      evidenceSummary: buildEvidenceSummary({ claims: [], processedCategories: [], unprocessedCategories: [], failedCategories: [] }),
      failures: [failure], warnings: [],
    });
  }

  const request: ResearchRequest = { ...parsed.data, categories: canonicalizeResearchCategories(parsed.data.categories) };
  const requestedCategories = request.categories;
  const providerHealth = options.extraction?.providerOptions?.providerHealth ??
    options.reconciliation?.providerOptions?.providerHealth ??
    createStructuredProviderHealth();
  const initialAbortCode = options.signal?.aborted
    ? researchAbortFailureCode(options.signal)
    : undefined;
  if (initialAbortCode !== undefined) {
    const updatedAt = clock.next();
    const completedAt = clock.next();
    const failures = requestedCategories.map((category) => ({
      category, code: initialAbortCode, message: failureMessage(initialAbortCode),
    }));
    return resultOrThrow({
      run: {
        id: runId, status: "failed", createdAt, startedAt, updatedAt, completedAt, partial: false,
        providerAttempts: [], processedCategories: [], unprocessedCategories: requestedCategories,
        failureCode: initialAbortCode,
        failureReason: initialAbortCode === "timeout"
          ? "research run reached its whole-run deadline before provider work began"
          : "research run was cancelled before provider work began",
      },
      candidateSources: [], sources: [], documents: [], candidates: [], claims: [], explanations: [],
      evidenceSummary: buildEvidenceSummary({
        claims: [], processedCategories: [], unprocessedCategories: requestedCategories, failedCategories: requestedCategories,
      }),
      failures, warnings: [],
    });
  }

  const stage = await runDiscoveryRetrievalStage(request, {
    discovery: options.discovery,
    retrieve: options.retrieve,
    signal: options.signal,
  });
  const reasonByCategory = new Map<ResearchCategory, ResearchFailure["code"]>();
  for (const state of stage.categoryStates) {
    if (!state.complete) reasonByCategory.set(state.category, state.reason ?? "source-discovery");
  }

  if (!stage.resolution.resolved) {
    for (const category of requestedCategories) {
      reasonByCategory.set(
        category,
        options.signal?.aborted ? researchAbortFailureCode(options.signal) : "source-discovery",
      );
    }
    const processedCategories: ResearchCategory[] = [];
    const unprocessedCategories = [...requestedCategories];
    const failures = buildFailures(requestedCategories, processedCategories, reasonByCategory);
    const updatedAt = clock.next();
    const completedAt = clock.next();
    const failureCode = primaryFailureCode(failures) ?? "source-discovery";
    return resultOrThrow({
      run: {
        id: runId, status: "failed", createdAt, startedAt, updatedAt, completedAt, partial: false,
        providerAttempts: normalizeProviderAttempts(stage.providerAttempts),
        processedCategories, unprocessedCategories, failureCode, failureReason: failureMessage(failureCode),
      },
      candidateSources: stage.candidateSources, sources: stage.sources, documents: stage.documents,
      candidates: [], claims: [], explanations: [],
      evidenceSummary: buildEvidenceSummary({ claims: [], processedCategories, unprocessedCategories, failedCategories: unprocessedCategories }),
      failures, warnings: aggregateWarnings(stage.warnings),
    });
  }

  const cleanEmptyCategories = stage.categoryStates
    .filter((state) => state.complete && state.discoveryStatus === "empty")
    .map((state) => state.category);
  const extractionCategories = stage.categoryStates
    .filter((state) => state.discoveryStatus === "covered" && (state.complete || state.hasUsableDocument))
    .map((state) => state.category);

  let extraction: ExtractionStageResult | undefined;
  if (extractionCategories.length > 0 && !options.signal?.aborted) {
    extraction = await extractResearchDocuments(stage.documents, {
      ...options.extraction,
      providerOptions: { ...options.extraction?.providerOptions, providerHealth },
      categories: extractionCategories,
      categoriesByDocumentId: stage.documentCategories,
      target: extractionTarget(request, stage.resolution.target),
      signal: options.signal,
      geminiApiKey: options.extraction?.geminiApiKey ?? process.env.GEMINI_API_KEY,
      groqApiKey: options.extraction?.groqApiKey ?? process.env.GROQ_API_KEY,
      openrouterApiKey: options.extraction?.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
    });
    const extractionCode = extractionFailureCode(extraction.failures, options.signal?.aborted === true);
    for (const category of extraction.incompleteCategories) reasonByCategory.set(category, extractionCode);
  } else if (options.signal?.aborted) {
    for (const category of extractionCategories) reasonByCategory.set(category, "cancelled");
  }

  const extractionCompleted = extraction === undefined
    ? []
    : extraction.completedCategories.filter((category) => extractionCategories.includes(category));
  const extractionClaimBearingCategories = new Set((extraction?.candidates ?? []).map((candidate) => candidate.category));
  const extractionGapCategories = extraction === undefined
    ? []
    : extraction.incompleteCategories.filter((category) => extractionClaimBearingCategories.has(category));
  const decisionEligibleCategories = canonicalizeResearchCategories([
    ...cleanEmptyCategories,
    ...extractionCompleted,
    ...extractionGapCategories,
  ]);

  let reconciliation: ReconciliationStageResult | undefined;
  if (decisionEligibleCategories.length > 0 && !options.signal?.aborted) {
    reconciliation = await reconcileResearchClaims({
      ...options.reconciliation,
      providerOptions: { ...options.reconciliation?.providerOptions, providerHealth },
      candidates: extraction?.candidates ?? [],
      sources: stage.sources,
      documents: stage.documents,
      target: stage.resolution.target,
      requestedPeriod: { academicYear: request.academicYear, intake: request.intake },
      decisionEligibleCategories,
      signal: options.signal,
      explain: true,
      deterministicExplanations: true,
      geminiApiKey: options.reconciliation?.geminiApiKey ?? options.extraction?.geminiApiKey ?? process.env.GEMINI_API_KEY,
      groqApiKey: options.reconciliation?.groqApiKey ?? options.extraction?.groqApiKey ?? process.env.GROQ_API_KEY,
      openrouterApiKey: options.reconciliation?.openrouterApiKey ?? options.extraction?.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
    });
    const reconciliationCode = reconciliationFailureCode(reconciliation.failures, options.signal?.aborted === true);
    for (const category of reconciliation.incompleteCategories) reasonByCategory.set(category, reconciliationCode);
  } else if (options.signal?.aborted) {
    for (const category of decisionEligibleCategories) reasonByCategory.set(category, "cancelled");
  }

  const reconciliationCompletedCategories = canonicalizeResearchCategories(reconciliation?.completedCategories ?? []);
  const reconciledClaims = reconciliation?.claims ?? [];
  const claimBearingCategories = new Set(reconciledClaims.map((claim) => claim.category));
  const processedCategories = reconciliationCompletedCategories.filter((category) =>
    !reasonByCategory.has(category) || claimBearingCategories.has(category)
  );
  const unprocessedCategories = requestedCategories.filter((category) => !processedCategories.includes(category));
  const terminalAbortCode = options.signal?.aborted
    ? researchAbortFailureCode(options.signal)
    : undefined;
  if (terminalAbortCode !== undefined) {
    for (const category of unprocessedCategories) {
      reasonByCategory.set(category, terminalAbortCode);
    }
  }
  const claims = reconciledClaims.filter((claim) => processedCategories.includes(claim.category));
  const explanationByCategory = new Map(
    (reconciliation?.explanations ?? []).map((explanation) => [explanation.category, explanation]),
  );
  const explanations: EvidenceExplanation[] = processedCategories
    .map((category) => explanationByCategory.get(category))
    .filter((explanation): explanation is EvidenceExplanation => explanation !== undefined);
  const terminalFailures = buildFailures(requestedCategories, processedCategories, reasonByCategory);
  const sourceGapFailures: ResearchFailure[] = processedCategories.flatMap((category) => {
    const code = reasonByCategory.get(category);
    return code === "retrieval" ||
        code === "normalization" ||
        code === "provider-rate-limit" ||
        code === "provider-budget" ||
        code === "provider-error" ||
        code === "timeout"
      ? [{ category, code, message: failureMessage(code) }]
      : [];
  });
  const failures = [...terminalFailures, ...sourceGapFailures];
  const failedCategories = unprocessedCategories.filter((category) => terminalFailures.some((failure) => failure.category === category));
  const evidenceSummary = buildEvidenceSummary({ claims, processedCategories, unprocessedCategories, failedCategories });
  const providerAttempts = normalizeProviderAttempts([
    ...stage.providerAttempts,
    ...(extraction?.providerAttempts ?? []),
    ...(reconciliation?.providerAttempts ?? []),
  ]);
  const status = terminalStatus(processedCategories, unprocessedCategories);
  const updatedAt = clock.next();
  const completedAt = clock.next();
  const failureCode = status === "failed" ? primaryFailureCode(failures) ?? "unknown" : undefined;

  return resultOrThrow({
    run: {
      id: runId, status, createdAt, startedAt, updatedAt, completedAt, partial: status === "partial",
      providerAttempts, processedCategories, unprocessedCategories,
      ...(failureCode === undefined ? {} : { failureCode, failureReason: failureMessage(failureCode) }),
    },
    candidateSources: stage.candidateSources,
    sources: stage.sources,
    documents: stage.documents,
    candidates: extraction?.candidates ?? [],
    claims,
    explanations,
    evidenceSummary,
    failures,
    warnings: aggregateWarnings(stage.warnings, extraction?.warnings ?? [], reconciliation?.warnings ?? []),
  });
}
