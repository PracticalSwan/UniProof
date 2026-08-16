import "server-only";

import http from "node:http";
import https from "node:https";
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from "node:http";
import { isIP } from "node:net";

import {
  RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES,
  RESEARCH_CONNECT_TIMEOUT_MS,
  RESEARCH_MAX_REDIRECTS,
  RESEARCH_MAX_RESPONSE_BYTES,
  RESEARCH_REQUEST_TIMEOUT_MS,
} from "@/lib/security/research-limits";
import {
  type OutboundDnsResolver,
  type OutboundResolvedAddress,
  type OutboundUrlValidation,
  validateOutboundUrlAtResolutionTime,
  validateRedirectTarget,
} from "@/lib/security/outbound-url";
import type {
  PinnedTransportTarget,
  RetrievalFailure,
  RetrievalHeaderName,
  RetrievalResult,
  RetrievedResponse,
  SafeResponseHeaders,
} from "./types";

type RequestFailure = {
  code: RetrievalFailure["code"];
  message: string;
};

type HopResult =
  | {
      ok: true;
      kind: "response";
      statusCode: number;
      headers: SafeResponseHeaders;
      contentType: "text/html" | "text/plain" | "application/pdf";
      bytes: Uint8Array;
      retrievedBytes: number;
    }
  | {
      ok: true;
      kind: "redirect";
      statusCode: number;
      location?: string;
    }
  | {
      ok: false;
      failure: RequestFailure;
    };

type RequestOptions = {
  deadline: number;
  signal?: AbortSignal;
};

const REQUEST_USER_AGENT = "UniProof/0.1 research-retrieval";
const REQUEST_ACCEPT = "text/html, text/plain, application/pdf";
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const SAFE_RESPONSE_HEADERS: readonly RetrievalHeaderName[] = [
  "content-type",
  "content-length",
  "content-encoding",
  "last-modified",
  "etag",
];

function safeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      parsed.username = "";
      parsed.password = "";
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }
  } catch {
    // Do not echo malformed input.
  }
  return "<unparseable outbound URL>";
}

function failure(code: RetrievalFailure["code"], message: string, url: string): RetrievalFailure {
  return { ok: false, code, message, safeUrl: safeUrl(url) };
}

function normalizeIp(value: string): string {
  const stripped = value.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(stripped) !== 6) return stripped;
  const [head, tail] = stripped.split("::");
  const parsePart = (part: string, embeddedIpv4 = false): number[] => {
    if (part === "") return [];
    return part.split(":").flatMap((piece, index, pieces) => {
      if (embeddedIpv4 && index === pieces.length - 1 && piece.includes(".")) {
        const octets = piece.split(".").map(Number);
        return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
      }
      return [Number.parseInt(piece || "0", 16)];
    });
  };
  const headGroups = parsePart(head ?? "", false);
  const tailGroups = parsePart(tail ?? "", true);
  const groups = stripped.includes("::")
    ? [...headGroups, ...Array.from({ length: Math.max(0, 8 - headGroups.length - tailGroups.length) }, () => 0), ...tailGroups]
    : parsePart(stripped, true);
  return groups.slice(0, 8).map((group) => group.toString(16).padStart(4, "0")).join(":");
}

function addressesMatch(actual: string | undefined, expected: OutboundResolvedAddress): boolean {
  if (actual === undefined) return false;
  return normalizeIp(actual) === normalizeIp(expected.address);
}

function familyMatches(actual: string | number | undefined, expected: 4 | 6): boolean {
  if (actual === expected) return true;
  return expected === 4 ? actual === "IPv4" : actual === "IPv6";
}

export function selectPinnedAddress(addresses: readonly OutboundResolvedAddress[]): OutboundResolvedAddress | null {
  const ordered = [...addresses].sort((left, right) => {
    if (left.family !== right.family) return left.family === 4 ? -1 : 1;
    return normalizeIp(left.address).localeCompare(normalizeIp(right.address));
  });
  return ordered[0] ?? null;
}

function headerValue(headers: IncomingHttpHeaders, name: RetrievalHeaderName): string | undefined {
  const value = headers[name];
  if (Array.isArray(value) || value === undefined) return value === undefined ? undefined : "";
  return value;
}

function parseContentType(value: string | undefined): "text/html" | "text/plain" | "application/pdf" | null {
  if (value === undefined || value.trim() === "") return null;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES.includes(mediaType)
    ? (mediaType as "text/html" | "text/plain" | "application/pdf")
    : null;
}

function safeHeaders(headers: IncomingHttpHeaders): SafeResponseHeaders {
  const safe: SafeResponseHeaders = {};
  for (const name of SAFE_RESPONSE_HEADERS) {
    const value = headerValue(headers, name);
    if (value !== undefined && value !== "") safe[name] = value.slice(0, 2_000);
  }
  return safe;
}

function requestPinned(
  target: PinnedTransportTarget,
  options: RequestOptions,
): Promise<HopResult> {
  const parsed = new URL(target.canonicalUrl);
  const selected = target.selectedAddress;
  const transport = parsed.protocol === "https:" ? https : http;
  const transportHostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const remaining = Math.max(1, options.deadline - Date.now());
  const requestOptions: https.RequestOptions & { autoSelectFamily?: boolean } = {
    protocol: parsed.protocol,
    hostname: transportHostname,
    port: parsed.port === "" ? undefined : Number(parsed.port),
    path: `${parsed.pathname || "/"}${parsed.search}`,
    method: "GET",
    agent: false,
    family: selected.family,
    autoSelectFamily: false,
    lookup: (hostname, _lookupOptions, callback) => {
      if (hostname.toLowerCase() !== transportHostname.toLowerCase()) {
        callback(new Error("validated hostname mismatch"), "0.0.0.0", 4);
        return;
      }
      callback(null, selected.address, selected.family);
    },
    headers: {
      "User-Agent": REQUEST_USER_AGENT,
      Accept: REQUEST_ACCEPT,
      "Accept-Encoding": "identity",
      Connection: "close",
      Host: parsed.host,
    },
  };
  if (parsed.protocol === "https:") {
    requestOptions.rejectUnauthorized = true;
    // A DNS hostname needs its original name for certificate/SNI identity;
    // an IP-literal must explicitly disable SNI rather than letting the
    // transport infer a name from the selected address.
    requestOptions.servername = target.addressFamily === null ? parsed.hostname : "";
  }

  return new Promise((resolve) => {
    let settled = false;
    let connected = false;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    let request: ClientRequest | undefined;
    const onAbort = () => {
      if (settled) return;
      request?.destroy();
      finish({ ok: false, failure: { code: "cancelled", message: "source request was cancelled" } });
    };

    const finish = (result: HopResult) => {
      if (settled) return;
      settled = true;
      if (connectTimer !== undefined) clearTimeout(connectTimer);
      if (requestTimer !== undefined) clearTimeout(requestTimer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const destroyWithFailure = (failureValue: RequestFailure) => {
      if (!settled) {
        request?.destroy();
        finish({ ok: false, failure: failureValue });
      }
    };
    if (options.signal?.aborted) {
      finish({ ok: false, failure: { code: "cancelled", message: "source request was cancelled" } });
      return;
    }
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const markConnected = (socket: { remoteAddress?: string; remoteFamily?: string | number }) => {
      if (connected || settled) return;
      connected = true;
      if (connectTimer !== undefined) clearTimeout(connectTimer);
      if (!addressesMatch(socket.remoteAddress, selected) || !familyMatches(socket.remoteFamily, selected.family)) {
        destroyWithFailure({ code: "connection-mismatch", message: "connected endpoint did not match the validated address" });
      }
    };

    try {
      request = transport.request(requestOptions, (response: IncomingMessage) => {
        const statusCode = response.statusCode ?? 0;
        if (REDIRECT_STATUS_CODES.has(statusCode)) {
          const location = headerValue(response.headers, "location" as RetrievalHeaderName);
          const redirectResult: HopResult = {
            ok: true,
            kind: "redirect",
            statusCode,
            ...(location === undefined || location === "" ? {} : { location }),
          };
          const finishRedirect = () => finish(redirectResult);
          response.once("close", finishRedirect);
          response.once("end", finishRedirect);
          response.resume();
          response.destroy();
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          finish({ ok: false, failure: { code: "http-status", message: "source returned an unsupported HTTP status" } });
          return;
        }

        const contentType = parseContentType(headerValue(response.headers, "content-type"));
        if (contentType === null) {
          response.resume();
          finish({ ok: false, failure: { code: "missing-content-type", message: "source did not return an allowed content type" } });
          return;
        }
        const contentEncoding = headerValue(response.headers, "content-encoding");
        if (contentEncoding !== undefined && contentEncoding.trim().toLowerCase() !== "identity") {
          response.resume();
          finish({ ok: false, failure: { code: "unsupported-content-encoding", message: "source returned a non-identity content encoding" } });
          return;
        }
        const contentLength = headerValue(response.headers, "content-length");
        if (contentLength === "") {
          response.resume();
          finish({ ok: false, failure: { code: "response-too-large", message: "source returned an ambiguous content length" } });
          return;
        }
        if (contentLength !== undefined && contentLength !== "") {
          const normalizedLength = contentLength.trim();
          const numericLength = Number(normalizedLength);
          if (!/^\d+$/u.test(normalizedLength) || !Number.isSafeInteger(numericLength) || numericLength < 0 || numericLength > RESEARCH_MAX_RESPONSE_BYTES) {
            response.resume();
            finish({ ok: false, failure: { code: "response-too-large", message: "source response exceeds the byte bound" } });
            return;
          }
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.byteLength;
          if (bytes > RESEARCH_MAX_RESPONSE_BYTES) {
            response.destroy();
            destroyWithFailure({ code: "response-too-large", message: "source response exceeds the byte bound" });
            return;
          }
          chunks.push(buffer);
        });
        response.once("error", () => {
          finish({ ok: false, failure: { code: "transport", message: "source response failed" } });
        });
        response.once("end", () => {
          finish({
            ok: true,
            kind: "response",
            statusCode,
            headers: safeHeaders(response.headers),
            contentType,
            bytes: Buffer.concat(chunks),
            retrievedBytes: bytes,
          });
        });
      });
      request.once("error", (error: NodeJS.ErrnoException) => {
        if (settled) return;
        const code = error?.code === "ETIMEDOUT" ? "connect-timeout" : "transport";
        finish({ ok: false, failure: { code, message: code === "connect-timeout" ? "source connection timed out" : "source request failed" } });
      });
      request.once("socket", (socket) => {
        connectTimer = setTimeout(() => {
          destroyWithFailure({ code: "connect-timeout", message: "source connection timed out" });
        }, Math.min(RESEARCH_CONNECT_TIMEOUT_MS, remaining));
        socket.once("connect", () => markConnected(socket));
        socket.once("secureConnect", () => markConnected(socket));
      });
      requestTimer = setTimeout(() => {
        destroyWithFailure({ code: "request-timeout", message: "source request timed out" });
      }, remaining);
      request.end();
    } catch {
      finish({ ok: false, failure: { code: "transport", message: "source request failed" } });
    }
  });
}

export async function requestPinnedTransport(
  target: PinnedTransportTarget,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<HopResult> {
  return requestPinned(target, {
    deadline: Date.now() + (options.timeoutMs ?? RESEARCH_REQUEST_TIMEOUT_MS),
    signal: options.signal,
  });
}

function mapValidationFailure(validation: Exclude<OutboundUrlValidation, { valid: true }>, rawUrl: string): RetrievalFailure {
  if (validation.reason.startsWith("dns-")) return failure("dns-failed", "source DNS validation failed", rawUrl);
  if (validation.reason === "blocked-hostname" || validation.reason === "blocked-ip-address") return failure("blocked-target", "source target is blocked by outbound policy", rawUrl);
  return failure("invalid-url", "source URL is not valid for retrieval", rawUrl);
}

async function withDeadline<T>(
  operation: Promise<T>,
  deadline: number,
  signal?: AbortSignal,
): Promise<T | undefined> {
  const remaining = deadline - Date.now();
  if (remaining <= 0 || signal?.aborted) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), remaining);
  });
  const cancellation = new Promise<undefined>((resolve) => {
    if (signal === undefined) return;
    onAbort = () => resolve(undefined);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([operation, timeout, cancellation]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort !== undefined) signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchPublicUrl(
  rawUrl: string,
  options: {
    dnsResolver?: OutboundDnsResolver;
    maxRedirects?: number;
    signal?: AbortSignal;
  } = {},
): Promise<RetrievalResult> {
  const originalUrl = rawUrl;
  if (options.signal?.aborted) return failure("cancelled", "source request was cancelled", rawUrl);
  const deadline = Date.now() + RESEARCH_REQUEST_TIMEOUT_MS;
  let currentUrl = rawUrl;
  let redirectCount = 0;
  const redirectChain: string[] = [];
  const seen = new Set<string>();
  const pinnedAddresses: OutboundResolvedAddress[] = [];
  const maxRedirects = options.maxRedirects ?? RESEARCH_MAX_REDIRECTS;

  while (true) {
    if (options.signal?.aborted) return failure("cancelled", "source request was cancelled", currentUrl);
    if (Date.now() >= deadline) return failure("request-timeout", "source request timed out", currentUrl);
    const validation = await withDeadline(
      validateOutboundUrlAtResolutionTime(currentUrl, { allowHttp: true, dnsResolver: options.dnsResolver }),
      deadline,
      options.signal,
    );
    if (validation === undefined) {
      return options.signal?.aborted
        ? failure("cancelled", "source request was cancelled", currentUrl)
        : failure("request-timeout", "source request timed out", currentUrl);
    }
    if (!validation.valid) return mapValidationFailure(validation, currentUrl);
    if (seen.has(validation.canonicalUrl)) return failure("redirect-loop", "source redirect loop detected", currentUrl);
    seen.add(validation.canonicalUrl);
    const selectedAddress = selectPinnedAddress(validation.resolvedAddresses);
    if (selectedAddress === null) return failure("dns-failed", "source did not resolve to a usable address", currentUrl);
    const hostnameWithoutBrackets = validation.hostname.replace(/^\[|\]$/g, "");
    const addressFamily = isIP(hostnameWithoutBrackets) === 4 ? 4 : isIP(hostnameWithoutBrackets) === 6 ? 6 : null;
    const target: PinnedTransportTarget = { ...validation, selectedAddress, addressFamily };
    pinnedAddresses.push(selectedAddress);
    const hop = await requestPinned(target, { deadline, signal: options.signal });
    if (!hop.ok) return failure(hop.failure.code, hop.failure.message, currentUrl);
    if (hop.kind === "response") {
      return {
        ok: true,
        originalUrl,
        finalUrl: validation.canonicalUrl,
        canonicalUrl: validation.canonicalUrl,
        redirectChain,
        headers: hop.headers,
        contentType: hop.contentType,
        bytes: hop.bytes,
        retrievedBytes: hop.retrievedBytes,
        retrievedAt: new Date().toISOString(),
        pinnedAddresses,
      } satisfies RetrievedResponse;
    }

    if (hop.location === undefined || hop.location.length === 0) return failure("redirect", "source redirect did not include a valid location", currentUrl);
    if (redirectCount >= maxRedirects) return failure("redirect", "source redirect limit exceeded", currentUrl);
    const next = await withDeadline(
      validateRedirectTarget(currentUrl, hop.location, redirectCount, {
        allowHttp: true,
        dnsResolver: options.dnsResolver,
        maxRedirects,
      }),
      deadline,
      options.signal,
    );
    if (next === undefined) {
      return options.signal?.aborted
        ? failure("cancelled", "source request was cancelled", currentUrl)
        : failure("request-timeout", "source request timed out", currentUrl);
    }
    if (!next.valid) return mapValidationFailure(next, currentUrl);
    if (validation.protocol === "https:" && next.protocol === "http:") {
      return failure("redirect-downgrade", "HTTPS to HTTP redirects are blocked", currentUrl);
    }
    redirectCount += 1;
    redirectChain.push(next.canonicalUrl);
    currentUrl = next.canonicalUrl;
  }
}

export const retrievePublicUrl = fetchPublicUrl;
export const fetchPublic = fetchPublicUrl;
export { requestPinned as requestValidatedTarget };
