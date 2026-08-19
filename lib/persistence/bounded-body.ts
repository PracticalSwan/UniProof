import { SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES } from "./contracts";

export type SavedBodyReadResult =
  | { ok: true; value: unknown }
  | { ok: false; code: "invalid-content-type" | "request-too-large" | "invalid-json" | "invalid-request" };

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (contentType === null) return false;
  const [mediaType, ...parameters] = contentType.split(";").map((part) => part.trim().toLowerCase());
  if (mediaType !== "application/json" || parameters.length > 1) return false;
  if (parameters.length === 0) return true;
  const [name, value = ""] = parameters[0]!.split("=");
  return name === "charset" && value.replace(/^["']|["']$/gu, "") === "utf-8";
}

function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // Best effort only; cleanup must not delay the bounded sanitized failure.
  }
}

export async function readSavedArtifactJson(request: Request): Promise<SavedBodyReadResult> {
  if (request.signal.aborted) return { ok: false, code: "invalid-request" };
  if (!hasJsonContentType(request)) return { ok: false, code: "invalid-content-type" };

  const declared = request.headers.get("content-length");
  let expected: number | undefined;
  if (declared !== null) {
    if (!/^\d+$/u.test(declared)) return { ok: false, code: "invalid-request" };
    expected = Number(declared);
    if (!Number.isSafeInteger(expected)) return { ok: false, code: "invalid-request" };
    if (expected > SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES) return { ok: false, code: "request-too-large" };
  }

  if (request.body === null) return { ok: false, code: "invalid-json" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    if (request.signal.aborted) {
      cancelReader(reader);
      return { ok: false, code: "invalid-request" };
    }
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      return { ok: false, code: "invalid-request" };
    }
    if (chunk.done) break;
    if (chunk.value === undefined) continue;
    total += chunk.value.byteLength;
    if (total > SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES) {
      cancelReader(reader);
      return { ok: false, code: "request-too-large" };
    }
    chunks.push(chunk.value);
  }

  if (expected !== undefined && expected !== total) return { ok: false, code: "invalid-request" };
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, code: "invalid-json" };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, code: "invalid-json" };
  }
}
