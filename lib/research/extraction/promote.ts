import "server-only";

import { createHash } from "node:crypto";

import {
  claimCandidateSchema,
  researchExtractionProviderSchema,
  type ClaimCandidate,
} from "@/lib/research/contracts";
import { isWellFormedUnicode, parsePortableExtractionPayload, type ExtractedClaim } from "./schema";
import type { ExtractionTask, PromotionInput, PromotionResult, PromotionRejectionReason } from "./types";

function rejectionResult(reason: PromotionRejectionReason, validEnvelope = false): PromotionResult {
  return {
    candidates: [],
    rejectedCount: 1,
    rejectionReasons: [reason],
    validClaimCount: 0,
    allClaimsFailedIntegrity: false,
    empty: false,
    validEnvelope,
  };
}

function candidateKey(candidate: Pick<ClaimCandidate, "category" | "property" | "value" | "unit" | "currency" | "academicYear" | "effectiveDate" | "intake" | "supportingText" | "sourceId" | "documentId">): string {
  const valueType = typeof candidate.value;
  return JSON.stringify([
    candidate.sourceId,
    candidate.documentId,
    candidate.category,
    candidate.property.normalize("NFKC").trim().toLowerCase(),
    valueType,
    candidate.value,
    candidate.unit ?? null,
    candidate.currency ?? null,
    candidate.academicYear ?? null,
    candidate.effectiveDate ?? null,
    candidate.intake ?? null,
    candidate.supportingText,
  ]);
}

function deterministicCandidateId(key: string): string {
  const digest = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 32);
  return `candidate-${digest}`;
}

function addReason(reasons: PromotionRejectionReason[], reason: PromotionRejectionReason): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function promoteOne(
  claim: ExtractedClaim,
  task: ExtractionTask,
  provider: string,
  model: string,
  reasons: PromotionRejectionReason[],
): ClaimCandidate | undefined {
  const eligible = new Set(task.categories);
  if (!eligible.has(claim.category)) {
    addReason(reasons, "invalid-category");
    return undefined;
  }

  const segment = claim.segmentId === task.segment.id ? task.segment : undefined;
  if (segment === undefined) {
    addReason(reasons, "unknown-segment");
    return undefined;
  }
  if (claim.supportingText.trim() === "") {
    addReason(reasons, "supporting-text-empty");
    return undefined;
  }
  if (!isWellFormedUnicode(segment.id) || !isWellFormedUnicode(segment.text)) {
    addReason(reasons, "domain-contract");
    return undefined;
  }
  if (!isWellFormedUnicode(claim.supportingText)) {
    addReason(reasons, "supporting-text-not-exact");
    return undefined;
  }
  // This is intentionally performed before any trimming, case folding, or
  // Unicode normalization. Exact code-point provenance is the trust boundary.
  if (!segment.text.includes(claim.supportingText)) {
    addReason(reasons, "supporting-text-not-exact");
    return undefined;
  }
  const provenanceSegments = task.provenanceSegments ?? [segment];
  if (!provenanceSegments.some((sourceSegment) => sourceSegment.text.includes(claim.supportingText))) {
    addReason(reasons, "supporting-text-not-exact");
    return undefined;
  }

  const extractionProvider = researchExtractionProviderSchema.safeParse(provider);
  if (!extractionProvider.success) {
    addReason(reasons, "domain-contract");
    return undefined;
  }

  const identity = task.target;
  const metadata = {
    id: "",
    universityId: identity.universityId,
    universityName: identity.universityName,
    programId: identity.programId,
    programName: identity.programName,
    category: claim.category,
    property: claim.property,
    value: claim.value,
    unit: claim.unit ?? undefined,
    currency: claim.currency ?? undefined,
    academicYear: claim.academicYear ?? undefined,
    effectiveDate: claim.effectiveDate ?? undefined,
    intake: claim.intake ?? undefined,
    sourceId: task.segment.sourceId,
    documentId: task.segment.documentId,
    extractionMethod: "model" as const,
    extractionProvider: extractionProvider.data,
    extractionModel: model,
    supportingText: claim.supportingText,
  };
  const key = candidateKey(metadata);
  const parsed = claimCandidateSchema.safeParse({
    ...metadata,
    id: deterministicCandidateId(key),
  });
  if (!parsed.success) {
    addReason(reasons, "domain-contract");
    return undefined;
  }

  // The domain contract historically trims supportingText. Restore the raw
  // exact substring after validation so downstream evidence retains the
  // provenance-sensitive surface that was actually checked.
  return { ...parsed.data, supportingText: claim.supportingText };
}

export function promoteExtractedClaims(input: PromotionInput & { payload: unknown }): PromotionResult {
  const parsed = parsePortableExtractionPayload(input.payload);
  if (!parsed.success) return rejectionResult("domain-contract", false);
  if (parsed.data.claims.length === 0) {
    return {
      candidates: [],
      rejectedCount: 0,
      rejectionReasons: [],
      validClaimCount: 0,
      allClaimsFailedIntegrity: false,
      empty: true,
      validEnvelope: true,
    };
  }

  const reasons: PromotionRejectionReason[] = [];
  const candidates: ClaimCandidate[] = [];
  for (const claim of parsed.data.claims) {
    const candidate = promoteOne(claim, input.task, input.provider, input.model, reasons);
    if (candidate !== undefined) candidates.push(candidate);
  }
  return {
    candidates,
    rejectedCount: parsed.data.claims.length - candidates.length,
    rejectionReasons: reasons,
    validClaimCount: candidates.length,
    allClaimsFailedIntegrity: candidates.length === 0,
    empty: false,
    validEnvelope: true,
  };
}

export function dedupePromotedCandidates(candidates: readonly ClaimCandidate[]): ClaimCandidate[] {
  const seen = new Set<string>();
  const result: ClaimCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export const promoteExtraction = promoteExtractedClaims;
