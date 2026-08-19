import "server-only";

import { z } from "zod";

import { resolveSupabaseIdentity } from "@/lib/auth/session";
import {
  persistenceErrorSchema,
  savedArtifactKindSchema,
  savedArtifactListResponseSchema,
  savedArtifactMetadataSchema,
  savedArtifactRowSchema,
  serializedPayloadBytes,
  SAVED_ARTIFACT_OWNER_CAP,
  SAVED_PROFILE_MAX_PAYLOAD_UTF8_BYTES,
  SAVED_RESULT_MAX_PAYLOAD_UTF8_BYTES,
  validateSavedArtifact,
  type PersistenceErrorCode,
} from "@/lib/persistence/contracts";
import { researchCatalog } from "@/lib/research/catalog";
import { isAllowedSameOriginMutation } from "@/lib/security/same-origin";
import { createClient } from "@/lib/supabase/server";

const artifactIdSchema = z.uuid();
const dbMetadataSchema = z.object({
  id: z.uuid(),
  kind: savedArtifactKindSchema,
  schema_version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  created_at: z.iso.datetime({ offset: true }),
}).strict();
const dbRowSchema = dbMetadataSchema.extend({ payload: z.unknown() }).strict();

const errorMessages: Record<PersistenceErrorCode, string> = {
  unauthenticated: "Sign in to use private saved snapshots.",
  "forbidden-origin": "Cross-origin saved-snapshot changes are not allowed.",
  "invalid-content-type": "Saved-snapshot requests must use JSON content.",
  "invalid-json": "The saved-snapshot request must contain valid UTF-8 JSON.",
  "invalid-request": "The saved-snapshot request is invalid.",
  "request-too-large": "The saved-snapshot request is too large.",
  "snapshot-too-large": "This result is too large to save safely. It remains available in this session.",
  "snapshot-capacity-reached": "This account already has the maximum number of saved snapshots.",
  "snapshot-not-found": "The saved snapshot was not found.",
  "snapshot-invalid": "This saved snapshot is invalid and cannot be restored.",
  "snapshot-unsupported-version": "This saved snapshot version is not supported.",
  "snapshot-target-unavailable": "This saved snapshot targets a program that is no longer available in the current catalog.",
  "persistence-unavailable": "Private saved snapshots are temporarily unavailable.",
};

function responseJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      pragma: "no-cache",
    },
  });
}

export function persistenceErrorResponse(code: PersistenceErrorCode, status: number): Response {
  return responseJson(persistenceErrorSchema.parse({ error: code, message: errorMessages[code] }), status);
}

export const isAllowedPersistenceMutation = isAllowedSameOriginMutation;

async function authenticatedClient() {
  let client: Awaited<ReturnType<typeof createClient>>;
  try {
    client = await createClient();
  } catch {
    return { ok: false as const, code: "persistence-unavailable" as const };
  }
  const identity = await resolveSupabaseIdentity(client, "auth-server");
  if (identity.status === "unauthenticated") return { ok: false as const, code: "unauthenticated" as const };
  if (identity.status === "infrastructure-error") return { ok: false as const, code: "persistence-unavailable" as const };
  return { ok: true as const, client, userId: identity.userId };
}

function metadataFromDb(input: unknown) {
  const parsed = dbMetadataSchema.safeParse(input);
  if (!parsed.success) return null;
  return savedArtifactMetadataSchema.parse({
    id: parsed.data.id,
    kind: parsed.data.kind,
    schemaVersion: parsed.data.schema_version,
    title: parsed.data.title,
    createdAt: parsed.data.created_at,
  });
}

function statusForValidation(code: "snapshot-invalid" | "snapshot-unsupported-version" | "snapshot-target-unavailable"): number {
  return code === "snapshot-target-unavailable" ? 409 : 422;
}

export async function listSavedArtifacts(request: Request): Promise<Response> {
  const auth = await authenticatedClient();
  if (!auth.ok) return persistenceErrorResponse(auth.code, auth.code === "unauthenticated" ? 401 : 503);

  const url = new URL(request.url);
  const params = [...url.searchParams.keys()];
  if (params.some((key) => key !== "kind") || url.searchParams.getAll("kind").length > 1) {
    return persistenceErrorResponse("invalid-request", 400);
  }
  const rawKind = url.searchParams.get("kind");
  const kind = rawKind === null ? null : savedArtifactKindSchema.safeParse(rawKind);
  if (kind !== null && !kind.success) return persistenceErrorResponse("invalid-request", 400);

  try {
    let query = auth.client
      .from("saved_artifacts")
      .select("id,kind,schema_version,title,created_at")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SAVED_ARTIFACT_OWNER_CAP);
    if (kind !== null) query = query.eq("kind", kind.data);
    const { data, error } = await query;
    if (error !== null || !Array.isArray(data)) return persistenceErrorResponse("persistence-unavailable", 503);
    const artifacts = data.map(metadataFromDb);
    if (artifacts.some((item) => item === null)) return persistenceErrorResponse("persistence-unavailable", 503);
    return responseJson(savedArtifactListResponseSchema.parse({ artifacts }));
  } catch {
    return persistenceErrorResponse("persistence-unavailable", 503);
  }
}

export async function saveArtifact(input: unknown): Promise<Response> {
  const auth = await authenticatedClient();
  if (!auth.ok) return persistenceErrorResponse(auth.code, auth.code === "unauthenticated" ? 401 : 503);

  const validated = validateSavedArtifact(input as { kind: unknown; schemaVersion: unknown; payload?: unknown }, researchCatalog);
  if (!validated.ok) return persistenceErrorResponse(validated.code, statusForValidation(validated.code));
  const payloadBytes = serializedPayloadBytes(validated.boundArtifact);
  const limit = validated.boundArtifact.kind === "profile"
    ? SAVED_PROFILE_MAX_PAYLOAD_UTF8_BYTES
    : SAVED_RESULT_MAX_PAYLOAD_UTF8_BYTES;
  if (payloadBytes > limit) return persistenceErrorResponse("snapshot-too-large", 413);

  try {
    const { data, error } = await auth.client
      .from("saved_artifacts")
      .insert({
        owner_id: auth.userId,
        kind: validated.boundArtifact.kind,
        schema_version: validated.boundArtifact.schemaVersion,
        title: validated.title,
        payload: validated.boundArtifact.payload,
      })
      .select("id,kind,schema_version,title,created_at")
      .single();
    if (error !== null) {
      if (error.code === "P0001") return persistenceErrorResponse("snapshot-capacity-reached", 409);
      return persistenceErrorResponse("persistence-unavailable", 503);
    }
    const metadata = metadataFromDb(data);
    if (metadata === null) return persistenceErrorResponse("persistence-unavailable", 503);
    return responseJson(metadata, 201);
  } catch {
    return persistenceErrorResponse("persistence-unavailable", 503);
  }
}

export async function getSavedArtifact(id: string): Promise<Response> {
  if (!artifactIdSchema.safeParse(id).success) return persistenceErrorResponse("snapshot-not-found", 404);
  const auth = await authenticatedClient();
  if (!auth.ok) return persistenceErrorResponse(auth.code, auth.code === "unauthenticated" ? 401 : 503);
  try {
    const { data, error } = await auth.client
      .from("saved_artifacts")
      .select("id,kind,schema_version,title,payload,created_at")
      .eq("id", id)
      .eq("owner_id", auth.userId)
      .maybeSingle();
    if (error !== null) return persistenceErrorResponse("persistence-unavailable", 503);
    if (data === null) return persistenceErrorResponse("snapshot-not-found", 404);
    const row = dbRowSchema.safeParse(data);
    if (!row.success) return persistenceErrorResponse("snapshot-invalid", 422);
    const validated = validateSavedArtifact({
      kind: row.data.kind,
      schemaVersion: row.data.schema_version,
      payload: row.data.payload,
    }, researchCatalog);
    if (!validated.ok) return persistenceErrorResponse(validated.code, statusForValidation(validated.code));
    return responseJson(savedArtifactRowSchema.parse({
      id: row.data.id,
      kind: validated.boundArtifact.kind,
      schemaVersion: validated.boundArtifact.schemaVersion,
      title: validated.title,
      createdAt: row.data.created_at,
      payload: validated.boundArtifact.payload,
    }));
  } catch {
    return persistenceErrorResponse("persistence-unavailable", 503);
  }
}

export async function deleteSavedArtifact(id: string): Promise<Response> {
  if (!artifactIdSchema.safeParse(id).success) return persistenceErrorResponse("snapshot-not-found", 404);
  const auth = await authenticatedClient();
  if (!auth.ok) return persistenceErrorResponse(auth.code, auth.code === "unauthenticated" ? 401 : 503);
  try {
    const { data, error } = await auth.client
      .from("saved_artifacts")
      .delete()
      .eq("id", id)
      .eq("owner_id", auth.userId)
      .select("id")
      .maybeSingle();
    if (error !== null) return persistenceErrorResponse("persistence-unavailable", 503);
    if (data === null) return persistenceErrorResponse("snapshot-not-found", 404);
    return responseJson({ deleted: true });
  } catch {
    return persistenceErrorResponse("persistence-unavailable", 503);
  }
}
