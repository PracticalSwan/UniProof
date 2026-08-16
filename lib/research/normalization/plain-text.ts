import { RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS } from "@/lib/security/research-limits";

export type NormalizedSection = {
  heading?: string;
  text: string;
};

export type NormalizedContent = {
  text: string;
  sections: readonly NormalizedSection[];
  truncated: boolean;
};

function truncateCodePoints(value: string, maximum: number): { value: string; truncated: boolean } {
  const codePoints = Array.from(value);
  if (codePoints.length <= maximum) return { value, truncated: false };
  return { value: codePoints.slice(0, maximum).join("").trimEnd(), truncated: true };
}

export function normalizePlainText(
  input: string,
  options: { maxCharacters?: number } = {},
): NormalizedContent {
  const maximum = options.maxCharacters ?? RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS;
  const normalizedLines = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const bounded = truncateCodePoints(normalizedLines, maximum);
  const sections = bounded.value
    .split(/\n{2,}/u)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
  return {
    text: bounded.value,
    sections,
    truncated: bounded.truncated,
  };
}

export const normalize = normalizePlainText;
