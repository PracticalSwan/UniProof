import "server-only";

import {
  researchProviderAttemptSchema,
  type ResearchExtractionProvider,
  type ResearchProviderAttempt,
  type ResearchProviderAttemptFailureKind,
} from "@/lib/research/contracts";
import {
  RESEARCH_AI_HTTP_ATTEMPT_TIMEOUT_MS,
  RESEARCH_AI_MAX_RESPONSE_BYTES,
  RESEARCH_MAX_RETRY_AFTER_MS,
} from "@/lib/security/research-limits";
import { readBoundedJson } from "@/lib/integrations/read-bounded-response";
import type {
  StructuredAiBudget,
  StructuredTaskKind,
  StructuredProviderOptions,
  StructuredProviderResult,
} from "./types";
import { assertValidAiBudget, createStructuredAiBudget } from "./types";

type ProviderResponseParse =
  | { ok: true; payload: unknown; model?: string }
  | { ok: false };

export type ProviderTransportSpec = {
  provider: ResearchExtractionProvider;
  stage?: StructuredTaskKind;
  endpoint: string;
  requestedModel: string;
  headers: Record<string, string>;
  body: unknown;
  requireConcreteModel?: boolean;
  parseResponse: (body: unknown) => ProviderResponseParse;
};

type TransportOutcome =
  | { kind: "success"; payload: unknown; model: string }
  | { kind: "failure"; failureKind: ResearchProviderAttemptFailureKind; retryAfterMs?: number }
  | { kind: "aborted" };

function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function truncateUtf16(value: string, maximumUnits: number): string {
  if (value.length <= maximumUnits) return value;
  let result = "";
  for (const character of value) {
    if (result.length + character.length > maximumUnits) break;
    result += character;
  }
  return result;
}

function boundedModel(value: string | undefined, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  const chosen = candidate === "" || !isWellFormedUtf16(candidate) ? fallback : candidate;
  return truncateUtf16(chosen, 80);
}

function usableReturnedModel(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (candidate === "" || candidate.length > 80 || !isWellFormedUtf16(candidate) || /[\u0000-\u001f\u007f]/u.test(candidate)) return undefined;
  return candidate;
}

function durationMs(now: () => number, startedAt: number): number {
  return Math.max(0, Math.min(120_000, Math.round(now() - startedAt)));
}

function attemptRecord(
  spec: ProviderTransportSpec,
  outcome: ResearchProviderAttempt["outcome"],
  retryCount: number,
  startedAt: number,
  now: () => number,
  failureKind?: ResearchProviderAttemptFailureKind,
  model?: string,
  stage: StructuredTaskKind = spec.stage ?? "extraction",
): ResearchProviderAttempt {
  return researchProviderAttemptSchema.parse({
    stage,
    provider: spec.provider,
    outcome,
    retryCount,
    durationMs: durationMs(now, startedAt),
    model: boundedModel(model, spec.requestedModel),
    failureKind,
  });
}

function classifyStatus(status: number): ResearchProviderAttemptFailureKind {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "policy";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate-limit";
  if (status === 451) return "policy";
  if (status >= 500) return "upstream";
  if (status >= 400 && status < 500) return "capability";
  return "upstream";
}

function canRetry(failureKind: ResearchProviderAttemptFailureKind): boolean {
  return failureKind === "rate-limit" || failureKind === "timeout" || failureKind === "upstream";
}

function cancelResponseBody(response: Response, reason: string): void {
  try {
    const cancellation = response.body?.cancel(reason);
    void cancellation?.catch(() => undefined);
  } catch {
    // Sanitized status classification must survive a provider body cleanup
    // failure; no body content is read or retained here.
  }
}

/**
 * Parse only a bounded Retry-After value. Invalid values intentionally return
 * undefined so the caller can use an injected deterministic backoff.
 */
export function parseRetryAfterMs(
  value: string | null,
  now: () => number = Date.now,
): number | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (normalized === "") return undefined;
  if (/^\d+(?:\.\d+)?$/u.test(normalized)) {
    const seconds = Number(normalized);
    if (!Number.isFinite(seconds) || seconds < 0) return undefined;
    return Math.min(RESEARCH_MAX_RETRY_AFTER_MS, Math.round(seconds * 1_000));
  }
  // A negative numeric value must not fall through to Date.parse (which
  // accepts a few surprising legacy date spellings such as "-1").
  if (/^-\d+(?:\.\d+)?$/u.test(normalized)) return undefined;
  const date = Date.parse(normalized);
  if (!Number.isFinite(date)) return undefined;
  const delay = date - now();
  if (delay < 0) return undefined;
  return Math.min(RESEARCH_MAX_RETRY_AFTER_MS, delay);
}

function defaultBackoffMs(retryCount: number): number {
  return Math.min(RESEARCH_MAX_RETRY_AFTER_MS, 250 * (retryCount + 1));
}

type AttemptReservation = "reserved" | "provider-budget" | "total-budget" | "aborted";

function reserveAttempt(
  budget: StructuredAiBudget,
  provider: ResearchExtractionProvider,
  signal?: AbortSignal,
): AttemptReservation {
  if (signal?.aborted) return "aborted";
  if (budget.used >= budget.limit) return "total-budget";
  if (budget.providerUsed[provider] >= budget.providerLimits[provider]) return "provider-budget";
  budget.used += 1;
  budget.providerUsed[provider] += 1;
  return "reserved";
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    (timer as unknown as { unref?: () => void }).unref?.();
  });
}

async function sleepWithAbort(
  milliseconds: number,
  signal: AbortSignal | undefined,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<boolean> {
  if (signal?.aborted) return false;
  if (milliseconds <= 0) return !signal?.aborted;

  let aborted = false;
  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<void>((resolve) => {
    onAbort = () => {
      aborted = true;
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  await Promise.race([sleep(milliseconds), abortPromise]);
  if (onAbort !== undefined) signal?.removeEventListener("abort", onAbort);
  return !aborted && !signal?.aborted;
}

async function dispatchOnce(
  spec: ProviderTransportSpec,
  options: Required<Pick<StructuredProviderOptions, "fetchImpl" | "now" | "sleep">> & StructuredProviderOptions,
  retryCount: number,
): Promise<{ outcome: TransportOutcome; attempt: ResearchProviderAttempt }> {
  const signal = options.signal;
  if (signal?.aborted) {
    return {
      outcome: { kind: "aborted" },
      attempt: attemptRecord(spec, "skipped", retryCount, options.now(), options.now, "budget"),
    };
  }

  const startedAt = options.now();
  const controller = new AbortController();
  let deadlineReached = false;
  let onCallerAbort: (() => void) | undefined;
  let rejectDeadline: ((reason?: unknown) => void) | undefined;
  const timeout = setTimeout(() => {
    deadlineReached = true;
    controller.abort();
    rejectDeadline?.(new Error("provider deadline"));
  }, RESEARCH_AI_HTTP_ATTEMPT_TIMEOUT_MS);
  (timeout as unknown as { unref?: () => void }).unref?.();
  const deadlinePromise = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  let rejectCallerAbort: ((reason?: unknown) => void) | undefined;
  const callerAbortPromise = new Promise<never>((_, reject) => {
    rejectCallerAbort = reject;
  });
  if (signal !== undefined) {
    onCallerAbort = () => {
      controller.abort();
      rejectCallerAbort?.(new Error("caller cancelled"));
    };
    signal.addEventListener("abort", onCallerAbort, { once: true });
    if (signal.aborted) onCallerAbort();
  }

  try {
    const requestPromise = options.fetchImpl(spec.endpoint, {
      method: "POST",
      headers: spec.headers,
      body: JSON.stringify(spec.body),
      redirect: "error",
      signal: controller.signal,
    });
    requestPromise.catch(() => undefined);
    const response = await Promise.race([
      requestPromise,
      deadlinePromise,
      ...(signal === undefined ? [] : [callerAbortPromise]),
    ]);

    if (signal?.aborted) {
      return {
        outcome: { kind: "aborted" },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, "upstream"),
      };
    }

    if (!response.ok) {
      const failureKind = classifyStatus(response.status);
      cancelResponseBody(response, "provider status body discarded");
      return {
        outcome: {
          kind: "failure",
          failureKind,
          retryAfterMs: failureKind === "rate-limit" ? parseRetryAfterMs(response.headers.get("retry-after"), options.now) : undefined,
        },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, failureKind),
      };
    }

    const bodyPromise = readBoundedJson(response, RESEARCH_AI_MAX_RESPONSE_BYTES);
    bodyPromise.catch(() => null);
    let body: unknown | null;
    try {
      body = await Promise.race([
        bodyPromise,
        deadlinePromise,
        ...(signal === undefined ? [] : [callerAbortPromise]),
      ]);
    } catch (error) {
      if (deadlineReached || signal?.aborted) throw error;
      return {
        outcome: { kind: "failure", failureKind: "invalid-response" },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, "invalid-response"),
      };
    }
    if (signal?.aborted) {
      return {
        outcome: { kind: "aborted" },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, "upstream"),
      };
    }
    if (body === null) {
      return {
        outcome: { kind: "failure", failureKind: "invalid-response" },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, "invalid-response"),
      };
    }

    const parsed = spec.parseResponse(body);
    const returnedModel = parsed.ok ? usableReturnedModel(parsed.model) : undefined;
    if (!parsed.ok || (spec.requireConcreteModel && returnedModel === undefined)) {
      return {
        outcome: { kind: "failure", failureKind: "invalid-response" },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, "invalid-response", returnedModel),
      };
    }
    const model = returnedModel ?? boundedModel(undefined, spec.requestedModel);
    return {
      outcome: { kind: "success", payload: parsed.payload, model },
      attempt: attemptRecord(spec, "success", retryCount, startedAt, options.now, undefined, model),
    };
  } catch {
    if (signal?.aborted) {
      return {
        outcome: { kind: "aborted" },
        attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, "upstream"),
      };
    }
    const failureKind: ResearchProviderAttemptFailureKind = deadlineReached ? "timeout" : "upstream";
    return {
      outcome: { kind: "failure", failureKind },
      attempt: attemptRecord(spec, "failed", retryCount, startedAt, options.now, failureKind),
    };
  } finally {
    clearTimeout(timeout);
    if (onCallerAbort !== undefined) signal?.removeEventListener("abort", onCallerAbort);
  }
}

export async function runProviderTransport(
  spec: ProviderTransportSpec,
  inputOptions: StructuredProviderOptions = {},
): Promise<StructuredProviderResult> {
  const options = {
    ...inputOptions,
    fetchImpl: inputOptions.fetchImpl ?? fetch,
    now: inputOptions.now ?? Date.now,
    sleep: inputOptions.sleep ?? defaultSleep,
  };
  const stage = inputOptions.stage ?? inputOptions.kind ?? spec.stage ?? "extraction";
  const budget = options.budget ?? createStructuredAiBudget(stage);
  assertValidAiBudget(budget, stage);
  const attempts: ResearchProviderAttempt[] = [];
  const stagedSpec = spec.stage === stage ? spec : { ...spec, stage };

  if (options.signal?.aborted) {
    return { ok: false, provider: spec.provider, failureKind: "upstream", attempts, aborted: true };
  }
  if (typeof options.apiKey !== "string" || options.apiKey.trim() === "") {
    attempts.push(researchProviderAttemptSchema.parse({
      stage,
      provider: spec.provider,
      model: spec.requestedModel,
      outcome: "skipped",
      retryCount: 0,
      durationMs: 0,
      failureKind: "configuration",
    }));
    return { ok: false, provider: spec.provider, failureKind: "configuration", attempts };
  }

  const maxRetries = 1;
  for (let retryCount = 0; retryCount <= maxRetries; retryCount += 1) {
    if (options.signal?.aborted) {
      return { ok: false, provider: spec.provider, failureKind: "upstream", attempts, aborted: true };
    }
    const reservation = reserveAttempt(budget, spec.provider, options.signal);
    if (reservation === "aborted") {
      return { ok: false, provider: spec.provider, failureKind: "upstream", attempts, aborted: true };
    }
    if (reservation !== "reserved") {
      attempts.push(researchProviderAttemptSchema.parse({
        stage,
        provider: spec.provider,
        model: spec.requestedModel,
        outcome: "skipped",
        retryCount,
        durationMs: 0,
        failureKind: "budget",
        budgetScope: reservation === "total-budget" ? "total" : "provider",
      }));
      return {
        ok: false,
        provider: spec.provider,
        failureKind: "budget",
        budgetScope: reservation === "total-budget" ? "total" : "provider",
        attempts,
      };
    }

    const dispatched = await dispatchOnce(stagedSpec, options, retryCount);
    attempts.push(dispatched.attempt);
    if (dispatched.outcome.kind === "aborted") {
      return { ok: false, provider: spec.provider, failureKind: "upstream", attempts, aborted: true };
    }
    if (dispatched.outcome.kind === "success") {
      return {
        ok: true,
        provider: spec.provider,
        payload: dispatched.outcome.payload,
        model: dispatched.outcome.model,
        attempts,
      };
    }

    const failureKind = dispatched.outcome.failureKind;
    if (!canRetry(failureKind) || retryCount >= maxRetries) {
      return { ok: false, provider: spec.provider, failureKind, attempts };
    }
    const delay = dispatched.outcome.retryAfterMs ?? defaultBackoffMs(retryCount);
    let mayRetry = false;
    try {
      mayRetry = await sleepWithAbort(delay, options.signal, options.sleep);
    } catch {
      return { ok: false, provider: spec.provider, failureKind: "upstream", attempts };
    }
    if (!mayRetry) {
      return { ok: false, provider: spec.provider, failureKind: "upstream", attempts, aborted: true };
    }
  }

  return { ok: false, provider: spec.provider, failureKind: "upstream", attempts };
}

/** Project-owned structured-task entry point used by provider adapters. */
export const runStructuredTask = runProviderTransport;

export function boundedJsonObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
