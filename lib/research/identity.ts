/**
 * Application-owned identity normalization shared by discovery resolution and
 * later evidence stages.  Keep this deliberately small: it is a comparison
 * view, never a rewrite of user- or source-provided text.
 */
export function normalizeResearchIdentity(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function sameResearchIdentity(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (left === undefined || right === undefined) return true;
  const normalizedLeft = normalizeResearchIdentity(left);
  const normalizedRight = normalizeResearchIdentity(right);
  return normalizedLeft.length > 0 && normalizedRight.length > 0 && normalizedLeft === normalizedRight;
}

// Compatibility aliases for callers that used the Phase 2B helper name.
export const normalizeIdentity = normalizeResearchIdentity;
export const sameIdentity = sameResearchIdentity;
