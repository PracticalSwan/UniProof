import { createHash } from "node:crypto";

import {
  researchDocumentSchema,
  researchSourceSchema,
  type CandidateSource,
  type ResearchDocument,
  type ResearchSource,
} from "@/lib/research/contracts";
import type { RetrievedResponse } from "@/lib/research/retrieval/types";
import { normalizeHtml } from "./html";
import { normalizePlainText, type NormalizedContent, type NormalizedSection } from "./plain-text";

export type DocumentNormalizationFailure = {
  ok: false;
  code: "unsupported-pdf-normalizer" | "unsupported-charset" | "invalid-text" | "schema";
  message: string;
};

export type DocumentNormalizationResult =
  | { ok: true; source: ResearchSource; document: ResearchDocument; normalized: NormalizedContent }
  | DocumentNormalizationFailure;

function charsetFromContentType(contentType: string): string | undefined {
  const match = /(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/iu.exec(contentType);
  return (match?.[1] ?? match?.[2])?.trim().toLowerCase();
}

function decodeBytes(response: RetrievedResponse): string | DocumentNormalizationFailure {
  const charset = charsetFromContentType(response.headers["content-type"] ?? "") ?? "utf-8";
  const decoderName = charset === "utf8" ? "utf-8" : charset;
  if (!["utf-8", "us-ascii", "iso-8859-1", "windows-1252"].includes(decoderName)) {
    return { ok: false, code: "unsupported-charset", message: "source charset is not supported" };
  }
  try {
    return new TextDecoder(decoderName, { fatal: true }).decode(response.bytes);
  } catch {
    return { ok: false, code: "invalid-text", message: "source text could not be decoded safely" };
  }
}

function sectionChunks(sections: readonly NormalizedSection[]): NormalizedSection[] {
  const chunks: NormalizedSection[] = [];
  for (const section of sections) {
    const points = Array.from(section.text);
    for (let index = 0; index < points.length; index += 20_000) {
      const text = points.slice(index, index + 20_000).join("").trim();
      if (text === "") continue;
      chunks.push(section.heading === undefined || index > 0 ? { text } : { heading: section.heading, text });
    }
  }
  return chunks.slice(0, 100);
}

export function normalizeRetrievedDocument(
  candidate: CandidateSource,
  response: RetrievedResponse,
): DocumentNormalizationResult {
  if (response.contentType === "application/pdf") {
    return { ok: false, code: "unsupported-pdf-normalizer", message: "PDF retrieval is supported but no bounded PDF text normalizer is enabled" };
  }
  const decoded = decodeBytes(response);
  if (typeof decoded !== "string") return decoded;
  const normalized = response.contentType === "text/html" ? normalizeHtml(decoded) : normalizePlainText(decoded);
  if (normalized.text.trim() === "") {
    return { ok: false, code: "invalid-text", message: "source did not contain usable normalized text" };
  }
  const contentHash = createHash("sha256").update(normalized.text, "utf8").digest("hex");
  const sourceId = `source-${contentHash}`;
  const documentId = `document-${contentHash}`;
  let publisher = candidate.publisher;
  if (publisher === undefined) {
    try {
      publisher = new URL(response.finalUrl).hostname;
    } catch {
      publisher = "Unknown publisher";
    }
  }
  const source = researchSourceSchema.safeParse({
    id: sourceId,
    url: response.canonicalUrl,
    title: candidate.title ?? publisher,
    publisher,
    sourceType: candidate.sourceType,
    retrievedAt: response.retrievedAt,
    discoveryProvider: candidate.discoveryProvider,
    discoveryQueryId: candidate.discoveryQueryId,
  });
  const document = researchDocumentSchema.safeParse({
    id: documentId,
    sourceId,
    originalUrl: response.originalUrl,
    canonicalUrl: response.canonicalUrl,
    title: candidate.title ?? publisher,
    publisher,
    sourceType: candidate.sourceType,
    retrievedAt: response.retrievedAt,
    contentType: response.headers["content-type"] ?? response.contentType,
    retrievedBytes: response.retrievedBytes,
    truncated: normalized.truncated,
    normalizedText: normalized.text,
    sections: sectionChunks(normalized.sections),
    contentHash,
  });
  if (!source.success || !document.success) {
    return { ok: false, code: "schema", message: "normalized source failed the strict provenance contract" };
  }
  return { ok: true, source: source.data, document: document.data, normalized };
}

export const promoteRetrievedDocument = normalizeRetrievedDocument;
