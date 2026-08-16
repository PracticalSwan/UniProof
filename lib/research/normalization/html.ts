import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

import { RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS } from "@/lib/security/research-limits";
import type { NormalizedContent, NormalizedSection } from "./plain-text";

type HtmlNode = DefaultTreeAdapterTypes.ChildNode;
type HtmlElement = DefaultTreeAdapterTypes.Element;

const IGNORED_SUBTREES = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
  "form",
  "nav",
  "aside",
  "footer",
]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const BLOCK_TAGS = new Set(["p", "li", "td", "th", "dt", "dd", "div", "section", "article"]);

function isElement(node: HtmlNode): node is HtmlElement {
  return node.nodeName !== "#text" && node.nodeName !== "#comment" && node.nodeName !== "#documentType";
}

function cleanText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/gu, " ")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/\s*\n\s*/gu, " ")
    .trim();
}

function truncateCodePoints(value: string, maximum: number): { value: string; truncated: boolean } {
  const codePoints = Array.from(value);
  if (codePoints.length <= maximum) return { value, truncated: false };
  return { value: codePoints.slice(0, maximum).join("").trimEnd(), truncated: true };
}

function textContent(node: HtmlNode): string {
  if (node.nodeName === "#text") return (node as DefaultTreeAdapterTypes.TextNode).value;
  if (!isElement(node) || IGNORED_SUBTREES.has(node.tagName)) return "";
  if (node.tagName === "br") return " ";
  return node.childNodes.map(textContent).join(" ");
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

export function normalizeHtml(
  input: string,
  options: { maxCharacters?: number } = {},
): NormalizedContent {
  const maximum = options.maxCharacters ?? RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS;
  const sections: NormalizedSection[] = [];
  let buffer = "";
  let pendingHeading: string | undefined;

  const flush = (forceHeading = false) => {
    const text = cleanText(buffer);
    buffer = "";
    if (text === "" && !forceHeading) return;
    if (pendingHeading !== undefined) {
      sections.push({ heading: pendingHeading, text: text || pendingHeading });
      pendingHeading = undefined;
      return;
    }
    if (text !== "") sections.push({ text });
  };

  const addText = (value: string) => {
    const text = cleanText(value);
    if (text === "") return;
    if (buffer !== "" && !buffer.endsWith(" ")) buffer += " ";
    buffer += text;
  };

  const visit = (node: HtmlNode, insideTableRow = false): void => {
    if (node.nodeName === "#text") {
      addText((node as DefaultTreeAdapterTypes.TextNode).value);
      return;
    }
    if (!isElement(node) || IGNORED_SUBTREES.has(node.tagName)) return;

    const tag = node.tagName;
    if (HEADING_TAGS.has(tag)) {
      flush();
      const heading = truncateCodePoints(cleanText(textContent(node)), 300).value;
      pendingHeading = heading === "" ? undefined : heading;
      return;
    }
    if (tag === "br") {
      addText(" ");
      return;
    }
    if (tag === "tr") {
      flush();
      for (const child of node.childNodes) visit(child, true);
      flush();
      return;
    }
    if (tag === "td" || tag === "th") {
      if (buffer !== "" && !buffer.endsWith(" | ")) buffer += " | ";
      for (const child of node.childNodes) visit(child, insideTableRow);
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock && !insideTableRow) flush();
    for (const child of node.childNodes) visit(child, insideTableRow);
    if (isBlock && !insideTableRow) flush();
  };

  const root = parseFragment(input);
  for (const child of root.childNodes) visit(child);
  flush(Boolean(pendingHeading));

  const joined = sections
    .map((section) => (section.heading === undefined ? section.text : `${section.heading}\n${section.text}`))
    .join("\n\n")
    .trim();
  const bounded = truncateCodePoints(joined, maximum);
  let remaining = maximum;
  const boundedSections: NormalizedSection[] = [];
  for (const section of sections) {
    if (remaining <= 0) break;
    const text = truncateCodePoints(section.text, remaining).value;
    if (text === "") break;
    boundedSections.push(section.heading === undefined ? { text } : { heading: section.heading, text });
    remaining -= Array.from(text).length;
  }
  return {
    text: bounded.value,
    sections: sectionChunks(boundedSections),
    truncated: bounded.truncated || boundedSections.length < sections.length,
  };
}

export const normalize = normalizeHtml;
