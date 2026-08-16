# Phase 2B–2C Execution Runbook — Discovery, Retrieval, and Normalization

Status: implemented and verified. This runbook records the completed Phase 2B–2C batch and its verification boundary.

Parent architecture: `docs/planning/phase-2-evidence-research-pipeline.md`.

## Purpose and precedence

This runbook specializes the parent Phase 2 plan into exact implementation order, module ownership, failure behavior, and acceptance tests for Phase 2B and Phase 2C. It does not replace `AGENTS.md`, the Phase 2A contracts, or the security policy.

If prose in this runbook conflicts with implemented Phase 2A behavior, inspect the live contract/security code and update this runbook before changing the safety boundary. Never weaken Phase 2A merely to make a provider integration easier.

## Batch scope

Implement together:

1. Phase 2B provider-neutral discovery with `Tavily -> Brave Search -> direct/structured` fallback.
2. Phase 2B provider setup UX for discovery keys.
3. Phase 2C DNS-pinned bounded HTTP(S) retrieval.
4. Phase 2C deterministic HTML/plain-text normalization into `ResearchDocument`.
5. Deterministic tests for discovery failover, transport safety, normalization, and partial results.

Do not implement Gemini, Groq, OpenRouter, AI extraction, AI reconciliation, Supabase persistence, Research UI wiring, recursive crawling, or paid-provider behavior in this batch.
## Protected inputs and prerequisites

Before editing, read the live versions of:

- `lib/research/contracts/research.ts`
- `lib/security/outbound-url.ts`
- `lib/security/research-limits.ts`
- `lib/env/server.ts`
- `.env.example`
- `.gitignore`
- `package.json` and `package-lock.json`

Preserve the Phase 2A regression suites. Contract extensions required by this batch must be additive where practical, must remain Zod-first/strict/bounded, and must receive regression tests before downstream code relies on them.

The existing `ResearchRun.discoveryProvider` field is insufficient to describe multi-provider fallback. Add bounded provider-attempt telemetry before orchestration needs it; do not overload one string with a comma-separated history.

## Required module ownership

Use these paths unless the live repository has an established narrower convention:

```text
lib/research/discovery/types.ts
lib/research/discovery/resolve-target.ts
lib/research/discovery/query-plan.ts
lib/research/discovery/dedupe.ts
lib/research/discovery/orchestrator.ts
lib/research/discovery/direct.ts
lib/research/retrieval/types.ts
lib/research/retrieval/fetch-public.ts
lib/research/normalization/html.ts
lib/research/normalization/plain-text.ts
lib/research/normalization/document.ts
lib/integrations/tavily/search.ts
lib/integrations/brave/search.ts
lib/integrations/ror/search.ts
scripts/setup-providers.mjs
tests/phase2b-discovery.test.ts
tests/phase2c-retrieval.test.ts
```

Provider wire types stop inside `lib/integrations/*`. Research modules consume project-owned types only.
## Cross-stage project-owned types

Create small internal types rather than passing provider payloads through the pipeline.

`ResolvedResearchTarget` is the project-owned identity used by query planning. It contains the request's canonical university/program IDs when known, resolved names, optional degree/country/subject context, and an optional trusted official URL/host only when that value came from approved local identity data or a confidently disambiguated structured identity source. The implemented contract has no first-class campus field; do not imply otherwise or invent a campus identifier/property convention. Never fabricate an official URL from a university name.

Target resolution must return a project-owned discriminated result rather than throwing vendor-shaped errors: either `{ resolved: true, target: ResolvedResearchTarget, warnings: [...] }` or `{ resolved: false, reason, warnings: [...] }`. Use a bounded reason vocabulary at least covering `unresolved-id`, `identity-conflict`, `ambiguous-identity`, and `insufficient-institutional-identity`. These are discovery/identity outcomes, not provider failures. If a later `ResearchResult` needs to surface one, map it to the existing bounded `source-discovery` operational failure while preserving the more specific internal reason in bounded safe metadata; do not broaden public failure vocabularies merely to expose an implementation detail.

`DiscoveryQuery` should contain a stable query ID, requested category, query text, resolved target identity context, optional locale/country hint, and bounded result count.

`DiscoveryAttempt` should contain provider, category/query ID when applicable, outcome, retry count, safe duration metadata, and an optional bounded failure kind. `outcome` uses `success`, `empty`, `skipped`, or `failed`. Failure kind is separate and uses the shared bounded vocabulary `configuration`, `authentication`, `rate-limit`, `timeout`, `upstream`, `invalid-response`, `capability`, `policy`, or `budget`. Do not encode `empty` as a failure kind.

`DiscoveryResult` should contain normalized candidate sources, attempt records, covered/uncovered categories, and bounded warnings. It must not contain raw Tavily/Brave payloads.

`coveredCategories` / `uncoveredCategories` describe discovery candidate coverage only. They must never be copied directly into `EvidenceSummary.categoriesProcessed`, `categoriesUnprocessed`, or `hasEvidence`; those later fields describe pipeline/evidence outcomes after retrieval, extraction, and gating.

`RetrievedResponse` is an internal transient object containing final canonical URL, redirect chain, safe response headers, validated/pinned address metadata, retrieved bytes, content type, and retrieval timestamp. It must never be exposed to the browser or persisted as raw provider/network data.

For this batch, make provider-attempt telemetry explicit: add a bounded ordered `providerAttempts` array to `ResearchRun` with a strict Zod schema and reuse the same project-owned attempt shape in later phases. Keep `discoveryProvider` and `extractionModel` for backward-compatible summary fields; do not make them the fallback-history source of truth.

Before query planning, add `program-structure` to `researchCategorySchema`, increase the server-owned category ceiling from six to seven, and add Phase 2A regression coverage proving the new category is accepted while unsupported categories remain rejected. This is required to satisfy the MVP Research Mode requirement for program-structure information; do not hide program structure inside an unrelated category.

## Phase 2B.0 — Resolve research target identity

Query planning must not assume a `ResearchRequest` contains a university/program name or official URL. Phase 2A intentionally permits name-based, ID-based, structured-target, and focused-question requests.

Implement an injected project-owned `ResearchTargetResolver` used before query planning:

- if a request already supplies a university/program name, normalize and retain it without inventing missing IDs;
- if a request supplies application-owned university/program IDs, including `target.program.universityId`, resolve them through the injected resolver backed by approved local/fixture identity data and cross-check all supplied names/IDs against the resolved record; contradictory identity data is `identity-conflict`, not a tie to be guessed through;
- Phase 2B–2C must not require Supabase persistence or invent a seed catalog merely to make ID resolution pass. If no application identity store exists yet, the runtime resolver may legitimately return `unresolved-id`; deterministic tests should inject a small in-memory resolver fixture;
- if an ID cannot be resolved, return an explicit bounded identity/source-discovery failure rather than searching opaque IDs as though they were names;
- a subject-area-only structured target is a topical target, not a university identity. It may drive bounded category-aware web queries but has no institutional direct/ROR fallback;
- a program-name-only target may drive bounded program/category web queries, but the program name must not be treated as a university name for ROR matching; institutional direct/ROR fallback requires resolved university identity;
- a question-only request may use the bounded question plus category intent, but it has no institutional direct/ROR fallback unless a concrete university identity is resolved through an approved project-owned path;
- an official URL/host becomes trusted identity metadata only from approved local data or a confidently matched structured identity result, never from string guessing or search snippets.

For automatic name-to-ROR matching, use the ROR v2 affiliation matching semantics rather than selecting by rank/score. Accept an automatic ROR identity only when the response supplies one active `chosen:true` organization and all application-supplied stable context is compatible. Require exact Unicode-normalized equality against one returned canonical name or alias and, when available, cross-check country and trusted domain. For current ROR v2.1 organization records, select the canonical institution name from the name entry whose `types` contains `ror_display`, and accept an official-site candidate only from a link whose `type` is `website`; do not trust array order and never promote a `wikipedia` link as the official university URL. If ROR supplies no `chosen:true` result, or the chosen result conflicts with trusted country/domain context, leave the identity unresolved/ambiguous; never select the first result or invent a confidence threshold. A known ROR ID may be resolved directly and then cross-checked against supplied context. The built-in credential-free ROR degraded fallback is enabled by default in the runtime discovery orchestrator; deterministic/offline tests may explicitly disable it or inject a mock adapter, but production callers must not need a hidden opt-in flag to receive the documented fallback.

## Phase 2B.1 — Discovery configuration and setup CLI

Update `.env.example` and `lib/env/server.ts` together when the adapters are introduced.

Required discovery secrets:

```text
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
```

Keep all provider keys server-only. Do not add any `NEXT_PUBLIC_*` provider credential.

Add `npm run setup:providers` backed by `scripts/setup-providers.mjs`. The Phase 2B–2C batch established the discovery-key behavior; the implemented Phase 2D extension manages the same file and fixed key flow for Gemini, Groq, and OpenRouter without creating a second setup mechanism.

The setup script must preserve unrelated `.env.local` lines, replace only exact managed keys, hide key input when stdin is an interactive TTY (neutral mask characters may provide typing feedback), restore terminal state in `finally`, never print key values, and keep `.env.local` ignored. If stdin is non-interactive, accept already-set environment variables rather than attempting a visible prompt.
Do not automatically enable full live research mode after provider keys are configured. Phase 2E reconciliation and Phase 2F full in-memory orchestration are implemented, but live Research endpoint/UI wiring remains Phase 3. Report which managed providers are configured and which fallback path is available.

Connectivity checks must be explicit opt-in because they consume provider quota/credits. A default setup run validates file/env configuration only.

The Phase 2B–2C acceptance scope deliberately covered only Tavily and Brave. The current shared command additionally manages Gemini, Groq, and OpenRouter with terminal echo disabled for interactive entry; submitting a blank line preserves an existing managed value. Non-interactive setup skips prompting and validates only already-present environment values. The command still does not enable live mode or perform connectivity checks.

## Phase 2B.2 — Deterministic query planning

Query planning is deterministic in this batch; do not spend AI calls to formulate search queries.

Create one focused general-web query per requested category, plus at most one identity/official-site query when the target has no trusted official URL. Bound the total with server-owned constants. With seven supported categories, a practical initial ceiling is one query per category plus at most one identity query, for no more than 8 planned queries before provider fallback.

Keep each general-web query at or below 350 characters and 45 whitespace-delimited words so it remains below Brave's current 400-character / 50-word request limits with margin for later formatting. Query construction must truncate or reject deterministically before an adapter call. Never place applicant profile data, GPA, citizenship, contact details, or sensitive document content in a search query.

The implementation applies a deterministic private-data guard to free-text questions: public questions remain usable, detected personal values or sensitive document references are omitted from provider queries, and a sensitive question with no other public target fails closed with an explicit warning.

Use target university/program names, requested category, intake/academic year when supplied, and category-specific keywords. Do not add unsupported facts to make a query more specific.

Example category intents:

- `admissions`: admissions requirements, entry requirements, English language, application deadline;
- `tuition`: tuition, fees, cost, academic year;
- `scholarships`: scholarships, funding, eligibility, deadline;
- `program-structure`: curriculum, modules/courses, credits, duration, core/elective structure;
- `research`: research groups, labs, faculty/research areas;
- `outcomes`: graduate outcomes/employment only when a source can support it;
- `support`: international student support, academic/student services.

Query IDs must be deterministic within a run so mocked tests can assert exact failover behavior.

## Phase 2B.3 — Tavily adapter

Use the Tavily Search endpoint only. Do not use Tavily Crawl/Map/Research as an implicit crawler.

Use basic search depth, `include_answer=false`, `include_raw_content=false`, and a small bounded result count. Search-provider snippets are discovery hints only and must not become evidence/supporting text.

Authenticate the Tavily REST call only with the server-side API key in the `Authorization: Bearer ...` header. Explicitly keep `search_depth=basic` and do not enable automatic parameter selection that can silently increase search depth/credit use. Never place the key in the query string, normalized candidate metadata, attempt telemetry, or errors.

Normalize only URL, title, provider provenance, rank/relevance when available, requested category, and safe publisher/domain metadata into `CandidateSource`. Reject malformed/non-HTTP(S) candidates before they reach retrieval.
## Phase 2B.4 — Brave Search fallback

Use Brave Web Search, not Brave Answers. Send the API key only in the required server-side `X-Subscription-Token` header. Keep the query/result bounds aligned with the deterministic query plan.

Invoke Brave only for a query/category that Tavily did not satisfy because Tavily is unconfigured, authentication/configuration failed, timed out, exhausted bounded retry/rate-limit handling, returned an upstream failure, returned an invalid response, or returned no usable HTTP(S) candidates.

Do not call Brave for categories already covered with sufficient usable Tavily candidates merely to compare indexes.

Normalize the result into the same `CandidateSource` shape. Do not persist Brave snippets or full response payloads as evidence.

## Phase 2B.5 — Direct and structured degraded discovery

After general-web discovery is exhausted for a query/category, use direct or structured mechanisms that can still produce useful candidates. Do not invoke structured fallback merely to compare providers after web discovery has already satisfied that query.

Required baseline for this batch:

- trusted official URL from the resolved target identity when one is actually known;
- ROR v2 organization lookup for identity/homepage/domain candidates, with deterministic disambiguation rather than first-result selection.

Treat ROR API records as structured identity provenance. They may improve identity coverage but must not be treated as proof of admissions, tuition, scholarships, or other facts they do not contain. When a confidently matched ROR record yields an official university homepage URL, the discovered page candidate represents the university publisher (`sourceType=university`, `discoveryProvider=ror`); do not mislabel the eventual university webpage as a dataset merely because ROR helped locate it.

College Scorecard and Discover Uni remain approved planned sources, but they are not blockers for this batch's fallback proof. Add them only when their country/category mapping and current official API/license requirements are implemented deliberately. Do not require another secret merely to make the baseline degraded path pass.

General-web results default conservatively to `independent` unless the candidate host exactly matches or is a subdomain of a trusted official university host. Structured adapters assign only their known source class. Never infer authoritative government/accreditation status from marketing text or a search snippet.

## Phase 2B.6 — Deduplication and selection

Canonicalize candidate URLs with the existing outbound canonicalizer for duplicate detection. Fragments must not create distinct candidates.

Deduplicate by canonical URL first. Then enforce `RESEARCH_MAX_SOURCES_PER_DOMAIN` and `RESEARCH_MAX_SOURCES_PER_RUN`. Prefer stronger known source types, exact target/program relevance, category relevance, and earlier provider rank without inventing a universal numeric authority score.

Do not discard an already-valid candidate merely because a later fallback provider fails.

For Phase 2B, a query is **discovery-satisfied** when at least one normalized, in-policy HTTP(S) candidate survives adapter validation for that query. This is intentionally a discovery-only condition: it says nothing about whether retrieval or evidence extraction will later succeed.

Discovery category coverage is computed from category-scoped queries only. An identity-only query can enrich `ResolvedResearchTarget` or produce an identity/homepage candidate, but it must not by itself mark every requested category covered. When a direct/ROR candidate is used as degraded fallback for a particular category query, retain that category association explicitly so coverage remains deterministic.

## Phase 2B.7 — Discovery retry and fallback algorithm

For each planned query/category, execute providers sequentially.

```text
Tavily configured?
  yes -> call Tavily
          >=1 usable candidate -> keep them; query is discovery-satisfied; do not call Brave for that query
          empty/transient exhausted/config/auth/invalid response -> record attempt and continue
  no  -> record skipped/configuration state

Brave configured?
  yes -> call Brave only if query is still discovery-unsatisfied
          >=1 usable candidate -> keep candidates; query is discovery-satisfied
          empty/failure -> record attempt and continue
  no  -> record skipped/configuration state

if query is still discovery-unsatisfied:
  use trusted direct URL / disambiguated ROR when identity/category context supports it
keep all validated candidates
mark uncovered categories explicitly
```

Transient provider failures may receive at most one retry in this batch, honoring a bounded `Retry-After` when safe. Do not retry authentication/configuration errors. Do not retry malformed requests. All waits must fit inside a server-owned per-call/per-run budget; discovery also stops after `RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN` (32) attempts or `RESEARCH_MAX_RUN_TIMEOUT_MS` (60 seconds), whichever comes first.

A provider returning zero results is `empty`, not a fabricated success. An uncovered category after all eligible discovery mechanisms is not a fatal run by itself; it becomes explicit partial/unprocessed state later in orchestration.

## Phase 2C.1 — Retrieval transport design

Do not implement arbitrary-source retrieval with ordinary `fetch(url)` after resolution-time validation. That would re-resolve DNS and leave the Phase 2A rebinding gap open.

Use Node's server-only `node:http` / `node:https` request path with a custom `lookup` that returns only an address from the already validated `resolvedAddresses`. The lookup callback must never call system DNS. Keep the original URL hostname for the HTTP `Host` header and certificate identity verification. For HTTPS with a DNS hostname, set TLS `servername` to that original hostname. For an HTTPS URL whose original host is an IP literal, do not send the IP as SNI (`servername` must remain empty/disabled), but keep normal CA validation and verify the certificate identity against the original IP host; never set `rejectUnauthorized=false`. Never replace the URL hostname with the selected transport IP string.

Keep the first implementation transport-simple and auditable: GET only, no proxy/environment-proxy routing, and no cross-request socket pooling/keep-alive reuse. Pass `agent: false` for this batch so each request gets an isolated one-use connection rather than a reusable global-agent socket. A request socket belongs to one validated URL/hop. If a later implementation adds proxying or pooled connection reuse, it needs a separate security review proving the validated-address invariant still holds.

For each URL:

1. run `validateOutboundUrlAtResolutionTime`;
2. choose a validated address deterministically, preferring IPv4 when both families are available unless later evidence justifies another policy;
3. create the request with lookup pinned to that validated address;
4. enforce connect timeout separately from total request timeout;
5. follow redirects manually only after `validateRedirectTarget` returns a new validated address set;
6. repeat pinning for the validated redirect target;
7. abort on any policy/timeout/size/content failure.
Request headers must be minimal: a UniProof research user agent, `Accept` limited to supported research types, and `Accept-Encoding: identity`. Never forward browser cookies, authorization headers, client IP headers, session headers, or provider credentials to arbitrary source hosts.

Fail closed on HTTPS -> HTTP redirect downgrade in this batch even when direct HTTP retrieval is otherwise explicitly permitted. HTTP -> HTTPS may proceed after normal redirect revalidation. Destroy/discard the redirect response body before opening the next hop, and never replay `Set-Cookie` or any response-derived credential header.

Retain only a small response-header allowlist needed for diagnostics/normalization (for example `content-type`, `content-length`, `content-encoding`, `last-modified`, and `etag`). Do not retain or forward `set-cookie`, authentication, proxy-authentication, or hop-by-hop credential/session headers.

If a server ignores `Accept-Encoding: identity` and returns a non-identity content encoding, fail closed in this batch rather than decoding an unbounded compressed stream. A later explicit decompression feature must enforce both compressed and decompressed byte ceilings.

Only follow standard HTTP redirect statuses relevant to GET retrieval (`301`, `302`, `303`, `307`, `308`). Missing/invalid `Location`, redirect loops, or a fourth redirect are bounded retrieval failures.

## Phase 2C.2 — Response bounds and MIME policy

Enforce `RESEARCH_CONNECT_TIMEOUT_MS`, `RESEARCH_REQUEST_TIMEOUT_MS`, `RESEARCH_MAX_REDIRECTS`, and `RESEARCH_MAX_RESPONSE_BYTES` from the existing server-owned limits module.

Count streamed body bytes as they arrive and destroy/abort the request immediately once the response exceeds the byte ceiling. Do not read the complete body and check size afterward.

Parse the base MIME type case-insensitively from `Content-Type`. Reject a missing/unsupported content type unless a narrowly tested safe fallback is explicitly added. Do not sniff executable or binary formats into text.

`text/html` and `text/plain` are required normalization inputs for this batch.

`application/pdf` remains transport-allowed by Phase 2A, but PDF text extraction is not required in this batch. If a PDF is safely retrieved, return a bounded `normalization`/unsupported-normalizer failure and do not create a fake empty `ResearchDocument`. Do not add a PDF library unless PDF normalization is intentionally pulled into scope with tests.

## Phase 2C.3 — HTML and text normalization

For HTML, use one maintained server-side HTML parser rather than regex-based parsing. Read `package.json` and `package-lock.json` first; if the current stack lacks a parser, add only the minimum dependency needed and verify its current official package/version before installation.

Deterministic HTML normalization must:

- remove `script`, `style`, `noscript`, `template`, `svg`, and `canvas` content;
- preserve headings, paragraphs, lists, definition lists, and tables;
- convert table rows/cells into readable text while preserving row relationships;
- normalize Unicode/whitespace without changing factual values;
- derive a title from the document when available;
- segment text by headings into at most the contract's section limit;
- truncate deterministically at `RESEARCH_MAX_NORMALIZED_TEXT_CHARACTERS` and set `truncated=true`;
- never execute scripts, follow embedded instructions, or render retrieved HTML.

For plain text, decode the declared charset with a safe decoder when supported, fall back conservatively to UTF-8 when the label is absent, normalize line endings/whitespace, and apply the same character ceiling.
## Phase 2C.4 — Source/document promotion and identity

A `CandidateSource` is only a discovery record. Promote it to a result `Source` only after safe retrieval succeeds and the content is usable for normalization.

Generate deterministic bounded IDs in application code rather than asking providers to invent them. Recommended form:

- source ID: prefix plus a truncated SHA-256 of canonical URL;
- document ID: prefix plus a truncated SHA-256 of canonical URL plus normalized content hash.

Set `ResearchDocument.contentHash` to lowercase SHA-256 of the final normalized UTF-8 text. This makes exact normalized duplicates detectable across different URLs without retaining raw response bodies.

`Source.retrievedAt` and `ResearchDocument.retrievedAt` should describe the same successful acquisition event. Use the final canonical URL after redirects, but preserve the original requested URL in `ResearchDocument.originalUrl`.

For general-web results, derive publisher metadata conservatively from candidate metadata or hostname. A hostname fallback is metadata, not proof of source authority.

Deduplicate successfully normalized documents by canonical URL and then normalized content hash. If two URLs normalize to the same content hash, retain provenance for the first accepted source and record a bounded duplicate warning rather than spending later AI calls on both copies.

## Phase 2B–2C contract evolution rules

Before implementation uses new orchestration state, resolve these currently deferred semantics explicitly in code/tests:

- add the bounded ordered `ResearchRun.providerAttempts` telemetry defined above rather than relying on the single `discoveryProvider` string;
- keep provider configuration/auth failures distinguishable from source-discovery coverage failures;
- do not broaden `CandidateSource` to accept unsafe protocols in adapters even though the Phase 2A base schema is intentionally discovery-oriented;
- keep raw retrieval bytes and provider payloads outside `ResearchResult`;
- preserve current Phase 2A limits and strict cross-record provenance checks.

Any change to `research.ts`, `outbound-url.ts`, or `research-limits.ts` requires the existing 39 Phase 2A regressions to remain green plus a new regression demonstrating the added behavior.

## Required Phase 2B deterministic tests

At minimum test:

1. deterministic category-aware query planning and query character/word bounds;
2. program-structure is a first-class research category and query intent;
3. name-based, program-name-only, ID-only, unresolved-ID, subject-area-only, and question-only target resolution behave deterministically without invented identity metadata;
4. ROR automatic matching accepts only a compatible active `chosen:true` result; absent/contradictory matches remain unresolved/ambiguous and never fall back to first-result or score selection;
5. Tavily success means Brave and structured fallback are not called for that satisfied query;
6. Tavily timeout/429/5xx/invalid response falls through after bounded handling;
7. missing/invalid Tavily configuration falls through without leaking the key;
8. Brave success after Tavily failure returns normalized candidates;
9. Tavily and Brave empty/failure retains trusted-direct/ROR candidates;
10. duplicate URL/fragments collapse deterministically;
11. per-domain and total-source budgets are enforced;
12. malformed/non-HTTP(S) provider URLs are discarded before retrieval;
13. uncovered categories remain explicit and do not erase covered categories;
14. discovery coverage is not mistaken for evidence/processed coverage;
15. logs/attempt records contain no API keys or full provider payloads;
16. setup script preserves unrelated `.env.local` content and never writes provider keys to `.env.example`.
## Required Phase 2C deterministic tests

Use local/mock HTTP servers and injected DNS resolvers. Default automated tests must not depend on the public internet.

At minimum test:

1. validated public hostname connects through the pinned validated address rather than a second uncontrolled DNS lookup;
2. the custom lookup never performs system DNS and the connected socket's remote address/family matches the selected validated address for each hop;
3. direct loopback/private/link-local/metadata targets remain blocked;
4. a public first URL redirecting to localhost/private IP is blocked before the second connection;
5. HTTPS -> HTTP redirect downgrade is rejected and HTTP -> HTTPS is independently revalidated;
6. redirect limit and redirect loop are enforced;
7. connect timeout aborts before the overall request timeout;
8. overall request timeout aborts a stalled body;
9. streamed body aborts immediately above `RESEARCH_MAX_RESPONSE_BYTES`;
10. unsupported/missing MIME and non-identity content encoding fail closed;
11. no proxy or pooled socket can bypass per-hop validated-address pinning;
12. HTML normalization removes executable/noise elements while preserving headings, lists, tables, and factual text;
13. plain-text normalization handles line endings/whitespace and deterministic truncation;
14. normalized text/section aggregates remain inside Phase 2A limits;
15. canonical URL and normalized content-hash deduplication work;
16. PDF retrieval does not fabricate a `ResearchDocument` when no PDF normalizer exists;
17. retrieval never forwards cookies, authorization, browser/session headers, provider credentials, or response `Set-Cookie` data;
18. retained response headers are allowlisted and secret/session headers are absent;
19. arbitrary-source errors contain sanitized origin-level URL information only.
20. HTTPS DNS-host requests use the original hostname for SNI/certificate identity, while HTTPS IP-literal requests send no IP SNI, keep normal CA verification, and verify certificate identity against the original IP host without disabling `rejectUnauthorized`.

Keep the actual-socket pinning test offline without weakening the production policy. It is acceptable to test the low-level already-validated transport primitive against a loopback-bound local server using a test-only constructed validated-target fixture, while separate public-fetch integration tests prove the real Phase 2A validator rejects loopback/private addresses before that primitive can be reached. Do not add a runtime `allowPrivate`, `skipValidation`, or similar bypass flag solely for tests.

## Implementation order

Follow this order so each layer has a testable consumer before the next one is added:

1. inspect live contracts/limits/env/package state and run the existing Phase 2A tests;
2. add the `program-structure` research category/category-limit regression, `providerAttempts` contract, resolved-target/discovery internal types, and identity-resolution tests;
3. add discovery constants/budgets if the existing limits module does not cover them;
4. implement deterministic query planning and candidate deduplication;
5. implement Tavily adapter with mocked tests;
6. implement Brave adapter with mocked tests;
7. implement trusted-direct/ROR degraded discovery;
8. implement sequential discovery orchestrator and failover tests;
9. implement/verify the discovery-key setup CLI and environment schema/example changes;
10. implement the DNS-pinned retrieval transport and security tests;
11. implement HTML/plain-text normalization and source/document promotion;
12. add an integration fixture that takes a `ResearchRequest` through discovery -> safe retrieval -> normalized `Source`/`ResearchDocument` without AI;
13. run the complete verification gate and inspect the final diff.

Do not start a later numbered step while an earlier layer has unresolved deterministic failures.

## Acceptance criteria

This batch is complete only when all of the following are true:

- a validated `ResearchRequest` produces deterministic discovery queries;
- all seven MVP research categories, including `program-structure`, are representable and covered by deterministic query planning;
- ID-only/name-based/program-name-only/subject-area-only/question-only requests pass through explicit target-resolution semantics without invented identities;
- Tavily -> Brave -> direct/structured fallback is proven without parallel fan-out;
- discovery provider failure never deletes already-valid candidates;
- arbitrary URLs cannot bypass Phase 2A policy or DNS pinning at the actual connection;
- redirects are revalidated and re-pinned at every hop;
- timeout, byte, redirect, MIME, protocol, DNS/IP, and per-run source bounds are exercised;
- HTML/plain-text sources become strict `Source` + `ResearchDocument` records with recoverable provenance;
- no raw search snippet/provider payload becomes evidence;
- provider keys remain server-only and the setup CLI does not expose them;
- PDF behavior is explicit rather than silently unsupported;
- all Phase 2A and new Phase 2B/2C tests pass;
- TypeScript, lint, build, dependency audit, workspace verification, diff check, and secret scan pass.

Live provider smoke tests are optional and separate from deterministic acceptance. Never make `npm test` require real Tavily/Brave credentials or public DNS.
## Verification commands

Run from the Windows project environment unless a project instruction is updated to say otherwise:

```text
npm test
npx tsc --noEmit
npm run lint
npm run build
npm audit --omit=dev
powershell -ExecutionPolicy Bypass -File scripts/verify-workspace.ps1
git diff --check
```

Run the repository's approved secret scan before any authorized commit/push. If dependencies were added for HTML parsing, inspect both `package.json` and `package-lock.json`, run the relevant audit, and explain why the dependency is necessary.

Do not perform a live provider request merely to claim verification. If an explicit smoke test is run, record which provider was contacted, that only a synthetic/public query was sent, and that the test consumed provider quota/credits.
