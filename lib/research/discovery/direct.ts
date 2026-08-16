import { normalizeCandidateSource } from "./dedupe";
import { targetHasInstitutionalIdentity } from "./resolve-target";
import type { DiscoveryQuery, ResolvedResearchTarget } from "./types";
import type { CandidateSource } from "@/lib/research/contracts";

export function trustedOfficialCandidate(
  target: ResolvedResearchTarget,
  query: DiscoveryQuery,
): CandidateSource | null {
  if (!targetHasInstitutionalIdentity(target) || target.officialUrl === undefined) return null;
  return normalizeCandidateSource(
    {
      url: target.officialUrl,
      title: target.universityName ?? target.programName,
      publisher: target.universityName,
      sourceType: "university",
    },
    {
      discoveryProvider: "direct",
      requestedCategory: query.category,
      discoveryQueryId: query.id,
      discoveredAt: new Date().toISOString(),
    },
  );
}

export function directDiscovery(
  target: ResolvedResearchTarget,
  query: DiscoveryQuery,
): { candidate: CandidateSource | null; outcome: "success" | "empty" } {
  const candidate = trustedOfficialCandidate(target, query);
  return candidate === null ? { candidate: null, outcome: "empty" } : { candidate, outcome: "success" };
}
