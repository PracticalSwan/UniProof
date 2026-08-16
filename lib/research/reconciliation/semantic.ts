import { createHash } from "node:crypto";

import type { ClaimCandidate } from "@/lib/research/contracts";
import type { ResolvedResearchTarget } from "@/lib/research/discovery/types";
import {
  buildNormalizedCandidateView,
  deterministicRelationshipForPair,
  normalizeAcademicYear,
  normalizeEffectiveDate,
  normalizeIntake,
} from "./normalize";
import { validateRelationshipEnvelope } from "./schema";
import type {
  PairPlanningResult,
  ResearchPeriodContext,
  SemanticQuestion,
  ValidatedSemanticRelationship,
} from "./types";
import { RESEARCH_MAX_SEMANTIC_QUESTIONS_PER_RUN } from "@/lib/security/research-limits";

function digest32(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
}

export function deterministicQuestionId(
  left: ClaimCandidate,
  right: ClaimCandidate,
  target: ResolvedResearchTarget,
  requestedPeriod?: ResearchPeriodContext,
): string {
  const orderedCandidates = [left, right].sort((a, b) => a.id.localeCompare(b.id));
  const ordered = orderedCandidates.map((candidate) => candidate.id);
  const leftView = buildNormalizedCandidateView(orderedCandidates[0]!, target);
  const rightView = buildNormalizedCandidateView(orderedCandidates[1]!, target);
  return `question-${digest32(JSON.stringify([
    ordered,
    leftView.scopeKey,
    rightView.scopeKey,
    normalizeAcademicYear(requestedPeriod?.academicYear) ?? null,
    normalizeIntake(requestedPeriod?.intake) ?? null,
    normalizeEffectiveDate(requestedPeriod?.effectiveDate) ?? null,
  ]))}`;
}

export function buildSemanticQuestions(input: {
  candidates: readonly ClaimCandidate[];
  target: ResolvedResearchTarget;
  requestedPeriod?: ResearchPeriodContext;
}): PairPlanningResult;
export function buildSemanticQuestions(
  candidates: readonly ClaimCandidate[],
  target: ResolvedResearchTarget,
  requestedPeriod?: ResearchPeriodContext,
): PairPlanningResult;
export function buildSemanticQuestions(
  inputOrCandidates: { candidates: readonly ClaimCandidate[]; target: ResolvedResearchTarget; requestedPeriod?: ResearchPeriodContext } | readonly ClaimCandidate[],
  positionalTarget?: ResolvedResearchTarget,
  positionalPeriod?: ResearchPeriodContext,
): PairPlanningResult {
  const input: { candidates: readonly ClaimCandidate[]; target: ResolvedResearchTarget; requestedPeriod?: ResearchPeriodContext } = Array.isArray(inputOrCandidates)
    ? { candidates: inputOrCandidates as readonly ClaimCandidate[], target: positionalTarget ?? {}, requestedPeriod: positionalPeriod }
    : inputOrCandidates as { candidates: readonly ClaimCandidate[]; target: ResolvedResearchTarget; requestedPeriod?: ResearchPeriodContext };
  const questions: SemanticQuestion[] = [];
  const deterministicRelationships: ValidatedSemanticRelationship[] = [];
  const overflowCategories = new Set<ClaimCandidate["category"]>();
  const overflowQuestionIds: string[] = [];
  let ambiguousCount = 0;
  const sortedCandidates = [...input.candidates].sort((left, right) => left.id.localeCompare(right.id));

  // Walk the canonical candidate order incrementally.  Do not materialize an
  // O(n²) pair array, and continue after overflow so deterministic pairs later
  // in the order are still preserved.
  for (let leftIndex = 0; leftIndex < sortedCandidates.length; leftIndex += 1) {
    const left = sortedCandidates[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < sortedCandidates.length; rightIndex += 1) {
      const right = sortedCandidates[rightIndex];
      if (right === undefined) continue;
      const leftView = buildNormalizedCandidateView(left, {
        universityId: left.universityId,
        universityName: left.universityName,
        programId: left.programId ?? undefined,
        programName: left.programName,
      });
      const rightView = buildNormalizedCandidateView(right, {
        universityId: right.universityId,
        universityName: right.universityName,
        programId: right.programId ?? undefined,
        programName: right.programName,
      });
      if (left.category !== right.category || leftView.propertyKey !== rightView.propertyKey) continue;

      const questionId = deterministicQuestionId(left, right, input.target, input.requestedPeriod);
      const question: SemanticQuestion = {
        questionId,
        leftCandidateId: left.id,
        rightCandidateId: right.id,
        category: left.category,
        property: left.property,
      };
      const relation = deterministicRelationshipForPair(left, right, input.target, input.requestedPeriod);
      if (relation !== undefined) {
        deterministicRelationships.push({ ...question, relationship: relation, resolution: "deterministic" });
        continue;
      }

      ambiguousCount += 1;
      if (ambiguousCount > RESEARCH_MAX_SEMANTIC_QUESTIONS_PER_RUN) {
        // One bounded sentinel question per affected category is sufficient to
        // prove semantic overflow. Keep scanning for later deterministic pairs
        // without retaining every O(n²) ambiguous overflow pair.
        if (!overflowCategories.has(left.category)) overflowQuestionIds.push(questionId);
        overflowCategories.add(left.category);
        overflowCategories.add(right.category);
        continue;
      }
      questions.push(question);
    }
  }

  questions.sort((left, right) => left.questionId.localeCompare(right.questionId));
  deterministicRelationships.sort((left, right) => left.questionId.localeCompare(right.questionId));
  return {
    questions,
    deterministicRelationships,
    overflow: overflowQuestionIds.length > 0,
    overflowCategories: [...overflowCategories].sort(),
    overflowQuestionIds: [...overflowQuestionIds].sort(),
  };
}

export const generateSemanticQuestions = buildSemanticQuestions;
export const buildReconciliationQuestions = buildSemanticQuestions;

export function validateSemanticRelationships(
  value: unknown,
  questions: readonly SemanticQuestion[],
  candidates: readonly ClaimCandidate[] = [],
) {
  return validateRelationshipEnvelope(value, questions, candidates);
}

export const validateModelRelationships = validateSemanticRelationships;
