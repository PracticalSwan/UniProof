import {
  isAllowedPersistenceMutation,
  listSavedArtifacts,
  persistenceErrorResponse,
  saveArtifactRequest,
} from "@/lib/persistence/server";

export async function GET(request: Request): Promise<Response> {
  return listSavedArtifacts(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPersistenceMutation(request)) return persistenceErrorResponse("forbidden-origin", 403);
  return saveArtifactRequest(request);
}
