"use client";

import Link from "next/link";
import * as React from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { useSavedRestore } from "@/components/saved/saved-restore-provider";
import { Button } from "@/components/ui/button";
import { saveSavedArtifact } from "@/lib/persistence/client";
import { SAVED_ARTIFACT_SCHEMA_VERSION } from "@/lib/persistence/contracts";
import { bindCatalogOwnedResearchTarget } from "@/lib/research/catalog/presentation";
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
  "deployment-rate-limit": "The deployment is temporarily limiting research requests. Try again explicitly in a moment.",
  "deployment-timeout": "The deployment timed out before the research request completed. Try again explicitly.",
  "network-error": "The research request could not be sent. Check the connection and try again.",
  "invalid-response": "The research response could not be safely validated for display.",
} as const;

const recoverableRetryCodes = new Set([
  "internal-error",
  "deployment-rate-limit",
  "deployment-timeout",
  "network-error",
  "invalid-response",
]);

function researchErrorMessage(code: string): string {
  if (code in serverErrorMessages) return serverErrorMessages[code];
  if (code in clientErrorMessages) return clientErrorMessages[code as keyof typeof clientErrorMessages];
  return "The research request could not be completed.";
}

interface ResearchWorkspaceProps {
  catalog: ResearchCatalog;
}

function catalogTargetLabel(catalog: ResearchCatalog, universityId: string, programId?: string): string | null {
  const university = catalog.universities.find((item) => item.id === universityId);
  if (university === undefined) return null;
  if (programId === undefined) return university.name;
  const program = catalog.programs.find((item) => item.id === programId && item.universityId === universityId);
  return program === undefined ? null : `${program.name} — ${university.name}`;
}

export function ResearchWorkspace({ catalog }: ResearchWorkspaceProps) {
  const { state: authState } = useAuthSession();
  const { consume } = useSavedRestore();
  const [saveStatus, setSaveStatus] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveBlocked, setSaveBlocked] = React.useState(false);
  const saveSequenceRef = React.useRef(0);
  const authAccountId = authState.status === "signed-in" ? authState.userId : null;
  const authAccountRef = React.useRef<string | null>(authAccountId);
  const restoredAccountRef = React.useRef<string | null>(null);
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
    if (authAccountRef.current !== authAccountId) {
      authAccountRef.current = authAccountId;
      saveSequenceRef.current += 1;
      setSaving(false);
      setSaveBlocked(false);
      setSaveStatus("");
      if (restoredAccountRef.current !== null) {
        restoredAccountRef.current = null;
        const active = activeRequestRef.current;
        activeRequestRef.current = null;
        active?.controller.abort();
        setSelectedClaimId(null);
        setClaimTrigger(null);
        setCancelRequested(false);
        setFieldErrors({});
        setFormState(createInitialResearchFormState());
        dispatch({ type: "clear-result" });
      }
    }
  }, [authAccountId]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestRef.current?.controller.abort();
      saveSequenceRef.current += 1;
    };
  }, []);

  React.useEffect(() => {
    if (authState.status !== "signed-in" || activeRequestRef.current !== null) return;
    const restored = consume("research");
    if (restored === null) return;
    const owner = authState.userId;
    const { request, dossier } = restored.payload;
    const bound = bindCatalogOwnedResearchTarget(dossier, catalog);
    const targetLabel = catalogTargetLabel(catalog, request.universityId, request.programId);
    queueMicrotask(() => {
      if (!mountedRef.current || authAccountRef.current !== owner || activeRequestRef.current !== null) return;
      if (bound === null || targetLabel === null) {
        setSaveStatus("This saved snapshot no longer resolves in the current catalog.");
        return;
      }
      setSelectedClaimId(null);
      setClaimTrigger(null);
      setFieldErrors({});
      setSaveBlocked(false);
      restoredAccountRef.current = owner;
      setFormState({
        search: targetLabel,
        universityId: request.universityId,
        ...(request.programId === undefined ? {} : { programId: request.programId }),
        categories: [...request.categories],
        question: request.question ?? "",
        intake: request.intake ?? "",
        academicYear: request.academicYear ?? "",
      });
      dispatch({
        type: "restore",
        dossier: bound,
        submission: { request, targetLabel },
      });
      setSaveStatus("Saved snapshot loaded. Refresh research explicitly for current evidence.");
    });
  }, [authState, catalog, consume]);

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

      saveSequenceRef.current += 1;
      setSaving(false);
      setSaveStatus("");
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
          const presentationDossier = bindCatalogOwnedResearchTarget(outcome.dossier, catalog);
          if (presentationDossier === null) {
            dispatch({
              type: "error",
              sequence,
              error: { code: "invalid-response", message: clientErrorMessages["invalid-response"] },
            });
            return;
          }
          setSelectedClaimId(null);
          setClaimTrigger(null);
          restoredAccountRef.current = null;
          setSaveBlocked(false);
          dispatch({ type: "result", sequence, dossier: presentationDossier });
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
            ...(submission.request.programId === undefined ? {} : {
              programId: "The previously selected program is no longer supported. Choose a supported target again.",
            }),
          });
        }
        dispatch({ type: "error", sequence, error: outcome.error });
      } finally {
        if (activeRequestRef.current === active) {
          activeRequestRef.current = null;
        }
      }
    },
    [catalog],
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

  const handleSave = React.useCallback(async () => {
    if (runState.kind !== "result" || authAccountId === null || isLoading || saving || saveBlocked) return;
    const sequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = sequence;
    const owner = authAccountId;
    const resultSnapshot = runState;
    setSaving(true);
    setSaveStatus("");
    const outcome = await saveSavedArtifact({
      kind: "research",
      schemaVersion: SAVED_ARTIFACT_SCHEMA_VERSION,
      payload: {
        request: resultSnapshot.submission.request,
        dossier: resultSnapshot.dossier,
      },
    });
    if (!mountedRef.current || sequence !== saveSequenceRef.current || authAccountRef.current !== owner) return;
    setSaving(false);
    if (!outcome.ok) {
      if (outcome.ambiguousMutation) setSaveBlocked(true);
      setSaveStatus(outcome.ambiguousMutation
        ? "The save outcome is unknown. Open Saved snapshots and refresh the list before trying again."
        : outcome.error.message);
      return;
    }
    setSaveBlocked(false);
    setSaveStatus("Research snapshot saved privately.");
  }, [authAccountId, isLoading, runState, saveBlocked, saving]);

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
  const restoredHistorical = runState.kind === "result" && runState.notice === "Saved snapshot loaded.";
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

      {runState.kind === "result" && !isLoading ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
          {restoredHistorical ? (
            <Button type="button" onClick={() => handleRetry(runState.submission)}>Refresh research</Button>
          ) : authState.status === "signed-in" ? (
            <Button type="button" variant="outline" disabled={saving || saveBlocked} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save snapshot"}
            </Button>
          ) : authState.status === "signed-out" && authState.configured ? (
            <Button asChild variant="outline"><Link href="/auth">Sign in to save</Link></Button>
          ) : null}
          <p aria-live="polite" className="text-sm text-muted-foreground">{saveStatus}</p>
        </div>
      ) : null}

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
