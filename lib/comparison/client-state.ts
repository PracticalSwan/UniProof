import { z } from "zod";

import type { PublicResearchTransportError, ResearchDossier } from "@/lib/research/mode/public-contracts";
import { researchDossierSchema } from "@/lib/research/mode/public-contracts";
import {
  comparisonSubmissionSchema,
  comparisonTargetSchema,
  comparisonTargetKey,
  type ComparisonSubmission,
  type ComparisonTarget,
} from "./contracts";
import { comparisonScoreResultSchema, type ComparisonScoreResult } from "./scoring";
import { comparisonTradeoffSchema, type ComparisonTradeoff } from "./tradeoffs";

const comparisonTransportErrorSchema = z.object({
  code: z.enum([
    "invalid-content-type",
    "request-too-large",
    "invalid-json",
    "invalid-request",
    "unsupported-target",
    "sensitive-input",
    "forbidden-origin",
    "internal-error",
    "network-error",
    "invalid-response",
  ]),
  message: z.string().trim().min(1).max(300),
}).strict();

export const comparisonResearchOutcomeSchema = z.discriminatedUnion("state", [
  z.object({
    target: comparisonTargetSchema,
    state: z.literal("dossier"),
    dossier: researchDossierSchema,
  }).strict(),
  z.object({
    target: comparisonTargetSchema,
    state: z.literal("transport-error"),
    error: comparisonTransportErrorSchema,
  }).strict(),
]);

export type ComparisonTransportError = Readonly<{
  code: PublicResearchTransportError["code"] | "network-error" | "invalid-response";
  message: string;
}>;

export type ComparisonResearchOutcome =
  | Readonly<{ target: ComparisonTarget; state: "dossier"; dossier: ResearchDossier }>
  | Readonly<{ target: ComparisonTarget; state: "transport-error"; error: ComparisonTransportError }>;

export type ComparisonResult = Readonly<{
  submission: ComparisonSubmission;
  status: "complete" | "partial";
  outcomes: readonly ComparisonResearchOutcome[];
  score: ComparisonScoreResult;
  tradeoffs: readonly ComparisonTradeoff[];
}>;

export const comparisonResultSchema = z.object({
  submission: comparisonSubmissionSchema,
  status: z.enum(["complete", "partial"]),
  outcomes: z.array(comparisonResearchOutcomeSchema).min(2).max(4),
  score: comparisonScoreResultSchema,
  tradeoffs: z.array(comparisonTradeoffSchema).max(100),
}).strict();

export type ComparisonWorkspaceError = Readonly<{
  code: "insufficient-usable-targets" | "shared-request-error";
  message: string;
}>;

export type ComparisonWorkspaceState =
  | Readonly<{ kind: "idle"; notice?: string; lastSequence?: number }>
  | Readonly<{
      kind: "loading";
      requestSequence: number;
      submission: ComparisonSubmission;
      currentTargetIndex: number;
      completedTargets: readonly ComparisonResearchOutcome[];
      previous?: ComparisonResult;
    }>
  | Readonly<{ kind: "result"; result: ComparisonResult; notice?: string; lastSequence?: number }>
  | Readonly<{
      kind: "error";
      requestSequence: number;
      error: ComparisonWorkspaceError;
      submission: ComparisonSubmission;
      completedTargets: readonly ComparisonResearchOutcome[];
      previous?: ComparisonResult;
    }>;

export type ComparisonWorkspaceAction =
  | { type: "start"; sequence: number; submission: ComparisonSubmission }
  | { type: "target-complete"; sequence: number; index: number; outcome: ComparisonResearchOutcome }
  | { type: "complete"; sequence: number; result: ComparisonResult }
  | { type: "fail"; sequence: number; error: ComparisonWorkspaceError; completedTargets: readonly ComparisonResearchOutcome[] }
  | { type: "cancel"; sequence: number }
  | { type: "restore"; sequence: number; result: ComparisonResult }
  | { type: "clear-result" };

export function createComparisonWorkspaceState(): ComparisonWorkspaceState {
  return { kind: "idle" };
}

function stateSequence(state: ComparisonWorkspaceState): number {
  if (state.kind === "loading" || state.kind === "error") return state.requestSequence;
  return state.lastSequence ?? 0;
}

export function comparisonWorkspaceReducer(
  state: ComparisonWorkspaceState,
  action: ComparisonWorkspaceAction,
): ComparisonWorkspaceState {
  if (action.type === "clear-result") {
    return { kind: "idle", lastSequence: stateSequence(state) || undefined };
  }

  if (action.type === "start") {
    if (action.sequence <= stateSequence(state)) return state;
    const previous = state.kind === "result"
      ? state.result
      : state.kind === "loading" || state.kind === "error"
        ? state.previous
        : undefined;
    return {
      kind: "loading",
      requestSequence: action.sequence,
      submission: action.submission,
      currentTargetIndex: 0,
      completedTargets: [],
      ...(previous === undefined ? {} : { previous }),
    };
  }

  if (action.type === "restore") {
    if (state.kind === "loading" || action.sequence <= stateSequence(state)) return state;
    return {
      kind: "result",
      result: action.result,
      notice: "Saved snapshot loaded.",
      lastSequence: action.sequence,
    };
  }

  if (state.kind !== "loading" || action.sequence !== state.requestSequence) return state;

  if (action.type === "target-complete") {
    if (action.index !== state.currentTargetIndex || action.index >= state.submission.targets.length) return state;
    const expected = state.submission.targets[action.index]!;
    if (comparisonTargetKey(expected) !== comparisonTargetKey(action.outcome.target)) return state;
    return {
      ...state,
      currentTargetIndex: action.index + 1,
      completedTargets: [...state.completedTargets, action.outcome],
    };
  }

  if (action.type === "complete") {
    return {
      kind: "result",
      result: action.result,
      lastSequence: action.sequence,
    };
  }

  if (action.type === "fail") {
    return {
      kind: "error",
      requestSequence: action.sequence,
      error: action.error,
      submission: state.submission,
      completedTargets: [...action.completedTargets],
      ...(state.previous === undefined ? {} : { previous: state.previous }),
    };
  }

  if (action.type === "cancel") {
    return state.previous === undefined
      ? { kind: "idle", notice: "Comparison cancelled.", lastSequence: action.sequence }
      : { kind: "result", result: state.previous, notice: "Comparison cancelled.", lastSequence: action.sequence };
  }

  return state;
}

export function isUsableComparisonDossier(dossier: ResearchDossier): boolean {
  return dossier.run.status === "succeeded" || dossier.run.status === "partial";
}

export function finalizeComparisonOutcomes(
  submission: ComparisonSubmission,
  outcomes: readonly ComparisonResearchOutcome[],
):
  | { ok: true; status: "complete" | "partial"; dossiers: readonly ResearchDossier[] }
  | { ok: false; error: ComparisonWorkspaceError } {
  const dossiers = outcomes
    .filter((outcome): outcome is Extract<ComparisonResearchOutcome, { state: "dossier" }> =>
      outcome.state === "dossier" && isUsableComparisonDossier(outcome.dossier)
    )
    .map((outcome) => outcome.dossier);
  if (dossiers.length < 2) {
    return {
      ok: false,
      error: {
        code: "insufficient-usable-targets",
        message: "At least two usable researched targets are required before a comparison fit can be calculated.",
      },
    };
  }
  const partial = outcomes.length !== submission.targets.length || outcomes.some((outcome) =>
    outcome.state === "transport-error" ||
    (outcome.state === "dossier" && outcome.dossier.run.status !== "succeeded")
  );
  return { ok: true, status: partial ? "partial" : "complete", dossiers };
}

export function deriveRetryTargetKeys(
  outcomes: readonly ComparisonResearchOutcome[],
): readonly string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const outcome of outcomes) {
    const retryable = outcome.state === "transport-error"
      ? outcome.error.code !== "unsupported-target"
      : outcome.dossier.run.status !== "succeeded";
    if (!retryable) continue;
    const key = comparisonTargetKey(outcome.target);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

export function mergeComparisonRetryOutcomes(
  submission: ComparisonSubmission,
  base: readonly ComparisonResearchOutcome[],
  replacements: readonly ComparisonResearchOutcome[],
): readonly ComparisonResearchOutcome[] {
  const selectedKeys = new Set(submission.targets.map(comparisonTargetKey));
  const replacementMap = new Map<string, ComparisonResearchOutcome>();
  for (const outcome of replacements) {
    const key = comparisonTargetKey(outcome.target);
    if (!selectedKeys.has(key) || replacementMap.has(key)) {
      throw new Error("Retry outcome does not belong to the immutable comparison selection.");
    }
    replacementMap.set(key, outcome);
  }
  const baseMap = new Map(base.map((outcome) => [comparisonTargetKey(outcome.target), outcome]));
  return submission.targets.flatMap((target) => {
    const key = comparisonTargetKey(target);
    const outcome = replacementMap.get(key) ?? baseMap.get(key);
    return outcome === undefined ? [] : [outcome];
  });
}
