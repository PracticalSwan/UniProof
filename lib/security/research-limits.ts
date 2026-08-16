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
export const RESEARCH_MAX_CATEGORIES = 6;
export const RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN = 100;
export const RESEARCH_MAX_CLAIMS_PER_RUN = 500;
export const RESEARCH_MAX_RESPONSE_BYTES = 2_000_000;
export const RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS = 200_000;
export const RESEARCH_MAX_SOURCES_PER_RUN = 12;
export const RESEARCH_MAX_SOURCES_PER_DOMAIN = 3;

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
