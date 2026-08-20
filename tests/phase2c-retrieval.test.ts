import http from "node:http";

import { describe, expect, it } from "vitest";

import { normalizeRetrievedDocument } from "@/lib/research/normalization/document";
import { normalizeHtml } from "@/lib/research/normalization/html";
import { normalizePlainText } from "@/lib/research/normalization/plain-text";
import { runDiscoveryRetrieval } from "@/lib/research/pipeline";
import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { requestPinnedTransport } from "@/lib/research/retrieval/fetch-public";
import type { PinnedTransportTarget, RetrievedResponse } from "@/lib/research/retrieval/types";
import { fetchPublicUrl } from "@/lib/research/retrieval/fetch-public";
import { RESEARCH_MAX_RESPONSE_BYTES } from "@/lib/security/research-limits";
import { validateRedirectTarget } from "@/lib/security/outbound-url";
import type { CandidateSource } from "@/lib/research/contracts";

function localTarget(port: number, path = "/"): PinnedTransportTarget {
  const url = `http://127.0.0.1:${port}${path}`;
  return {
    valid: true,
    url,
    canonicalUrl: url,
    hostname: "127.0.0.1",
    protocol: "http:",
    addressFamily: 4,
    literalAddress: "127.0.0.1",
    resolvedAddresses: [{ address: "127.0.0.1", family: 4 }],
    validationScope: "dns-resolution-time",
    selectedAddress: { address: "127.0.0.1", family: 4 },
  };
}

async function withServer(handler: http.RequestListener, callback: (port: number) => Promise<void>) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server did not bind");
  try {
    await callback(address.port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Phase 2C retrieval and normalization", () => {
  it("pins a local test-only validated target and isolates request headers", async () => {
    await withServer((request, response) => {
      expect(request.headers.authorization).toBeUndefined();
      expect(request.headers.cookie).toBeUndefined();
      expect(request.headers["accept-encoding"]).toBe("identity");
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Set-Cookie": "secret=never-replayed", "X-Private-Debug": "must-not-survive" });
      response.end("bounded source text");
    }, async (port) => {
      const result = await requestPinnedTransport(localTarget(port));
      expect(result.ok).toBe(true);
      if (result.ok && result.kind === "response") {
        expect(Buffer.from(result.bytes).toString("utf8")).toBe("bounded source text");
        expect((result.headers as Record<string, string | undefined>)["set-cookie"]).toBeUndefined();
        expect((result.headers as Record<string, string | undefined>)["x-private-debug"]).toBeUndefined();
      }
    });
  });

  it("rejects loopback DNS results before the pinned transport is reached", async () => {
    const result = await fetchPublicUrl("https://public.example/research", {
      dnsResolver: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("blocked-target");
  });

  it("cuts off a response declared above the server-owned byte bound", async () => {
    await withServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain", "Content-Length": String(RESEARCH_MAX_RESPONSE_BYTES + 1) });
      response.end("too large");
    }, async (port) => {
      const result = await requestPinnedTransport(localTarget(port));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe("response-too-large");
    });
  });

  it("cuts off a streamed response that crosses the byte bound without a Content-Length", async () => {
    await withServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.write(Buffer.alloc(RESEARCH_MAX_RESPONSE_BYTES, 0x61));
      response.end("b");
    }, async (port) => {
      const result = await requestPinnedTransport(localTarget(port));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe("response-too-large");
    });
  });

  it("enforces the overall request deadline on a stalled response body", async () => {
    await withServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.write("partial");
      setTimeout(() => response.end("late"), 100);
    }, async (port) => {
      const result = await requestPinnedTransport(localTarget(port), { timeoutMs: 20 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe("request-timeout");
    });
  });

  it("revalidates a redirect destination and rejects a private second-hop address", async () => {
    const result = await validateRedirectTarget(
      "https://public.example/start",
      "https://private.example/next",
      0,
      {
        allowHttp: true,
        dnsResolver: async (hostname) => hostname === "private.example"
          ? [{ address: "127.0.0.1", family: 4 as const }]
          : [{ address: "93.184.216.34", family: 4 as const }],
      },
    );
    expect(result).toMatchObject({ valid: false, reason: "blocked-ip-address" });
  });

  it("sanitizes retrieval failure URLs to origin-level information", async () => {
    const result = await fetchPublicUrl("https://user:pass@public.example/private/path?marker=sensitive-value#fragment");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.safeUrl).toBe("https://public.example/");
      expect(JSON.stringify(result)).not.toContain("sensitive-value");
      expect(JSON.stringify(result)).not.toContain("private/path");
    }
  });

  it("fails closed on missing MIME and non-identity content encoding", async () => {
    await withServer((_request, response) => {
      response.writeHead(200);
      response.end("missing type");
    }, async (port) => {
      const result = await requestPinnedTransport(localTarget(port));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe("missing-content-type");
    });

    await withServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain", "Content-Encoding": "gzip" });
      response.end("compressed marker");
    }, async (port) => {
      const result = await requestPinnedTransport(localTarget(port));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe("unsupported-content-encoding");
    });
  });

  it("normalizes executable HTML noise while preserving factual structure", () => {
    const normalized = normalizeHtml("<nav>Ignore</nav><h1>Admissions</h1><p>Deadline: 1 June 2027</p><script>alert(1)</script><table><tr><td>Tuition</td><td>$12,000</td></tr></table>");
    expect(normalized.text).toContain("Admissions");
    expect(normalized.text).toContain("Deadline: 1 June 2027");
    expect(normalized.text).toContain("$12,000");
    expect(normalized.text).toContain("Tuition | $12,000");
    expect(normalized.text).not.toContain("alert");
    expect(normalized.text).not.toContain("Ignore");
  });

  it("normalizes deeply nested bounded HTML without exhausting the JavaScript stack", () => {
    const depth = 12_000;
    const nestedBlock = `${"<div>".repeat(depth)}<p>Deep requirement</p>${"</div>".repeat(depth)}`;
    const nestedHeading = `<h1>${"<span>".repeat(depth)}Admissions${"</span>".repeat(depth)}</h1>`;

    expect(normalizeHtml(nestedBlock).text).toContain("Deep requirement");
    expect(normalizeHtml(nestedHeading).text).toContain("Admissions");
  });

  it("normalizes plain text deterministically and refuses PDF promotion", () => {
    const plain = normalizePlainText("  First line\r\n\r\n\r\nSecond\tline  ");
    expect(plain.text).toBe("First line\n\nSecond line");
    const candidate: CandidateSource = {
      url: "https://example.edu/guide",
      title: "Guide",
      publisher: "Example University",
      domain: "example.edu",
      sourceType: "university",
      discoveryProvider: "direct",
    };
    const response: RetrievedResponse = {
      ok: true,
      originalUrl: candidate.url,
      finalUrl: candidate.url,
      canonicalUrl: candidate.url,
      redirectChain: [],
      headers: { "content-type": "application/pdf" },
      contentType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF fake"),
      retrievedBytes: 9,
      retrievedAt: "2026-08-16T00:00:00.000Z",
      pinnedAddresses: [{ address: "93.184.216.34", family: 4 }],
    };
    expect(normalizeRetrievedDocument(candidate, response)).toMatchObject({ ok: false, code: "unsupported-pdf-normalizer" });
    expect(normalizePlainText("abcdefghij", { maxCharacters: 5 })).toMatchObject({ text: "abcde", truncated: true });
  });

  it("runs the offline discovery-to-document path without AI or provider keys", async () => {
    const candidate = {
      url: "https://example.edu/admissions",
      title: "Admissions",
      publisher: "Example University",
      domain: "example.edu",
      sourceType: "university" as const,
      discoveryProvider: "tavily",
      discoveryQueryId: "category-admissions",
      requestedCategory: "admissions" as const,
    };
    const result = await runDiscoveryRetrieval(
      {
        target: { university: { name: "Example University" } },
        categories: ["admissions"],
      },
      {
        runId: "integration-run",
        now: () => "2026-08-16T00:00:00.000Z",
        discovery: {
          tavilySearch: async () => ({ outcome: "success", candidates: [candidate], retryCount: 0 }),
          braveSearch: async () => ({ outcome: "success", candidates: [], retryCount: 0 }),
        },
        retrieve: async () => ({
          ok: true,
          originalUrl: candidate.url,
          finalUrl: candidate.url,
          canonicalUrl: candidate.url,
          redirectChain: [],
          headers: { "content-type": "text/html; charset=utf-8" },
          contentType: "text/html",
          bytes: new TextEncoder().encode("<h1>Admissions</h1><p>English requirement: IELTS 6.5</p>"),
          retrievedBytes: 58,
          retrievedAt: "2026-08-16T00:00:00.000Z",
          pinnedAddresses: [{ address: "93.184.216.34", family: 4 }],
        }),
      },
    );
    expect(result.run.id).toBe("integration-run");
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.normalizedText).toContain("IELTS 6.5");
    expect(result.evidenceSummary.categoriesProcessed).toEqual([]);
    expect(result.evidenceSummary.categoriesUnprocessed).toEqual(["admissions"]);
  });

  it("keeps retrieval and uncovered-category failures inside the result contract bound", async () => {
    const candidates = Array.from({ length: 12 }, (_, index) => normalizeCandidateSource(
      {
        url: `https://source-${index}.example.edu/admissions`,
        title: `Source ${index}`,
        sourceType: "independent",
      },
      {
        discoveryProvider: "tavily",
        requestedCategory: "admissions",
        discoveryQueryId: "category-admissions",
        discoveredAt: "2026-08-16T00:00:00.000Z",
      },
    )).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    const result = await runDiscoveryRetrieval(
      {
        target: { university: { name: "Example University" } },
        categories: ["admissions", "tuition", "scholarships", "program-structure", "research", "outcomes", "support"],
      },
      {
        discovery: {
          tavilySearch: async (query) => query.category === "admissions"
            ? { outcome: "success", candidates, retryCount: 0 }
            : { outcome: "empty", candidates: [], retryCount: 0 },
          braveSearch: async () => ({ outcome: "empty", candidates: [], retryCount: 0 }),
          enableRor: false,
        },
        retrieve: async () => ({
          ok: false,
          code: "http-status",
          message: "test failure",
          safeUrl: "https://source.example.edu/",
        }),
      },
    );
    expect(result.failures).toHaveLength(18);
    expect(result.evidenceSummary.categoriesFailed).toEqual([
      "admissions", "tuition", "scholarships", "program-structure", "research", "outcomes", "support",
    ]);
    expect(result.failures.every((failure) => failure.message.length < 500)).toBe(true);
  });

  it("deduplicates normalized documents by canonical URL and content hash", async () => {
    const candidates = ["https://a.example.edu/page", "https://b.example.edu/page"].map((url) => ({
      url,
      title: "Admissions",
      sourceType: "university" as const,
      discoveryProvider: "tavily",
      requestedCategory: "admissions" as const,
    }));
    const result = await runDiscoveryRetrieval(
      { target: { university: { name: "Example University" } }, categories: ["admissions"] },
      {
        discovery: {
          tavilySearch: async () => ({ outcome: "success", candidates, retryCount: 0 }),
        },
        retrieve: async (url) => ({
          ok: true,
          originalUrl: url,
          finalUrl: url,
          canonicalUrl: url,
          redirectChain: [],
          headers: { "content-type": "text/plain; charset=utf-8" },
          contentType: "text/plain" as const,
          bytes: new TextEncoder().encode("same normalized content"),
          retrievedBytes: 23,
          retrievedAt: "2026-08-16T00:00:00.000Z",
          pinnedAddresses: [{ address: "93.184.216.34", family: 4 as const }],
        }),
      },
    );
    expect(result.sources).toHaveLength(1);
    expect(result.documents).toHaveLength(1);
    expect(result.failures.some((failure) => failure.code === "source-limit")).toBe(true);
  });
});
