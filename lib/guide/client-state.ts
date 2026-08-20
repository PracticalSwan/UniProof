import {
  guideSubmissionSchema,
  type GuideAssessmentError,
  type GuideResult,
  type GuideSubmission,
} from "./contracts";
import { assessGuideRequirements } from "./assessment";
import { buildGuidePlan } from "./planning";
import {
  GUIDE_RESEARCH_CATEGORIES,
} from "./contracts";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import {
  researchDossierSchema,
  researchModeRequestSchema,
  type PublicResearchTransportError,
  type ResearchDossier,
  type ResearchModeRequest,
} from "@/lib/research/mode/public-contracts";

export type GuideTransportError = Readonly<{
  code:
    | PublicResearchTransportError["code"]
    | "deployment-rate-limit"
    | "deployment-timeout"
    | "network-error"
    | "invalid-response";
  message: string;
}>;

export type GuideReusableDossier = Readonly<{
  key: string;
  dossier: ResearchDossier;
}>;

export type GuideWorkspaceState =
  | Readonly<{ kind: "idle"; notice?: string; lastSequence?: number }>
  | Readonly<{
      kind: "loading";
      requestSequence: number;
      submission: GuideSubmission;
      researchRequest: ResearchModeRequest;
      forceRefresh: boolean;
      previous?: GuideResult;
    }>
  | Readonly<{ kind: "result"; result: GuideResult; notice?: string; lastSequence?: number }>
  | Readonly<{
      kind: "error";
      requestSequence: number;
      error: GuideTransportError | GuideAssessmentError;
      submission: GuideSubmission;
      researchRequest: ResearchModeRequest;
      forceRefresh: boolean;
      previous?: GuideResult;
    }>;

export type GuideWorkspaceAction =
  | { type: "start"; sequence: number; submission: GuideSubmission; researchRequest: ResearchModeRequest; forceRefresh: boolean }
  | { type: "complete"; sequence: number; result: GuideResult; notice?: string }
  | { type: "fail"; sequence: number; error: GuideTransportError | GuideAssessmentError }
  | { type: "cancel"; sequence: number }
  | { type: "restore"; sequence: number; result: GuideResult }
  | { type: "clear-result" };

export function createGuideWorkspaceState(): GuideWorkspaceState {
  return { kind: "idle" };
}

function stateSequence(state: GuideWorkspaceState): number {
  if (state.kind === "loading" || state.kind === "error") return state.requestSequence;
  return state.lastSequence ?? 0;
}

export function guideWorkspaceReducer(
  state: GuideWorkspaceState,
  action: GuideWorkspaceAction,
): GuideWorkspaceState {
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
      researchRequest: action.researchRequest,
      forceRefresh: action.forceRefresh,
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

  if (action.type === "complete") {
    if (state.kind !== "loading" || action.sequence !== state.requestSequence) return state;
    return {
      kind: "result",
      result: action.result,
      lastSequence: action.sequence,
      ...(action.notice === undefined ? {} : { notice: action.notice }),
    };
  }

  if (action.type === "fail") {
    if (state.kind !== "loading" || action.sequence !== state.requestSequence) return state;
    return {
      kind: "error",
      requestSequence: state.requestSequence,
      error: action.error,
      submission: state.submission,
      researchRequest: state.researchRequest,
      forceRefresh: state.forceRefresh,
      ...(state.previous === undefined ? {} : { previous: state.previous }),
    };
  }

  if (action.type === "cancel") {
    if (state.kind !== "loading" || action.sequence !== state.requestSequence) return state;
    return state.previous === undefined
      ? { kind: "idle", notice: "Assessment cancelled.", lastSequence: action.sequence }
      : { kind: "result", result: state.previous, notice: "Assessment cancelled.", lastSequence: action.sequence };
  }

  return state;
}

export function guideResearchKey(request: ResearchModeRequest): string {
  return JSON.stringify([
    request.universityId,
    request.programId ?? "",
    request.intake ?? "",
    request.academicYear ?? "",
    request.categories,
  ]);
}

export function canReuseGuideDossier(
  reusable: GuideReusableDossier | undefined,
  request: ResearchModeRequest,
): boolean {
  if (reusable === undefined) return false;
  if (reusable.dossier.run.status === "failed") return false;
  return reusable.key === guideResearchKey(request);
}

export function isUsableGuideDossier(dossier: ResearchDossier): boolean {
  return dossier.run.status === "succeeded" || dossier.run.status === "partial";
}

export function finalizeGuideResult(
  submissionInput: unknown,
  requestInput: unknown,
  dossierInput: unknown,
  catalog: ResearchCatalog,
): { ok: true; result: GuideResult } | { ok: false; error: GuideAssessmentError } {
  const assessmentError: GuideAssessmentError = {
    code: "guide-assessment-error",
    message: "Guide could not safely assess the researched requirements. Try refreshing the requirements.",
  };

  const submission = guideSubmissionSchema.safeParse(submissionInput);
  if (!submission.success) return { ok: false, error: assessmentError };

  const request = researchModeRequestSchema.safeParse(requestInput);
  if (!request.success) return { ok: false, error: assessmentError };

  const dossier = researchDossierSchema.safeParse(dossierInput);
  if (!dossier.success) return { ok: false, error: assessmentError };

  const sub = submission.data;
  const req = request.data;
  const dos = dossier.data;

  if (req.universityId !== sub.target.universityId || req.programId !== sub.target.programId) {
    return { ok: false, error: assessmentError };
  }
  if (req.intake !== sub.publicContext.intake || req.academicYear !== sub.publicContext.academicYear) {
    return { ok: false, error: assessmentError };
  }

  if (req.categories.length !== GUIDE_RESEARCH_CATEGORIES.length ||
      req.categories.some((cat, i) => cat !== GUIDE_RESEARCH_CATEGORIES[i])) {
    return { ok: false, error: assessmentError };
  }

  if (dos.target.university.id !== sub.target.universityId) {
    return { ok: false, error: assessmentError };
  }
  if (dos.target.program?.id !== sub.target.programId) {
    return { ok: false, error: assessmentError };
  }

  const dosCategories = dos.categories.map((row) => row.category);
  if (dosCategories.length !== GUIDE_RESEARCH_CATEGORIES.length ||
      dosCategories.some((cat, i) => cat !== GUIDE_RESEARCH_CATEGORIES[i])) {
    return { ok: false, error: assessmentError };
  }

  const catalogUniversity = catalog.universities.find((u) => u.id === sub.target.universityId);
  if (catalogUniversity === undefined) return { ok: false, error: assessmentError };
  const catalogProgram = catalog.programs.find(
    (p) => p.id === sub.target.programId && p.universityId === sub.target.universityId,
  );
  if (catalogProgram === undefined) return { ok: false, error: assessmentError };

  if (dos.run.status === "failed") return { ok: false, error: assessmentError };

  try {
    const assessment = assessGuideRequirements(sub, dos);
    const plan = buildGuidePlan(sub, dos, assessment);
    const hasIncomplete = dos.categories.some(
      (row) => row.state === "incomplete" || (row.state === "ready" && row.sourceGap !== undefined),
    );
    const status = dos.run.status === "partial" || hasIncomplete ? "partial" : "complete";

    return {
      ok: true,
      result: {
        submission: sub,
        researchRequest: req,
        dossier: dos,
        status,
        assessments: assessment.assessments,
        ...(assessment.budgetAssessment === undefined ? {} : { budgetAssessment: assessment.budgetAssessment }),
        risks: plan.risks,
        checklist: plan.checklist,
        timeline: plan.timeline,
        unrecognizedAdmissions: assessment.unrecognizedAdmissions,
      },
    };
  } catch {
    return { ok: false, error: assessmentError };
  }
}
