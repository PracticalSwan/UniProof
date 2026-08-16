import type { OutboundResolvedAddress, OutboundUrlValidation } from "@/lib/security/outbound-url";

export type RetrievalHeaderName = "content-type" | "content-length" | "content-encoding" | "last-modified" | "etag";

export type SafeResponseHeaders = Partial<Record<RetrievalHeaderName, string>>;

export type PinnedTransportTarget = Extract<OutboundUrlValidation, { valid: true }> & {
  selectedAddress: OutboundResolvedAddress;
  addressFamily: 4 | 6 | null;
  literalAddress?: string | null;
};

export type RetrievedResponse = {
  ok: true;
  originalUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  redirectChain: readonly string[];
  headers: SafeResponseHeaders;
  contentType: "text/html" | "text/plain" | "application/pdf";
  bytes: Uint8Array;
  retrievedBytes: number;
  retrievedAt: string;
  pinnedAddresses: readonly OutboundResolvedAddress[];
};

export type RetrievalFailureCode =
  | "invalid-url"
  | "blocked-target"
  | "dns-failed"
  | "connect-timeout"
  | "request-timeout"
  | "redirect"
  | "redirect-downgrade"
  | "redirect-loop"
  | "http-status"
  | "missing-content-type"
  | "unsupported-content-type"
  | "unsupported-content-encoding"
  | "response-too-large"
  | "connection-mismatch"
  | "transport"
  | "normalization";

export type RetrievalFailure = {
  ok: false;
  code: RetrievalFailureCode;
  message: string;
  safeUrl: string;
};

export type RetrievalResult = RetrievedResponse | RetrievalFailure;
