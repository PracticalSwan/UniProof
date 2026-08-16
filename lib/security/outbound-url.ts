import "server-only";

import type { LookupAddress } from "node:dns";
import { lookup as nodeDnsLookup } from "node:dns/promises";
import { isIP, isIPv4, isIPv6 } from "node:net";

import {
  RESEARCH_MAX_REDIRECT_LOCATION_CHARS,
  validateResearchRedirectLimit,
} from "./research-limits";

const DNS_RESOLUTION_TIMEOUT_MS = 3_000;

const BLOCKED_METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.google",
  "metadata.goog",
  "instance-data.ec2.internal",
  "metadata.azure.internal",
  "metadata.azure.com",
]);

const IPV4_BLOCKED_RANGES: readonly {
  prefix: readonly [number, number, number, number];
  bits: number;
  reason: string;
}[] = Object.freeze([
  { prefix: [0, 0, 0, 0], bits: 8, reason: "IPv4 unspecified range 0.0.0.0/8" },
  { prefix: [10, 0, 0, 0], bits: 8, reason: "IPv4 private range 10.0.0.0/8" },
  { prefix: [100, 64, 0, 0], bits: 10, reason: "IPv4 shared address range 100.64.0.0/10" },
  { prefix: [127, 0, 0, 0], bits: 8, reason: "IPv4 loopback range 127.0.0.0/8" },
  { prefix: [169, 254, 0, 0], bits: 16, reason: "IPv4 link-local and metadata range 169.254.0.0/16" },
  { prefix: [168, 63, 129, 16], bits: 32, reason: "Azure metadata endpoint 168.63.129.16" },
  { prefix: [172, 16, 0, 0], bits: 12, reason: "IPv4 private range 172.16.0.0/12" },
  { prefix: [192, 0, 0, 0], bits: 24, reason: "IPv4 reserved range 192.0.0.0/24" },
  { prefix: [192, 0, 2, 0], bits: 24, reason: "IPv4 documentation range 192.0.2.0/24" },
  { prefix: [192, 88, 99, 0], bits: 24, reason: "IPv4 6to4 relay range 192.88.99.0/24" },
  { prefix: [192, 168, 0, 0], bits: 16, reason: "IPv4 private range 192.168.0.0/16" },
  { prefix: [198, 18, 0, 0], bits: 15, reason: "IPv4 benchmarking range 198.18.0.0/15" },
  { prefix: [198, 51, 100, 0], bits: 24, reason: "IPv4 documentation range 198.51.100.0/24" },
  { prefix: [203, 0, 113, 0], bits: 24, reason: "IPv4 documentation range 203.0.113.0/24" },
  { prefix: [224, 0, 0, 0], bits: 4, reason: "IPv4 multicast range 224.0.0.0/4" },
  { prefix: [240, 0, 0, 0], bits: 4, reason: "IPv4 reserved range 240.0.0.0/4" },
]);

const IPV6_BLOCKED_PREFIXES: readonly {
  bits: number;
  groups: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  reason: string;
}[] = Object.freeze([
  { bits: 128, groups: [0, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 unspecified address ::" },
  { bits: 128, groups: [0, 0, 0, 0, 0, 0, 0, 1], reason: "IPv6 loopback address ::1" },
  { bits: 96, groups: [0, 0, 0, 0, 0, 0, 0, 0], reason: "deprecated IPv4-compatible IPv6 range ::/96" },
  { bits: 64, groups: [0x0100, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 discard-only prefix 100::/64" },
  { bits: 96, groups: [0x0064, 0xff9b, 0, 0, 0, 0, 0, 0], reason: "well-known IPv4 NAT64 prefix 64:ff9b::/96" },
  { bits: 48, groups: [0x0064, 0xff9b, 0x0001, 0, 0, 0, 0, 0], reason: "local-use IPv4 NAT64 prefix 64:ff9b:1::/48" },
  { bits: 23, groups: [0x2001, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 IETF protocol-assignment prefix 2001::/23" },
  { bits: 32, groups: [0x2001, 0x0db8, 0, 0, 0, 0, 0, 0], reason: "IPv6 documentation prefix 2001:db8::/32" },
  { bits: 16, groups: [0x2002, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 6to4 prefix 2002::/16" },
  { bits: 16, groups: [0x3ffe, 0, 0, 0, 0, 0, 0, 0], reason: "returned IPv6 6bone prefix 3ffe::/16" },
  { bits: 20, groups: [0x3fff, 0x0000, 0, 0, 0, 0, 0, 0], reason: "IPv6 documentation prefix 3fff::/20" },
  { bits: 7, groups: [0xfc00, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 unique-local prefix fc00::/7" },
  { bits: 10, groups: [0xfe80, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 link-local prefix fe80::/10" },
  { bits: 8, groups: [0xff00, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 multicast prefix ff00::/8" },
  { bits: 16, groups: [0x5f00, 0, 0, 0, 0, 0, 0, 0], reason: "IPv6 SRv6 reserved prefix 5f00::/16" },
]);

type Ipv6Groups = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type OutboundDnsAddress = LookupAddress | string;

export type OutboundDnsResolver = (
  hostname: string,
  options?: { all: true; verbatim: true },
) => Promise<readonly OutboundDnsAddress[]>;

const defaultDnsResolver: OutboundDnsResolver = (hostname, options) =>
  nodeDnsLookup(hostname, options ?? { all: true, verbatim: true });

export type OutboundResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type OutboundIpAddressClassification = {
  address: string;
  family: 4 | 6;
  isPublic: boolean;
  blockedReason?: string;
  mappedIpv4Address?: string;
};

export type OutboundValidationFailure = {
  valid: false;
  url: string;
  reason: string;
  detail?: string;
};

export type OutboundUrlValidation =
  | OutboundValidationFailure
  | {
      valid: true;
      url: string;
      canonicalUrl: string;
      hostname: string;
      protocol: "http:" | "https:";
      resolvedAddresses: readonly OutboundResolvedAddress[];
      /**
       * DNS is validated only when this result is created. A future fetcher
       * must pin transport to resolvedAddresses; otherwise a hostname could be
       * rebound between validation and connection (DNS rebinding).
       */
      validationScope: "dns-resolution-time";
    };

function outboundFailure(
  url: string,
  reason: string,
  detail?: string,
): OutboundValidationFailure {
  let safeUrl = "<unparseable outbound URL>";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      parsed.username = "";
      parsed.password = "";
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      safeUrl = parsed.toString();
    } else {
      safeUrl = `<${parsed.protocol} outbound URL>`;
    }
  } catch {
    // Do not echo malformed input into logs or error payloads.
  }
  return {
    valid: false,
    url: safeUrl,
    reason,
    ...(detail === undefined ? {} : { detail }),
  };
}

function ipv4ToNumber(address: string): number {
  const octets = address.split(".");
  if (octets.length !== 4) {
    throw new Error("Invalid IPv4 address");
  }

  return octets.reduce((value, octet) => {
    const parsed = Number(octet);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
      throw new Error("Invalid IPv4 octet");
    }
    return value * 256 + parsed;
  }, 0);
}

function parseIpv6Address(address: string): Ipv6Groups {
  if (!address.includes(":")) {
    throw new Error("Invalid IPv6 address");
  }

  const compressedParts = address.split("::");
  if (compressedParts.length > 2) {
    throw new Error("Invalid IPv6 compression");
  }

  const parseGroups = (text: string, allowEmbeddedIpv4: boolean): number[] => {
    if (text === "") {
      return [];
    }

    const pieces = text.split(":");
    const groups: number[] = [];
    for (const [index, piece] of pieces.entries()) {
      const isLastPiece = index === pieces.length - 1;
      const embeddedIpv4 = isLastPiece && allowEmbeddedIpv4 && piece.includes(".");
      if (embeddedIpv4) {
        if (!isIPv4(piece)) {
          throw new Error("Invalid embedded IPv4 address");
        }
        const octets = piece.split(".").map(Number);
        groups.push(
          (octets[0] << 8) | octets[1],
          (octets[2] << 8) | octets[3],
        );
        continue;
      }

      if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) {
        throw new Error("Invalid IPv6 group");
      }
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };

  let groups: number[];
  if (compressedParts.length === 2) {
    const head = parseGroups(compressedParts[0], false);
    const tail = parseGroups(compressedParts[1], true);
    if (head.length + tail.length > 7) {
      throw new Error("Invalid IPv6 compression");
    }
    const missingGroups = 8 - head.length - tail.length;
    groups = [...head, ...Array.from({ length: missingGroups }, () => 0), ...tail];
  } else {
    groups = parseGroups(compressedParts[0], true);
    if (groups.length !== 8) {
      throw new Error("Invalid IPv6 group count");
    }
  }

  if (groups.length !== 8) {
    throw new Error("Invalid IPv6 group count");
  }
  return [
    groups[0],
    groups[1],
    groups[2],
    groups[3],
    groups[4],
    groups[5],
    groups[6],
    groups[7],
  ];
}

function ipv4PrefixMatches(
  addressValue: number,
  prefix: readonly [number, number, number, number],
  bits: number,
): boolean {
  const prefixValue = ipv4ToNumber(prefix.join("."));
  const mask = bits === 0 ? 0 : (0xffffffff >>> (32 - bits)) << (32 - bits);
  return (addressValue & mask) === (prefixValue & mask);
}

function ipv6PrefixMatches(addressGroups: Ipv6Groups, bits: number, prefixGroups: Ipv6Groups): boolean {
  let remainingBits = bits;
  for (let index = 0; index < addressGroups.length && remainingBits > 0; index += 1) {
    const groupBits = Math.min(remainingBits, 16);
    const mask = groupBits === 16 ? 0xffff : (0xffff << (16 - groupBits)) & 0xffff;
    if ((addressGroups[index] & mask) !== (prefixGroups[index] & mask)) {
      return false;
    }
    remainingBits -= groupBits;
  }
  return true;
}

function ipv4BlockedReason(address: string): string | null {
  const addressValue = ipv4ToNumber(address);
  return IPV4_BLOCKED_RANGES.find((range) =>
    ipv4PrefixMatches(addressValue, range.prefix, range.bits),
  )?.reason ?? null;
}

function ipv4MappedAddress(addressGroups: Ipv6Groups): string | null {
  const prefixIsMapped =
    addressGroups.slice(0, 5).every((group) => group === 0) &&
    addressGroups[5] === 0xffff;
  if (!prefixIsMapped) {
    return null;
  }

  const octets = [addressGroups[6] >> 8, addressGroups[6] & 0xff, addressGroups[7] >> 8, addressGroups[7] & 0xff];
  return octets.join(".");
}

function ipv6BlockedReason(addressGroups: Ipv6Groups, mappedIpv4: string | null): string | null {
  if (mappedIpv4 !== null) {
    return ipv4BlockedReason(mappedIpv4);
  }

  const specialUseReason = IPV6_BLOCKED_PREFIXES.find((prefix) =>
    ipv6PrefixMatches(addressGroups, prefix.bits, prefix.groups),
  )?.reason;
  if (specialUseReason !== undefined) {
    return specialUseReason;
  }

  const currentGlobalUnicast = ipv6PrefixMatches(
    addressGroups,
    3,
    [0x2000, 0, 0, 0, 0, 0, 0, 0],
  );
  return currentGlobalUnicast
    ? null
    : "IPv6 address is outside the current IANA global-unicast allocation 2000::/3";
}

export function classifyOutboundIpAddress(
  address: string,
  family: 4 | 6,
): OutboundIpAddressClassification {
  const parsedFamily = isIP(address);
  if (parsedFamily !== family) {
    return {
      address,
      family,
      isPublic: false,
      blockedReason: `address does not match IPv${family} syntax`,
    };
  }

  if (family === 4) {
    const blockedReason = ipv4BlockedReason(address);
    return {
      address,
      family,
      isPublic: blockedReason === null,
      ...(blockedReason === null ? {} : { blockedReason }),
    };
  }

  let addressGroups: Ipv6Groups;
  try {
    addressGroups = parseIpv6Address(address);
  } catch {
    return {
      address,
      family,
      isPublic: false,
      blockedReason: "invalid IPv6 address",
    };
  }
  const mappedIpv4Address = ipv4MappedAddress(addressGroups);
  const blockedReason = ipv6BlockedReason(addressGroups, mappedIpv4Address);
  return {
    address,
    family,
    isPublic: blockedReason === null,
    ...(blockedReason === null ? {} : { blockedReason }),
    ...(mappedIpv4Address === null ? {} : { mappedIpv4Address }),
  };
}

/** Return true only when the address is syntactically valid and outside the
 * server's blocked/special-use ranges. */
export function isPublicIpAddress(address: string, family?: 4 | 6): boolean {
  const parsedFamily = isIP(address);
  if (parsedFamily !== 4 && parsedFamily !== 6) {
    return false;
  }
  if (family !== undefined && parsedFamily !== family) {
    return false;
  }
  return classifyOutboundIpAddress(address, parsedFamily).isPublic;
}

export function assertPublicIpAddress(address: string, family?: 4 | 6): void {
  if (!isPublicIpAddress(address, family)) {
    throw new Error(`blocked or invalid outbound IP address: ${address}`);
  }
}

function isPolicyBlockedHostname(hostname: string): string | null {
  const normalizedHostname = hostname.toLowerCase().replace(/\.+$/, "");
  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost")
  ) {
    return "localhost and the .localhost suffix always resolve to loopback";
  }
  if (
    BLOCKED_METADATA_HOSTNAMES.has(normalizedHostname) ||
    normalizedHostname === "metadata" ||
    normalizedHostname.endsWith(".metadata.google.internal") ||
    (normalizedHostname.endsWith(".internal") &&
      normalizedHostname.startsWith("metadata."))
  ) {
    return `${normalizedHostname} is a known cloud metadata hostname`;
  }
  return null;
}

function isValidDnsHostname(hostname: string): boolean {
  if (hostname.length > 253 || hostname.length === 0) {
    return false;
  }

  const hostnameWithoutRoot = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  return hostnameWithoutRoot
    .split(".")
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

export type OutboundUrlSyntaxValidation =
  | OutboundValidationFailure
  | {
      valid: true;
      url: string;
      canonicalUrl: string;
      hostname: string;
      protocol: "http:" | "https:";
      addressFamily: 4 | 6 | null;
      literalAddress: string | null;
    };

export function validateOutboundUrlSyntax(
  rawUrl: string,
  options?: { allowHttp?: boolean },
): OutboundUrlSyntaxValidation {
  const allowHttp = options?.allowHttp === true;
  if (rawUrl.length === 0) {
    return outboundFailure(rawUrl, "empty-url");
  }
  if (/[\u0000-\u0020\u007f-\u009f]/.test(rawUrl)) {
    return outboundFailure(rawUrl, "control-or-space-character");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return outboundFailure(rawUrl, "invalid-url");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return outboundFailure(url.toString(), "unsupported-protocol", url.protocol);
  }
  if (url.protocol === "http:" && !allowHttp) {
    return outboundFailure(url.toString(), "http-not-allowed");
  }
  if (url.username !== "" || url.password !== "") {
    return outboundFailure(url.toString(), "embedded-credentials");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname.length === 0) {
    return outboundFailure(url.toString(), "missing-host");
  }

  const blockedHostnameReason = isPolicyBlockedHostname(hostname);
  if (blockedHostnameReason !== null) {
    return outboundFailure(url.toString(), "blocked-hostname", blockedHostnameReason);
  }

  if (hostname.startsWith("[")) {
    if (!hostname.endsWith("]") || !hostname.includes(":")) {
      return outboundFailure(url.toString(), "invalid-ipv6-literal");
    }
    const literal = hostname.slice(1, -1);
    if (!isIPv6(literal) || literal.includes("%")) {
      return outboundFailure(url.toString(), "invalid-ipv6-literal");
    }
    return {
      valid: true,
      url: rawUrl,
      canonicalUrl: url.toString(),
      hostname,
      protocol: url.protocol as "http:" | "https:",
      addressFamily: 6,
      literalAddress: literal,
    };
  }

  const hostnameWithoutRoot = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  if (isIPv4(hostnameWithoutRoot)) {
    return {
      valid: true,
      url: rawUrl,
      canonicalUrl: url.toString(),
      hostname,
      protocol: url.protocol as "http:" | "https:",
      addressFamily: 4,
      literalAddress: hostnameWithoutRoot,
    };
  }

  if (!isValidDnsHostname(hostname)) {
    return outboundFailure(url.toString(), "invalid-hostname");
  }

  return {
    valid: true,
    url: rawUrl,
    canonicalUrl: url.toString(),
    hostname,
    protocol: url.protocol as "http:" | "https:",
    addressFamily: null,
    literalAddress: null,
  };
}

/**
 * Canonicalizes an outbound URL for duplicate detection only. It removes a
 * fragment and lets the WHATWG URL serializer normalize host casing/default
 * ports, while preserving the path and query string exactly. It does not
 * resolve DNS and therefore is not an outbound-fetch authorization decision.
 */
export function canonicalizeOutboundUrl(
  rawUrl: string,
  options?: { allowHttp?: boolean },
): string | null {
  const syntax = validateOutboundUrlSyntax(rawUrl, {
    allowHttp: options?.allowHttp ?? true,
  });
  if (!syntax.valid) {
    return null;
  }

  const canonical = new URL(syntax.canonicalUrl);
  canonical.hash = "";
  if (!canonical.hostname.startsWith("[") && canonical.hostname.endsWith(".")) {
    canonical.hostname = canonical.hostname.slice(0, -1);
  }
  return canonical.toString();
}

export const normalizeCanonicalUrl = canonicalizeOutboundUrl;

async function resolveHostname(
  hostname: string,
  resolver: OutboundDnsResolver,
): Promise<readonly OutboundDnsAddress[]> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("DNS lookup timed out"));
    }, DNS_RESOLUTION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      resolver(hostname, { all: true, verbatim: true }),
      timeout,
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function normalizeDnsAddresses(
  addresses: readonly OutboundDnsAddress[],
): OutboundResolvedAddress[] {
  const normalized: OutboundResolvedAddress[] = [];
  const seen = new Set<string>();
  for (const entry of addresses) {
    const address = typeof entry === "string" ? entry : entry.address;
    const parsedFamily = isIP(address);
    if (parsedFamily !== 4 && parsedFamily !== 6) {
      throw new Error("DNS resolver returned an invalid address");
    }
    let family: 4 | 6 = parsedFamily;
    if (typeof entry !== "string") {
      if ((entry.family !== 4 && entry.family !== 6) || entry.family !== parsedFamily) {
        throw new Error("DNS resolver returned an address/family mismatch");
      }
      family = entry.family;
    }
    const key = `${family}:${address}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({ address, family });
  }
  return normalized;
}

/**
 * Validates the URL and every address returned by DNS at validation time.
 * It does not fetch and does not prevent DNS rebinding after validation.
 */
export async function validateOutboundUrlAtResolutionTime(
  rawUrl: string,
  options?: {
    allowHttp?: boolean;
    dnsResolver?: OutboundDnsResolver;
  },
): Promise<OutboundUrlValidation> {
  const syntax = validateOutboundUrlSyntax(rawUrl, options);
  if (!syntax.valid) {
    return syntax;
  }

  if (syntax.literalAddress !== null && syntax.addressFamily !== null) {
    const classification = classifyOutboundIpAddress(
      syntax.literalAddress,
      syntax.addressFamily,
    );
    if (!classification.isPublic) {
      return outboundFailure(
        syntax.canonicalUrl,
        "blocked-ip-address",
        classification.blockedReason,
      );
    }

    return {
      valid: true,
      url: rawUrl,
      canonicalUrl: syntax.canonicalUrl,
      hostname: syntax.hostname,
      protocol: syntax.protocol,
      resolvedAddresses: [
        {
          address: syntax.literalAddress,
          family: syntax.addressFamily,
        },
      ],
      validationScope: "dns-resolution-time",
    };
  }

  const resolver = options?.dnsResolver ?? defaultDnsResolver;
  let resolved: readonly OutboundDnsAddress[];
  try {
    resolved = await resolveHostname(syntax.hostname, resolver);
  } catch {
    return outboundFailure(
      syntax.canonicalUrl,
      "dns-resolution-failed",
      "DNS resolution failed",
    );
  }

  let addresses: OutboundResolvedAddress[];
  try {
    addresses = normalizeDnsAddresses(resolved);
  } catch {
    return outboundFailure(
      syntax.canonicalUrl,
      "dns-invalid-addresses",
      "DNS resolver returned invalid addresses",
    );
  }
  if (addresses.length === 0) {
    return outboundFailure(syntax.canonicalUrl, "dns-no-addresses");
  }

  for (const resolvedAddress of addresses) {
    const classification = classifyOutboundIpAddress(
      resolvedAddress.address,
      resolvedAddress.family,
    );
    if (!classification.isPublic) {
      return outboundFailure(
        syntax.canonicalUrl,
        "blocked-ip-address",
        `${syntax.hostname} resolves to a blocked address: ${classification.blockedReason}`,
      );
    }
  }

  return {
    valid: true,
    url: rawUrl,
    canonicalUrl: syntax.canonicalUrl,
    hostname: syntax.hostname,
    protocol: syntax.protocol,
    resolvedAddresses: addresses,
    validationScope: "dns-resolution-time",
  };
}

/** Explicit name for the resolver-backed validation contract used by later
 * retrieval code. This validates the address set at one point in time only. */
export const resolveAndValidateOutboundTarget = validateOutboundUrlAtResolutionTime;

/**
 * Revalidates every redirect target before retrieval follows it. The count is
 * the number of redirects already followed, so a limit of zero rejects the
 * first redirect and a limit of three permits the third but rejects a fourth.
 */
export async function validateOutboundRedirectTargetAtResolutionTime(
  rawUrl: string,
  redirectsCompleted: number,
  options?: {
    allowHttp?: boolean;
    dnsResolver?: OutboundDnsResolver;
    maxRedirects?: number;
  },
): Promise<OutboundUrlValidation> {
  const redirectLimit = validateResearchRedirectLimit(
    redirectsCompleted,
    options?.maxRedirects,
  );
  if (!redirectLimit.valid) {
    return outboundFailure(rawUrl, redirectLimit.reason);
  }

  return validateOutboundUrlAtResolutionTime(rawUrl, options);
}

/**
 * Resolve a Location value against the current URL, then independently apply
 * protocol, credential, hostname, DNS, and public-IP checks to the result.
 */
export async function validateRedirectTarget(
  currentUrl: string,
  location: string,
  redirectsCompleted: number,
  options?: {
    allowHttp?: boolean;
    dnsResolver?: OutboundDnsResolver;
    maxRedirects?: number;
  },
): Promise<OutboundUrlValidation> {
  const redirectLimit = validateResearchRedirectLimit(
    redirectsCompleted,
    options?.maxRedirects,
  );
  if (!redirectLimit.valid) {
    return outboundFailure(currentUrl, redirectLimit.reason);
  }
  if (location.length === 0 || location.length > RESEARCH_MAX_REDIRECT_LOCATION_CHARS) {
    return outboundFailure(currentUrl, "invalid-redirect-location");
  }

  const currentSyntax = validateOutboundUrlSyntax(currentUrl, options);
  if (!currentSyntax.valid) {
    return currentSyntax;
  }

  let resolvedLocation: URL;
  try {
    resolvedLocation = new URL(location, currentUrl);
  } catch {
    return outboundFailure(currentUrl, "invalid-redirect-location");
  }

  return validateOutboundUrlAtResolutionTime(resolvedLocation.toString(), options);
}
