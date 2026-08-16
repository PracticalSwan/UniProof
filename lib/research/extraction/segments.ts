import "server-only";

import { createHash } from "node:crypto";

import type { ResearchDocument, ResearchDocumentSection } from "@/lib/research/contracts";
import {
  RESEARCH_EXTRACTION_SEGMENT_OVERLAP_CHARACTERS,
  RESEARCH_MAX_EXTRACTION_SEGMENT_CHARACTERS,
} from "@/lib/security/research-limits";
import type { ExtractionSegment } from "./types";

export type SegmentationOptions = {
  maximumCharacters?: number;
  overlapCharacters?: number;
};

function lastParagraphBoundary(points: readonly string[], start: number, end: number): number | undefined {
  for (let index = end - 2; index >= start; index -= 1) {
    if (points[index] === "\n" && points[index + 1] === "\n") return index + 2;
  }
  return undefined;
}

function lastSentenceBoundary(points: readonly string[], start: number, end: number): number | undefined {
  for (let index = end - 1; index > start; index -= 1) {
    if (!/[.!?。！？]/u.test(points[index] ?? "")) continue;
    const next = points[index + 1];
    if (next === undefined || /\s/u.test(next)) return index + 1;
  }
  return undefined;
}

function lastWhitespaceBoundary(points: readonly string[], start: number, end: number): number | undefined {
  for (let index = end - 1; index > start; index -= 1) {
    if (/\s/u.test(points[index] ?? "")) return index + 1;
  }
  return undefined;
}

function preferredEnd(points: readonly string[], start: number, maximumEnd: number): number {
  return lastParagraphBoundary(points, start, maximumEnd)
    ?? lastSentenceBoundary(points, start, maximumEnd)
    ?? lastWhitespaceBoundary(points, start, maximumEnd)
    ?? maximumEnd;
}

function segmentId(document: ResearchDocument, sectionOrdinal: number, chunkOrdinal: number): string {
  const readable = `segment-${document.id}-section-${sectionOrdinal}-chunk-${chunkOrdinal}`;
  if (readable.length <= 120) return readable;
  const digest = createHash("sha256")
    .update(`${document.sourceId}\u0000${document.id}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `segment-${digest}-section-${sectionOrdinal}-chunk-${chunkOrdinal}`;
}

function sectionSegments(
  section: ResearchDocumentSection,
  document: ResearchDocument,
  sectionOrdinal: number,
  maximumCharacters: number,
  overlapCharacters: number,
): ExtractionSegment[] {
  const points = Array.from(section.text);
  const segments: ExtractionSegment[] = [];
  let start = 0;
  let chunkOrdinal = 0;

  while (start < points.length) {
    const maximumEnd = Math.min(points.length, start + maximumCharacters);
    let end = maximumEnd === points.length
      ? maximumEnd
      : preferredEnd(points, start, maximumEnd);
    if (end <= start) end = maximumEnd;
    const text = points.slice(start, end).join("");
    if (text.length === 0) break;
    segments.push({
      id: segmentId(document, sectionOrdinal, chunkOrdinal),
      sourceId: document.sourceId,
      documentId: document.id,
      sectionOrdinal,
      chunkOrdinal,
      text,
      heading: section.heading,
    });
    chunkOrdinal += 1;
    if (end >= points.length) break;

    const nextStart = Math.max(start + 1, end - overlapCharacters);
    if (nextStart <= start || nextStart >= points.length) break;
    start = nextStart;
  }

  return segments;
}

export function segmentResearchDocument(
  document: ResearchDocument,
  options: SegmentationOptions = {},
): readonly ExtractionSegment[] {
  const maximumCharacters = options.maximumCharacters ?? RESEARCH_MAX_EXTRACTION_SEGMENT_CHARACTERS;
  const overlapCharacters = options.overlapCharacters ?? RESEARCH_EXTRACTION_SEGMENT_OVERLAP_CHARACTERS;
  if (!Number.isSafeInteger(maximumCharacters) || maximumCharacters <= 0) {
    throw new Error("maximum extraction segment size must be a positive integer");
  }
  if (!Number.isSafeInteger(overlapCharacters) || overlapCharacters < 0 || overlapCharacters >= maximumCharacters) {
    throw new Error("extraction segment overlap must be between zero and the maximum segment size");
  }

  const sections: readonly ResearchDocumentSection[] = document.sections.length > 0
    ? document.sections
    : [{ text: document.normalizedText }];
  return sections.flatMap((section, sectionOrdinal) => sectionSegments(
    section,
    document,
    sectionOrdinal,
    maximumCharacters,
    overlapCharacters,
  ));
}

export const segmentDocument = segmentResearchDocument;
