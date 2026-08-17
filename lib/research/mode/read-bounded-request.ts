export const RESEARCH_MODE_MAX_REQUEST_BYTES = 16 * 1024;

export type BoundedJsonReadResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      code: "invalid-content-type" | "request-too-large" | "invalid-json" | "invalid-request";
    };

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (contentType === null) return false;
  const [mediaType, ...parameters] = contentType.split(";").map((part) => part.trim().toLowerCase());
  if (mediaType !== "application/json" || parameters.length > 1) return false;
  if (parameters.length === 0) return true;
  const [name, value = ""] = parameters[0]!.split("=");
  return name === "charset" && value.replace(/^["']|["']$/gu, "") === "utf-8";
}

function bestEffortCancel(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  void reader.cancel().catch(() => undefined);
  return Promise.resolve();
}

async function readChunkOrAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let removeAbortListener: () => void = () => undefined;
  try {
    const aborted = new Promise<never>((_, reject) => {
      const abort = () => {
        void bestEffortCancel(reader);
        reject(new Error("request body read was aborted"));
      };
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      removeAbortListener = () => signal.removeEventListener("abort", abort);
    });
    const chunk = reader.read();
    void chunk.catch(() => undefined);
    return await Promise.race([chunk, aborted]);
  } finally {
    removeAbortListener();
  }
}

export async function readBoundedJsonRequest(request: Request): Promise<BoundedJsonReadResult> {
  if (request.signal.aborted) return { ok: false, code: "invalid-request" };
  if (!hasJsonContentType(request)) return { ok: false, code: "invalid-content-type" };

  const declaredLength = request.headers.get("content-length");
  let declaredByteLength: number | undefined;
  if (declaredLength !== null) {
    if (!/^\d+$/u.test(declaredLength)) return { ok: false, code: "invalid-request" };
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length)) return { ok: false, code: "invalid-request" };
    if (length > RESEARCH_MODE_MAX_REQUEST_BYTES) return { ok: false, code: "request-too-large" };
    declaredByteLength = length;
  }

  if (request.body === null) return { ok: false, code: "invalid-json" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    if (request.signal.aborted) {
      await bestEffortCancel(reader);
      return { ok: false, code: "invalid-request" };
    }

    const { done, value } = await readChunkOrAbort(reader, request.signal);
    if (done) break;
    if (value === undefined) continue;
    totalBytes += value.byteLength;
    if (totalBytes > RESEARCH_MODE_MAX_REQUEST_BYTES) {
      await bestEffortCancel(reader);
      return { ok: false, code: "request-too-large" };
    }
    chunks.push(value);
  }

  if (request.signal.aborted) return { ok: false, code: "invalid-request" };
  if (declaredByteLength !== undefined && totalBytes !== declaredByteLength) {
    return { ok: false, code: "invalid-request" };
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return { ok: false, code: "invalid-json" };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, code: "invalid-json" };
  }
}
