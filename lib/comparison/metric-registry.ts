import type { ResearchModeCategory } from "@/lib/research/mode/public-contracts";
import type { ComparisonPriority } from "./contracts";

export type ComparisonMetricId =
  | "annual-tuition"
  | "scholarship-availability"
  | "scholarship-presence"
  | "research-opportunity-availability"
  | "employment-rate"
  | "international-support-availability";

export type ComparisonMetricKind = "numeric" | "boolean" | "presence";
export type ComparisonMetricDirection = "lower" | "higher" | "absolute";

export type ComparisonMetricDefinition = Readonly<{
  id: ComparisonMetricId;
  dimension: ComparisonPriority;
  category: ResearchModeCategory;
  aliases: readonly string[];
  kind: ComparisonMetricKind;
  direction: ComparisonMetricDirection;
}>;

function collapseAsciiWhitespace(value: string): string {
  return value.replace(/[\t\n\v\f\r ]+/g, " ");
}

export function normalizeComparisonPropertyKey(value: string): string {
  const trimmed = value.trim().toLocaleLowerCase("en-US").normalize("NFC");
  const collapsed = collapseAsciiWhitespace(trimmed);
  return collapseAsciiWhitespace(collapsed.replace(/[:\-_]/g, " ")).trim();
}

export function normalizeComparisonToken(value: string): string {
  return collapseAsciiWhitespace(value.trim().toLocaleLowerCase("en-US").normalize("NFC"));
}

export const comparisonMetricRegistry: readonly ComparisonMetricDefinition[] = [
  {
    id: "annual-tuition",
    dimension: "affordability",
    category: "tuition",
    aliases: [
      "annual tuition",
      "annual tuition fee",
      "annual tuition fees",
      "tuition per year",
      "yearly tuition",
    ],
    kind: "numeric",
    direction: "lower",
  },
  {
    id: "research-opportunity-availability",
    dimension: "research",
    category: "research",
    aliases: [
      "research opportunity available",
      "research opportunities available",
      "thesis option available",
      "research thesis available",
    ],
    kind: "boolean",
    direction: "absolute",
  },
  {
    id: "scholarship-availability",
    dimension: "scholarships",
    category: "scholarships",
    aliases: [
      "scholarship available",
      "scholarships available",
      "scholarship availability",
      "funding available",
    ],
    kind: "boolean",
    direction: "absolute",
  },
  {
    id: "scholarship-presence",
    dimension: "scholarships",
    category: "scholarships",
    aliases: [
      "scholarship name",
      "scholarship",
      "funding opportunity",
    ],
    kind: "presence",
    direction: "absolute",
  },
  {
    id: "employment-rate",
    dimension: "outcomes",
    category: "outcomes",
    aliases: [
      "employment rate",
      "graduate employment rate",
      "graduate outcome rate",
      "employment outcome rate",
    ],
    kind: "numeric",
    direction: "higher",
  },
  {
    id: "international-support-availability",
    dimension: "support",
    category: "support",
    aliases: [
      "international student support available",
      "international students support available",
      "international student services available",
      "international office available",
    ],
    kind: "boolean",
    direction: "absolute",
  },
] as const;

const aliasIndex = new Map<string, ComparisonMetricDefinition>();
for (const definition of comparisonMetricRegistry) {
  for (const alias of definition.aliases) {
    const normalized = normalizeComparisonPropertyKey(alias);
    if (aliasIndex.has(normalized)) {
      throw new Error("Comparison metric registry contains a duplicate normalized alias.");
    }
    aliasIndex.set(normalized, definition);
  }
}

export function lookupComparisonMetric(property: string): ComparisonMetricDefinition | undefined {
  return aliasIndex.get(normalizeComparisonPropertyKey(property));
}

export function comparisonMetricsForDimension(
  dimension: ComparisonPriority,
): readonly ComparisonMetricDefinition[] {
  return comparisonMetricRegistry.filter((definition) => definition.dimension === dimension);
}
