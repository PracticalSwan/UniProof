import { describe, expect, it } from "vitest";

import {
  initialResearchWorkspaceState,
  researchWorkspaceReducer,
  type ResearchWorkspaceError,
  type ResearchSubmissionSnapshot,
  type ResearchWorkspaceState,
} from "@/lib/research/mode/client-state";
import {
  researchDossierSchema,
  researchModeRequestSchema,
  type ResearchModeCategory,
  type ResearchDossier,
} from "@/lib/research/mode/public-contracts";

function makeSnapshot(
  overrides: { universityId?: string; programId?: string | null; sequence?: number } = {},
): ResearchSubmissionSnapshot {
  const request = researchModeRequestSchema.parse({
    universityId: overrides.universityId ?? "university-mit",
    ...(overrides.programId === null
      ? {}
      : { programId: overrides.programId ?? "program-mit-artificial-intelligence-decision-making-bs" }),
    categories: ["admissions"],
  });
  return Object.freeze({
    request: Object.freeze({
      ...request,
      categories: Object.freeze(request.categories) as ResearchModeCategory[],
    }),
    targetLabel: `MIT submission ${overrides.sequence ?? 1}`,
  });
}

function makeDossier(runId = "run-1"): ResearchDossier {
  const source = {
    id: "source-1",
    url: "https://example.edu/evidence",
    title: "Evidence page",
    publisher: "Example University",
    sourceType: "university" as const,
    retrievedAt: "2026-08-17T00:00:00.000Z",
    effectiveDate: "2026-09-01",
  };
  const claim = {
    id: "claim-1",
    category: "admissions" as const,
    property: "Application deadline",
    value: "2027-01-15",
    effectiveDate: "2026-09-01",
    verificationStatus: "verified" as const,
    representativeSourceId: "source-1",
    sourceIds: ["source-1"],
    supportingText: "The application deadline is 15 January 2027.",
  };
  return researchDossierSchema.parse({
    target: {
      university: {
        id: "university-mit",
        name: "Massachusetts Institute of Technology",
        countryCode: "US",
        websiteUrl: "https://web.mit.edu/",
      },
      program: {
        id: "program-mit-artificial-intelligence-decision-making-bs",
        name: "Bachelor of Science in Artificial Intelligence and Decision Making (Course 6-4)",
        degreeLevel: "bachelor",
        subjectArea: "Artificial Intelligence",
        officialUrl: "https://catalog.mit.edu/",
      },
    },
    run: {
      id: runId,
      status: "succeeded",
      createdAt: "2026-08-17T00:00:00.000Z",
      startedAt: "2026-08-17T00:00:01.000Z",
      updatedAt: "2026-08-17T00:00:02.000Z",
      completedAt: "2026-08-17T00:00:03.000Z",
    },
    summary: {
      totalClaims: 1,
      statusCounts: {
        verified: 1,
        corroborated: 0,
        "university-reported": 0,
        conflicting: 0,
        anecdotal: 0,
        inferred: 0,
        outdated: 0,
      },
      processedCategories: ["admissions"],
      unprocessedCategories: [],
    },
    categories: [
      {
        category: "admissions",
        state: "ready",
        claims: [claim],
        explanation: {
          category: "admissions",
          referencedClaimIds: ["claim-1"],
          summary: "The official passage supports the claim.",
        },
        hasConflict: false,
        hasOutdated: false,
      },
    ],
    sources: [source],
  });
}

function start(
  state: ResearchWorkspaceState,
  sequence = 1,
  submission = makeSnapshot({ sequence }),
): ResearchWorkspaceState {
  return researchWorkspaceReducer(state, { type: "start", sequence, submission });
}

type TerminalAction =
  | { type: "result"; sequence: number; dossier: ResearchDossier }
  | { type: "error"; sequence: number; error: ResearchWorkspaceError }
  | { type: "cancelled"; sequence: number };

function terminal(state: ResearchWorkspaceState, action: TerminalAction): ResearchWorkspaceState {
  return researchWorkspaceReducer(state, action);
}

describe("research workspace reducer", () => {
  it("starts loading from idle with the exact immutable submission snapshot", () => {
    const submission = makeSnapshot();
    const state = researchWorkspaceReducer(initialResearchWorkspaceState, {
      type: "start",
      sequence: 7,
      submission,
    });

    expect(state).toEqual({
      kind: "loading",
      requestSequence: 7,
      submission,
      previous: undefined,
    });
  });

  it("preserves the previous dossier and its submission when refreshing a result", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const dossier = makeDossier();
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    state = start(state, 2, secondSubmission);

    expect(state).toEqual({
      kind: "loading",
      requestSequence: 2,
      submission: secondSubmission,
      previous: { dossier, submission: firstSubmission },
    });
  });

  it("replaces the previous dossier only when the terminal sequence matches", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    const oldDossier = makeDossier("old");
    const newDossier = makeDossier("new");
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier: oldDossier });
    state = start(state, 2, secondSubmission);
    state = terminal(state, { type: "result", sequence: 2, dossier: newDossier });

    expect(state).toEqual({
      kind: "result",
      dossier: newDossier,
      submission: secondSubmission,
    });
  });

  it("ignores a stale terminal result", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    const dossier = makeDossier();
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier });
    state = start(state, 2, secondSubmission);
    const stale = terminal(state, { type: "result", sequence: 1, dossier: makeDossier("stale") });

    expect(stale).toBe(state);
  });

  it("keeps the submission that produced a result for exact historical retry", () => {
    const submission = makeSnapshot();
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, submission);
    state = terminal(state, { type: "result", sequence: 1, dossier: makeDossier() });

    expect(state).toEqual({
      kind: "result",
      dossier: expect.any(Object),
      submission,
    });
  });

  it("preserves the previous dossier when a refresh transport error occurs", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const dossier = makeDossier();
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    state = start(state, 2, secondSubmission);
    state = terminal(state, {
      type: "error",
      sequence: 2,
      error: { code: "network-error", message: "The research request could not be sent." },
    });

    expect(state).toEqual({
      kind: "error",
      error: { code: "network-error", message: "The research request could not be sent." },
      submission: secondSubmission,
      previous: { dossier, submission: firstSubmission },
    });
  });

  it("restores the previous dossier and its own submission after cancellation", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const dossier = makeDossier();
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    state = start(state, 2, secondSubmission);
    state = terminal(state, { type: "cancelled", sequence: 2 });

    expect(state).toEqual({
      kind: "result",
      dossier,
      submission: firstSubmission,
      notice: "The research request was cancelled in this session.",
    });
  });

  it("returns idle with a cancellation notice after a first-run cancel", () => {
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1);
    state = terminal(state, { type: "cancelled", sequence: 1 });

    expect(state).toEqual({
      kind: "idle",
      notice: "The research request was cancelled in this session.",
    });
  });

  it("ignores stale error and cancellation actions", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier: makeDossier() });
    state = start(state, 2, secondSubmission);

    const staleError = researchWorkspaceReducer(state, {
      type: "error",
      sequence: 1,
      error: { code: "invalid-response", message: "invalid" },
    });
    expect(staleError).toBe(state);

    const staleCancel = researchWorkspaceReducer(state, { type: "cancelled", sequence: 1 });
    expect(staleCancel).toBe(state);
  });

  it("ignores terminal actions when no request is loading", () => {
    const state: ResearchWorkspaceState = { kind: "idle" };
    expect(researchWorkspaceReducer(state, {
      type: "result",
      sequence: 1,
      dossier: makeDossier(),
    })).toBe(state);
    expect(researchWorkspaceReducer(state, {
      type: "error",
      sequence: 1,
      error: { code: "network-error", message: "network" },
    })).toBe(state);
    expect(researchWorkspaceReducer(state, { type: "cancelled", sequence: 1 })).toBe(state);
  });

  it("cannot start a second active sequence from the reducer", () => {
    const state = start(initialResearchWorkspaceState, 1);
    const doubled = start(state, 2, makeSnapshot({ sequence: 2 }));

    expect(doubled).toBe(state);
  });

  it("clears a displayed result only on explicit clear-result", () => {
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1);
    state = terminal(state, { type: "result", sequence: 1, dossier: makeDossier() });
    state = researchWorkspaceReducer(state, { type: "clear-result" });

    expect(state).toEqual({ kind: "idle" });
  });

  it("clears a preserved displayed result even when a refresh error is active", () => {
    const firstSubmission = makeSnapshot({ sequence: 1 });
    const dossier = makeDossier();
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1, firstSubmission);
    state = terminal(state, { type: "result", sequence: 1, dossier });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    state = start(state, 2, secondSubmission);
    state = terminal(state, {
      type: "error",
      sequence: 2,
      error: { code: "network-error", message: "network" },
    });
    state = researchWorkspaceReducer(state, { type: "clear-result" });

    expect(state).toEqual({ kind: "idle" });
  });

  it("dismisses notices without changing the underlying result", () => {
    let state: ResearchWorkspaceState = initialResearchWorkspaceState;
    state = start(state, 1);
    state = terminal(state, { type: "result", sequence: 1, dossier: makeDossier() });
    const secondSubmission = makeSnapshot({ sequence: 2 });
    state = start(state, 2, secondSubmission);
    state = terminal(state, { type: "cancelled", sequence: 2 });
    const dismissed = researchWorkspaceReducer(state, { type: "dismiss-notice" });

    expect(dismissed).toEqual({
      kind: "result",
      dossier: expect.any(Object),
      submission: expect.any(Object),
    });
    expect("notice" in dismissed ? dismissed.notice : undefined).toBeUndefined();
  });
});
