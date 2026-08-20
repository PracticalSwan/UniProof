import "server-only";

import { RESEARCH_TOTAL_DEADLINE_MS } from "@/lib/security/research-limits";

export { RESEARCH_TOTAL_DEADLINE_MS };

const researchDeadlineReason = Symbol("uniproof-research-whole-run-deadline");

export type ResearchExecutionBudget = Readonly<{
  signal: AbortSignal;
  deadlineReached: () => boolean;
  callerCancelled: () => boolean;
  dispose: () => void;
}>;

export function researchAbortFailureCode(
  signal: AbortSignal,
): "timeout" | "cancelled" {
  return signal.reason === researchDeadlineReason ? "timeout" : "cancelled";
}

export function createResearchExecutionBudget(
  callerSignal: AbortSignal,
  timeoutMs: number = RESEARCH_TOTAL_DEADLINE_MS,
): ResearchExecutionBudget {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("research execution deadline must be a positive integer");
  }

  const controller = new AbortController();
  let terminalOwner: "caller" | "deadline" | undefined;
  let onCallerAbort: (() => void) | undefined;

  const stopCallerListener = () => {
    if (onCallerAbort !== undefined) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  };

  if (callerSignal.aborted) {
    terminalOwner = "caller";
    controller.abort(callerSignal.reason);
  } else {
    onCallerAbort = () => {
      if (terminalOwner !== undefined) return;
      terminalOwner = "caller";
      controller.abort(callerSignal.reason);
    };
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  const timer = setTimeout(() => {
    if (terminalOwner !== undefined) return;
    terminalOwner = "deadline";
    controller.abort(researchDeadlineReason);
  }, timeoutMs);
  (timer as unknown as { unref?: () => void }).unref?.();

  let disposed = false;
  return {
    signal: controller.signal,
    deadlineReached: () => terminalOwner === "deadline",
    callerCancelled: () => terminalOwner === "caller",
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      stopCallerListener();
    },
  };
}
