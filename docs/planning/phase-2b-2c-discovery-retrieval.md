# Phase 2B–2C Execution Runbook — Discovery, Retrieval, and Normalization

Status: planned. This is the implementation-grade runbook for the next Phase 2 batch.

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
lib/integrations/openalex/search.ts
scripts/setup-providers.mjs
tests/phase2b-discovery.test.ts
tests/phase2c-retrieval.test.ts
```

Provider wire types stop inside `lib/integrations/*`. Research modules consume project-owned types only.
## Cross-stage project-owned types

Create small internal types rather than passing provider payloads through the pipeline.

`DiscoveryQuery` should contain a stable query ID, requested category, query text, target identity context, optional locale/country hint, and bounded result count.

`DiscoveryAttempt` should contain provider, category/query ID when applicable, outcome, retry count, safe duration metadata, and an optional bounded failure kind. Use a bounded vocabulary such as `configuration`, `authentication`, `rate-limit`, `timeout`, `upstream`, `invalid-response`, `policy`, and `empty`.

`DiscoveryResult` should contain normalized candidate sources, attempt records, covered/uncovered categories, and bounded warnings. It must not contain raw Tavily/Brave payloads.

`RetrievedResponse` is an internal transient object containing final canonical URL, redirect chain, safe response headers, validated/pinned address metadata, retrieved bytes, content type, and retrieval timestamp. It must never be exposed to the browser or persisted as raw provider/network data.

If provider-attempt telemetry is added to the public `ResearchRun`, add a strict bounded Zod schema and keep existing fields for backward compatibility. Do not remove Phase 2A fields as part of this batch.

## Phase 2B.1 — Discovery configuration and setup CLI

Update `.env.example` and `lib/env/server.ts` together when the adapters are introduced.

Required discovery secrets:

```text
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
```

Keep all provider keys server-only. Do not add any `NEXT_PUBLIC_*` provider credential.

Add `npm run setup:providers` backed by `scripts/setup-providers.mjs`. During this batch it configures discovery credentials only; Phase 2D extends the same command for AI credentials rather than creating a second setup mechanism.

The setup script must preserve unrelated `.env.local` lines, replace only exact managed keys, hide key input when stdin is an interactive TTY, restore terminal state in `finally`, never print key values, and keep `.env.local` ignored. If stdin is non-interactive, accept already-set environment variables rather than attempting a visible prompt.
Do not automatically enable full live research mode after only discovery keys are configured, because Phase 2D extraction is not implemented yet. Report which discovery providers are configured and which fallback path is available.

Connectivity checks must be explicit opt-in because they consume provider quota/credits. A default setup run validates file/env configuration only.

## Phase 2B.2 — Deterministic query planning

Query planning is deterministic in this batch; do not spend AI calls to formulate search queries.

Create one focused general-web query per requested category, plus at most one identity/official-site query when the target has no trusted official URL. Bound the total with server-owned constants. A practical initial ceiling is one query per category and no more than 7 planned queries before provider fallback.

Keep each general-web query under 350 characters so it remains below Brave's current 400-character limit with margin for later formatting. Never place applicant profile data, GPA, citizenship, contact details, or sensitive document content in a search query.

Use target university/program names, requested category, intake/academic year when supplied, and category-specific keywords. Do not add unsupported facts to make a query more specific.

Example category intents:

- `admissions`: admissions requirements, entry requirements, English language, application deadline;
- `tuition`: tuition, fees, cost, academic year;
- `scholarships`: scholarships, funding, eligibility, deadline;
- `research`: research groups, labs, faculty/research areas;
- `outcomes`: graduate outcomes/employment only when a source can support it;
- `support`: international student support, academic/student services.

Query IDs must be deterministic within a run so mocked tests can assert exact failover behavior.

## Phase 2B.3 — Tavily adapter

Use the Tavily Search endpoint only. Do not use Tavily Crawl/Map/Research as an implicit crawler.

Use basic search depth, `include_answer=false`, `include_raw_content=false`, and a small bounded result count. Search-provider snippets are discovery hints only and must not become evidence/supporting text.

Normalize only URL, title, provider provenance, rank/relevance when available, requested category, and safe publisher/domain metadata into `CandidateSource`. Reject malformed/non-HTTP(S) candidates before they reach retrieval.
## Phase 2B.4 — Brave Search fallback

Use Brave Web Search, not Brave Answers. Send the API key only in the required server-side subscription-token header. Keep the query/result bounds aligned with the deterministic query plan.

Invoke Brave only for a query/category that Tavily did not satisfy because Tavily is unconfigured, authentication/configuration failed, timed out, exhausted bounded retry/rate-limit handling, returned an upstream failure, returned an invalid response, or returned no usable HTTP(S) candidates.

Do not call Brave for categories already covered with sufficient usable Tavily candidates merely to compare indexes.

Normalize the result into the same `CandidateSource` shape. Do not persist Brave snippets or full response payloads as evidence.

## Phase 2B.5 — Direct and structured degraded discovery

After general-web discovery is exhausted for a category, use no-key/direct authoritative mechanisms that can still produce useful candidates.

Required baseline for this batch:

- trusted official URL already present in the target or a resolved canonical university identity;
- ROR organization lookup for identity/homepage/domain candidates;
- OpenAlex institution lookup for institution identity and research-related candidates.

Treat ROR/OpenAlex as structured datasets and preserve their provider identity. They may improve identity/research coverage but must not be treated as proof of admissions, tuition, scholarships, or other facts they do not contain.

College Scorecard and Discover Uni remain approved planned sources, but they are not blockers for this batch's fallback proof. Add them only when their country/category mapping and current official API/license requirements are implemented deliberately. Do not require another secret merely to make the baseline degraded path pass.

General-web results default conservatively to `independent` unless the candidate host exactly matches or is a subdomain of a trusted official university host. Structured adapters assign only their known source class. Never infer authoritative government/accreditation status from marketing text or a search snippet.

## Phase 2B.6 — Deduplication and selection

Canonicalize candidate URLs with the existing outbound canonicalizer for duplicate detection. Fragments must not create distinct candidates.

Deduplicate by canonical URL first. Then enforce `RESEARCH_MAX_SOURCES_PER_DOMAIN` and `RESEARCH_MAX_SOURCES_PER_RUN`. Prefer stronger known source types, exact target/program relevance, category relevance, and earlier provider rank without inventing a universal numeric authority score.

Do not discard an already-valid candidate merely because a later fallback provider fails.
## Phase 2B.7 — Discovery retry and fallback algorithm

For each planned query/category, execute providers sequentially.

```text
Tavily configured?
  yes -> call Tavily
          success with usable candidates -> keep them; do not call Brave for that query
          empty/transient exhausted/config/auth/invalid response -> record attempt and continue
  no  -> record skipped/configuration state

Brave configured?
  yes -> call Brave only if Tavily did not yield usable candidates
          success -> keep candidates
          empty/failure -> record attempt and continue
  no  -> record skipped/configuration state

run direct/ROR/OpenAlex degraded discovery when category/identity context supports it
keep all validated candidates
mark uncovered categories explicitly
```

Transient provider failures may receive at most one retry in this batch, honoring a bounded `Retry-After` when safe. Do not retry authentication/configuration errors. Do not retry malformed requests. All waits must fit inside a server-owned per-call/per-run budget.

A provider returning zero results is `empty`, not a fabricated success. An uncovered category after all eligible discovery mechanisms is not a fatal run by itself; it becomes explicit partial/unprocessed state later in orchestration.

## Phase 2C.1 — Retrieval transport design

Do not implement arbitrary-source retrieval with ordinary `fetch(url)` after resolution-time validation. That would re-resolve DNS and leave the Phase 2A rebinding gap open.

Use Node's server-only `node:http` / `node:https` request path with a custom `lookup` that returns only an address from the already validated `resolvedAddresses`. Keep the original hostname for the HTTP `Host` header and TLS SNI/certificate verification. Never replace the URL hostname with the IP string.

For each URL:

1. run `validateOutboundUrlAtResolutionTime`;
2. choose a validated address deterministically, preferring IPv4 when both families are available unless later evidence justifies another policy;
3. create the request with lookup pinned to that validated address;
4. enforce connect timeout separately from total request timeout;
5. follow redirects manually only after `validateRedirectTarget` returns a new validated address set;
6. repeat pinning for the validated redirect target;
7. abort on any policy/timeout/size/content failure.
Request headers must be minimal: a UniProof research user agent, `Accept` limited to supported research types, and `Accept-Encoding: identity`. Never forward browser cookies, authorization headers, client IP headers, session headers, or provider credentials to arbitrary source hosts.

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

- add bounded provider-attempt telemetry rather than relying on the single `discoveryProvider` string;
- keep provider configuration/auth failures distinguishable from source-discovery coverage failures;
- do not broaden `CandidateSource` to accept unsafe protocols in adapters even though the Phase 2A base schema is intentionally discovery-oriented;
- keep raw retrieval bytes and provider payloads outside `ResearchResult`;
- preserve current Phase 2A limits and strict cross-record provenance checks.

Any change to `research.ts`, `outbound-url.ts`, or `research-limits.ts` requires the existing 39 Phase 2A regressions to remain green plus a new regression demonstrating the added behavior.

## Required Phase 2B deterministic tests

At minimum test:

1. deterministic category-aware query planning and query-length bounds;
2. Tavily success means Brave is not called for that query;
3. Tavily timeout/429/5xx/invalid response falls through after bounded handling;
4. missing/invalid Tavily configuration falls through without leaking the key;
5. Brave success after Tavily failure returns normalized candidates;
6. Tavily and Brave empty/failure retains direct/ROR/OpenAlex candidates;
7. duplicate URL/fragments collapse deterministically;
8. per-domain and total-source budgets are enforced;
9. malformed/non-HTTP(S) provider URLs are discarded before retrieval;
10. uncovered categories remain explicit and do not erase covered categories;
11. logs/attempt records contain no API keys or full provider payloads;
12. setup script preserves unrelated `.env.local` content and never writes provider keys to `.env.example`.
## Required Phase 2C deterministic tests

Use local/mock HTTP servers and injected DNS resolvers. Default automated tests must not depend on the public internet.

At minimum test:

1. validated public hostname connects through the pinned validated address rather than a second uncontrolled DNS lookup;
2. direct loopback/private/link-local/metadata targets remain blocked;
3. a public first URL redirecting to localhost/private IP is blocked before the second connection;
4. redirect limit and redirect loop are enforced;
5. connect timeout aborts before the overall request timeout;
6. overall request timeout aborts a stalled body;
7. streamed body aborts immediately above `RESEARCH_MAX_RESPONSE_BYTES`;
8. unsupported/missing MIME and non-identity content encoding fail closed;
9. HTML normalization removes executable/noise elements while preserving headings, lists, tables, and factual text;
10. plain-text normalization handles line endings/whitespace and deterministic truncation;
11. normalized text/section aggregates remain inside Phase 2A limits;
12. canonical URL and normalized content-hash deduplication work;
13. PDF retrieval does not fabricate a `ResearchDocument` when no PDF normalizer exists;
14. retrieval never forwards cookies, authorization, browser/session headers, or provider credentials;
15. arbitrary-source errors contain sanitized origin-level URL information only.

## Implementation order

Follow this order so each layer has a testable consumer before the next one is added:

1. inspect live contracts/limits/env/package state and run the existing Phase 2A tests;
2. add provider-attempt/discovery internal types and any narrowly required contract extension with tests;
3. add discovery constants/budgets if the existing limits module does not cover them;
4. implement deterministic query planning and candidate deduplication;
5. implement Tavily adapter with mocked tests;
6. implement Brave adapter with mocked tests;
7. implement direct/ROR/OpenAlex degraded discovery;
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
npm audit
powershell -ExecutionPolicy Bypass -File scripts/verify-workspace.ps1
git diff --check
```

Run the repository's approved secret scan before any authorized commit/push. If dependencies were added for HTML parsing, inspect both `package.json` and `package-lock.json`, run the relevant audit, and explain why the dependency is necessary.

Do not perform a live provider request merely to claim verification. If an explicit smoke test is run, record which provider was contacted, that only a synthetic/public query was sent, and that the test consumed provider quota/credits.