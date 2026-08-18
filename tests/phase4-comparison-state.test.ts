import { describe, expect, it } from "vitest";

import {
  comparisonWorkspaceReducer,
  createComparisonWorkspaceState,
  deriveRetryTargetKeys,
  finalizeComparisonOutcomes,
  mergeComparisonRetryOutcomes,
  type ComparisonResearchOutcome,
  type ComparisonResult,
} from "@/lib/comparison/client-state";
import {
  comparisonSubmissionSchema,
  freezeComparisonSubmission,
  comparisonTargetKey,
  type ComparisonTarget,
} from "@/lib/comparison/contracts";
import { makeComparisonDossier } from "@/tests/fixtures/comparison-dossiers";

const targetA = { universityId: "university-mit", programId: "program-mit-artificial-intelligence-decision-making-bs" } as const;
const targetB = { universityId: "university-stanford", programId: "program-stanford-computer-science-bs" } as const;
const targetC = { universityId: "university-georgia-tech", programId: "program-georgia-tech-computer-science-bs" } as const;
const categories = ["tuition", "research"] as const;

function submission(targets = [targetA, targetB, targetC]) {
  return freezeComparisonSubmission(comparisonSubmissionSchema.parse({
    targets,
    categories,
    weights: { affordability: 50, research: 50, scholarships: 0, outcomes: 0, support: 0 },
    showRankingEvidence: false,
    showAnecdotalEvidence: false,
  }));
}

function usable(target: typeof targetA | typeof targetB | typeof targetC, status: "succeeded" | "partial" = "succeeded"): ComparisonResearchOutcome {
  const dossier = makeComparisonDossier({
    ...target,
    categories,
    claims: [
      { id: `${target.programId}-tuition`, category: "tuition", property: "annual tuition", value: 10_000, currency: "USD", academicYear: "2027-28" },
      { id: `${target.programId}-research`, category: "research", property: "research opportunity available", value: true },
    ],
    states: status === "partial" ? { research: "incomplete" } : undefined,
  });
  return { target, state: "dossier", dossier };
}

function failedDossier(target: typeof targetA | typeof targetB | typeof targetC): ComparisonResearchOutcome {
  const dossier = makeComparisonDossier({
    ...target,
    categories,
    claims: [],
    states: { tuition: "incomplete", research: "incomplete" },
  });
  return { target, state: "dossier", dossier };
}

function transport(target: typeof targetA | typeof targetB | typeof targetC): ComparisonResearchOutcome {
  return { target, state: "transport-error", error: { code: "network-error", message: "Research request could not be completed." } };
}

function resultFor(s = submission()): ComparisonResult {
  return {
    submission: s,
    status: "complete",
    outcomes: [usable(targetA), usable(targetB), usable(targetC)],
    score: null,
    tradeoffs: [],
  };
}

describe("Phase 4 comparison workspace state", () => {
  it("ignores stale sequence actions and exact-index/target ownership mismatches", () => {
    const s = submission();
    let state = comparisonWorkspaceReducer(createComparisonWorkspaceState(), { type: "start", sequence: 2, submission: s });
    const unchanged = state;
    state = comparisonWorkspaceReducer(state, { type: "target-complete", sequence: 1, index: 0, outcome: usable(targetA) });
    expect(state).toBe(unchanged);
    state = comparisonWorkspaceReducer(state, { type: "target-complete", sequence: 2, index: 1, outcome: usable(targetA) });
    expect(state).toBe(unchanged);
    state = comparisonWorkspaceReducer(state, { type: "target-complete", sequence: 2, index: 0, outcome: usable(targetB) });
    expect(state).toBe(unchanged);
    state = comparisonWorkspaceReducer(state, { type: "complete", sequence: 1, result: resultFor(s) });
    expect(state).toBe(unchanged);
    state = comparisonWorkspaceReducer(state, { type: "cancel", sequence: 1 });
    expect(state).toBe(unchanged);
  });

  it("accepts only newer starts and advances exact sequential target completion", () => {
    const s = submission();
    let state = comparisonWorkspaceReducer(createComparisonWorkspaceState(), { type: "start", sequence: 3, submission: s });
    const first = state;
    state = comparisonWorkspaceReducer(state, { type: "start", sequence: 3, submission: s });
    expect(state).toBe(first);
    state = comparisonWorkspaceReducer(state, { type: "start", sequence: 2, submission: s });
    expect(state).toBe(first);
    state = comparisonWorkspaceReducer(state, { type: "target-complete", sequence: 3, index: 0, outcome: usable(targetA) });
    expect(state.kind).toBe("loading");
    if (state.kind === "loading") {
      expect(state.currentTargetIndex).toBe(1);
      expect(state.completedTargets).toHaveLength(1);
    }
  });

  it("preserves prior result through start/cancel/error and clear-result removes result/error only", () => {
    const oldResult = resultFor();
    let state = { kind: "result", result: oldResult } as const;
    const s = submission([targetA, targetB]);
    state = comparisonWorkspaceReducer(state, { type: "start", sequence: 5, submission: s }) as typeof state;
    expect(state.kind).toBe("loading");
    const cancelled = comparisonWorkspaceReducer(state, { type: "cancel", sequence: 5 });
    expect(cancelled).toEqual({
      kind: "result",
      result: oldResult,
      notice: "Comparison cancelled.",
      lastSequence: 5,
    });

    const loading = comparisonWorkspaceReducer({ kind: "result", result: oldResult }, { type: "start", sequence: 6, submission: s });
    const errored = comparisonWorkspaceReducer(loading, {
      type: "fail",
      sequence: 6,
      error: { code: "insufficient-usable-targets", message: "At least two usable researched targets are required." },
      completedTargets: [transport(targetA), usable(targetB)],
    });
    expect(errored.kind).toBe("error");
    if (errored.kind === "error") expect(errored.previous).toBe(oldResult);
    expect(comparisonWorkspaceReducer(errored, { type: "clear-result" })).toEqual({
      kind: "idle",
      lastSequence: 6,
    });
  });

  it("requires at least two usable succeeded/partial dossiers and excludes failed dossiers/transport errors", () => {
    const s = submission();
    const good = finalizeComparisonOutcomes(s, [usable(targetA), usable(targetB, "partial"), transport(targetC)]);
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.status).toBe("partial");

    expect(finalizeComparisonOutcomes(s, [usable(targetA), failedDossier(targetB), transport(targetC)])).toMatchObject({
      ok: false,
      error: { code: "insufficient-usable-targets" },
    });
  });

  it("derives retry keys from transport, failed dossiers, and partial incomplete dossiers only", () => {
    const outcomes = [usable(targetA), failedDossier(targetB), usable(targetC, "partial"), transport(targetA)];
    expect(deriveRetryTargetKeys(outcomes)).toEqual([
      comparisonTargetKey(targetB),
      comparisonTargetKey(targetC),
      comparisonTargetKey(targetA),
    ]);
    expect(deriveRetryTargetKeys([{
      target: targetA,
      state: "transport-error",
      error: { code: "unsupported-target", message: "This target is not supported." },
    }])).toEqual([]);
  });

  it("merges retry replacements only by exact immutable target key and keeps selection order", () => {
    const base = [usable(targetA), transport(targetB), usable(targetC, "partial")];
    const replacements = [usable(targetC), usable(targetB)];
    const merged = mergeComparisonRetryOutcomes(submission(), base, replacements);
    expect(merged.map((outcome) => comparisonTargetKey(outcome.target))).toEqual([
      comparisonTargetKey(targetA),
      comparisonTargetKey(targetB),
      comparisonTargetKey(targetC),
    ]);
    expect(merged[1]!.state).toBe("dossier");
    expect(merged[2]!.state).toBe("dossier");

    const outsideTarget: ComparisonTarget = {
      universityId: "university-mit",
      programId: "program-mit-computer-science-engineering-bs",
    };
    expect(() => mergeComparisonRetryOutcomes(submission(), base, [
      { target: outsideTarget, state: "transport-error", error: { code: "network-error", message: "Research request could not be completed." } },
    ])).toThrow();
  });
});
