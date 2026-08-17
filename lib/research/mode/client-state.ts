import type {
  PublicResearchTransportError,
  ResearchDossier,
  ResearchModeRequest,
  ResearchModeCategory,
} from "./public-contracts";

export type ResearchWorkspaceError =
  | PublicResearchTransportError
  | { code: "network-error"; message: string }
  | { code: "invalid-response"; message: string };

export type ResearchSubmissionSnapshot = {
  request: ResearchModeRequest;
  targetLabel: string;
};

type PreviousResearchResult = {
  dossier: ResearchDossier;
  submission: ResearchSubmissionSnapshot;
};

export type ResearchWorkspaceState =
  | { kind: "idle"; notice?: string }
  | {
      kind: "loading";
      requestSequence: number;
      submission: ResearchSubmissionSnapshot;
      previous?: PreviousResearchResult;
    }
  | {
      kind: "result";
      dossier: ResearchDossier;
      submission: ResearchSubmissionSnapshot;
      notice?: string;
    }
  | {
      kind: "error";
      error: ResearchWorkspaceError;
      submission: ResearchSubmissionSnapshot;
      previous?: PreviousResearchResult;
    };

export type ResearchWorkspaceAction =
  | { type: "start"; sequence: number; submission: ResearchSubmissionSnapshot }
  | { type: "result"; sequence: number; dossier: ResearchDossier }
  | { type: "error"; sequence: number; error: ResearchWorkspaceError }
  | { type: "cancelled"; sequence: number }
  | { type: "clear-result" }
  | { type: "dismiss-notice" };

export const RESEARCH_CANCEL_NOTICE = "The research request was cancelled in this session.";

export const initialResearchWorkspaceState: ResearchWorkspaceState = { kind: "idle" };

function previousResultFrom(
  state: ResearchWorkspaceState,
): PreviousResearchResult | undefined {
  if (state.kind === "result") {
    return { dossier: state.dossier, submission: state.submission };
  }
  if (state.kind === "error") {
    return state.previous;
  }
  return undefined;
}

export function freezeResearchSubmission(
  submission: ResearchSubmissionSnapshot,
): ResearchSubmissionSnapshot {
  return Object.freeze({
    request: Object.freeze({
      ...submission.request,
      categories: Object.freeze([...submission.request.categories]) as ResearchModeCategory[],
    }),
    targetLabel: submission.targetLabel,
  });
}

function isTerminalForCurrentLoading(
  state: ResearchWorkspaceState,
  sequence: number,
): state is Extract<ResearchWorkspaceState, { kind: "loading" }> {
  return state.kind === "loading" && state.requestSequence === sequence;
}

export function researchWorkspaceReducer(
  state: ResearchWorkspaceState,
  action: ResearchWorkspaceAction,
): ResearchWorkspaceState {
  switch (action.type) {
    case "start": {
      if (state.kind === "loading") return state;
      const submission = freezeResearchSubmission(action.submission);
      return {
        kind: "loading",
        requestSequence: action.sequence,
        submission,
        previous: previousResultFrom(state),
      };
    }
    case "result": {
      if (!isTerminalForCurrentLoading(state, action.sequence)) return state;
      return {
        kind: "result",
        dossier: action.dossier,
        submission: state.submission,
      };
    }
    case "error": {
      if (!isTerminalForCurrentLoading(state, action.sequence)) return state;
      return {
        kind: "error",
        error: action.error,
        submission: state.submission,
        previous: state.previous,
      };
    }
    case "cancelled": {
      if (!isTerminalForCurrentLoading(state, action.sequence)) return state;
      if (state.previous === undefined) {
        return { kind: "idle", notice: RESEARCH_CANCEL_NOTICE };
      }
      return {
        kind: "result",
        dossier: state.previous.dossier,
        submission: state.previous.submission,
        notice: RESEARCH_CANCEL_NOTICE,
      };
    }
    case "clear-result": {
      if (state.kind === "loading") return state;
      return { kind: "idle" };
    }
    case "dismiss-notice": {
      if (state.kind === "idle" && state.notice === undefined) return state;
      if (state.kind === "result" && state.notice === undefined) return state;
      if (state.kind === "idle") return { kind: "idle" };
      if (state.kind === "result") {
        return {
          kind: "result",
          dossier: state.dossier,
          submission: state.submission,
        };
      }
      return state;
    }
  }
}
