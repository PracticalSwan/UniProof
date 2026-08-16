import "server-only";

const MAX_CONTENT_LENGTH_DIGITS = 15;

function ignoreCancellation(cancellation: Promise<void> | undefined): void {
  void cancellation?.catch(() => undefined);
}

function cancelBody(response: Response, reason: string): void {
  try {
    ignoreCancellation(response.body?.cancel(reason));
  } catch {
    // The body may already be closed or failed; bounded failure remains the
    // caller-visible result either way.
  }
}

function declaredContentLength(response: Response, maximumBytes: number): number | null | false {
  const value = response.headers.get("content-length");
  if (value === null) return null;
  const normalized = value.trim();
  if (normalized === "" || normalized.length > MAX_CONTENT_LENGTH_DIGITS || !/^\d+$/u.test(normalized)) return false;
  const length = Number(normalized);
  return Number.isSafeInteger(length) && length <= maximumBytes ? length : false;
}

export async function readBoundedText(response: Response, maximumBytes: number): Promise<string | null> {
  const declared = declaredContentLength(response, maximumBytes);
  if (declared === false) {
    cancelBody(response, "response exceeds the server byte bound");
    return null;
  }

  if (response.body === null) {
    const text = await response.text();
    return Buffer.byteLength(text, "utf8") <= maximumBytes ? text : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximumBytes) {
        ignoreCancellation(reader.cancel("response exceeds the server byte bound"));
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    try {
      ignoreCancellation(reader.cancel());
    } catch {
      // The stream is already failed; return the bounded failure below.
    }
    return null;
  } finally {
    reader.releaseLock();
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return null;
  }
}

export async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown | null> {
  const text = await readBoundedText(response, maximumBytes);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
