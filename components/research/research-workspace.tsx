"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import {
  buildResearchSubmission,
  clearResearchTarget,
  createInitialResearchFormState,
  selectResearchProgram,
  selectResearchUniversity,
  type ResearchFormField,
  type ResearchFormState,
} from "@/lib/research/mode/client-form";
import {
  initialResearchWorkspaceState,
  researchWorkspaceReducer,
  type ResearchSubmissionSnapshot,
} from "@/lib/research/mode/client-state";
import { executeResearchRequest } from "@/lib/research/mode/client-transport";
import { ResearchDossier } from "./research-dossier";
import { ResearchForm } from "./research-form";

type ActiveResearchRequest = {
  sequence: number;
  controller: AbortController;
};

const serverErrorMessages: Record<string, string> = {
  "invalid-content-type": "The research request could not be accepted. Check the form and start a new request.",
  "invalid-json": "The research request could not be accepted. Check the form and start a new request.",
  "invalid-request": "The research request is invalid. Correct the highlighted fields and start a new request.",
  "request-too-large": "The research request is too large. Please shorten the public research context and try again.",
  "unsupported-target": "The selected university or program is no longer supported. Choose a supported target again.",
  "sensitive-input": "Research fields must contain public information only. Edit the populated free-text fields and start a new request.",
  "forbidden-origin": "The research request was blocked by browser origin controls.",
  "internal-error": "UniProof could not complete this research request.",
};

const clientErrorMessages = {
  "network-error": "The research request could not be sent. Check the connection and try again.",
  "invalid-response": "The research response could not be safely validated for display.",
} as const;

const recoverableRetryCodes = new Set(["internal-error", "network-error", "invalid-response"]);

function researchErrorMessage(code: string): string {
  if (code in serverErrorMessages) return serverErrorMessages[code];
  if (code in clientErrorMessages) return clientErrorMessages[code as keyof typeof clientErrorMessages];
  return "The research request could not be completed.";
}

interface ResearchWorkspaceProps {
  catalog: ResearchCatalog;
}

export function ResearchWorkspace({ catalog }: ResearchWorkspaceProps) {
  const [formState, setFormState] = React.useState<ResearchFormState>(() =>
    createInitialResearchFormState(),
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<ResearchFormField, string>>
  >({});
  const [runState, dispatch] = React.useReducer(
    researchWorkspaceReducer,
    initialResearchWorkspaceState,
  );
  const [selectedClaimId, setSelectedClaimId] = React.useState<string | null>(null);
  const [claimTrigger, setClaimTrigger] = React.useState<HTMLButtonElement | null>(null);
  const [cancelRequested, setCancelRequested] = React.useState(false);

  const activeRequestRef = React.useRef<ActiveResearchRequest | null>(null);
  const nextSequenceRef = React.useRef(1);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestRef.current?.controller.abort();
    };
  }, []);

  const isLoading = runState.kind === "loading";
  const displayedResult = runState.kind === "result"
    ? runState
    : runState.kind === "error" && runState.previous !== undefined
      ? runState.previous
      : isLoading && runState.previous !== undefined
        ? runState.previous
        : null;

  const patchForm = React.useCallback((patch: Partial<ResearchFormState>) => {
    setFieldErrors({});
    setFormState((current) => ({ ...current, ...patch }));
  }, []);

  const focusFirstInvalidField = React.useCallback(
    (errors: Partial<Record<ResearchFormField, string>>) => {
      const order: ResearchFormField[] = [
        "universityId",
        "programId",
        "categories",
        "question",
        "intake",
        "academicYear",
      ];
      const first = order.find((field) => errors[field] !== undefined);
      if (first === undefined) return;
      const target: string =
        first === "universityId" || first === "programId"
          ? "research-search"
          : first === "categories"
            ? "research-category-admissions"
            : `research-${first}`;
      window.requestAnimationFrame(() => {
        document.getElementById(target)?.focus();
      });
    },
    [],
  );

  const startSubmission = React.useCallback(
    async (submission: ResearchSubmissionSnapshot) => {
      if (activeRequestRef.current !== null) return;

      const sequence = nextSequenceRef.current;
      nextSequenceRef.current += 1;
      const controller = new AbortController();
      const active: ActiveResearchRequest = { sequence, controller };
      activeRequestRef.current = active;
      setSelectedClaimId(null);
      setClaimTrigger(null);
      setCancelRequested(false);
      dispatch({ type: "start", sequence, submission });

      try {
        const outcome = await executeResearchRequest(
          submission.request,
          controller.signal,
        );

        if (activeRequestRef.current !== active || !mountedRef.current) return;

        if (controller.signal.aborted || outcome.kind === "cancelled") {
          dispatch({ type: "cancelled", sequence });
          return;
        }

        if (outcome.kind === "dossier") {
          setSelectedClaimId(null);
          setClaimTrigger(null);
          dispatch({ type: "result", sequence, dossier: outcome.dossier });
          return;
        }

        if (outcome.error.code === "unsupported-target") {
          setFormState((current) => ({
            ...current,
            universityId: undefined,
            programId: undefined,
          }));
          setFieldErrors({
            universityId: "The previously selected target is no longer supported. Choose a supported target again.",
          });
        }
        dispatch({ type: "error", sequence, error: outcome.error });
      } finally {
        if (activeRequestRef.current === active) {
          activeRequestRef.current = null;
        }
      }
    },
    [],
  );

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (activeRequestRef.current !== null) return;

      const outcome = buildResearchSubmission(formState, catalog);
      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors);
        focusFirstInvalidField(outcome.fieldErrors);
        return;
      }
      void startSubmission(outcome.submission);
    },
    [catalog, focusFirstInvalidField, formState, startSubmission],
  );

  const handleRetry = React.useCallback(
    (submission: ResearchSubmissionSnapshot) => {
      if (activeRequestRef.current !== null) return;
      void startSubmission(submission);
    },
    [startSubmission],
  );

  const handleCancel = React.useCallback(() => {
    const active = activeRequestRef.current;
    if (active === null || active.controller.signal.aborted) return;
    setCancelRequested(true);
    active.controller.abort();
  }, []);

  const handleReset = React.useCallback(() => {
    if (activeRequestRef.current !== null) return;
    setFormState(createInitialResearchFormState());
    setFieldErrors({});
  }, []);

  const handleSelectUniversity = React.useCallback((universityId: string) => {
    setFieldErrors({});
    setFormState((current) => selectResearchUniversity(current, universityId, catalog));
  }, [catalog]);

  const handleSelectProgram = React.useCallback((programId: string) => {
    setFieldErrors({});
    setFormState((current) => selectResearchProgram(current, programId, catalog));
  }, [catalog]);

  const handleClearTarget = React.useCallback(() => {
    setFieldErrors({});
    setFormState((current) => clearResearchTarget(current));
  }, []);

  const handleClearResult = React.useCallback(() => {
    if (activeRequestRef.current !== null) return;
    setSelectedClaimId(null);
    setClaimTrigger(null);
    dispatch({ type: "clear-result" });
  }, []);

  const handleSelectClaim = React.useCallback((claimId: string, trigger: HTMLButtonElement) => {
    setSelectedClaimId(claimId);
    setClaimTrigger(trigger);
  }, []);

  const formMatchesSubmission = React.useMemo(() => {
    if (displayedResult === null) return true;
    const current = buildResearchSubmission(formState, catalog);
    if (!current.ok) return false;
    return (
      JSON.stringify(current.submission.request) ===
        JSON.stringify(displayedResult.submission.request) &&
      current.submission.targetLabel === displayedResult.submission.targetLabel
    );
  }, [catalog, displayedResult, formState]);

  const serverErrorCode = runState.kind === "error" ? runState.error.code : null;
  const activeError = runState.kind === "error" ? runState.error : null;
  const statusMessage = isLoading
    ? displayedResult === null
      ? "Researching sources and evidence. This may take a while; you can cancel this request."
      : "Updating research. This may take a while; you can cancel this request."
    : runState.kind === "error"
      ? researchErrorMessage(runState.error.code)
      : runState.kind === "result"
        ? runState.notice ?? `Research ${runState.dossier.run.status}.`
        : runState.notice ?? "Ready to research a supported target.";

  return (
    <div className="mt-10 space-y-6">
      <ResearchForm
        formState={formState}
        catalog={catalog}
        disabled={isLoading}
        fieldErrors={fieldErrors}
        serverErrorCode={serverErrorCode}
        onPatch={patchForm}
        onSelectUniversity={handleSelectUniversity}
        onSelectProgram={handleSelectProgram}
        onClearTarget={handleClearTarget}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />

      <div className="flex flex-wrap items-center gap-4" aria-live="polite" role="status">
        <p className="min-w-0 break-words text-sm font-medium">{statusMessage}</p>
        {isLoading ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={cancelRequested}
          >
            {cancelRequested ? "Cancelling" : "Cancel"}
          </Button>
        ) : null}
      </div>

      {activeError !== null ? (
        <section
          aria-label="Research request error"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {researchErrorMessage(activeError.code)}
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                Target: {runState.kind === "error" ? runState.submission.targetLabel : ""}
              </p>
            </div>
            {recoverableRetryCodes.has(activeError.code) && !isLoading ? (
              <div className="max-w-sm space-y-2 sm:text-right">
                <Button
                  type="button"
                  onClick={() => {
                    if (runState.kind === "error") handleRetry(runState.submission);
                  }}
                >
                  Retry this research
                </Button>
                <p className="text-xs text-muted-foreground">
                  Retry repeats the exact failed request. The Research button starts a new request
                  from the current form.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {displayedResult !== null ? (
        <ResearchDossier
          dossier={displayedResult.dossier}
          submission={displayedResult.submission}
          formMatchesSubmission={formMatchesSubmission}
          busy={isLoading}
          updating={isLoading}
          allowRetry={activeError === null}
          selectedClaimId={selectedClaimId}
          claimTrigger={claimTrigger}
          onSelectClaim={handleSelectClaim}
          onClearClaim={() => {
            setSelectedClaimId(null);
          }}
          onRetry={handleRetry}
          onClear={handleClearResult}
        />
      ) : isLoading ? (
        <section aria-label="Research in progress" className="rounded-lg border border-border bg-white p-5">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
