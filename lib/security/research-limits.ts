import "server-only";

/**
 * These limits are deliberately server-owned constants. Retrieval code must
 * derive its bounds from this module and must not accept them from requests.
 */
export const RESEARCH_CONNECT_TIMEOUT_MS = 8_000;
export const RESEARCH_REQUEST_TIMEOUT_MS = 15_000;
export const RESEARCH_MAX_REDIRECTS = 3;
export const RESEARCH_MAX_REDIRECT_LOCATION_CHARS = 4_096;
export const RESEARCH_MAX_QUERY_CHARACTERS = 600;
export const RESEARCH_MAX_DISCOVERY_QUERY_CHARACTERS = 350;
export const RESEARCH_MAX_DISCOVERY_QUERY_WORDS = 45;
export const RESEARCH_MAX_DISCOVERY_QUERIES = 8;
export const RESEARCH_MAX_DISCOVERY_RESULTS = 5;
export const RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN = 32;
export const RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS = 60_000;
export const RESEARCH_TOTAL_DEADLINE_MS = 240_000;
export const RESEARCH_MAX_CATEGORIES = 7;
export const RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN = 100;
export const RESEARCH_MAX_CLAIMS_PER_RUN = 500;
export const RESEARCH_MAX_RESPONSE_BYTES = 2_000_000;
export const RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS = 200_000;
export const RESEARCH_MAX_SOURCES_PER_RUN = 12;
export const RESEARCH_MAX_SOURCES_PER_DOMAIN = 3;
export const RESEARCH_MAX_FAILURES_PER_RUN = RESEARCH_MAX_SOURCES_PER_RUN + RESEARCH_MAX_CATEGORIES;
export const RESEARCH_MAX_WARNINGS_PER_RUN = 50;

// Phase 2D AI transport and segmentation limits are intentionally separate
// from the historical Phase 2A extraction-call/schema ceiling above.
export const RESEARCH_AI_HTTP_ATTEMPT_TIMEOUT_MS = 30_000;
export const RESEARCH_AI_MAX_RESPONSE_BYTES = 256 * 1024;
export const RESEARCH_AI_MAX_OUTPUT_TOKENS = 1_500;
export const RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN = 24;
export const RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN = 12;
export const RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN = 6;
export const RESEARCH_MAX_SEMANTIC_QUESTIONS_PER_REQUEST = 12;
export const RESEARCH_MAX_SEMANTIC_QUESTIONS_PER_RUN = 144;
export const RESEARCH_MAX_EXPLANATION_SUMMARY_UTF16 = 600;
export const RESEARCH_MAX_EXTRACTION_SEGMENT_CHARACTERS = 5_000;
export const RESEARCH_MAX_EXTRACTION_BATCH_CHARACTERS = 20_000;
export const RESEARCH_EXTRACTION_SEGMENT_OVERLAP_CHARACTERS = 250;
export const RESEARCH_MAX_RETRY_AFTER_MS = 2_000;

/**
 * Final result history adds at most three provider-scoped non-dispatched
 * skips and one total-stage skip to each AI stage. Actual HTTP attempts are
 * never truncated to reach this bound.
 */
export const RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN =
  RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN +
  (RESEARCH_MAX_EXTRACTION_HTTP_ATTEMPTS_PER_RUN + 4) +
  (RESEARCH_MAX_RECONCILIATION_HTTP_ATTEMPTS_PER_RUN + 4) +
  (RESEARCH_MAX_EXPLANATION_HTTP_ATTEMPTS_PER_RUN + 4);

export const RESEARCH_ALLOWED_RESPONSE_CONTENT_TYPES: readonly string[] =
  Object.freeze(["text/html", "text/plain", "application/pdf"]);

export type ResearchRedirectLimitResult =
  | {
      valid: true;
      redirectsCompleted: number;
      maxRedirects: number;
    }
  | {
      valid: false;
      redirectsCompleted: number;
      maxRedirects: number;
      reason: "invalid-redirect-count" | "invalid-max-redirects" | "too-many-redirects";
    };

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

export function validateResearchRedirectLimit(
  redirectsCompleted: number,
  maxRedirects: number = RESEARCH_MAX_REDIRECTS,
): ResearchRedirectLimitResult {
  if (!isNonNegativeInteger(redirectsCompleted)) {
    return {
      valid: false,
      redirectsCompleted,
      maxRedirects,
      reason: "invalid-redirect-count",
    };
  }

  if (!isNonNegativeInteger(maxRedirects)) {
    return {
      valid: false,
      redirectsCompleted,
      maxRedirects,
      reason: "invalid-max-redirects",
    };
  }

  if (maxRedirects > RESEARCH_MAX_REDIRECTS) {
    return {
      valid: false,
      redirectsCompleted,
      maxRedirects,
      reason: "invalid-max-redirects",
    };
  }

  if (redirectsCompleted >= maxRedirects) {
    return {
      valid: false,
      redirectsCompleted,
      maxRedirects,
      reason: "too-many-redirects",
    };
  }

  return {
    valid: true,
    redirectsCompleted,
    maxRedirects,
  };
}
