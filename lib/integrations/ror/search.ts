import "server-only";

import { normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { readBoundedJson } from "@/lib/integrations/read-bounded-response";
import { RESEARCH_REQUEST_TIMEOUT_MS } from "@/lib/security/research-limits";
import type {
  DiscoveryFailureKind,
  ResolvedResearchTarget,
} from "@/lib/research/discovery/types";

type RorFetch = typeof fetch;

type RorOrganization = {
  id?: unknown;
  status?: unknown;
  names?: unknown;
  domains?: unknown;
  links?: unknown;
  locations?: unknown;
};

type RorItem = {
  chosen?: unknown;
  organization?: RorOrganization;
};

export type RorSearchResult = {
  outcome: "success" | "empty" | "failed" | "skipped";
  identity?: ResolvedResearchTarget;
  candidate?: ReturnType<typeof normalizeCandidateSource>;
  failureKind?: DiscoveryFailureKind;
  warning?: string;
  retryCount?: number;
  durationMs?: number;
};

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function hostFor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    return undefined;
  }
}

function organizationNames(organization: RorOrganization): string[] {
  if (!Array.isArray(organization.names)) return [];
  return organization.names.flatMap((entry) => {
    if (typeof entry === "object" && entry !== null && typeof (entry as { value?: unknown }).value === "string") {
      return [(entry as { value: string }).value];
    }
    return [];
  });
}

function organizationDisplayName(organization: RorOrganization): string | undefined {
  if (!Array.isArray(organization.names)) return undefined;
  for (const entry of organization.names) {
    if (typeof entry !== "object" || entry === null) continue;
    const value = (entry as { value?: unknown }).value;
    const types = (entry as { types?: unknown }).types;
    if (typeof value === "string" && Array.isArray(types) && types.includes("ror_display")) return value;
  }
  return undefined;
}

function organizationDomains(organization: RorOrganization): string[] {
  if (!Array.isArray(organization.domains)) return [];
  return organization.domains.filter((domain): domain is string => typeof domain === "string").map((domain) => domain.toLowerCase().replace(/\.+$/, ""));
}

function organizationWebsite(organization: RorOrganization): string | undefined {
  if (!Array.isArray(organization.links)) return undefined;
  for (const link of organization.links) {
    if (typeof link !== "object" || link === null) continue;
    const type = (link as { type?: unknown }).type;
    const value = (link as { value?: unknown }).value;
    if (type !== "website" || typeof value !== "string") continue;
    const host = hostFor(value);
    if (host !== undefined) return value;
  }
  return undefined;
}

function organizationCountryCodes(organization: RorOrganization): string[] {
  if (!Array.isArray(organization.locations)) return [];
  return organization.locations.flatMap((location) => {
    if (typeof location !== "object" || location === null) return [];
    const details = (location as { geonames_details?: unknown }).geonames_details;
    if (typeof details !== "object" || details === null) return [];
    const code = (details as { country_code?: unknown }).country_code;
    return typeof code === "string" ? [code.toUpperCase()] : [];
  });
}

function contextMatches(
  organization: RorOrganization,
  inputName: string,
  context: { countryCode?: string; officialHost?: string } = {},
): boolean {
  const suppliedName = normalized(inputName);
  if (suppliedName.length === 0) return false;
  const names = organizationNames(organization).map(normalized).filter((name) => name.length > 0);
  const nameMatches = names.some((name) => name === suppliedName);
  if (!nameMatches) return false;

  if (context.countryCode !== undefined) {
    const countries = organizationCountryCodes(organization);
    if (countries.length > 0 && !countries.includes(context.countryCode.toUpperCase())) return false;
  }
  if (context.officialHost !== undefined) {
    const trusted = context.officialHost.toLowerCase().replace(/\.+$/, "");
    const domains = organizationDomains(organization);
    const websiteHost = hostFor(organizationWebsite(organization));
    const matches = [...domains, ...(websiteHost === undefined ? [] : [websiteHost])].some(
      (domain) => domain === trusted || domain.endsWith(`.${trusted}`) || trusted.endsWith(`.${domain}`),
    );
    if (!matches) return false;
  }
  return true;
}

export async function searchRorAffiliation(
  name: string,
  context: {
    universityName?: string;
    countryCode?: string;
    officialHost?: string;
    requestedCategory?: "admissions" | "tuition" | "scholarships" | "program-structure" | "research" | "outcomes" | "support";
    discoveryQueryId?: string;
    signal?: AbortSignal;
  } = {},
  options: { fetchImpl?: RorFetch } = {},
): Promise<RorSearchResult> {
  const startedAt = Date.now();
  if (name.trim() === "") {
    return { outcome: "skipped", failureKind: "policy", warning: "ROR requires an institutional name", durationMs: 0 };
  }
  const url = new URL("https://api.ror.org/v2/organizations");
  url.searchParams.set("affiliation", name.trim());
  const fetchImpl = options.fetchImpl ?? fetch;
  if (context.signal?.aborted) return { outcome: "skipped", failureKind: "budget", warning: "ROR call budget was reached", durationMs: 0 };
  const controller = new AbortController();
  const externalSignal = context.signal;
  const abortListener = externalSignal === undefined ? undefined : () => controller.abort();
  if (externalSignal !== undefined && abortListener !== undefined) externalSignal.addEventListener("abort", abortListener, { once: true });
  const timeout = setTimeout(() => controller.abort(), RESEARCH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "error", headers: { Accept: "application/json", "Accept-Encoding": "identity" }, signal: controller.signal });
    if (!response.ok) {
      return { outcome: "failed", failureKind: response.status === 429 ? "rate-limit" : "upstream", warning: "ROR did not return a usable response", durationMs: Date.now() - startedAt };
    }
    const payload = await readBoundedJson(response, 500_000);
    if (payload === null || typeof payload !== "object" || !Array.isArray((payload as { items?: unknown }).items)) {
      return { outcome: "failed", failureKind: "invalid-response", warning: "ROR returned an invalid response", durationMs: Date.now() - startedAt };
    }
    const chosen = (payload as { items: unknown[] }).items.filter((item): item is RorItem => typeof item === "object" && item !== null && (item as RorItem).chosen === true);
    if (chosen.length !== 1 || chosen[0]?.organization === undefined) {
      return { outcome: "empty", warning: "ROR returned no unambiguous chosen organization", durationMs: Date.now() - startedAt };
    }
    const organization = chosen[0].organization;
    if (organization.status !== "active") {
      return { outcome: "empty", warning: "ROR chosen organization is not active", durationMs: Date.now() - startedAt };
    }
    if (!contextMatches(organization, name, context)) {
      return { outcome: "empty", warning: "ROR chosen organization conflicts with supplied identity context", durationMs: Date.now() - startedAt };
    }
    const websiteUrl = organizationWebsite(organization);
    const rorId = typeof organization.id === "string" ? organization.id : undefined;
    const universityName = organizationDisplayName(organization);
    if (universityName === undefined) {
      return { outcome: "failed", failureKind: "invalid-response", warning: "ROR organization has no ror_display name", durationMs: Date.now() - startedAt };
    }
    const officialHost = hostFor(websiteUrl);
    const candidate = websiteUrl === undefined ? undefined : normalizeCandidateSource(
      {
        url: websiteUrl,
        title: universityName,
        publisher: universityName,
        sourceType: "university",
      },
      {
        discoveryProvider: "ror",
        requestedCategory: context.requestedCategory,
        discoveryQueryId: context.discoveryQueryId,
        discoveredAt: new Date().toISOString(),
      },
    );
    return {
      outcome: "success",
      identity: { universityName, officialUrl: websiteUrl, officialHost, rorId, countryCode: organizationCountryCodes(organization)[0] ?? context.countryCode },
      ...(candidate === null || candidate === undefined ? {} : { candidate }),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (context.signal?.aborted) return { outcome: "skipped", failureKind: "budget", warning: "ROR call budget was reached", durationMs: Date.now() - startedAt };
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return { outcome: "failed", failureKind: isTimeout ? "timeout" : "upstream", warning: "ROR request failed", durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
    if (abortListener !== undefined) context.signal?.removeEventListener("abort", abortListener);
  }
}

export async function resolveRorId(
  rorId: string,
  context: {
    universityName?: string;
    countryCode?: string;
    officialHost?: string;
    requestedCategory?: "admissions" | "tuition" | "scholarships" | "program-structure" | "research" | "outcomes" | "support";
    discoveryQueryId?: string;
    signal?: AbortSignal;
  } = {},
  options: { fetchImpl?: RorFetch } = {},
): Promise<RorSearchResult> {
  const startedAt = Date.now();
  const normalizedId = rorId.trim().replace(/^https?:\/\/ror\.org\//iu, "");
  if (!/^[0-9a-z]{9,20}$/iu.test(normalizedId)) {
    return { outcome: "failed", failureKind: "policy", warning: "ROR ID format is invalid", durationMs: 0 };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  if (context.signal?.aborted) return { outcome: "skipped", failureKind: "budget", warning: "ROR call budget was reached", durationMs: 0 };
  const controller = new AbortController();
  const externalSignal = context.signal;
  const abortListener = externalSignal === undefined ? undefined : () => controller.abort();
  if (externalSignal !== undefined && abortListener !== undefined) externalSignal.addEventListener("abort", abortListener, { once: true });
  const timeout = setTimeout(() => controller.abort(), RESEARCH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://api.ror.org/v2/organizations/${encodeURIComponent(normalizedId)}`, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/json", "Accept-Encoding": "identity" },
      signal: controller.signal,
    });
    if (!response.ok) return { outcome: "failed", failureKind: response.status === 429 ? "rate-limit" : "upstream", warning: "ROR ID lookup failed", durationMs: Date.now() - startedAt };
    const payload = await readBoundedJson(response, 500_000);
    if (payload === null || typeof payload !== "object") return { outcome: "failed", failureKind: "invalid-response", warning: "ROR returned an invalid organization", durationMs: Date.now() - startedAt };
    const organization = payload as RorOrganization;
    if (organization.status !== "active") return { outcome: "empty", warning: "ROR organization is not active", durationMs: Date.now() - startedAt };
    const universityName = organizationDisplayName(organization);
    if (universityName === undefined) return { outcome: "failed", failureKind: "invalid-response", warning: "ROR organization has no ror_display name", durationMs: Date.now() - startedAt };
    if (!contextMatches(organization, context.universityName ?? universityName, context)) {
      return { outcome: "empty", warning: "ROR organization conflicts with supplied identity context", durationMs: Date.now() - startedAt };
    }
    const websiteUrl = organizationWebsite(organization);
    const candidate = websiteUrl === undefined ? undefined : normalizeCandidateSource(
      { url: websiteUrl, title: universityName, publisher: universityName, sourceType: "university" },
      { discoveryProvider: "ror", requestedCategory: context.requestedCategory, discoveryQueryId: context.discoveryQueryId, discoveredAt: new Date().toISOString() },
    );
    return {
      outcome: "success",
      identity: { universityName, officialUrl: websiteUrl, officialHost: hostFor(websiteUrl), rorId: `https://ror.org/${normalizedId}`, countryCode: organizationCountryCodes(organization)[0] ?? context.countryCode },
      ...(candidate === null || candidate === undefined ? {} : { candidate }),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (context.signal?.aborted) return { outcome: "skipped", failureKind: "budget", warning: "ROR call budget was reached", durationMs: Date.now() - startedAt };
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return { outcome: "failed", failureKind: isTimeout ? "timeout" : "upstream", warning: "ROR ID lookup failed", durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
    if (abortListener !== undefined) context.signal?.removeEventListener("abort", abortListener);
  }
}

export const search = searchRorAffiliation;
export const resolveIdentity = resolveRorId;
