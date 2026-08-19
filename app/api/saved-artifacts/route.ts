import { readSavedArtifactJson } from "@/lib/persistence/bounded-body";
import {
  isAllowedPersistenceMutation,
  listSavedArtifacts,
  persistenceErrorResponse,
  saveArtifact,
} from "@/lib/persistence/server";

export async function GET(request: Request): Promise<Response> {
  return listSavedArtifacts(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPersistenceMutation(request)) return persistenceErrorResponse("forbidden-origin", 403);
  const body = await readSavedArtifactJson(request);
  if (!body.ok) return persistenceErrorResponse(body.code, body.code === "request-too-large" ? 413 : body.code === "invalid-content-type" ? 415 : 400);
  return saveArtifact(body.value);
}
