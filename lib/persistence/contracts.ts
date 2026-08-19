import { z } from "zod";

import { comparisonResultSchema } from "@/lib/comparison/client-state";
import { comparisonTargetKey } from "@/lib/comparison/contracts";
import { bindCatalogOwnedResearchTarget } from "@/lib/research/catalog/presentation";
import type { ResearchCatalog } from "@/lib/research/catalog/schema";
import {
  researchDossierSchema,
  researchModeRequestSchema,
} from "@/lib/research/mode/public-contracts";
import {
  GUIDE_RESEARCH_CATEGORIES,
  guideApplicantProfileSchema,
  guideResultSchema,
  guideTargetKey,
} from "@/lib/guide/contracts";

export const SAVED_ARTIFACT_SCHEMA_VERSION = 1;
export const SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES = 4_300_000;
export const SAVED_PROFILE_MAX_PAYLOAD_UTF8_BYTES = 32 * 1_024;
export const SAVED_RESULT_MAX_PAYLOAD_UTF8_BYTES = 4 * 1_024 * 1_024;
export const SAVED_ARTIFACT_MAX_TITLE_UTF8_LENGTH = 120;
export const SAVED_ARTIFACT_OWNER_CAP = 20;

export const savedArtifactKindSchema = z.enum(["profile", "research", "comparison", "guide"]);
export type SavedArtifactKind = z.infer<typeof savedArtifactKindSchema>;

export const persistenceErrorCodeSchema = z.enum([
  "unauthenticated",
  "forbidden-origin",
  "invalid-content-type",
  "invalid-json",
  "invalid-request",
  "request-too-large",
  "snapshot-too-large",
  "snapshot-capacity-reached",
  "snapshot-not-found",
  "snapshot-invalid",
  "snapshot-unsupported-version",
  "snapshot-target-unavailable",
  "persistence-unavailable",
]);
export type PersistenceErrorCode = z.infer<typeof persistenceErrorCodeSchema>;

export const persistenceErrorSchema = z.object({
  error: persistenceErrorCodeSchema,
  message: z.string().trim().min(1).max(300),
}).strict();
export type PersistenceError = z.infer<typeof persistenceErrorSchema>;

const profileArtifactSchema = z.object({
  kind: z.literal("profile"),
  schemaVersion: z.literal(SAVED_ARTIFACT_SCHEMA_VERSION),
  payload: guideApplicantProfileSchema,
}).strict();

export const savedResearchPayloadSchema = z.object({
  request: researchModeRequestSchema,
  dossier: researchDossierSchema,
}).strict();

const researchArtifactSchema = z.object({
  kind: z.literal("research"),
  schemaVersion: z.literal(SAVED_ARTIFACT_SCHEMA_VERSION),
  payload: savedResearchPayloadSchema,
}).strict();

const comparisonArtifactSchema = z.object({
  kind: z.literal("comparison"),
  schemaVersion: z.literal(SAVED_ARTIFACT_SCHEMA_VERSION),
  payload: comparisonResultSchema,
}).strict();

const guideArtifactSchema = z.object({
  kind: z.literal("guide"),
  schemaVersion: z.literal(SAVED_ARTIFACT_SCHEMA_VERSION),
  payload: guideResultSchema,
}).strict();

export const savedArtifactSchema = z.discriminatedUnion("kind", [
  profileArtifactSchema,
  researchArtifactSchema,
  comparisonArtifactSchema,
  guideArtifactSchema,
]);
export type SavedArtifact = z.infer<typeof savedArtifactSchema>;

export const savedArtifactSaveRequestSchema = savedArtifactSchema;

export const savedArtifactMetadataSchema = z.object({
  id: z.uuid(),
  kind: savedArtifactKindSchema,
  schemaVersion: z.literal(SAVED_ARTIFACT_SCHEMA_VERSION),
  title: z.string().trim().min(1).max(SAVED_ARTIFACT_MAX_TITLE_UTF8_LENGTH),
  createdAt: z.iso.datetime({ offset: true }),
}).strict();
export type SavedArtifactMetadata = z.infer<typeof savedArtifactMetadataSchema>;

export const savedArtifactRowSchema = savedArtifactMetadataSchema.extend({
  payload: z.unknown(),
}).strict();
export type SavedArtifactRow = z.infer<typeof savedArtifactRowSchema>;

export const savedArtifactListResponseSchema = z.object({
  artifacts: z.array(savedArtifactMetadataSchema).max(SAVED_ARTIFACT_OWNER_CAP),
}).strict();

export const savedArtifactRestoreEnvelopeSchema = z.object({
  accountId: z.uuid(),
  token: z.number().int().min(1),
  artifact: savedArtifactSchema,
}).strict();
export type SavedArtifactRestoreEnvelope = z.infer<typeof savedArtifactRestoreEnvelopeSchema>;

export function serializedUtf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function serializedPayloadBytes(artifact: SavedArtifact): number {
  return serializedUtf8Bytes(JSON.stringify(artifact.payload));
}

export type ParsedSavedArtifact =
  | { ok: true; artifact: SavedArtifact }
  | { ok: false; code: "snapshot-invalid" | "snapshot-unsupported-version" };

export function parseSavedArtifact(input: unknown): ParsedSavedArtifact {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, code: "snapshot-invalid" };
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version !== SAVED_ARTIFACT_SCHEMA_VERSION) {
    return { ok: false, code: "snapshot-unsupported-version" };
  }
  const parsed = savedArtifactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "snapshot-invalid" };
  return { ok: true, artifact: parsed.data };
}

function truncateTitle(value: string): string {
  const chars = Array.from(value);
  if (chars.length <= SAVED_ARTIFACT_MAX_TITLE_UTF8_LENGTH) return value.trim();
  return `${chars.slice(0, SAVED_ARTIFACT_MAX_TITLE_UTF8_LENGTH - 1).join("").trim()}…`;
}

function currentTargetLabel(
  target: { universityId: string; programId?: string },
  catalog: ResearchCatalog,
): string | null {
  const university = catalog.universities.find((item) => item.id === target.universityId);
  if (university === undefined) return null;
  if (target.programId === undefined) return university.name;
  const program = catalog.programs.find(
    (item) => item.id === target.programId && item.universityId === university.id,
  );
  if (program === undefined) return null;
  return `${program.name} — ${university.name}`;
}

type ValidationFailure = Readonly<{
  ok: false;
  code: "snapshot-invalid" | "snapshot-unsupported-version" | "snapshot-target-unavailable";
}>;

export type SavedArtifactValidation =
  | {
      ok: true;
      artifact: SavedArtifact;
      boundArtifact: SavedArtifact;
      title: string;
    }
  | ValidationFailure;

function researchClaimIds(dossier: z.infer<typeof researchDossierSchema>): Set<string> {
  return new Set(dossier.categories.flatMap((row) => row.claims.map((claim) => claim.id)));
}

function researchSourceIds(dossier: z.infer<typeof researchDossierSchema>): Set<string> {
  return new Set(dossier.sources.map((source) => source.id));
}

function validEvidenceRefs(
  refs: readonly { targetKey: string; claimId: string }[],
  targetKey: string,
  claims: Set<string>,
): boolean {
  return refs.every((ref) => ref.targetKey === targetKey && claims.has(ref.claimId));
}

function validateGuideArtifact(
  payload: z.infer<typeof guideResultSchema>,
  catalog: ResearchCatalog,
): { ok: true; payload: z.infer<typeof guideResultSchema> } | ValidationFailure {
  const boundDossier = bindCatalogOwnedResearchTarget(payload.dossier, catalog);
  if (boundDossier === null) return { ok: false, code: "snapshot-target-unavailable" };

  const target = payload.submission.target;
  if (
    payload.researchRequest.universityId !== target.universityId ||
    payload.researchRequest.programId !== target.programId ||
    payload.researchRequest.intake !== payload.submission.publicContext.intake ||
    payload.researchRequest.academicYear !== payload.submission.publicContext.academicYear
  ) {
    return { ok: false, code: "snapshot-invalid" };
  }

  if (
    payload.researchRequest.categories.length !== GUIDE_RESEARCH_CATEGORIES.length ||
    payload.researchRequest.categories.some((category, index) => category !== GUIDE_RESEARCH_CATEGORIES[index])
  ) {
    return { ok: false, code: "snapshot-invalid" };
  }

  if (
    boundDossier.target.university.id !== target.universityId ||
    boundDossier.target.program?.id !== target.programId ||
    boundDossier.categories.length !== GUIDE_RESEARCH_CATEGORIES.length ||
    boundDossier.categories.some((row, index) => row.category !== GUIDE_RESEARCH_CATEGORIES[index])
  ) {
    return { ok: false, code: "snapshot-invalid" };
  }

  const expectedStatus = boundDossier.run.status === "partial" ||
    boundDossier.categories.some((row) => row.state === "incomplete")
    ? "partial"
    : "complete";
  if (payload.status !== expectedStatus) return { ok: false, code: "snapshot-invalid" };

  const targetKey = guideTargetKey(target);
  const claims = researchClaimIds(boundDossier);
  const allRefGroups = [
    ...payload.assessments.map((item) => item.evidenceRefs),
    ...(payload.budgetAssessment === undefined ? [] : [payload.budgetAssessment.evidenceRefs]),
    ...payload.risks.map((item) => item.evidenceRefs),
    ...payload.checklist.map((item) => item.evidenceRefs),
    ...payload.timeline.map((item) => item.evidenceRefs),
  ];
  if (!allRefGroups.every((refs) => validEvidenceRefs(refs, targetKey, claims))) {
    return { ok: false, code: "snapshot-invalid" };
  }
  if (!payload.unrecognizedAdmissions.every((item) =>
    validEvidenceRefs([item.evidenceRef], targetKey, claims),
  )) {
    return { ok: false, code: "snapshot-invalid" };
  }

  return {
    ok: true,
    payload: {
      ...payload,
      dossier: boundDossier,
    },
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateComparisonArtifact(
  payload: z.infer<typeof comparisonResultSchema>,
  catalog: ResearchCatalog,
): { ok: true; payload: z.infer<typeof comparisonResultSchema> } | ValidationFailure {
  const selectedKeys = payload.submission.targets.map(comparisonTargetKey);
  if (
    payload.outcomes.length !== payload.submission.targets.length ||
    payload.outcomes.some((outcome, index) =>
      !sameJson(outcome.target, payload.submission.targets[index])
    )
  ) {
    return { ok: false, code: "snapshot-invalid" };
  }

  const dossierByKey = new Map<string, z.infer<typeof researchDossierSchema>>();
  const boundOutcomes = payload.outcomes.map((outcome) => {
    if (outcome.state !== "dossier") return outcome;
    const bound = bindCatalogOwnedResearchTarget(outcome.dossier, catalog);
    if (bound === null) return { unavailable: true as const };
    const key = comparisonTargetKey(outcome.target);
    const dossierKey = comparisonTargetKey({
      universityId: bound.target.university.id,
      ...(bound.target.program === undefined ? {} : { programId: bound.target.program.id }),
    });
    if (key !== dossierKey) return { mismatch: true as const };
    dossierByKey.set(key, bound);
    return { target: outcome.target, state: "dossier" as const, dossier: bound };
  });
  if (boundOutcomes.some((outcome) => "unavailable" in outcome || "mismatch" in outcome)) {
    return { ok: false, code: "snapshot-target-unavailable" };
  }

  if (!sameJson(payload.score.submission, payload.submission)) {
    return { ok: false, code: "snapshot-invalid" };
  }
  if (
    payload.score.targets.length !== selectedKeys.length ||
    payload.score.targets.some((target, index) =>
      !sameJson(target.target, payload.submission.targets[index])
    )
  ) {
    return { ok: false, code: "snapshot-invalid" };
  }

  for (const target of payload.score.targets) {
    const key = comparisonTargetKey(target.target);
    if (target.dossier !== null && !sameJson(target.dossier, dossierByKey.get(key) ?? null)) {
      return { ok: false, code: "snapshot-invalid" };
    }

    let coveredWeight = 0;
    for (const [dimension, outcome] of Object.entries(target.dimensions)) {
      if (outcome.state !== "scored") continue;
      coveredWeight += payload.submission.weights[dimension as keyof typeof payload.submission.weights];
      const dossier = dossierByKey.get(key);
      const claims = dossier === undefined ? new Set<string>() : researchClaimIds(dossier);
      if (outcome.claimIds.some((claimId) => !claims.has(claimId))) {
        return { ok: false, code: "snapshot-invalid" };
      }
      const sources = dossier === undefined ? new Set<string>() : researchSourceIds(dossier);
      if (
        outcome.fact.claimIds.some((claimId) => !claims.has(claimId)) ||
        outcome.fact.sourceIds.some((sourceId) => !sources.has(sourceId))
      ) {
        return { ok: false, code: "snapshot-invalid" };
      }
    }
    if (target.evidenceCoverage !== coveredWeight) {
      return { ok: false, code: "snapshot-invalid" };
    }
    const scoredCount = Object.values(target.dimensions).filter((item) => item.state === "scored").length;
    const shouldSuppress = scoredCount < 2 || coveredWeight < 50;
    if (target.fitSuppressed !== shouldSuppress || (target.fitScore === null) !== shouldSuppress) {
      return { ok: false, code: "snapshot-invalid" };
    }
  }

  for (const tradeoff of payload.tradeoffs) {
    if (
      tradeoff.targetKeys.some((key) => !selectedKeys.includes(key)) ||
      tradeoff.evidenceRefs.some((ref) => {
        const dossier = dossierByKey.get(ref.targetKey);
        return dossier === undefined || !researchClaimIds(dossier).has(ref.claimId);
      })
    ) {
      return { ok: false, code: "snapshot-invalid" };
    }
  }

  const complete = payload.outcomes.every((outcome) =>
    outcome.state === "dossier" && outcome.dossier.run.status === "succeeded"
  );
  if (payload.status !== (complete ? "complete" : "partial")) {
    return { ok: false, code: "snapshot-invalid" };
  }

  return {
    ok: true,
    payload: {
      ...payload,
      outcomes: boundOutcomes.map((outcome) => {
        if ("unavailable" in outcome || "mismatch" in outcome) throw new Error("Unreachable bound comparison outcome.");
        return outcome;
      }),
    },
  };
}

export function validateSavedArtifact(
  input: { kind: unknown; schemaVersion: unknown; payload?: unknown },
  catalog: ResearchCatalog,
): SavedArtifactValidation {
  const parsed = parseSavedArtifact(input);
  if (!parsed.ok) return parsed;

  if (parsed.artifact.kind === "profile") {
    return {
      ok: true,
      artifact: parsed.artifact,
      boundArtifact: parsed.artifact,
      title: "Applicant profile",
    };
  }

  if (parsed.artifact.kind === "research") {
    const { request, dossier } = parsed.artifact.payload;
    const bound = bindCatalogOwnedResearchTarget(dossier, catalog);
    if (bound === null) return { ok: false, code: "snapshot-target-unavailable" };
    if (
      request.universityId !== bound.target.university.id ||
      request.programId !== bound.target.program?.id ||
      request.categories.length !== bound.categories.length ||
      request.categories.some((category, index) => category !== bound.categories[index]?.category)
    ) {
      return { ok: false, code: "snapshot-invalid" };
    }
    const label = currentTargetLabel({
      universityId: bound.target.university.id,
      ...(bound.target.program === undefined ? {} : { programId: bound.target.program.id }),
    }, catalog);
    if (label === null) return { ok: false, code: "snapshot-target-unavailable" };
    const boundArtifact: SavedArtifact = {
      kind: "research",
      schemaVersion: SAVED_ARTIFACT_SCHEMA_VERSION,
      payload: { request, dossier: bound },
    };
    return {
      ok: true,
      artifact: parsed.artifact,
      boundArtifact,
      title: truncateTitle(label),
    };
  }

  if (parsed.artifact.kind === "guide") {
    const validated = validateGuideArtifact(parsed.artifact.payload, catalog);
    if (!validated.ok) return validated;
    const label = currentTargetLabel(parsed.artifact.payload.submission.target, catalog);
    if (label === null) return { ok: false, code: "snapshot-target-unavailable" };
    const boundArtifact: SavedArtifact = {
      kind: "guide",
      schemaVersion: SAVED_ARTIFACT_SCHEMA_VERSION,
      payload: validated.payload,
    };
    return {
      ok: true,
      artifact: parsed.artifact,
      boundArtifact,
      title: truncateTitle(label),
    };
  }

  const validated = validateComparisonArtifact(parsed.artifact.payload, catalog);
  if (!validated.ok) return validated;
  const labels = validated.payload.submission.targets.map((target) => {
    const label = currentTargetLabel(target, catalog);
    if (label === null) return null;
    return label;
  });
  if (labels.some((label) => label === null)) {
    return { ok: false, code: "snapshot-target-unavailable" };
  }
  const boundArtifact: SavedArtifact = {
    kind: "comparison",
    schemaVersion: SAVED_ARTIFACT_SCHEMA_VERSION,
    payload: validated.payload,
  };
  return {
    ok: true,
    artifact: parsed.artifact,
    boundArtifact,
    title: truncateTitle(labels.join(" vs ")),
  };
}
