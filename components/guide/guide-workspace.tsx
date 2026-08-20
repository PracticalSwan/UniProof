"use client";

import Link from "next/link";
import * as React from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { ClaimEvidenceSheet } from "@/components/research/claim-evidence-sheet";
import { useSavedRestore } from "@/components/saved/saved-restore-provider";
import { Button } from "@/components/ui/button";
import { saveSavedArtifact } from "@/lib/persistence/client";
import { SAVED_ARTIFACT_SCHEMA_VERSION } from "@/lib/persistence/contracts";
import { bindCatalogOwnedResearchTarget } from "@/lib/research/catalog/presentation";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import type { ResearchModeRequest } from "@/lib/research/mode/public-contracts";
import { executeResearchRequest } from "@/lib/research/mode/client-transport";
import {
  guideTargetKey,
  type GuideApplicantProfile,
  type GuideEvidenceRef,
  type GuideResult,
  type GuideSubmission,
} from "@/lib/guide/contracts";
import {
  canReuseGuideDossier,
  createGuideWorkspaceState,
  finalizeGuideResult,
  guideResearchKey,
  guideWorkspaceReducer,
  type GuideReusableDossier,
} from "@/lib/guide/client-state";
import {
  createDefaultGuideDraft,
  validateGuideDraft,
  validateGuideProfileDraft,
  type GuideDraft,
  type GuideFieldErrors,
} from "@/lib/guide/client-form";
import { GuideProfileForm } from "./guide-profile-form";
import { GuideResults } from "./guide-results";
import { GuideRunBanner } from "./guide-run-banner";

interface GuideWorkspaceProps {
  catalog: ResearchCatalog;
}

const GUIDE_RETRYABLE_CODES = new Set([
  "internal-error",
  "deployment-rate-limit",
  "deployment-timeout",
  "network-error",
  "invalid-response",
  "guide-assessment-error",
]);

function focusFirstGuideError(errors: GuideFieldErrors): void {
  const order = [
    "target",
    "intake",
    "academicYear",
    "citizenship",
    "currentCountry",
    "qualificationLevel",
    "qualificationTitle",
    "qualificationSubject",
    "gpaValue",
    "gpaScale",
    "englishKind",
    "englishOverall",
    "englishComponents",
    "otherEnglishName",
    "otherEnglishScore",
    "budgetAmount",
    "budgetCurrency",
    "budgetScope",
  ];
  const first = order.find((field) => errors[field] !== undefined);
  const idByField: Record<string, string> = {
    target: "guide-program-search",
    intake: "guide-intake",
    academicYear: "guide-year",
    citizenship: "guide-citizenship",
    currentCountry: "guide-current-country",
    qualificationLevel: "guide-qual-level",
    qualificationTitle: "guide-qual-title",
    qualificationSubject: "guide-qual-subject",
    gpaValue: "guide-gpa-value",
    gpaScale: "guide-gpa-scale",
    englishKind: "guide-english-kind",
    englishOverall: "guide-english-overall",
    englishComponents: "guide-english-listening",
    otherEnglishName: "guide-other-english-name",
    otherEnglishScore: "guide-other-english-score",
    budgetAmount: "guide-budget-amount",
    budgetCurrency: "guide-budget-currency",
    budgetScope: "guide-budget-scope",
  };
  const target = first === undefined ? "guide-program-search" : idByField[first];
  if (target !== undefined) requestAnimationFrame(() => document.getElementById(target)?.focus());
}

function draftWithProfile(current: GuideDraft, profile: GuideApplicantProfile): GuideDraft {
  const english = profile.englishTest;
  const components = "components" in english ? english.components : undefined;
  return {
    ...current,
    citizenship: profile.citizenship,
    currentCountry: profile.currentCountry,
    qualificationLevel: profile.qualification.level,
    qualificationTitle: profile.qualification.title,
    qualificationSubject: profile.qualification.subject,
    gpaValue: profile.qualification.gpa?.value.toString() ?? "",
    gpaScale: profile.qualification.gpa?.scale.toString() ?? "",
    englishKind: english.kind,
    englishOverall: "overall" in english ? english.overall.toString() : "",
    englishListening: components?.listening.toString() ?? "",
    englishReading: components?.reading.toString() ?? "",
    englishWriting: components?.writing.toString() ?? "",
    englishSpeaking: components?.speaking.toString() ?? "",
    otherEnglishName: english.kind === "other" ? english.name : "",
    otherEnglishScore: english.kind === "other" ? english.score : "",
    budgetAmount: profile.budget?.amount.toString() ?? "",
    budgetCurrency: profile.budget?.currency ?? "",
    budgetScope: profile.budget?.scope ?? "annual",
    scholarshipNeed: profile.scholarshipNeed,
  };
}

function draftFromGuideResult(result: GuideResult): GuideDraft {
  return draftWithProfile({
    ...createDefaultGuideDraft(),
    universityId: result.submission.target.universityId,
    programId: result.submission.target.programId,
    intake: result.submission.publicContext.intake ?? "",
    academicYear: result.submission.publicContext.academicYear ?? "",
  }, result.submission.profile);
}

export function GuideWorkspace({ catalog }: GuideWorkspaceProps) {
  const { state: authState } = useAuthSession();
  const { consume } = useSavedRestore();
  const authAccountId = authState.status === "signed-in" ? authState.userId : null;
  const authAccountRef = React.useRef<string | null>(authAccountId);
  const restoredAccountRef = React.useRef<string | null>(null);
  const restoredProfileAccountRef = React.useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [blockedSaves, setBlockedSaves] = React.useState({ profile: false, guide: false });
  const saveSequenceRef = React.useRef(0);
  const [draft, setDraft] = React.useState<GuideDraft>(createDefaultGuideDraft);
  const [errors, setErrors] = React.useState<GuideFieldErrors>({});
  const [state, dispatch] = React.useReducer(guideWorkspaceReducer, undefined, createGuideWorkspaceState);
  const [reusableDossier, setReusableDossier] = React.useState<GuideReusableDossier | undefined>();
  const [selectedEvidenceRef, setSelectedEvidenceRef] = React.useState<GuideEvidenceRef | null>(null);
  const [triggerElement, setTriggerElement] = React.useState<HTMLButtonElement | null>(null);
  const [correctionRequiredTargetKey, setCorrectionRequiredTargetKey] = React.useState<string | null>(null);

  const sequenceRef = React.useRef(0);
  const activeRunRef = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      saveSequenceRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    if (authAccountRef.current === authAccountId) return;
    authAccountRef.current = authAccountId;
    saveSequenceRef.current += 1;
    setSaving(false);
    setBlockedSaves({ profile: false, guide: false });
    setSaveStatus("");
    if (restoredAccountRef.current !== null || restoredProfileAccountRef.current !== null) {
      sequenceRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      activeRunRef.current = false;
      restoredAccountRef.current = null;
      restoredProfileAccountRef.current = null;
      setReusableDossier(undefined);
      setSelectedEvidenceRef(null);
      setTriggerElement(null);
      setDraft(createDefaultGuideDraft());
      setErrors({});
      dispatch({ type: "clear-result" });
    }
  }, [authAccountId]);

  const displayedResult = state.kind === "result"
    ? state.result
    : state.kind === "loading" || state.kind === "error"
      ? state.previous
      : undefined;
  const displayedDossier = React.useMemo(
    () => displayedResult === undefined
      ? undefined
      : bindCatalogOwnedResearchTarget(displayedResult.dossier, catalog) ?? undefined,
    [catalog, displayedResult],
  );
  const displayedTargetKey = displayedResult === undefined ? null : guideTargetKey(displayedResult.submission.target);

  const closeEvidence = React.useCallback(() => {
    setSelectedEvidenceRef(null);
    setTriggerElement(null);
  }, []);

  const handleDraftChange = React.useCallback((updates: Partial<GuideDraft>) => {
    setErrors({});
    setDraft((current) => ({ ...current, ...updates }));
    const publicOnlyFields = new Set(["universityId", "programId", "intake", "academicYear"]);
    if (Object.keys(updates).some((field) => !publicOnlyFields.has(field))) {
      setBlockedSaves((current) => ({ ...current, profile: false }));
    }
  }, []);

  const handleShowEvidence = React.useCallback((ref: GuideEvidenceRef, trigger: HTMLButtonElement) => {
    setSelectedEvidenceRef(ref);
    setTriggerElement(trigger);
  }, []);

  const closeEvidenceBeforeReplacement = React.useCallback(async () => {
    setSelectedEvidenceRef(null);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    setTriggerElement(null);
  }, []);

  React.useEffect(() => {
    if (authAccountId === null || activeRunRef.current) return;
    const profile = consume("profile");
    if (profile !== null) {
      const owner = authAccountId;
      queueMicrotask(() => {
        if (!mountedRef.current || authAccountRef.current !== owner || activeRunRef.current) return;
        restoredProfileAccountRef.current = owner;
        setBlockedSaves((current) => ({ ...current, profile: false }));
        setDraft((current) => draftWithProfile(current, profile.payload));
        setErrors({});
        setSaveStatus("Saved applicant profile loaded. It was not submitted and no research was started.");
      });
      return;
    }

    const restored = consume("guide");
    if (restored === null) return;
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const owner = authAccountId;
    void (async () => {
      await closeEvidenceBeforeReplacement();
      if (
        !mountedRef.current ||
        sequence !== sequenceRef.current ||
        authAccountRef.current !== owner ||
        activeRunRef.current
      ) return;
      setReusableDossier(undefined);
      restoredAccountRef.current = owner;
      restoredProfileAccountRef.current = owner;
      setBlockedSaves({ profile: false, guide: false });
      setDraft(draftFromGuideResult(restored.payload));
      setErrors({});
      dispatch({ type: "restore", sequence, result: restored.payload });
      setSaveStatus("Saved Guide snapshot loaded. Refresh evidence explicitly for current conclusions.");
    })();
  }, [authAccountId, closeEvidenceBeforeReplacement, consume]);

  const runAssessment = React.useCallback(async (
    submission: GuideSubmission,
    researchRequest: ResearchModeRequest,
    forceRefresh: boolean,
  ) => {
    if (activeRunRef.current) return;
    saveSequenceRef.current += 1;
    setSaving(false);
    setSaveStatus("");
    activeRunRef.current = true;
    const sequence = ++sequenceRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "start", sequence, submission, researchRequest, forceRefresh });

    try {
      const key = guideResearchKey(researchRequest);
      if (!forceRefresh && reusableDossier !== undefined && canReuseGuideDossier(reusableDossier, researchRequest)) {
        const finalization = finalizeGuideResult(submission, researchRequest, reusableDossier.dossier, catalog);
        if (finalization.ok) {
          await closeEvidenceBeforeReplacement();
          if (!mountedRef.current || sequence !== sequenceRef.current) return;
          if (controller.signal.aborted) {
            dispatch({ type: "cancel", sequence });
            return;
          }
          restoredAccountRef.current = null;
          setBlockedSaves((current) => ({ ...current, guide: false }));
          dispatch({ type: "complete", sequence, result: finalization.result, notice: "Previously researched requirements were reused." });
        } else {
          dispatch({ type: "fail", sequence, error: finalization.error });
        }
        return;
      }

      const outcome = await executeResearchRequest(researchRequest, controller.signal);

      if (!mountedRef.current || sequence !== sequenceRef.current) return;

      if (controller.signal.aborted || outcome.kind === "cancelled") {
        dispatch({ type: "cancel", sequence });
        return;
      }

      if (outcome.kind === "server-error") {
        if (outcome.error.code === "unsupported-target") {
          const rejectedTargetKey = guideTargetKey(submission.target);
          setReusableDossier((current) => {
            if (current === undefined || current.dossier.target.program === undefined) return current;
            const currentTargetKey = guideTargetKey({
              universityId: current.dossier.target.university.id,
              programId: current.dossier.target.program.id,
            });
            return currentTargetKey === rejectedTargetKey ? undefined : current;
          });
          setCorrectionRequiredTargetKey(rejectedTargetKey);
        }
        dispatch({ type: "fail", sequence, error: outcome.error });
        return;
      }

      if (outcome.kind !== "dossier") {
        dispatch({ type: "fail", sequence, error: outcome.error });
        return;
      }

      const dossier = outcome.dossier;
      if (dossier.run.status === "failed") {
        dispatch({
          type: "fail",
          sequence,
          error: { code: "internal-error", message: "The research run failed. Try refreshing the requirements." },
        });
        return;
      }

      const finalization = finalizeGuideResult(submission, researchRequest, dossier, catalog);
      if (finalization.ok) {
        await closeEvidenceBeforeReplacement();
        if (!mountedRef.current || sequence !== sequenceRef.current) return;
        if (controller.signal.aborted) {
          dispatch({ type: "cancel", sequence });
          return;
        }
        setReusableDossier({ key, dossier });
        const completedTargetKey = guideTargetKey(submission.target);
        setCorrectionRequiredTargetKey((current) => current === completedTargetKey ? null : current);
        restoredAccountRef.current = null;
        setBlockedSaves((current) => ({ ...current, guide: false }));
        dispatch({ type: "complete", sequence, result: finalization.result });
      } else {
        dispatch({ type: "fail", sequence, error: finalization.error });
      }
    } finally {
      if (sequence === sequenceRef.current) {
        activeRunRef.current = false;
        abortRef.current = null;
      }
    }
  }, [catalog, closeEvidenceBeforeReplacement, reusableDossier]);

  const handleSubmit = React.useCallback(() => {
    const validation = validateGuideDraft(draft, catalog);
    if (!validation.ok) {
      setErrors(validation.errors);
      focusFirstGuideError(validation.errors);
      return;
    }
    const targetKey = guideTargetKey(validation.submission.target);
    if (correctionRequiredTargetKey === targetKey) {
      const errors = { target: "This program is correction-required. Select a different supported program." };
      setErrors(errors);
      focusFirstGuideError(errors);
      return;
    }
    setErrors({});
    setBlockedSaves({ profile: false, guide: false });
    if (correctionRequiredTargetKey !== null && correctionRequiredTargetKey !== targetKey) {
      setCorrectionRequiredTargetKey(null);
    }
    void runAssessment(validation.submission, validation.researchRequest, false);
  }, [catalog, correctionRequiredTargetKey, draft, runAssessment]);

  const handleRefresh = React.useCallback(() => {
    if (state.kind !== "result") return;
    const validation = validateGuideDraft(draft, catalog);
    if (!validation.ok) {
      setErrors(validation.errors);
      focusFirstGuideError(validation.errors);
      return;
    }
    setErrors({});
    void runAssessment(validation.submission, validation.researchRequest, true);
  }, [catalog, draft, runAssessment, state.kind]);

  const handleRetry = React.useCallback(() => {
    if (state.kind !== "error" || !GUIDE_RETRYABLE_CODES.has(state.error.code)) return;
    void runAssessment(state.submission, state.researchRequest, state.forceRefresh);
  }, [runAssessment, state]);

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleReset = React.useCallback(() => {
    closeEvidence();
    restoredProfileAccountRef.current = null;
    setDraft(createDefaultGuideDraft());
    setErrors({});
    setCorrectionRequiredTargetKey(null);
    setSaveStatus("");
  }, [closeEvidence]);

  const handleClearResult = React.useCallback(() => {
    if (activeRunRef.current) return;
    const sequence = sequenceRef.current;
    const owner = authAccountRef.current;
    void (async () => {
      await closeEvidenceBeforeReplacement();
      if (!mountedRef.current || sequence !== sequenceRef.current || authAccountRef.current !== owner || activeRunRef.current) return;
      restoredAccountRef.current = null;
      dispatch({ type: "clear-result" });
      setSaveStatus("");
    })();
  }, [closeEvidenceBeforeReplacement]);

  const handleEvidenceClose = React.useCallback(() => {
    setSelectedEvidenceRef(null);
  }, []);

  const saveGuideArtifact = React.useCallback(async (kind: "profile" | "guide") => {
    if (authAccountId === null || saving || activeRunRef.current || blockedSaves[kind]) return;

    const artifact = kind === "profile"
      ? (() => {
          const validation = validateGuideProfileDraft(draft);
          if (!validation.ok) {
            setErrors(validation.errors);
            focusFirstGuideError(validation.errors);
            return null;
          }
          return {
            kind: "profile" as const,
            schemaVersion: SAVED_ARTIFACT_SCHEMA_VERSION,
            payload: validation.profile,
          };
        })()
      : state.kind === "result" && state.notice !== "Saved snapshot loaded."
        ? {
            kind: "guide" as const,
            schemaVersion: SAVED_ARTIFACT_SCHEMA_VERSION,
            payload: state.result,
          }
        : null;
    if (artifact === null) return;

    const sequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = sequence;
    const owner = authAccountId;
    setSaving(true);
    setSaveStatus("");
    const result = await saveSavedArtifact(artifact);
    if (!mountedRef.current || sequence !== saveSequenceRef.current || authAccountRef.current !== owner) return;
    setSaving(false);
    if (!result.ok) {
      if (result.ambiguousMutation) {
        setBlockedSaves((current) => ({ ...current, [kind]: true }));
      }
      setSaveStatus(result.ambiguousMutation
        ? "The save outcome is unknown. Open Saved snapshots and refresh the list before trying again."
        : result.error.message);
      return;
    }
    setBlockedSaves((current) => ({ ...current, [kind]: false }));
    setSaveStatus(kind === "profile" ? "Applicant profile saved privately." : "Guide snapshot saved privately.");
  }, [authAccountId, blockedSaves, draft, saving, state]);

  const isNetworkPending = state.kind === "loading";
  const restoredHistorical = state.kind === "result" && state.notice === "Saved snapshot loaded.";

  return (
    <div className="mt-10 grid gap-7 xl:grid-cols-[372px_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-visible rounded-lg border border-border border-t-[3px] border-t-primary bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Applicant profile</h2>
        <div className="mt-5">
          <GuideProfileForm
            draft={draft}
            errors={errors}
            disabled={isNetworkPending}
            catalog={catalog}
            onDraftChange={handleDraftChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onReset={handleReset}
            onRefresh={handleRefresh}
            hasResult={state.kind === "result"}
            canRefresh={state.kind === "result"}
          />
        </div>
        {authState.status === "signed-in" || (authState.status === "signed-out" && authState.configured) ? (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">
              Saving is optional. Applicant academic, location, English-test, scholarship, and budget fields will be stored privately in your signed-in account.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {authState.status === "signed-in" ? (
                <>
                  <Button type="button" variant="outline" disabled={saving || isNetworkPending || blockedSaves.profile} onClick={() => void saveGuideArtifact("profile")}>Save profile</Button>
                  {state.kind === "result" && !restoredHistorical ? (
                    <Button type="button" variant="outline" disabled={saving || isNetworkPending || blockedSaves.guide} onClick={() => void saveGuideArtifact("guide")}>Save Guide snapshot</Button>
                  ) : null}
                </>
              ) : (
                <Button asChild variant="outline"><Link href="/auth">Sign in to save</Link></Button>
              )}
            </div>
            <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{saveStatus}</p>
          </div>
        ) : saveStatus === "" ? null : (
          <p aria-live="polite" className="mt-5 text-sm text-muted-foreground">{saveStatus}</p>
        )}
      </aside>

      <div className="min-w-0 space-y-6">
        <GuideRunBanner
          state={state}
          retryable={state.kind === "error" && GUIDE_RETRYABLE_CODES.has(state.error.code)}
          onRetry={handleRetry}
        />

        {displayedResult !== undefined ? (
          <GuideResults
            result={displayedResult}
            catalog={catalog}
            onShowEvidence={handleShowEvidence}
            disabled={isNetworkPending}
            onClear={handleClearResult}
          />
        ) : null}

      </div>

      <ClaimEvidenceSheet
        dossier={displayedDossier ?? null}
        selectedClaimId={selectedEvidenceRef?.targetKey === displayedTargetKey ? selectedEvidenceRef.claimId : null}
        triggerElement={triggerElement}
        onClose={handleEvidenceClose}
      />
    </div>
  );
}
