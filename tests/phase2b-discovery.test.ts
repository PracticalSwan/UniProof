import { describe, expect, it } from "vitest";

import {
  researchCategorySchema,
  researchRequestSchema,
} from "@/lib/research/contracts";
import { searchBrave } from "@/lib/integrations/brave/search";
import { resolveRorId, searchRorAffiliation } from "@/lib/integrations/ror/search";
import { searchTavily } from "@/lib/integrations/tavily/search";
import { dedupeCandidates, normalizeCandidateSource } from "@/lib/research/discovery/dedupe";
import { discoverResearch } from "@/lib/research/discovery/orchestrator";
import { containsSensitiveResearchData, planDiscoveryQueries } from "@/lib/research/discovery/query-plan";
import { resolveResearchTarget } from "@/lib/research/discovery/resolve-target";

const timestamp = "2026-08-16T00:00:00.000Z";

function request(overrides: Record<string, unknown> = {}) {
  return researchRequestSchema.parse({
    target: { university: { name: "Example University" }, subjectArea: "computer science" },
    categories: ["admissions", "tuition", "scholarships", "program-structure", "research", "outcomes", "support"],
    ...overrides,
  });
}

describe("Phase 2B discovery", () => {
  it("accepts all seven categories and plans bounded deterministic queries", async () => {
    const parsed = request();
    expect(parsed.categories).toHaveLength(7);
    expect(researchCategorySchema.safeParse("program-structure").success).toBe(true);
    const resolution = await resolveResearchTarget(parsed);
    expect(resolution.resolved).toBe(true);
    if (!resolution.resolved) return;
    const queries = planDiscoveryQueries(parsed, resolution);
    expect(queries).toHaveLength(8);
    expect(queries[0]?.id).toBe("category-admissions");
    expect(queries.at(-1)?.id).toBe("identity-university");
    for (const query of queries) {
      expect(query.text.length).toBeLessThanOrEqual(350);
      expect(query.text.trim().split(/\s+/u).length).toBeLessThanOrEqual(45);
    }
  });

  it("does not search an unresolved opaque application ID", async () => {
    const parsed = request({
      target: { university: { id: "unresolved-university" } },
      categories: ["admissions"],
    });
    const resolution = await resolveResearchTarget(parsed, {
      resolveUniversity: () => undefined,
    });
    expect(resolution).toMatchObject({ resolved: false, reason: "unresolved-id" });
    const result = await discoverResearch(parsed, {
      targetResolver: { resolveUniversity: () => undefined },
      tavilySearch: async () => ({ outcome: "success", candidates: [], retryCount: 0 }),
      braveSearch: async () => ({ outcome: "success", candidates: [], retryCount: 0 }),
    });
    expect(result.queries).toHaveLength(0);
    expect(result.providerAttempts).toHaveLength(0);
  });

  it("rejects contradictory resolved IDs and preserves program-name-only semantics", async () => {
    const conflict = await resolveResearchTarget(
      request({ target: { university: { id: "u-1", name: "Example University" }, program: { id: "p-1", universityId: "u-1", name: "Computing" } }, categories: ["admissions"] }),
      {
        resolveUniversity: (id) => ({ id, name: "Example University" }),
        resolveProgram: () => ({ id: "p-1", universityId: "u-2", name: "Computing" }),
      },
    );
    expect(conflict).toMatchObject({ resolved: false, reason: "identity-conflict" });

    const programOnly = await resolveResearchTarget(
      request({ target: { program: { name: "MSc Computing" } }, categories: ["program-structure"] }),
    );
    expect(programOnly).toMatchObject({ resolved: true });
    if (programOnly.resolved) expect(programOnly.target.universityName).toBeUndefined();
  });

  it("prefers the catalog program URL for direct evidence while retaining the university root trust host", async () => {
    const resolution = await resolveResearchTarget(
      request({
        target: {
          university: { id: "u-1" },
          program: { id: "p-1", universityId: "u-1" },
        },
        categories: ["admissions"],
      }),
      {
        resolveUniversity: () => ({
          id: "u-1",
          name: "Example University",
          countryCode: "US",
          websiteUrl: "https://example.edu/",
        }),
        resolveProgram: () => ({
          id: "p-1",
          universityId: "u-1",
          name: "BSc Computing",
          degreeLevel: "bachelor",
          subjectArea: "Computer Science",
          officialUrl: "https://cs.example.edu/programs/bsc",
        }),
      },
    );

    expect(resolution.resolved).toBe(true);
    if (!resolution.resolved) return;
    expect(resolution.target.officialUrl).toBe("https://cs.example.edu/programs/bsc");
    expect(resolution.target.officialHost).toBe("example.edu");
  });

  it("retains the catalog-owned direct program page alongside successful web discovery", async () => {
    const parsed = request({
      target: {
        university: { id: "u-1" },
        program: { id: "p-1", universityId: "u-1" },
      },
      categories: ["admissions"],
    });
    const result = await discoverResearch(parsed, {
      enableRor: false,
      targetResolver: {
        resolveUniversity: () => ({
          id: "u-1",
          name: "Example University",
          countryCode: "US",
          websiteUrl: "https://example.edu/",
        }),
        resolveProgram: () => ({
          id: "p-1",
          universityId: "u-1",
          name: "BSc Computing",
          degreeLevel: "bachelor",
          subjectArea: "Computer Science",
          officialUrl: "https://cs.example.edu/programs/bsc",
        }),
      },
      tavilySearch: async (query) => {
        const candidate = normalizeCandidateSource(
          { url: "https://example.edu/admissions", sourceType: "university" },
          {
            discoveryProvider: "tavily",
            requestedCategory: query.category,
            discoveryQueryId: query.id,
          },
        );
        return { outcome: "success", candidates: candidate === null ? [] : [candidate], retryCount: 0 };
      },
      braveSearch: async () => ({ outcome: "empty", candidates: [], retryCount: 0 }),
    });

    expect(result.candidateSources.map((candidate) => candidate.url)).toEqual(expect.arrayContaining([
      "https://cs.example.edu/programs/bsc",
      "https://example.edu/admissions",
    ]));
    expect(result.providerAttempts).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "direct", category: "admissions", outcome: "success" }),
    ]));
    expect(result.categoryAssociations).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://cs.example.edu/programs/bsc", categories: ["admissions"] }),
    ]));
  });

  it("does not add a generic university homepage when category discovery already found official evidence", async () => {
    const parsed = request({
      target: { university: { id: "u-1" } },
      categories: ["tuition", "research"],
    });
    const result = await discoverResearch(parsed, {
      enableRor: false,
      targetResolver: {
        resolveUniversity: () => ({
          id: "u-1",
          name: "Example University",
          countryCode: "US",
          websiteUrl: "https://example.edu/",
        }),
      },
      tavilySearch: async (query) => {
        const candidate = normalizeCandidateSource(
          {
            url: query.category === "tuition"
              ? "https://example.edu/fees"
              : "https://example.edu/research",
            sourceType: "university",
          },
          {
            discoveryProvider: "tavily",
            requestedCategory: query.category,
            discoveryQueryId: query.id,
          },
        );
        return { outcome: "success", candidates: candidate === null ? [] : [candidate], retryCount: 0 };
      },
      braveSearch: async () => ({ outcome: "empty", candidates: [], retryCount: 0 }),
    });

    expect(result.candidateSources.map((candidate) => candidate.url)).toEqual([
      "https://example.edu/fees",
      "https://example.edu/research",
    ]);
    expect(result.providerAttempts.some((attempt) => attempt.provider === "direct")).toBe(false);
    expect(result.categoryAssociations).toEqual([
      { url: "https://example.edu/fees", categories: ["tuition"] },
      { url: "https://example.edu/research", categories: ["research"] },
    ]);
  });

  it("rejects a supplied university name that conflicts with a resolved program university", async () => {
    const conflict = await resolveResearchTarget(
      request({
        target: {
          university: { name: "Foo University" },
          program: { id: "p-1", name: "Computing" },
        },
        categories: ["admissions"],
      }),
      {
        resolveProgram: () => ({ id: "p-1", universityId: "u-2", name: "Computing" }),
        resolveUniversity: (id) => ({ id, name: "Bar University" }),
      },
    );
    expect(conflict).toMatchObject({ resolved: false, reason: "identity-conflict" });
  });

  it("rejects conflicting Unicode university identities instead of collapsing them during normalization", async () => {
    const conflict = await resolveResearchTarget(
      request({
        target: { university: { id: "u-unicode", name: "\u5927\u5b66\u4e00" } },
        categories: ["admissions"],
      }),
      {
        resolveUniversity: (id) => ({ id, name: "\u5927\u5b66\u4e8c" }),
      },
    );
    expect(conflict).toMatchObject({ resolved: false, reason: "identity-conflict" });
  });

  it("fails closed when a resolved program parent cannot be checked against a supplied university name", async () => {
    const unresolved = await resolveResearchTarget(
      request({
        target: { university: { name: "Example University" }, program: { id: "p-1", name: "Computing" } },
        categories: ["program-structure"],
      }),
      {
        resolveProgram: () => ({ id: "p-1", universityId: "u-2", name: "Computing" }),
      },
    );
    expect(unresolved).toMatchObject({ resolved: false, reason: "unresolved-id" });
  });

  it("uses ROR chosen:true only and rejects score/order guessing", async () => {
    const noChosen = await searchRorAffiliation("Example University", {}, {
      fetchImpl: async () => new Response(JSON.stringify({ items: [{ chosen: false, organization: { status: "active", names: [{ value: "Example University" }] } }] }), { status: 200 }),
    });
    expect(noChosen.outcome).toBe("empty");

    const chosen = await searchRorAffiliation("Example University", { countryCode: "US" }, {
      fetchImpl: async () => new Response(JSON.stringify({ items: [
        { chosen: false, organization: { status: "active", names: [{ value: "Other University" }] } },
        { chosen: true, organization: { id: "https://ror.org/01abc", status: "active", names: [{ value: "Example University", types: ["ror_display", "label"] }], domains: ["example.edu"], links: [{ type: "website", value: "https://example.edu" }], locations: [{ geonames_details: { country_code: "US" } }] } },
      ] }), { status: 200 }),
    });
    expect(chosen.outcome).toBe("success");
    expect(chosen.candidate?.discoveryProvider).toBe("ror");
  });

  it("rejects partial-name ROR matches instead of accepting a generic substring", async () => {
    const result = await searchRorAffiliation("University", {}, {
      fetchImpl: async () => new Response(JSON.stringify({
        items: [{
          chosen: true,
          organization: {
            id: "https://ror.org/01abcdefg",
            status: "active",
            names: [{ value: "Example University", types: ["ror_display", "label"] }],
            domains: ["example.edu"],
            links: [{ type: "website", value: "https://example.edu" }],
          },
        }],
      }), { status: 200 }),
    });
    expect(result.outcome).toBe("empty");
  });

  it("cross-checks a known ROR ID against supplied name and domain context", async () => {
    const result = await resolveRorId("01abcdefg", { universityName: "Example University", officialHost: "example.edu" }, {
      fetchImpl: async () => new Response(JSON.stringify({
        id: "https://ror.org/01abcdefg",
        status: "active",
        names: [{ value: "Other University", types: ["ror_display", "label"] }],
        domains: ["other.edu"],
        links: [{ type: "website", value: "https://other.edu" }],
      }), { status: 200 }),
    });
    expect(result.outcome).toBe("empty");
    expect(result.candidate).toBeUndefined();
  });

  it("keeps Tavily authentication and retry metadata bounded and secret-free", async () => {
    const query = {
      id: "category-admissions",
      kind: "category" as const,
      category: "admissions" as const,
      text: "Example University admissions requirements",
      target: { universityName: "Example University" },
      maxResults: 5,
    };
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const authentication = await searchTavily(query, {
      apiKey: "secret-tavily-key",
      fetchImpl: async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return new Response("{}", { status: 401 });
      },
    });
    expect(authentication).toMatchObject({ outcome: "failed", failureKind: "authentication", retryCount: 0 });
    expect(observedUrl).toBe("https://api.tavily.com/search");
    expect(observedInit?.redirect).toBe("error");
    expect(observedInit?.headers).toMatchObject({ Authorization: "Bearer secret-tavily-key" });
    expect(JSON.stringify(authentication)).not.toContain("secret-tavily-key");

    const sleeps: number[] = [];
    let calls = 0;
    const retried = await searchTavily(query, {
      apiKey: "secret-tavily-key",
      sleep: async (milliseconds) => { sleeps.push(milliseconds); },
      fetchImpl: async () => {
        calls += 1;
        return calls === 1
          ? new Response("", { status: 429, headers: { "Retry-After": "0.5" } })
          : new Response(JSON.stringify({ results: [{ url: "https://example.edu/admissions", title: "Admissions" }] }), { status: 200 });
      },
    });
    expect(retried).toMatchObject({ outcome: "success", retryCount: 1 });
    expect(calls).toBe(2);
    expect(sleeps).toEqual([500]);

    const longSleeps: number[] = [];
    let longCalls = 0;
    const longWindow = await searchTavily(query, {
      apiKey: "secret-tavily-key",
      sleep: async (milliseconds) => { longSleeps.push(milliseconds); },
      fetchImpl: async () => {
        longCalls += 1;
        return new Response("", { status: 429, headers: { "Retry-After": "60" } });
      },
    });
    expect(longWindow).toMatchObject({ outcome: "failed", failureKind: "rate-limit", retryCount: 0 });
    expect(longCalls).toBe(1);
    expect(longSleeps).toEqual([]);
  });

  it("classifies missing configuration, timeout, and 5xx handling without retrying policy failures", async () => {
    const query = {
      id: "category-admissions",
      kind: "category" as const,
      category: "admissions" as const,
      text: "Example University admissions requirements",
      target: { universityName: "Example University" },
      maxResults: 5,
    };
    const missing = await searchTavily(query, { apiKey: "" });
    expect(missing).toMatchObject({ outcome: "skipped", failureKind: "configuration", retryCount: 0 });

    const timeout = await searchTavily(query, {
      apiKey: "secret-tavily-key",
      sleep: async () => {},
      fetchImpl: async () => { throw new DOMException("timed out", "AbortError"); },
    });
    expect(timeout).toMatchObject({ outcome: "failed", failureKind: "timeout", retryCount: 1 });

    let upstreamCalls = 0;
    const upstream = await searchTavily(query, {
      apiKey: "secret-tavily-key",
      sleep: async () => {},
      fetchImpl: async () => {
        upstreamCalls += 1;
        return new Response("", { status: 503 });
      },
    });
    expect(upstream).toMatchObject({ outcome: "failed", failureKind: "upstream", retryCount: 1 });
    expect(upstreamCalls).toBe(2);
  });

  it("classifies malformed Brave payloads without exposing provider data", async () => {
    const query = {
      id: "category-tuition",
      kind: "category" as const,
      category: "tuition" as const,
      text: "Example University tuition fees",
      target: { universityName: "Example University" },
      maxResults: 5,
    };
    const result = await searchBrave(query, {
      apiKey: "secret-brave-key",
      fetchImpl: async (input, init) => {
        expect(String(input)).toContain("https://api.search.brave.com/res/v1/web/search");
        expect(init?.redirect).toBe("error");
        expect(init?.headers).toMatchObject({ "X-Subscription-Token": "secret-brave-key" });
        return new Response(JSON.stringify({ web: { results: "not-an-array" } }), { status: 200 });
      },
    });
    expect(result).toMatchObject({ outcome: "failed", failureKind: "invalid-response", retryCount: 0 });
    expect(JSON.stringify(result)).not.toContain("secret-brave-key");

    const sleeps: number[] = [];
    let calls = 0;
    const longWindow = await searchBrave(query, {
      apiKey: "secret-brave-key",
      sleep: async (milliseconds) => { sleeps.push(milliseconds); },
      fetchImpl: async () => {
        calls += 1;
        return new Response("", { status: 429, headers: { "Retry-After": "60" } });
      },
    });
    expect(longWindow).toMatchObject({ outcome: "failed", failureKind: "rate-limit", retryCount: 0 });
    expect(calls).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it("circuits a persistently rate-limited discovery provider across later queries in the same run", async () => {
    let tavilyCalls = 0;
    let braveCalls = 0;
    const result = await discoverResearch(request({ categories: ["admissions", "tuition"] }), {
      enableRor: false,
      tavilySearch: async () => {
        tavilyCalls += 1;
        return { outcome: "failed", candidates: [], retryCount: 0, failureKind: "rate-limit" as const };
      },
      braveSearch: async (query) => {
        braveCalls += 1;
        const discovered = query.category === undefined
          ? null
          : normalizeCandidateSource(
              { url: `https://example.edu/${query.category}`, sourceType: "university" },
              { discoveryProvider: "brave", requestedCategory: query.category, discoveryQueryId: query.id },
            );
        return {
          outcome: discovered === null ? "empty" as const : "success" as const,
          candidates: discovered === null ? [] : [discovered],
          retryCount: 0,
        };
      },
    });

    expect(tavilyCalls).toBe(1);
    expect(braveCalls).toBe(3);
    expect(result.coveredCategories).toEqual(["admissions", "tuition"]);
    expect(result.providerAttempts.filter((attempt) => attempt.provider === "tavily")).toHaveLength(1);
  });

  it("falls through from a failed Tavily query to Brave and preserves a trusted direct candidate", async () => {
    const braveCandidate = normalizeCandidateSource(
      { url: "https://example.edu/admissions", sourceType: "independent" },
      { discoveryProvider: "brave", requestedCategory: "admissions", discoveryQueryId: "category-admissions" },
    );
    expect(braveCandidate).not.toBeNull();
    let braveCalls = 0;
    const fallback = await discoverResearch(request({ categories: ["admissions"] }), {
      tavilySearch: async () => { throw new Error("provider-internal-secret"); },
      braveSearch: async () => {
        braveCalls += 1;
        return { outcome: "success", candidates: braveCandidate === null ? [] : [braveCandidate], retryCount: 0 };
      },
    });
    expect(braveCalls).toBe(2);
    expect(fallback.coveredCategories).toEqual(["admissions"]);
    expect(fallback.providerAttempts[0]).toMatchObject({ outcome: "failed", failureKind: "upstream" });
    expect(JSON.stringify(fallback)).not.toContain("provider-internal-secret");

    const direct = await discoverResearch(
      request({ target: { university: { id: "u-1" } }, categories: ["admissions"] }),
      {
        targetResolver: { resolveUniversity: () => ({ id: "u-1", name: "Example University", websiteUrl: "https://example.edu" }) },
        tavilySearch: async () => ({ outcome: "failed", candidates: [], retryCount: 1, failureKind: "upstream" }),
        braveSearch: async () => ({ outcome: "failed", candidates: [], retryCount: 1, failureKind: "upstream" }),
      },
    );
    expect(direct.candidateSources.some((candidate) => candidate.sourceType === "university" && candidate.discoveryProvider === "direct")).toBe(true);
  });

  it("rejects malformed and non-HTTP(S) provider URLs before retrieval", () => {
    expect(normalizeCandidateSource({ url: "javascript:alert(1)", sourceType: "independent" }, { discoveryProvider: "tavily" })).toBeNull();
    expect(normalizeCandidateSource({ url: "https://", sourceType: "independent" }, { discoveryProvider: "brave" })).toBeNull();
    const sanitized = normalizeCandidateSource({ url: "https://example.edu", title: "Admissions\u202E<script>" }, { discoveryProvider: "tavily" });
    expect(sanitized?.title).toBe("Admissions <script>");
  });

  it("stops at Tavily success and does not call Brave for the satisfied query", async () => {
    let braveCalls = 0;
    const candidate = normalizeCandidateSource(
      { url: "https://example.edu/admissions", title: "Admissions", sourceType: "university" },
      { discoveryProvider: "tavily", requestedCategory: "admissions", discoveryQueryId: "category-admissions", discoveredAt: timestamp },
    );
    expect(candidate).not.toBeNull();
    const result = await discoverResearch(request({ categories: ["admissions"] }), {
      tavilySearch: async () => ({ outcome: "success", candidates: candidate === null ? [] : [candidate], retryCount: 0, durationMs: 1 }),
      braveSearch: async () => {
        braveCalls += 1;
        return { outcome: "success", candidates: [], retryCount: 0 };
      },
    });
    expect(braveCalls).toBe(0);
    expect(result.coveredCategories).toEqual(["admissions"]);
    expect(result.providerAttempts.map((attempt) => attempt.provider)).toEqual(["tavily", "tavily"]);
  });

  it("falls through to Brave and canonicalizes fragments with domain/run budgets", () => {
    const first = normalizeCandidateSource({ url: "https://example.edu/a#one", sourceType: "independent" }, { discoveryProvider: "tavily" });
    const duplicate = normalizeCandidateSource({ url: "https://EXAMPLE.edu/a#two", sourceType: "independent" }, { discoveryProvider: "brave" });
    const other = normalizeCandidateSource({ url: "https://example.edu/b", sourceType: "independent" }, { discoveryProvider: "brave" });
    expect(first).not.toBeNull();
    expect(duplicate).not.toBeNull();
    expect(other).not.toBeNull();
    const selected = dedupeCandidates([first!, duplicate!, other!], { maxSourcesPerRun: 12, maxSourcesPerDomain: 2 });
    expect(selected).toHaveLength(2);
    expect(new Set(selected.map((candidate) => candidate.url)).size).toBe(2);
  });

  it("prefers stronger provenance when duplicate canonical URLs disagree on source type", () => {
    const generic = normalizeCandidateSource(
      { url: "https://example.edu/", sourceType: "independent" },
      { discoveryProvider: "tavily", requestedCategory: "admissions" },
    );
    const official = normalizeCandidateSource(
      { url: "https://EXAMPLE.edu/#official", sourceType: "university", publisher: "Example University" },
      { discoveryProvider: "direct", requestedCategory: "tuition" },
    );
    expect(generic).not.toBeNull();
    expect(official).not.toBeNull();
    const selected = dedupeCandidates([generic!, official!]);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      sourceType: "university",
      discoveryProvider: "direct",
      publisher: "Example University",
    });
  });

  it("preserves discovery coverage when multiple category queries yield the same canonical URL", async () => {
    const result = await discoverResearch(request({ categories: ["admissions", "tuition"] }), {
      tavilySearch: async (query) => {
        const candidate = normalizeCandidateSource(
          { url: "https://example.edu", sourceType: "independent" },
          {
            discoveryProvider: "tavily",
            requestedCategory: query.category,
            discoveryQueryId: query.id,
          },
        );
        return { outcome: "success", candidates: candidate === null ? [] : [candidate], retryCount: 0 };
      },
      braveSearch: async () => ({ outcome: "empty", candidates: [], retryCount: 0 }),
    });
    expect(result.candidateSources).toHaveLength(1);
    expect(result.coveredCategories).toEqual(["admissions", "tuition"]);
    expect(result.uncoveredCategories).toEqual([]);
  });

  it("reuses a confidently resolved ROR identity for later category fallback", async () => {
    let rorCalls = 0;
    const result = await discoverResearch(request({ categories: ["admissions", "tuition"] }), {
      tavilySearch: async () => ({ outcome: "empty", candidates: [], retryCount: 0 }),
      braveSearch: async () => ({ outcome: "empty", candidates: [], retryCount: 0 }),
      rorSearch: async (_name, context) => {
        rorCalls += 1;
        const candidate = normalizeCandidateSource(
          { url: "https://example.edu", title: "Example University", publisher: "Example University", sourceType: "university" },
          {
            discoveryProvider: "ror",
            requestedCategory: context?.requestedCategory,
            discoveryQueryId: context?.discoveryQueryId,
          },
        );
        return {
          outcome: "success",
          candidate: candidate ?? undefined,
          identity: {
            universityName: "Example University",
            officialUrl: "https://example.edu",
            officialHost: "example.edu",
            rorId: "https://ror.org/01abcdefg",
          },
          retryCount: 0,
        };
      },
    });
    expect(rorCalls).toBe(1);
    expect(result.coveredCategories).toEqual(["admissions", "tuition"]);
    expect(result.providerAttempts.some((attempt) => attempt.provider === "direct" && attempt.category === "tuition" && attempt.outcome === "success")).toBe(true);
  });

  it("rejects a chosen ROR organization whose Unicode name conflicts with the requested institution", async () => {
    const result = await searchRorAffiliation("\u5927\u5b66\u4e00", {}, {
      fetchImpl: async () => new Response(JSON.stringify({
        items: [{
          chosen: true,
          organization: {
            id: "https://ror.org/01abcdefg",
            status: "active",
            names: [{ value: "\u5927\u5b66\u4e8c", types: ["ror_display", "label"] }],
            domains: ["example.edu"],
            links: [{ type: "website", value: "https://example.edu" }],
          },
        }],
      }), { status: 200 }),
    });
    expect(result.outcome).toBe("empty");
  });

  it("uses the ROR display name and website link type instead of first-array ordering", async () => {
    const result = await searchRorAffiliation("Example University", {}, {
      fetchImpl: async () => new Response(JSON.stringify({
        items: [{
          chosen: true,
          organization: {
            id: "https://ror.org/01abcdefg",
            status: "active",
            names: [
              { value: "EU", types: ["acronym"] },
              { value: "Example University", types: ["ror_display", "label"] },
            ],
            domains: ["example.edu"],
            links: [
              { type: "wikipedia", value: "https://en.wikipedia.org/wiki/Example_University" },
              { type: "website", value: "https://example.edu" },
            ],
            locations: [{ geonames_details: { country_code: "US" } }],
          },
        }],
      }), { status: 200 }),
    });
    expect(result).toMatchObject({
      outcome: "success",
      identity: {
        universityName: "Example University",
        officialUrl: "https://example.edu",
        officialHost: "example.edu",
        countryCode: "US",
      },
    });
    expect(result.candidate?.url).toBe("https://example.edu/");
  });

  it("classifies an aborted ROR request timeout separately from upstream failure", async () => {
    const result = await searchRorAffiliation("Example University", {}, {
      fetchImpl: async () => { throw new DOMException("timed out", "AbortError"); },
    });
    expect(result).toMatchObject({ outcome: "failed", failureKind: "timeout" });
  });

  it("excludes personal values from provider queries while retaining public target context", async () => {
    expect(containsSensitiveResearchData("What is the GPA requirement?"))
      .toBe(false);
    expect(containsSensitiveResearchData("International student IELTS 7.5 entry requirement"))
      .toBe(false);
    expect(containsSensitiveResearchData("My GPA is 3.8; email me at student@example.com"))
      .toBe(true);
    expect(containsSensitiveResearchData("passport number AB123456"))
      .toBe(true);
    expect(containsSensitiveResearchData("IELTS 7.5, Thai citizen"))
      .toBe(true);
    expect(containsSensitiveResearchData("I scored 7.5 in IELTS"))
      .toBe(true);
    expect(containsSensitiveResearchData("My annual budget is USD 24000"))
      .toBe(true);
    const parsed = request({ categories: ["admissions"], question: "My GPA is 3.8; email me at student@example.com" });
    const resolution = await resolveResearchTarget(parsed);
    expect(resolution.resolved).toBe(true);
    if (!resolution.resolved) return;
    const queries = planDiscoveryQueries(parsed, resolution);
    expect(queries).not.toHaveLength(0);
    expect(queries.every((query) => !query.text.includes("student@example.com"))).toBe(true);

    const observedQueries: string[] = [];
    const result = await discoverResearch(parsed, {
      tavilySearch: async (query) => {
        observedQueries.push(query.text);
        return { outcome: "empty", candidates: [], retryCount: 0 };
      },
      braveSearch: async (query) => {
        observedQueries.push(query.text);
        return { outcome: "empty", candidates: [], retryCount: 0 };
      },
      enableRor: false,
    });
    expect(observedQueries.every((query) => !query.includes("student@example.com"))).toBe(true);
    expect(result.warnings).toContain("research question contains private or sensitive data; it was excluded from discovery queries");
  });

  it("fails closed for a sensitive question-only request", async () => {
    const parsed = request({
      target: undefined,
      categories: ["admissions"],
      question: "My passport number is AB123456 and I need advice",
    });
    const result = await discoverResearch(parsed, {
      tavilySearch: async () => ({ outcome: "failed", candidates: [], retryCount: 0, failureKind: "policy" }),
      braveSearch: async () => ({ outcome: "failed", candidates: [], retryCount: 0, failureKind: "policy" }),
    });
    expect(result.queries).toHaveLength(0);
    expect(result.providerAttempts).toHaveLength(0);
    expect(result.uncoveredCategories).toEqual(["admissions"]);
  });
});
