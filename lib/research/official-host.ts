export function normalizeOfficialHost(hostname: string): string {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, "")
    .replace(/\.+$/gu, "");
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function hostMatchesOfficialRoot(candidateHost: string, officialHost: string): boolean {
  const candidate = normalizeOfficialHost(candidateHost);
  const official = normalizeOfficialHost(officialHost);
  if (candidate === "" || official === "") return false;
  return candidate === official || candidate.endsWith(`.${official}`);
}
