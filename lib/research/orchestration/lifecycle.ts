import "server-only";

import { randomUUID } from "node:crypto";

import type { ResearchCategory, ResearchFailure, ResearchRun } from "@/lib/research/contracts";

export type MonotonicResearchClock = {
  next(): string;
};

export function createMonotonicResearchClock(now: () => string): MonotonicResearchClock {
  let previousMs: number | undefined;
  let previousIso: string | undefined;
  return {
    next(): string {
      const raw = now();
      const parsed = Date.parse(raw);
      if (!Number.isFinite(parsed)) throw new Error("research orchestration clock returned an invalid instant");
      if (previousMs !== undefined && parsed < previousMs) return previousIso!;
      const normalized = new Date(parsed).toISOString();
      previousMs = parsed;
      previousIso = normalized;
      return normalized;
    },
  };
}

export function createDefaultRunId(): string {
  return `run-${randomUUID()}`;
}

export function terminalStatus(
  processedCategories: readonly ResearchCategory[],
  unprocessedCategories: readonly ResearchCategory[],
): Extract<ResearchRun["status"], "succeeded" | "partial" | "failed"> {
  if (processedCategories.length === 0) return "failed";
  return unprocessedCategories.length === 0 ? "succeeded" : "partial";
}

const failurePrecedence: readonly ResearchFailure["code"][] = [
  "cancelled",
  "validation",
  "timeout",
  "source-discovery",
  "retrieval",
  "normalization",
  "source-limit",
  "provider-rate-limit",
  "provider-error",
  "unknown",
];

export function primaryFailureCode(
  failures: readonly ResearchFailure[],
): ResearchFailure["code"] | undefined {
  for (const code of failurePrecedence) {
    if (failures.some((failure) => failure.code === code)) return code;
  }
  return undefined;
}
