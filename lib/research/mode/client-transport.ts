import {
  canonicalizeResearchModeCategories,
  researchModeResponseSchema,
  type PublicResearchTransportError,
  type ResearchDossier,
  type ResearchModeRequest,
} from "./public-contracts";

export type ResearchClientTransportResult =
  | { kind: "dossier"; dossier: ResearchDossier }
  | { kind: "server-error"; error: PublicResearchTransportError }
  | { kind: "network-error"; error: { code: "network-error"; message: string } }
  | { kind: "invalid-response"; error: { code: "invalid-response"; message: string } }
  | { kind: "cancelled" };

export const RESEARCH_CLIENT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const INVALID_RESPONSE_MESSAGE =
  "The research response could not be safely validated for display.";
const NETWORK_ERROR_MESSAGE =
  "The research request could not be sent. Check the connection and try again.";

function invalidResponse(): ResearchClientTransportResult {
  return {
    kind: "invalid-response",
    error: { code: "invalid-response", message: INVALID_RESPONSE_MESSAGE },
  };
}

function networkError(): ResearchClientTransportResult {
  return {
    kind: "network-error",
    error: { code: "network-error", message: NETWORK_ERROR_MESSAGE },
  };
}

function isJsonContentType(response: Response): boolean {
  const contentType = response.headers.get("content-type");
  if (contentType === null) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

function declaredLengthWithinBound(response: Response): boolean {
  const declared = response.headers.get("content-length");
  if (declared === null) return true;
  const length = Number(declared);
  return Number.isFinite(length) && length >= 0 && length <= RESEARCH_CLIENT_MAX_RESPONSE_BYTES;
}

function responseMatchesSubmittedRequest(
  dossier: ResearchDossier,
  request: ResearchModeRequest,
): boolean {
  if (dossier.target.university.id !== request.universityId) return false;
  if (request.programId === undefined) {
    if (dossier.target.program !== undefined) return false;
  } else {
    if (dossier.target.program?.id !== request.programId) return false;
  }

  const dossierCategories = canonicalizeResearchModeCategories(
    dossier.categories.map((row) => row.category),
  );
  return dossierCategories.length === request.categories.length &&
    dossierCategories.every((category, index) => category === request.categories[index]);
}

export async function executeResearchRequest(
  request: ResearchModeRequest,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ResearchClientTransportResult> {
  if (signal.aborted) return { kind: "cancelled" };

  let response: Response;
  try {
    response = await fetchImpl("/api/research", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    return signal.aborted ? { kind: "cancelled" } : networkError();
  }

  if (signal.aborted) return { kind: "cancelled" };

  if (!isJsonContentType(response) || !declaredLengthWithinBound(response)) {
    return invalidResponse();
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    return signal.aborted ? { kind: "cancelled" } : networkError();
  }

  if (signal.aborted) return { kind: "cancelled" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return invalidResponse();
  }

  const envelope = researchModeResponseSchema.safeParse(parsed);
  if (!envelope.success) return invalidResponse();

  const httpOk = response.status >= 200 && response.status < 300;
  if (envelope.data.ok !== httpOk) return invalidResponse();

  if (signal.aborted) return { kind: "cancelled" };

  if (envelope.data.ok === false) {
    return { kind: "server-error", error: envelope.data.error };
  }

  if (!responseMatchesSubmittedRequest(envelope.data.dossier, request)) {
    return invalidResponse();
  }

  if (signal.aborted) return { kind: "cancelled" };

  return { kind: "dossier", dossier: envelope.data.dossier };
}
