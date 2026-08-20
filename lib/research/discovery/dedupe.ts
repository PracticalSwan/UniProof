import {
  candidateSourceSchema,
  type CandidateSource,
  type ResearchCategory,
} from "@/lib/research/contracts";
import {
  RESEARCH_MAX_SOURCES_PER_DOMAIN,
  RESEARCH_MAX_SOURCES_PER_RUN,
} from "@/lib/security/research-limits";
import { hostMatchesOfficialRoot } from "@/lib/research/official-host";
import { canonicalizeOutboundUrl, validateOutboundUrlSyntax } from "@/lib/security/outbound-url";

const SOURCE_PRIORITY: Record<CandidateSource["sourceType"], number> = {
  university: 0,
  government: 1,
  accreditation: 2,
  dataset: 3,
  independent: 4,
  ranking: 5,
  anecdotal: 6,
};

function hostnameFor(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    return undefined;
  }
}

function safeMetadata(value: string | undefined, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized === "" ? undefined : Array.from(normalized).slice(0, maximum).join("");
}

export function normalizeCandidateSource(
  input: Partial<CandidateSource> & { url: string },
  defaults: {
    discoveryProvider: CandidateSource["discoveryProvider"];
    requestedCategory?: ResearchCategory;
    discoveryQueryId?: string;
    discoveredAt?: string;
    trustedOfficialHost?: string;
  },
): CandidateSource | null {
  const syntax = validateOutboundUrlSyntax(input.url, { allowHttp: true });
  if (!syntax.valid) return null;
  const canonicalUrl = canonicalizeOutboundUrl(input.url, { allowHttp: true });
  if (canonicalUrl === null) return null;
  const domain = hostnameFor(canonicalUrl);
  if (domain === undefined) return null;
  const trustedHost = defaults.trustedOfficialHost;
  const isTrustedOfficial = trustedHost !== undefined && hostMatchesOfficialRoot(domain, trustedHost);
  const parsed = candidateSourceSchema.safeParse({
    ...input,
    url: canonicalUrl,
    title: safeMetadata(input.title, 300),
    publisher: safeMetadata(input.publisher, 200),
    domain,
    sourceType: input.sourceType === undefined || (input.sourceType === "independent" && isTrustedOfficial)
      ? isTrustedOfficial ? "university" : "independent"
      : input.sourceType,
    discoveryProvider: defaults.discoveryProvider,
    discoveryQueryId: defaults.discoveryQueryId ?? input.discoveryQueryId,
    requestedCategory: defaults.requestedCategory ?? input.requestedCategory,
    discoveredAt: defaults.discoveredAt ?? input.discoveredAt,
  });
  return parsed.success ? parsed.data : null;
}

export function dedupeCandidates(
  candidates: readonly CandidateSource[],
  options: {
    maxSourcesPerRun?: number;
    maxSourcesPerDomain?: number;
  } = {},
): CandidateSource[] {
  const maxSourcesPerRun = options.maxSourcesPerRun ?? RESEARCH_MAX_SOURCES_PER_RUN;
  const maxSourcesPerDomain = options.maxSourcesPerDomain ?? RESEARCH_MAX_SOURCES_PER_DOMAIN;
  const unique = new Map<string, { candidate: CandidateSource; order: number }>();

  candidates.forEach((candidate, order) => {
    const canonicalUrl = canonicalizeOutboundUrl(candidate.url, { allowHttp: true });
    if (canonicalUrl === null) return;
    const normalized = normalizeCandidateSource(
      { ...candidate, url: canonicalUrl },
      {
        discoveryProvider: candidate.discoveryProvider,
        requestedCategory: candidate.requestedCategory,
        discoveryQueryId: candidate.discoveryQueryId,
        discoveredAt: candidate.discoveredAt,
      },
    );
    if (normalized === null) return;
    const existing = unique.get(canonicalUrl);
    if (existing === undefined || SOURCE_PRIORITY[normalized.sourceType] < SOURCE_PRIORITY[existing.candidate.sourceType]) {
      unique.set(canonicalUrl, { candidate: normalized, order });
    }
  });

  const sorted = [...unique.values()].sort((left, right) => {
    const priority = SOURCE_PRIORITY[left.candidate.sourceType] - SOURCE_PRIORITY[right.candidate.sourceType];
    if (priority !== 0) return priority;
    const leftScore = left.candidate.relevanceScore ?? -1;
    const rightScore = right.candidate.relevanceScore ?? -1;
    if (leftScore !== rightScore) return rightScore - leftScore;
    const leftRank = left.candidate.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.candidate.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.order - right.order;
  });

  const domains = new Map<string, number>();
  const selected: CandidateSource[] = [];
  for (const entry of sorted) {
    if (selected.length >= maxSourcesPerRun) break;
    const domain = entry.candidate.domain ?? hostnameFor(entry.candidate.url);
    if (domain === undefined) continue;
    const count = domains.get(domain) ?? 0;
    if (count >= maxSourcesPerDomain) continue;
    domains.set(domain, count + 1);
    selected.push(entry.candidate);
  }
  return selected;
}

export function categoriesCoveredByCandidates(
  candidates: readonly CandidateSource[],
  requested: readonly ResearchCategory[],
): { covered: ResearchCategory[]; uncovered: ResearchCategory[] } {
  const coveredSet = new Set(
    candidates
      .filter((candidate) => candidate.requestedCategory !== undefined)
      .map((candidate) => candidate.requestedCategory as ResearchCategory),
  );
  const covered = requested.filter((category) => coveredSet.has(category));
  const uncovered = requested.filter((category) => !coveredSet.has(category));
  return { covered, uncovered };
}
