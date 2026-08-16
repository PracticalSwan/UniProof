import type {
  CandidateSource,
  ResearchCategory,
  ResearchProvider,
  ResearchProviderAttempt,
  ResearchRequest,
  ResearchTarget,
} from "@/lib/research/contracts";

export type ResearchIdentityRecord = {
  university?: {
    id: string;
    name: string;
    countryCode?: string;
    websiteUrl?: string;
    rorId?: string;
  };
  program?: {
    id: string;
    universityId: string;
    name: string;
    degreeLevel?: "bachelor" | "master";
    subjectArea?: string;
    officialUrl?: string;
  };
};

export type ResolvedResearchTarget = {
  universityId?: string;
  universityName?: string;
  programId?: string;
  programName?: string;
  subjectArea?: string;
  countryCode?: string;
  degreeLevel?: "bachelor" | "master";
  officialUrl?: string;
  officialHost?: string;
  rorId?: string;
};

export type TargetResolutionReason =
  | "unresolved-id"
  | "identity-conflict"
  | "ambiguous-identity"
  | "insufficient-institutional-identity";

export type TargetResolutionResult =
  | {
      resolved: true;
      target: ResolvedResearchTarget;
      warnings: readonly string[];
    }
  | {
      resolved: false;
      reason: TargetResolutionReason;
      warnings: readonly string[];
    };

export type ResearchTargetResolver = {
  resolveUniversity?: (id: string) => ResearchIdentityRecord["university"] | Promise<ResearchIdentityRecord["university"] | undefined>;
  resolveProgram?: (id: string) => ResearchIdentityRecord["program"] | Promise<ResearchIdentityRecord["program"] | undefined>;
};

export type DiscoveryQueryKind = "category" | "identity";

export type DiscoveryQuery = {
  id: string;
  kind: DiscoveryQueryKind;
  category?: ResearchCategory;
  text: string;
  target: ResolvedResearchTarget;
  locale?: string;
  countryCode?: string;
  maxResults: number;
};

export type DiscoveryFailureKind =
  | "configuration"
  | "authentication"
  | "rate-limit"
  | "timeout"
  | "upstream"
  | "invalid-response"
  | "capability"
  | "policy"
  | "budget";

export type DiscoveryAttempt = ResearchProviderAttempt & {
  provider: ResearchProvider;
};

export type ProviderSearchResult = {
  outcome: "success" | "empty" | "skipped" | "failed";
  candidates: readonly CandidateSource[];
  retryCount: number;
  durationMs?: number;
  failureKind?: DiscoveryFailureKind;
  warning?: string;
};

export type DiscoveryOptions = {
  targetResolver?: ResearchTargetResolver;
  tavilyApiKey?: string;
  braveApiKey?: string;
  /** Defaults to enabled for the built-in no-key ROR fallback. Set false to disable live built-in ROR calls; injected ROR adapters still run. */
  enableRor?: boolean;
  tavilySearch?: (query: DiscoveryQuery, options?: { apiKey?: string; signal?: AbortSignal }) => Promise<ProviderSearchResult>;
  braveSearch?: (query: DiscoveryQuery, options?: { apiKey?: string; signal?: AbortSignal }) => Promise<ProviderSearchResult>;
  rorSearch?: (name: string, context?: { countryCode?: string; officialHost?: string; requestedCategory?: ResearchCategory; discoveryQueryId?: string; signal?: AbortSignal }) => Promise<{
    outcome: "success" | "empty" | "failed" | "skipped";
    candidate?: CandidateSource;
    identity?: ResolvedResearchTarget;
    failureKind?: DiscoveryFailureKind;
    warning?: string;
    retryCount?: number;
    durationMs?: number;
  }>;
  rorIdSearch?: (rorId: string, context?: { universityName?: string; countryCode?: string; officialHost?: string; signal?: AbortSignal }) => Promise<{
    outcome: "success" | "empty" | "failed" | "skipped";
    identity?: ResolvedResearchTarget;
    candidate?: CandidateSource;
    failureKind?: DiscoveryFailureKind;
    warning?: string;
    retryCount?: number;
    durationMs?: number;
  }>;
  now?: () => string;
};

export type DiscoveryResult = {
  resolution: TargetResolutionResult;
  queries: readonly DiscoveryQuery[];
  candidateSources: readonly CandidateSource[];
  providerAttempts: readonly DiscoveryAttempt[];
  coveredCategories: readonly ResearchCategory[];
  uncoveredCategories: readonly ResearchCategory[];
  warnings: readonly string[];
};

export type ResearchRequestInput = ResearchRequest | ResearchTarget;
