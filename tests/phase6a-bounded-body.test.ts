import { describe, expect, it } from "vitest";

import { readSavedArtifactJson } from "@/lib/persistence/bounded-body";
import { SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES } from "@/lib/persistence/contracts";

function requestFromBytes(bytes: Uint8Array, headers: Record<string, string> = {}) {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Request("https://app.example/api/saved-artifacts", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body,
  });
}

describe("saved-artifact bounded request body", () => {
  it("accepts an exact maximum-size valid UTF-8 JSON body and rejects one byte over", async () => {
    const overhead = new TextEncoder().encode('{"x":""}').byteLength;
    const exactText = `{"x":"${"a".repeat(SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES - overhead)}"}`;
    const exactBytes = new TextEncoder().encode(exactText);
    expect(exactBytes.byteLength).toBe(SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES);
    await expect(readSavedArtifactJson(requestFromBytes(exactBytes))).resolves.toEqual({
      ok: true,
      value: { x: "a".repeat(SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES - overhead) },
    });

    const overBytes = new TextEncoder().encode(`${exactText} `);
    await expect(readSavedArtifactJson(requestFromBytes(overBytes))).resolves.toEqual({
      ok: false,
      code: "request-too-large",
    });
  });

  it("rejects invalid UTF-8 and dishonest Content-Length", async () => {
    await expect(readSavedArtifactJson(requestFromBytes(Uint8Array.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d])))).resolves.toEqual({
      ok: false,
      code: "invalid-json",
    });
    await expect(readSavedArtifactJson(requestFromBytes(new TextEncoder().encode("{}"), {
      "content-length": "3",
    }))).resolves.toEqual({ ok: false, code: "invalid-request" });
  });

  it("does not wait for a hostile cancel promise after the byte ceiling is exceeded", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(SAVED_ARTIFACT_MAX_BODY_UTF8_BYTES + 1));
      },
      cancel() {
        return new Promise<void>(() => undefined);
      },
    });
    const request = new Request("https://app.example/api/saved-artifacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const outcome = await Promise.race([
      readSavedArtifactJson(request),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);
    expect(outcome).not.toBe("timeout");
    expect(outcome).toEqual({ ok: false, code: "request-too-large" });
  });
});
