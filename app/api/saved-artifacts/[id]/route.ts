import {
  deleteSavedArtifact,
  getSavedArtifact,
  isAllowedPersistenceMutation,
  persistenceErrorResponse,
} from "@/lib/persistence/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return getSavedArtifact(id);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!isAllowedPersistenceMutation(request)) return persistenceErrorResponse("forbidden-origin", 403);
  const { id } = await context.params;
  return deleteSavedArtifact(id);
}
