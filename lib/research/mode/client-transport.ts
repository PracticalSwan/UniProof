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
  | { kind: "deployment-rate-limit"; error: { code: "deployment-rate-limit"; message: string } }
  | { kind: "deployment-timeout"; error: { code: "deployment-timeout"; message: string } }
  | { kind: "network-error"; error: { code: "network-error"; message: string } }
  | { kind: "invalid-response"; error: { code: "invalid-response"; message: string } }
  | { kind: "cancelled" };

export const RESEARCH_CLIENT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const INVALID_RESPONSE_MESSAGE =
  "The research response could not be safely validated for display.";
const NETWORK_ERROR_MESSAGE =
  "The research request could not be sent. Check the connection and try again.";
const DEPLOYMENT_RATE_LIMIT_MESSAGE =
  "The deployment is temporarily limiting research requests. Try again explicitly in a moment.";
const DEPLOYMENT_TIMEOUT_MESSAGE =
  "The deployment timed out before the research request completed. Try again explicitly.";

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

type BoundedResponseTextResult =
  | { ok: true; text: string }
  | { ok: false; kind: "cancelled" | "invalid-response" | "network-error" };

function cancelReaderBestEffort(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // Cleanup must never replace the sanitized transport outcome.
  }
}

function cancelResponseBodyBestEffort(response: Response): void {
  try {
    if (response.body !== null) {
      void response.body.cancel().catch(() => undefined);
    }
  } catch {
    // Cleanup must never replace the sanitized transport outcome.
  }
}

async function readChunkWithSignal(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<
  | { kind: "chunk"; result: ReadableStreamReadResult<Uint8Array> }
  | { kind: "cancelled" }
  | { kind: "network-error" }
> {
  if (signal.aborted) {
    cancelReaderBestEffort(reader);
    return { kind: "cancelled" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      value:
        | { kind: "chunk"; result: ReadableStreamReadResult<Uint8Array> }
        | { kind: "cancelled" }
        | { kind: "network-error" },
    ) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => {
      cancelReaderBestEffort(reader);
      finish({ kind: "cancelled" });
    };

    signal.addEventListener("abort", onAbort, { once: true });
    void reader.read().then(
      (result) => {
        if (signal.aborted) {
          cancelReaderBestEffort(reader);
          finish({ kind: "cancelled" });
          return;
        }
        finish({ kind: "chunk", result });
      },
      () => {
        if (signal.aborted) {
          cancelReaderBestEffort(reader);
          finish({ kind: "cancelled" });
          return;
        }
        finish({ kind: "network-error" });
      },
    );
  });
}

async function readBoundedResearchResponseText(
  response: Response,
  signal: AbortSignal,
): Promise<BoundedResponseTextResult> {
  if (signal.aborted) return { ok: false, kind: "cancelled" };

  if (response.body === null || response.body === undefined) {
    try {
      const text = await response.text();
      if (signal.aborted) return { ok: false, kind: "cancelled" };
      if (new TextEncoder().encode(text).byteLength > RESEARCH_CLIENT_MAX_RESPONSE_BYTES) {
        return { ok: false, kind: "invalid-response" };
      }
      return { ok: true, text };
    } catch {
      return signal.aborted
        ? { ok: false, kind: "cancelled" }
        : { ok: false, kind: "network-error" };
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";

  while (true) {
    const chunk = await readChunkWithSignal(reader, signal);
    if (chunk.kind !== "chunk") {
      return { ok: false, kind: chunk.kind };
    }
    if (signal.aborted) {
      cancelReaderBestEffort(reader);
      return { ok: false, kind: "cancelled" };
    }
    if (chunk.result.done) {
      try {
        text += decoder.decode();
      } catch {
        cancelReaderBestEffort(reader);
        return { ok: false, kind: "invalid-response" };
      }
      return signal.aborted
        ? { ok: false, kind: "cancelled" }
        : { ok: true, text };
    }

    totalBytes += chunk.result.value.byteLength;
    if (totalBytes > RESEARCH_CLIENT_MAX_RESPONSE_BYTES) {
      cancelReaderBestEffort(reader);
      return { ok: false, kind: "invalid-response" };
    }

    try {
      text += decoder.decode(chunk.result.value, { stream: true });
    } catch {
      cancelReaderBestEffort(reader);
      return { ok: false, kind: "invalid-response" };
    }
  }
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

  if (response.status === 429) {
    cancelResponseBodyBestEffort(response);
    return {
      kind: "deployment-rate-limit",
      error: { code: "deployment-rate-limit", message: DEPLOYMENT_RATE_LIMIT_MESSAGE },
    };
  }
  if (response.status === 504) {
    cancelResponseBodyBestEffort(response);
    return {
      kind: "deployment-timeout",
      error: { code: "deployment-timeout", message: DEPLOYMENT_TIMEOUT_MESSAGE },
    };
  }

  if (!isJsonContentType(response) || !declaredLengthWithinBound(response)) {
    cancelResponseBodyBestEffort(response);
    return invalidResponse();
  }

  const bodyResult = await readBoundedResearchResponseText(response, signal);
  if (!bodyResult.ok) {
    if (bodyResult.kind === "cancelled") return { kind: "cancelled" };
    if (bodyResult.kind === "network-error") return networkError();
    return invalidResponse();
  }

  if (signal.aborted) return { kind: "cancelled" };

  let parsed: unknown;
  const body = bodyResult.text;
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
