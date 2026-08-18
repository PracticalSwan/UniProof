"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { ClaimEvidenceSheet } from "@/components/research/claim-evidence-sheet";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import { executeResearchRequest, type ResearchClientTransportResult } from "@/lib/research/mode/client-transport";
import type { ResearchDossier, ResearchModeRequest } from "@/lib/research/mode/public-contracts";
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
  createInitialComparisonFormState,
  validateComparisonForm,
  type ComparisonFormField,
} from "@/lib/comparison/client-form";
import { comparisonTargetKey, type ComparisonSubmission, type ComparisonTarget } from "@/lib/comparison/contracts";
import { scoreComparison } from "@/lib/comparison/scoring";
import { buildComparisonTradeoffs } from "@/lib/comparison/tradeoffs";
import { CompareForm } from "./compare-form";
import { CompareRunBanner } from "./compare-run-banner";
import { ComparisonResults } from "./comparison-results";

interface CompareWorkspaceProps {
  catalog: ResearchCatalog;
}

type ActiveBatch = {
  sequence: number;
  controller: AbortController;
};

type RetryContext = {
  submission: ComparisonSubmission;
  outcomes: readonly ComparisonResearchOutcome[];
  targetKeys: readonly string[];
};

type EvidenceSelection = {
  dossier: ResearchDossier;
  claimId: string;
  trigger: HTMLButtonElement;
};

function targetLabel(target: ComparisonTarget, catalog: ResearchCatalog): string {
  const university = catalog.universities.find((item) => item.id === target.universityId);
  const program = target.programId === undefined
    ? undefined
    : catalog.programs.find((item) => item.id === target.programId);
  return program === undefined
    ? university?.name ?? target.universityId
    : `${program.name} — ${university?.name ?? target.universityId}`;
}

function buildResearchRequest(target: ComparisonTarget, submission: ComparisonSubmission): ResearchModeRequest {
  return {
    universityId: target.universityId,
    ...(target.programId === undefined ? {} : { programId: target.programId }),
    categories: [...submission.categories],
    ...(submission.intake === undefined ? {} : { intake: submission.intake }),
    ...(submission.academicYear === undefined ? {} : { academicYear: submission.academicYear }),
  };
}

function transportOutcome(target: ComparisonTarget, result: Exclude<ResearchClientTransportResult, { kind: "dossier" | "cancelled" }>): ComparisonResearchOutcome {
  return {
    target: { ...target },
    state: "transport-error",
    error: { code: result.error.code, message: result.error.message },
  };
}

function bindEvidenceOfficialLinks(dossier: ResearchDossier, catalog: ResearchCatalog): ResearchDossier {
  const university = catalog.universities.find((item) => item.id === dossier.target.university.id);
  const program = dossier.target.program === undefined
    ? undefined
    : catalog.programs.find((item) => item.id === dossier.target.program!.id);
  if (university === undefined || (dossier.target.program !== undefined && (program === undefined || program.universityId !== university.id))) {
    throw new Error("Comparison evidence target no longer resolves in the public catalog.");
  }
  return {
    ...dossier,
    target: {
      university: { ...dossier.target.university, websiteUrl: university.websiteUrl },
      ...(dossier.target.program === undefined ? {} : {
        program: { ...dossier.target.program, officialUrl: program!.officialUrl },
      }),
    },
  };
}

const unsupportedTargetCorrectionMessage = "Remove or replace each target Research reported as unsupported before starting a new comparison.";

function firstInvalidControl(errors: Partial<Record<ComparisonFormField, string>>): string | undefined {
  if (errors.targets !== undefined) return "compare-target-search";
  if (errors.categories !== undefined) return "compare-category-tuition";
  for (const priority of ["affordability", "research", "scholarships", "outcomes", "support"] as const) {
    if (errors[`weight-${priority}`] !== undefined) return `compare-weight-${priority}`;
  }
  if (errors.weights !== undefined) return "compare-weight-affordability";
  if (errors.intake !== undefined) return "compare-intake";
  if (errors.academicYear !== undefined) return "compare-academic-year";
  return undefined;
}

export function CompareWorkspace({ catalog }: CompareWorkspaceProps) {
  const [formState, setFormState] = React.useState(createInitialComparisonFormState);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<ComparisonFormField, string>>>({});
  const [unsupportedTargetKeys, setUnsupportedTargetKeys] = React.useState<readonly string[]>([]);
  const [workspace, dispatch] = React.useReducer(comparisonWorkspaceReducer, undefined, createComparisonWorkspaceState);
  const [evidence, setEvidence] = React.useState<EvidenceSelection | null>(null);
  const [lastEvidenceTrigger, setLastEvidenceTrigger] = React.useState<HTMLButtonElement | null>(null);
  const activeBatchRef = React.useRef<ActiveBatch | null>(null);
  const sequenceRef = React.useRef(0);

  React.useEffect(() => () => {
    const active = activeBatchRef.current;
    activeBatchRef.current = null;
    active?.controller.abort();
  }, []);

  const runBatch = React.useCallback(async (
    submission: ComparisonSubmission,
    retry?: RetryContext,
  ) => {
    if (activeBatchRef.current !== null) return;

    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const controller = new AbortController();
    const active: ActiveBatch = { sequence, controller };
    activeBatchRef.current = active;
    setEvidence(null);
    dispatch({ type: "start", sequence, submission });

    const retryKeys = retry === undefined
      ? new Set(submission.targets.map(comparisonTargetKey))
      : new Set(retry.targetKeys);
    const baseByKey = new Map((retry?.outcomes ?? []).map((outcome) => [comparisonTargetKey(outcome.target), outcome]));
    const replacements: ComparisonResearchOutcome[] = [];
    const unsupportedInBatch = new Set<string>();
    let sharedError = false;

    try {
      for (let index = 0; index < submission.targets.length; index += 1) {
        const target = submission.targets[index]!;
        const key = comparisonTargetKey(target);
        if (!retryKeys.has(key)) {
          const base = baseByKey.get(key);
          if (base === undefined) throw new Error("Retry snapshot is missing an immutable target outcome.");
          dispatch({ type: "target-complete", sequence, index, outcome: base });
          continue;
        }

        if (controller.signal.aborted || activeBatchRef.current !== active) return;
        const result = await executeResearchRequest(buildResearchRequest(target, submission), controller.signal);
        if (controller.signal.aborted || activeBatchRef.current !== active) return;
        if (result.kind === "cancelled") return;

        const outcome: ComparisonResearchOutcome = result.kind === "dossier"
          ? { target: { ...target }, state: "dossier", dossier: result.dossier }
          : transportOutcome(target, result);
        replacements.push(outcome);
        baseByKey.set(key, outcome);
        dispatch({ type: "target-complete", sequence, index, outcome });
        if (result.kind === "server-error" && result.error.code === "unsupported-target") {
          unsupportedInBatch.add(key);
        }

        if (result.kind === "server-error" && (result.error.code === "sensitive-input" || result.error.code === "invalid-request")) {
          sharedError = true;
          break;
        }
      }

      if (controller.signal.aborted || activeBatchRef.current !== active) return;
      if (unsupportedInBatch.size > 0) {
        setUnsupportedTargetKeys((current) => [...new Set([...current, ...unsupportedInBatch])]);
        setFieldErrors((current) => ({ ...current, targets: unsupportedTargetCorrectionMessage }));
      }
      const outcomes = retry === undefined
        ? submission.targets.flatMap((target) => {
            const outcome = baseByKey.get(comparisonTargetKey(target));
            return outcome === undefined ? [] : [outcome];
          })
        : mergeComparisonRetryOutcomes(submission, retry.outcomes, replacements);

      if (sharedError) {
        dispatch({
          type: "fail",
          sequence,
          error: {
            code: "shared-request-error",
            message: "Research rejected the shared comparison request. Correct the selection or public context before starting a new comparison.",
          },
          completedTargets: outcomes,
        });
        return;
      }

      const finalized = finalizeComparisonOutcomes(submission, outcomes);
      if (!finalized.ok) {
        dispatch({ type: "fail", sequence, error: finalized.error, completedTargets: outcomes });
        return;
      }

      const score = scoreComparison(submission, finalized.dossiers);
      const tradeoffs = buildComparisonTradeoffs(score, finalized.dossiers, submission);
      const result: ComparisonResult = {
        submission,
        status: finalized.status,
        outcomes,
        score,
        tradeoffs,
      };
      dispatch({ type: "complete", sequence, result });
    } finally {
      if (activeBatchRef.current === active) activeBatchRef.current = null;
    }
  }, []);

  const submitCurrentForm = React.useCallback(() => {
    const validation = validateComparisonForm(formState, catalog);
    const selectedKeys = new Set(formState.targets.map(comparisonTargetKey));
    const correctionRequired = unsupportedTargetKeys.some((key) => selectedKeys.has(key));
    if (correctionRequired) validation.fieldErrors.targets = unsupportedTargetCorrectionMessage;
    setFieldErrors(validation.fieldErrors);
    if (validation.submission === undefined || correctionRequired) {
      const focusId = firstInvalidControl(validation.fieldErrors);
      if (focusId !== undefined) {
        requestAnimationFrame(() => document.getElementById(focusId)?.focus());
      }
      return;
    }
    void runBatch(validation.submission);
  }, [catalog, formState, runBatch, unsupportedTargetKeys]);

  const cancelActive = React.useCallback(() => {
    const active = activeBatchRef.current;
    if (active === null) return;
    activeBatchRef.current = null;
    active.controller.abort();
    dispatch({ type: "cancel", sequence: active.sequence });
  }, []);

  const currentResult = workspace.kind === "result"
    ? workspace.result
    : workspace.kind === "loading" || workspace.kind === "error"
      ? workspace.previous
      : undefined;

  const retryContext: RetryContext | undefined = workspace.kind === "result"
    ? (() => {
        const targetKeys = deriveRetryTargetKeys(workspace.result.outcomes);
        return targetKeys.length === 0 ? undefined : { submission: workspace.result.submission, outcomes: workspace.result.outcomes, targetKeys };
      })()
    : workspace.kind === "error" && workspace.error.code === "insufficient-usable-targets"
      ? (() => {
          const targetKeys = deriveRetryTargetKeys(workspace.completedTargets);
          return targetKeys.length === 0 ? undefined : { submission: workspace.submission, outcomes: workspace.completedTargets, targetKeys };
        })()
      : undefined;

  const openEvidence = React.useCallback((dossier: ResearchDossier, claimId: string, trigger: HTMLButtonElement) => {
    setLastEvidenceTrigger(trigger);
    setEvidence({ dossier: bindEvidenceOfficialLinks(dossier, catalog), claimId, trigger });
  }, [catalog]);

  const loadingTarget = workspace.kind === "loading"
    ? workspace.submission.targets[Math.min(workspace.currentTargetIndex, workspace.submission.targets.length - 1)]
    : undefined;

  return (
    <div className="pb-20">
      <CompareForm
        catalog={catalog}
        state={formState}
        fieldErrors={fieldErrors}
        disabled={workspace.kind === "loading"}
        onStateChange={(action) => {
          const next = typeof action === "function" ? action(formState) : action;
          const selectedKeys = new Set(next.targets.map(comparisonTargetKey));
          const remainingUnsupported = unsupportedTargetKeys.filter((key) => selectedKeys.has(key));
          setFormState(next);
          setUnsupportedTargetKeys(remainingUnsupported);
          setFieldErrors(remainingUnsupported.length > 0 ? { targets: unsupportedTargetCorrectionMessage } : {});
        }}
        onCompare={submitCurrentForm}
        onReset={() => setFieldErrors({})}
      />

      {workspace.kind === "loading" && loadingTarget !== undefined ? (
        <CompareRunBanner
          current={Math.min(workspace.currentTargetIndex + 1, workspace.submission.targets.length)}
          total={workspace.submission.targets.length}
          label={targetLabel(loadingTarget, catalog)}
          onCancel={cancelActive}
        />
      ) : null}

      {workspace.kind === "error" ? (
        <section className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4" aria-labelledby="compare-error-heading">
          <h2 id="compare-error-heading" className="text-lg font-semibold text-destructive">Comparison could not be calculated</h2>
          <p className="mt-2 text-sm">{workspace.error.message}</p>
        </section>
      ) : null}

      {workspace.kind !== "loading" && (retryContext !== undefined || workspace.kind === "result" || workspace.kind === "error") ? (
        <div className="mt-5 flex flex-wrap gap-3" aria-label="Comparison result actions">
          {retryContext === undefined ? null : (
            <Button type="button" variant="outline" className="min-h-10" onClick={() => void runBatch(retryContext.submission, retryContext)}>
              Retry incomplete/failed research
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            onClick={() => {
              setEvidence(null);
              dispatch({ type: "clear-result" });
            }}
          >
            Clear result
          </Button>
        </div>
      ) : null}

      {workspace.kind === "idle" && workspace.notice !== undefined ? <p className="mt-5 text-sm font-semibold">{workspace.notice}</p> : null}
      {workspace.kind === "result" && workspace.notice !== undefined ? <p className="mt-5 text-sm font-semibold">{workspace.notice}</p> : null}

      {currentResult === undefined ? null : (
        <ComparisonResults result={currentResult} catalog={catalog} onEvidence={openEvidence} />
      )}

      <ClaimEvidenceSheet
        dossier={evidence?.dossier ?? null}
        selectedClaimId={evidence?.claimId ?? null}
        triggerElement={evidence?.trigger ?? lastEvidenceTrigger}
        onClose={() => setEvidence(null)}
      />
    </div>
  );
}
