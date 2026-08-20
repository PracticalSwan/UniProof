import { createHash } from "node:crypto";

import {
  evidenceStatusSchema,
  verifiedClaimSchema,
  type ClaimCandidate,
  type ResearchCategory,
  type ResearchDocument,
  type ResearchSource,
  type VerifiedClaim,
} from "@/lib/research/contracts";
import type { ResolvedResearchTarget } from "@/lib/research/discovery/types";
import { normalizeResearchIdentity } from "@/lib/research/identity";
import { hostMatchesOfficialRoot, normalizeOfficialHost } from "@/lib/research/official-host";
import {
  buildNormalizedCandidateView,
  normalizeAcademicYear,
  normalizeEffectiveDate,
  normalizeIntake,
  normalizeProperty,
  typedValuesEqual,
} from "@/lib/research/reconciliation/normalize";
import type {
  ResearchPeriodContext,
  SemanticQuestion,
  ValidatedSemanticRelationship,
} from "@/lib/research/reconciliation/types";

export type EvidenceGateInput = {
  candidates: readonly ClaimCandidate[];
  sources: readonly ResearchSource[];
  documents: readonly ResearchDocument[];
  target: ResolvedResearchTarget;
  requestedPeriod?: ResearchPeriodContext;
  decisionEligibleCategories: readonly ResearchCategory[];
  relationships?: readonly ValidatedSemanticRelationship[];
  questions?: readonly SemanticQuestion[];
  unresolvedQuestionIds?: readonly string[];
  forcedIncompleteCategories?: readonly ResearchCategory[];
};

export type EvidenceGateResult = {
  claims: readonly VerifiedClaim[];
  unknownCategories: readonly ResearchCategory[];
  completedCategories: readonly ResearchCategory[];
  incompleteCategories: readonly ResearchCategory[];
  warnings: readonly string[];
};

type CandidateWithSource = {
  candidate: ClaimCandidate;
  source?: ResearchSource;
  document?: ResearchDocument;
  current: boolean;
  outdated: boolean;
  scopeCompatible: boolean;
  direct: boolean;
  semantic: boolean;
};

type Cluster = CandidateWithSource[];

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizedPublisher(value: string): string {
  return normalizeResearchIdentity(value);
}

function hostFor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return normalizeOfficialHost(new URL(value).hostname);
  } catch {
    return undefined;
  }
}

function isResolvedUniversitySource(source: ResearchSource, target: ResolvedResearchTarget): boolean {
  if (source.sourceType !== "university") return false;
  const publisher = normalizedPublisher(source.publisher);
  const targetName = target.universityName === undefined ? "" : normalizeResearchIdentity(target.universityName);
  const sourceHost = hostFor(source.url);
  const officialHost = target.officialHost === undefined ? undefined : normalizeOfficialHost(target.officialHost);
  const publisherMatches = targetName !== "" && (
    publisher === targetName || publisher.startsWith(`${targetName} `) || publisher.endsWith(` ${targetName}`)
  );
  const hostMatches = officialHost !== undefined && sourceHost !== undefined &&
    hostMatchesOfficialRoot(sourceHost, officialHost);
  return publisherMatches || hostMatches;
}

function sourceOwnerKey(source: ResearchSource, target: ResolvedResearchTarget): string {
  const publisher = normalizedPublisher(source.publisher);
  const targetName = target.universityName === undefined ? "" : normalizeResearchIdentity(target.universityName);
  const sourceHost = hostFor(source.url);
  const officialHost = target.officialHost === undefined ? undefined : normalizeOfficialHost(target.officialHost);
  if (
    isResolvedUniversitySource(source, target) ||
    (targetName !== "" && publisher === targetName) ||
    (officialHost !== undefined && sourceHost !== undefined && hostMatchesOfficialRoot(sourceHost, officialHost))
  ) {
    return `university:${(target.universityId ?? targetName) || "resolved-target"}`;
  }
  return `publisher:${publisher}`;
}

function evidenceOriginKey(item: CandidateWithSource): string | undefined {
  return item.document?.contentHash ?? item.source?.id;
}

function independentSourceCount(items: readonly CandidateWithSource[], target: ResolvedResearchTarget): number {
  const owners = new Set<string>();
  const origins = new Set<string>();
  for (const item of items) {
    if (
      item.source === undefined ||
      item.source.sourceType === "anecdotal" ||
      item.source.sourceType === "ranking" ||
      item.source.sourceType === "independent"
    ) continue;
    if (item.source.sourceType === "university" && !isResolvedUniversitySource(item.source, target)) continue;
    const origin = evidenceOriginKey(item);
    if (origin === undefined) continue;
    owners.add(sourceOwnerKey(item.source, target));
    origins.add(origin);
  }
  // Corroboration requires application-owned reliable source classes plus a
  // different owner and evidence origin. Arbitrary general-web results remain
  // inferred until a reviewed reliability/ownership registry exists.
  if (owners.size < 2 || origins.size < 2) return 1;
  return Math.min(owners.size, origins.size);
}

function renderedValue(candidate: ClaimCandidate): string[] {
  if (typeof candidate.value === "boolean") return [candidate.value ? "true" : "false", candidate.value ? "yes" : "no"];
  if (typeof candidate.value === "number") {
    const raw = String(candidate.value);
    return [raw, raw.replace(/\.0+$/u, ""), raw.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")];
  }
  return [candidate.value, normalizeResearchIdentity(candidate.value)];
}

function directSupport(candidate: ClaimCandidate): boolean {
  const passage = normalizeProperty(candidate.supportingText);
  return renderedValue(candidate).some((value) => {
    const normalizedValue = normalizeProperty(value);
    return normalizedValue !== "" && passage.includes(normalizedValue);
  });
}

function hasUnmodeledScopeQualifier(candidate: ClaimCandidate): boolean {
  return /\b(campus|campuses|modality|online|on[- ]campus|residen(?:t|cy)|cohort|exception|except|conditional|condition|international|domestic|full[- ]time|part[- ]time)\b/iu.test(candidate.supportingText);
}

function identityMatches(candidate: ClaimCandidate, target: ResolvedResearchTarget): boolean {
  if (target.universityId !== undefined) {
    if (candidate.universityId !== undefined) {
      if (target.universityId !== candidate.universityId) return false;
    } else if (target.universityName === undefined || candidate.universityName === undefined || normalizeResearchIdentity(target.universityName) !== normalizeResearchIdentity(candidate.universityName)) {
      return false;
    }
  } else if (target.universityName !== undefined && (candidate.universityName === undefined || normalizeResearchIdentity(target.universityName) !== normalizeResearchIdentity(candidate.universityName))) {
    return false;
  }
  if (target.programId !== undefined) {
    if (candidate.programId !== undefined && candidate.programId !== null) {
      if (target.programId !== candidate.programId) return false;
    } else if (target.programName === undefined || candidate.programName === undefined || normalizeResearchIdentity(target.programName) !== normalizeResearchIdentity(candidate.programName)) {
      return false;
    }
  } else if (target.programName !== undefined && (candidate.programName === undefined || normalizeResearchIdentity(target.programName) !== normalizeResearchIdentity(candidate.programName))) {
    return false;
  }
  return true;
}

function canonicalAcademicYearStart(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeAcademicYear(value);
  if (normalized === undefined) return undefined;
  const match = /^(\d{4})(?:-(\d{4}))?$/u.exec(normalized);
  if (match === null) return undefined;
  const first = Number(match[1]);
  const second = match[2] === undefined ? undefined : Number(match[2]);
  if (!Number.isSafeInteger(first) || (second !== undefined && second !== first + 1)) return undefined;
  return first;
}

function olderAcademicYear(candidateYear: string | undefined, requestedYear: string | undefined): boolean {
  const candidate = canonicalAcademicYearStart(candidateYear);
  const requested = canonicalAcademicYearStart(requestedYear);
  return candidate !== undefined && requested !== undefined && candidate < requested;
}

function canonicalEffectiveDate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeEffectiveDate(value);
  if (normalized === undefined) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(normalized);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (!Number.isSafeInteger(year) || day < 1 || day > daysInMonth) return undefined;
  return normalized;
}

function periodState(
  candidate: ClaimCandidate,
  source: ResearchSource | undefined,
  requested: ResearchPeriodContext | undefined,
): { current: boolean; outdated: boolean } {
  if (requested === undefined) return { current: true, outdated: false };
  const candidateYear = candidate.academicYear ?? source?.academicYear;
  const requestedYear = requested.academicYear;
  if (requestedYear !== undefined) {
    if (candidateYear === undefined) return { current: false, outdated: false };
    const normalizedCandidate = normalizeAcademicYear(candidateYear);
    const normalizedRequested = normalizeAcademicYear(requestedYear);
    if (normalizedCandidate !== normalizedRequested) {
      return { current: false, outdated: olderAcademicYear(candidateYear, requestedYear) };
    }
  }
  if (requested.intake !== undefined) {
    const candidateIntake = normalizeIntake(candidate.intake);
    if (candidateIntake === undefined) return { current: false, outdated: false };
    if (candidateIntake !== normalizeIntake(requested.intake)) return { current: false, outdated: false };
  }
  if (requested.effectiveDate !== undefined) {
    const candidateDate = canonicalEffectiveDate(candidate.effectiveDate ?? source?.effectiveDate);
    const requestedDate = canonicalEffectiveDate(requested.effectiveDate);
    if (candidateDate === undefined || requestedDate === undefined) return { current: false, outdated: false };
    if (candidateDate !== requestedDate) {
      return { current: false, outdated: candidateDate < requestedDate };
    }
  }
  return { current: true, outdated: false };
}

function propertyAllowsNormativeVerification(category: ResearchCategory, property: string): boolean {
  const key = normalizeProperty(property);
  const patterns: Record<ResearchCategory, RegExp> = {
    admissions: /admission|application|deadline|requirement|eligib|gpa|grade|test|english|prerequisite|document|visa/iu,
    tuition: /tuition|fee|cost|price|deposit|payment/iu,
    scholarships: /scholar|award|grant|fund|bursar|financial/iu,
    "program-structure": /program|course|module|credit|duration|curriculum|degree|study|semester/iu,
    support: /support|service|career|advis|counsel|housing|accommodation|library/iu,
    research: /research|publication|lab|faculty|project/iu,
    outcomes: /outcome|employment|salary|performance|ranking|graduate/iu,
  };
  return patterns[category].test(key);
}

function relationKey(left: string, right: string): string {
  return [left, right].sort().join("|");
}

function canonicalValueKey(candidate: ClaimCandidate, target: ResolvedResearchTarget): string {
  const view = buildNormalizedCandidateView(candidate, target);
  return JSON.stringify([view.scopeKey, view.valueKey]);
}

function claimId(cluster: Cluster, status: VerifiedClaim["verificationStatus"], target: ResolvedResearchTarget): string {
  const candidateIds = cluster.map((item) => item.candidate.id).sort();
  const valueKey = canonicalValueKey(cluster[0]!.candidate, target);
  const key = JSON.stringify([valueKey, status, candidateIds]);
  return `claim-${createHash("sha256").update(key, "utf8").digest("hex").slice(0, 32)}`;
}

function representativeIdentity(cluster: Cluster, target: ResolvedResearchTarget): Pick<VerifiedClaim, "universityId" | "universityName" | "programId" | "programName"> {
  const sorted = [...cluster].sort((left, right) => left.candidate.id.localeCompare(right.candidate.id));
  const first = sorted[0]?.candidate;
  if (first === undefined) return {};
  const universityIds = sorted.map((item) => item.candidate.universityId).filter((id): id is string => id !== undefined);
  const universityNames = sorted.map((item) => item.candidate.universityName).filter((name): name is string => name !== undefined);
  const programIds = sorted.map((item) => item.candidate.programId).filter((id): id is string => id !== undefined && id !== null);
  const programNames = sorted.map((item) => item.candidate.programName).filter((name): name is string => name !== undefined);
  const result: Pick<VerifiedClaim, "universityId" | "universityName" | "programId" | "programName"> = {};
  const universityId = universityIds.length > 0 && new Set(universityIds).size === 1 ? universityIds[0] : target.universityId;
  const universityName = universityNames[0] ?? target.universityName;
  if (universityId !== undefined) result.universityId = universityId;
  if (universityName !== undefined) result.universityName = universityName;
  const programId = programIds.length > 0 && new Set(programIds).size === 1 ? programIds[0] : target.programId;
  const programName = programNames[0] ?? target.programName;
  if (programId !== undefined) result.programId = programId;
  if (programName !== undefined) result.programName = programName;
  return result;
}

function buildClaim(cluster: Cluster, status: VerifiedClaim["verificationStatus"], target: ResolvedResearchTarget): VerifiedClaim {
  const sorted = [...cluster].sort((left, right) => left.candidate.id.localeCompare(right.candidate.id));
  const first = sorted[0]!.candidate;
  const sourceIds = sortedUnique(sorted.map((item) => item.candidate.sourceId));
  const documentIds = sortedUnique(sorted.map((item) => item.candidate.documentId));
  const identity = representativeIdentity(sorted, target);
  return verifiedClaimSchema.parse({
    id: claimId(sorted, status, target),
    ...identity,
    category: first.category,
    property: first.property,
    value: first.value,
    unit: first.unit,
    currency: first.currency,
    academicYear: first.academicYear,
    effectiveDate: first.effectiveDate,
    intake: first.intake,
    sourceId: sorted[0]!.candidate.sourceId,
    supportingText: sorted[0]!.candidate.supportingText,
    verificationStatus: status,
    sourceIds,
    documentIds,
    candidateIds: sorted.map((item) => item.candidate.id).sort(),
  });
}

function statusForCluster(cluster: Cluster, category: ResearchCategory, target: ResolvedResearchTarget): VerifiedClaim["verificationStatus"] | undefined {
  if (cluster.length === 0) return undefined;
  if (cluster.some((item) => item.source === undefined || item.document === undefined)) return undefined;
  const inScope = cluster.filter((item) => item.scopeCompatible);
  if (inScope.length === 0) return undefined;
  if (inScope.every((item) => item.outdated)) return "outdated";
  const current = inScope.filter((item) => item.current);
  if (current.length === 0) return inScope.some((item) => item.outdated) ? "outdated" : undefined;
  if (current.every((item) => item.source?.sourceType === "anecdotal")) return "anecdotal";
  const semantic = current.some((item) => item.semantic);
  const direct = current.every((item) => item.direct);
  const reliableIndependent = independentSourceCount(current, target);
  const sourceTypes = new Set(current.map((item) => item.source?.sourceType));
  const hasResolvedUniversitySource = current.some((item) =>
    item.source !== undefined && isResolvedUniversitySource(item.source, target));
  if (semantic && !direct) return "inferred";
  if (sourceTypes.has("government") || sourceTypes.has("accreditation")) {
    if (propertyAllowsNormativeVerification(category, current[0]!.candidate.property) && direct && !semantic) {
      return "verified";
    }
  }
  if (
    hasResolvedUniversitySource &&
    category !== "outcomes" && category !== "research" &&
    propertyAllowsNormativeVerification(category, current[0]!.candidate.property) &&
    direct && !semantic
  ) return "verified";
  if (reliableIndependent >= 2 && direct) return "corroborated";
  if (hasResolvedUniversitySource && (category === "outcomes" || category === "research")) {
    return direct ? "university-reported" : "inferred";
  }
  if (hasResolvedUniversitySource) return direct ? "university-reported" : "inferred";
  if (sourceTypes.has("anecdotal")) return "anecdotal";
  // Dataset/independent/ranking evidence can corroborate but cannot verify a
  // single source. A direct unsupported interpretation remains inferred.
  return "inferred";
}

function buildClusters(
  items: readonly CandidateWithSource[],
  target: ResolvedResearchTarget,
  relationships: readonly ValidatedSemanticRelationship[],
): Cluster[] {
  const sorted = [...items].sort((left, right) => left.candidate.id.localeCompare(right.candidate.id));
  const parent = new Map(sorted.map((item) => [item.candidate.id, item.candidate.id]));
  const find = (id: string): string => {
    const value = parent.get(id);
    if (value === undefined || value === id) return value ?? id;
    const root = find(value);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const l = find(left);
    const r = find(right);
    if (l !== r) parent.set(r, l < r ? l : r);
  };
  for (const relationship of relationships) {
    if (relationship.relationship !== "equivalent") continue;
    const left = sorted.find((item) => item.candidate.id === relationship.leftCandidateId);
    const right = sorted.find((item) => item.candidate.id === relationship.rightCandidateId);
    if (left === undefined || right === undefined || !typedValuesEqual(left.candidate, right.candidate)) continue;
    const leftView = buildNormalizedCandidateView(left.candidate, target);
    const rightView = buildNormalizedCandidateView(right.candidate, target);
    if (leftView.scopeKey === rightView.scopeKey) union(left.candidate.id, right.candidate.id);
  }
  const clusters = new Map<string, Cluster>();
  for (const item of sorted) {
    const root = find(item.candidate.id);
    const cluster = clusters.get(root) ?? [];
    cluster.push(item);
    clusters.set(root, cluster);
  }
  return [...clusters.values()].sort((left, right) => (left[0]?.candidate.id ?? "").localeCompare(right[0]?.candidate.id ?? ""));
}

function conflictClusterIds(
  items: readonly CandidateWithSource[],
  relationships: readonly ValidatedSemanticRelationship[],
): Set<string> {
  const contradictory = new Set<string>();
  const byPair = new Set(relationships.filter((relationship) => relationship.relationship === "contradictory").map((relationship) => relationKey(relationship.leftCandidateId, relationship.rightCandidateId)));
  for (const left of items) {
    for (const right of items) {
      if (left.candidate.id >= right.candidate.id) continue;
      const leftType = left.source?.sourceType;
      const rightType = right.source?.sourceType;
      if (byPair.has(relationKey(left.candidate.id, right.candidate.id)) &&
        left.current && right.current && left.scopeCompatible && right.scopeCompatible &&
        leftType !== undefined && rightType !== undefined &&
        leftType !== "anecdotal" && rightType !== "anecdotal" &&
        leftType !== "ranking" && rightType !== "ranking" &&
        !typedValuesEqual(left.candidate, right.candidate)) {
        contradictory.add(left.candidate.id);
        contradictory.add(right.candidate.id);
      }
    }
  }
  return contradictory;
}

export function evaluateEvidenceGate(input: EvidenceGateInput): EvidenceGateResult {
  const eligible = [...new Set(input.decisionEligibleCategories)].sort();
  const sourceMap = new Map(input.sources.map((source) => [source.id, source]));
  const documentMap = new Map(input.documents.map((document) => [document.id, document]));
  const relationshipList = input.relationships ?? [];
  const questionMap = new Map((input.questions ?? []).map((question) => [question.questionId, question]));
  const unresolved = new Set(input.unresolvedQuestionIds ?? []);
  const forcedIncomplete = new Set(input.forcedIncompleteCategories ?? []);
  const blockedCandidateIds = new Set<string>();
  for (const questionId of unresolved) {
    const question = questionMap.get(questionId);
    if (question !== undefined) {
      blockedCandidateIds.add(question.leftCandidateId);
      blockedCandidateIds.add(question.rightCandidateId);
    }
  }
  const claims: VerifiedClaim[] = [];
  const unknownCategories: ResearchCategory[] = [];
  const completedCategories: ResearchCategory[] = [];
  const incompleteCategories: ResearchCategory[] = [];
  const warnings: string[] = [];

  for (const category of eligible) {
    const categoryCandidates = input.candidates.filter((candidate) => candidate.category === category);
    const hasBrokenProvenance = categoryCandidates.some((candidate) => {
      const source = sourceMap.get(candidate.sourceId);
      const document = documentMap.get(candidate.documentId);
      return source === undefined || document === undefined || document.sourceId !== candidate.sourceId;
    });
    const categoryBlocked = forcedIncomplete.has(category) || hasBrokenProvenance || categoryCandidates.some((candidate) => blockedCandidateIds.has(candidate.id));
    if (hasBrokenProvenance) warnings.push(`category ${category} has unresolved candidate provenance`);
    const items: CandidateWithSource[] = categoryCandidates
      .filter((candidate) => !blockedCandidateIds.has(candidate.id))
      .map((candidate) => {
        const source = sourceMap.get(candidate.sourceId);
        const rawDocument = documentMap.get(candidate.documentId);
        const document = rawDocument?.sourceId === candidate.sourceId ? rawDocument : undefined;
        const period = periodState(candidate, source, input.requestedPeriod);
        const sourceScopeCompatible = source?.sourceType !== "university" || isResolvedUniversitySource(source, input.target);
        const scopeCompatible = sourceScopeCompatible && identityMatches(candidate, input.target) && !hasUnmodeledScopeQualifier(candidate);
        const semantic = relationshipList.some((relationship) => relationship.resolution === "model" && (relationship.leftCandidateId === candidate.id || relationship.rightCandidateId === candidate.id) && relationship.relationship === "equivalent");
        return {
          candidate,
          source,
          document,
          current: period.current,
          outdated: period.outdated,
          scopeCompatible,
          direct: directSupport(candidate),
          semantic,
        };
      });
    if (categoryCandidates.length === 0) {
      if (!categoryBlocked) {
        unknownCategories.push(category);
        completedCategories.push(category);
      } else {
        incompleteCategories.push(category);
      }
      continue;
    }
    const clusters = buildClusters(items, input.target, relationshipList.filter((relationship) => relationship.category === category));
    const conflictIds = conflictClusterIds(items, relationshipList.filter((relationship) => relationship.category === category));
    for (const cluster of clusters) {
      if (cluster.length === 0 || cluster.every((item) => !item.scopeCompatible)) continue;
      const status = cluster.some((item) => conflictIds.has(item.candidate.id))
        ? "conflicting" as const
        : statusForCluster(cluster, category, input.target);
      if (status === undefined) continue;
      claims.push(buildClaim(cluster, status, input.target));
    }
    if (categoryBlocked) {
      incompleteCategories.push(category);
    } else if (claims.some((claim) => claim.category === category) || unknownCategories.includes(category)) {
      completedCategories.push(category);
    } else {
      unknownCategories.push(category);
      completedCategories.push(category);
    }
  }

  const uniqueClaims = [...new Map(claims.map((claim) => [claim.id, claim])).values()].sort((left, right) => left.id.localeCompare(right.id));
  const uniqueCompleted = [...new Set(completedCategories)].filter((category) => !incompleteCategories.includes(category)).sort();
  const uniqueIncomplete = [...new Set(incompleteCategories)].sort();
  const uniqueUnknown = [...new Set(unknownCategories)].filter((category) => uniqueCompleted.includes(category)).sort();
  return {
    claims: uniqueClaims,
    unknownCategories: uniqueUnknown,
    completedCategories: uniqueCompleted,
    incompleteCategories: uniqueIncomplete,
    warnings,
  };
}

export const gateEvidence = evaluateEvidenceGate;
export const deterministicEvidenceGate = evaluateEvidenceGate;
export const buildEvidenceClaims = evaluateEvidenceGate;

export { evidenceStatusSchema };
