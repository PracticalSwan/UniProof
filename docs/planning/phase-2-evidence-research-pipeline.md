# Phase 2 — Evidence and Research Pipeline

Status: Phase 2A implemented; Phase 2B–2F remain planned.

## Goal

Build the evidence-first backend pipeline that converts a bounded university/program research request into validated, traceable claims. Every material factual value must retain its source, supporting passage, retrieval time, applicable intake/year when known, and evidence status.

Phase 2 must work before Research Mode is wired to live providers. The core unit is a claim, not a generated paragraph.

## Non-negotiable invariants

- Retrieved content and model output are untrusted data.
- Missing evidence becomes `unknown`, never a guessed value.
- Conflicting credible evidence remains `conflicting`; it is not silently resolved.
- AI inference remains distinguishable from sourced fact.
- Every factual claim must point to one or more source records and supporting evidence.
- Retrieval must reject SSRF destinations and remain bounded by protocol, redirects, time, bytes, and content type.
- Provider failures must preserve already-validated partial results.
- Gemini free-tier processing must not receive applicant personal data or sensitive documents.
- Deployment, publication, destructive Git operations, and production persistence remain out of scope unless separately authorized; repository initialization/publication was separately authorized and has already occurred.

## Gemini API decision — researched 2026-08-16

UniProof will use the Gemini Developer API through Google AI Studio rather than OpenAI.

### Connection

- Use the current official JavaScript SDK: `@google/genai`.
- Keep `GEMINI_API_KEY` server-only; never expose it through `NEXT_PUBLIC_*` or browser bundles.
- Use the Gemini Interactions API for new integration work because Google currently recommends it as the primary API surface for Gemini models and new capabilities.
- Construct the SDK client only inside server-only provider modules.
- Use stateless interactions with `store: false`; no Phase 2 flow needs server-managed Gemini conversation history.
- Use schema-constrained JSON output and validate the returned JSON again with the project Zod contract before it becomes a claim candidate.
- Do not enable Gemini Google Search grounding on the free tier. Gemini 3.x Search grounding is not available on the free tier, and UniProof already has a separate discovery/retrieval boundary.

### Free-tier model policy

Primary model: `gemini-3.5-flash-lite`.

Use it for high-volume claim extraction, document classification, category assignment, temporal-field extraction, and simple normalization. Google describes it as the GA model optimized for high-throughput and simple data processing, which matches most Phase 2 extraction calls.

Escalation model: `gemini-3.6-flash`.

Use it only when the primary extraction is ambiguous, schema-invalid after one bounded repair attempt, or the evidence set contains a material conflict requiring a higher-quality semantic comparison. It is also free for input/output tokens on the current free tier, but it should not become the default high-frequency model.

Do not use `gemini-3.1-pro-preview`: the current pricing table marks it unavailable on the free tier.

### Rate-limit strategy

Google no longer publishes a stable universal RPM/TPM/RPD table for every free-tier project. Active limits are shown in AI Studio, are applied per project rather than per key, and are explicitly not guaranteed.

Therefore UniProof must not hard-code a claimed quota. Instead:

- treat AI Studio's current project limits as the operational source of truth;
- default to one concurrent Gemini request per research run;
- impose a server-side maximum Gemini-call budget per research run;
- batch cleaned documents where doing so preserves source identity and fits token bounds;
- use Flash-Lite for the normal path and Flash only for escalation;
- honor `429 RESOURCE_EXHAUSTED` with bounded exponential backoff plus jitter;
- parse provider retry hints when available;
- never spin in an unbounded retry loop;
- return partial/incomplete research when the call budget or quota is exhausted;
- make model IDs and call budgets server-side configuration, not browser-controlled parameters.

### Free-tier privacy consequence

Google states that content submitted to unpaid Gemini API services may be used to improve Google products and may be reviewed under the applicable terms. `store: false` disables Interactions API state storage but does not convert unpaid usage into paid-service data handling.

Phase 2 therefore sends only public-source research content plus the minimum research question needed for extraction. Do not send applicant profiles, citizenship, GPA, contact details, documents, or other personal/sensitive data to Gemini while the project uses the unpaid tier.

## Planned server configuration

The later Gemini integration should introduce server-only configuration equivalent to:

- `GEMINI_API_KEY`
- `GEMINI_PRIMARY_MODEL=gemini-3.5-flash-lite`
- `GEMINI_ESCALATION_MODEL=gemini-3.6-flash`
- `GEMINI_MAX_CALLS_PER_RUN`
- `GEMINI_MAX_RETRIES`
- `GEMINI_CONCURRENCY`

Exact numeric call/concurrency defaults must be conservative and tested against the project's current AI Studio limits before live research is enabled. Do not expose quota configuration to untrusted clients.

## End-to-end Phase 2 flow

```text
ResearchRequest
  -> discovery query planning
  -> candidate source discovery
  -> outbound URL policy
  -> bounded retrieval
  -> document normalization
  -> Gemini structured claim extraction
  -> Zod validation
  -> deterministic claim normalization/reconciliation
  -> evidence/freshness/conflict classification
  -> ResearchResult + partial/failure metadata
```

## Phase 2A — Research safety boundary and core contracts

Purpose: establish safe, testable boundaries before any live search or AI provider is called.

Implemented 2026-08-16:

- Zod-first contracts live under `lib/research/contracts/` and reuse the existing domain/evidence schemas.
- Server-owned retrieval bounds live under `lib/security/research-limits.ts`.
- `lib/security/outbound-url.ts` exposes syntax validation, conservative canonicalization, public IPv4/IPv6 classification, resolver-injected resolution-time validation, and redirect-target revalidation. The post-review IPv6 policy fails closed outside the current IANA `2000::/3` global-unicast allocation and blocks special-purpose/reserved prefixes such as IETF protocol assignments, documentation, returned 6bone, and mapped private IPv4 destinations.
- Deterministic tests run with Vitest and do not perform live DNS, web, Tavily, Gemini, or Supabase calls. Review regressions cover current IANA cases including `100:0:0:1::/64`, deprecated `2001:10::/28`, returned `3ffe::/16`, reserved `4000::/3`, and malformed resolver address-family metadata.
- Resolution-time validation returns the validated address set for a future pinned transport. It does not by itself prevent a later ordinary `fetch(url)` from resolving a hostname again; Phase 2C must pin or revalidate the connection lookup.

### Core research contracts

Add Zod-first contracts and derive TypeScript types for:

- `ResearchRequest`: target university/program, requested categories, intake/year, locale, and bounded free-text question.
- `ResearchRun`: run ID, lifecycle status, timestamps, provider/call-budget summary, and partial-result state.
- `CandidateSource`: discovered URL, title, publisher/domain, source type, discovery origin, and relevance metadata.
- `ResearchDocument`: canonical URL, source identity, retrieval metadata, content type, normalized text/sections, and content hash.
- `ClaimCandidate`: model-extracted factual candidate tied to source/supporting passage.
- `VerifiedClaim`: normalized claim plus final evidence classification and source references.
- `EvidenceSummary`: counts/coverage/conflicts/unknowns/outdated state.
- `ResearchResult`: validated output container for sources, claims, evidence summary, and run status.

Do not model Comparison or Guide entities in Phase 2A.

### Outbound URL policy

Create one reusable server-only policy used by every direct source retrieval path. It must reject unsupported protocols, URL credentials, localhost names, loopback, unspecified, private, link-local, multicast/reserved ranges, and cloud metadata destinations.
The policy must resolve hostnames and reject any resolved blocked IP before the connection. Redirect destinations must be revalidated at every hop. Do not rely on hostname string checks alone.

### Retrieval bounds

Phase 2A should define, even before full HTML cleaning exists:

- HTTPS preferred; HTTP allowed only when policy explicitly permits it.
- explicit connect/request timeout;
- small redirect limit;
- maximum response bytes;
- allowlist of research-safe MIME types;
- response streaming/abort once byte limits are exceeded;
- bounded per-run source count and per-domain source count;
- canonical URL normalization and duplicate detection;
- safe user agent identifying UniProof research retrieval;
- no cookie forwarding, browser session reuse, client authorization headers, or credential forwarding.

### Phase 2A tests

Phase 2A covers URL syntax/canonicalization, IPv4/IPv6 classification, metadata/localhost blocking, resolver failures and DNS timeout, redirect-target validation, redirect budgets, contract-level MIME restrictions, source/reference integrity, and duplicate/contradictory contract state.

Actual HTTP transport enforcement for connect/request timeout, streamed response-byte limits, response MIME handling, and redirect following belongs to Phase 2C and must receive transport-level tests when that fetcher exists. Phase 2A must use deterministic local/mocked network behavior and must not require real Tavily or Gemini credentials.

## Phase 2B — Source discovery and provider adapters

Purpose: discover likely authoritative sources without coupling research orchestration to one provider payload.

### Discovery policy

Prefer sources in this order when the claim category allows it:

1. official university/program/admissions pages;
2. government, accreditation, or regulator sources;
3. authoritative structured datasets such as ROR/OpenAlex/College Scorecard/Discover Uni;
4. high-quality independent sources;
5. rankings or community sources only for categories where those sources are semantically appropriate.

Tavily is a discovery provider, not automatically the evidence authority. Store the underlying publisher URL as the source whenever possible.

### Adapter boundary

Each provider adapter returns normalized `CandidateSource` records and hides provider-specific response fields. Initial adapters may include Tavily discovery plus ROR/OpenAlex and selected national datasets.

Discovery must support category-aware queries, deduplicate equivalent URLs, avoid repeatedly selecting many pages from the same domain, retain provider provenance, and enforce a source-count budget before retrieval.

No adapter may bypass the outbound URL policy when a discovered URL is later fetched directly.

## Phase 2C — Source acquisition and normalization

Purpose: convert safely retrieved source material into a stable model/input representation while preserving provenance.

`ResearchDocument` should retain the canonical URL, title, publisher/domain, source type, retrieval timestamp, HTTP metadata needed for diagnostics, content type, normalized readable text, section/headings where useful, and a deterministic content hash.

Normalization rules:

- never render or execute retrieved HTML in the application;
- remove scripts/styles/navigation noise where practical without deleting relevant factual text;
- preserve headings, tables converted to readable text, and nearby labels needed to interpret dates/fees;
- keep exact supporting substrings recoverable for evidence attribution;
- normalize whitespace and obvious encoding issues safely;
- detect duplicate content by canonical URL and content hash;
- keep raw provider payloads out of domain contracts;
- truncate/segment oversized documents deterministically before Gemini input;
- mark partial/truncated documents explicitly.

The MVP should use focused page retrieval, not recursive crawling. A research run has a hard source/page budget.

PDF support may be added only if it can use the same bounded retrieval and provenance rules; broad document-upload support remains outside Phase 2.

## Phase 2D — Gemini structured claim extraction

Purpose: extract claim candidates from normalized public-source documents without allowing model output to become truth directly.

### Provider module

Create a server-only Gemini adapter around `@google/genai`. The rest of the codebase consumes a project-owned interface rather than importing the Google SDK directly.

The adapter must:

- read only server-side Gemini configuration;
- use `gemini-3.5-flash-lite` on the normal path;
- set `store: false` for every Interactions API request;
- request structured JSON matching the project extraction schema;
- validate returned JSON with Zod again;
- classify provider errors into retryable/non-retryable categories;
- implement bounded retries with exponential backoff and jitter;
- record safe metrics such as model, duration, token metadata when provided, outcome, and retry count without logging full source text or secrets;
- escalate to `gemini-3.6-flash` only under explicit deterministic conditions.

### Extraction contract

Each `ClaimCandidate` must include category/property/value, optional unit/currency/date/academic year/intake, source/document reference, supporting text, extraction method/model, and extraction confidence only if its semantics are explicitly documented.
Extraction instructions must tell Gemini to extract only facts supported by the supplied document, quote or identify the supporting passage, preserve uncertainty, and omit fields that are not supported. Retrieved webpage instructions must be treated as quoted source content, never as model/system instructions.

Gemini must not assign the final UniProof evidence status. Final evidence classification is deterministic application logic in Phase 2E.

### Escalation conditions

An escalation to `gemini-3.6-flash` is permitted only when one of these conditions is recorded:

- primary output remains schema-invalid after one bounded repair attempt;
- the supporting passage and extracted value are materially inconsistent;
- multiple credible source candidates appear semantically contradictory and deterministic normalization cannot establish whether they refer to different periods/scopes;
- a complex table/requirement needs higher-quality semantic interpretation.

Do not escalate simply to make prose sound better. Phase 2 is an extraction pipeline, not a chat-completion loop.

### Call-budget behavior

When the Gemini budget is exhausted, keep validated candidates already produced, mark unprocessed documents/categories, and return a partial run. Never substitute synthetic values for skipped extraction.

## Phase 2E — Deterministic reconciliation and evidence classification

Purpose: convert claim candidates into normalized claims and evidence states without delegating truth decisions to an LLM.

Group comparable candidates using university/program identity, normalized property, category, scope, and applicable intake/academic year. Normalize dates, currencies, units, booleans, and known categorical values before comparing evidence.

Evidence-state rules must be explicit and testable. At minimum:

- `verified`: supported by the relevant authoritative primary source under the project's evidence policy;
- `corroborated`: materially equivalent claim supported by multiple independent reliable sources;
- `university-reported`: university-published information where independent corroboration is absent or not expected;
- `conflicting`: current/relevant credible sources materially disagree after period/scope normalization;
- `anecdotal`: claim is opinion/community experience rather than institutional fact;
- `inferred`: an application-derived interpretation based on identified evidence, never a substituted source fact;
- `unknown`: no sufficiently reliable evidence supports a value;
- `outdated`: evidence exists but applies to a superseded intake/year or is outside the defined freshness rule.

Conflict records must preserve each competing value/source. Unknown values must not become zero, false, or the least favorable comparison value.

`EvidenceSummary` should expose state counts, category coverage, unresolved conflicts, stale categories, and unprocessed/failed categories separately.

## Phase 2F — Fixtures, orchestration, and verification

Purpose: prove the pipeline with deterministic cases before connecting it to the Research UI.

Create fixtures/tests for:

- one current authoritative claim;
- corroborated equivalent claims;
- materially conflicting current claims;
- old intake/year evidence classified as outdated;
- no usable evidence classified as unknown;
- anecdotal-only evidence;
- duplicate canonical URLs and duplicate content;
- malformed Gemini JSON;
- valid JSON that fails project semantic validation;
- Gemini 429/rate-limit response and retry exhaustion;
- Gemini non-retryable failure;
- source discovery failure with retained direct/structured sources;
- retrieval timeout/oversize/unsupported content;
- blocked SSRF URL and redirect-to-private-IP case;
- partial research run with successful and failed categories.

The orchestrator should be a small deterministic pipeline coordinator. Avoid production-style multi-agent orchestration. Each step consumes and returns project-owned contracts and records a bounded status/failure result.

Only after these tests pass should Phase 3 connect `/research` to a live research endpoint and expose loading, partial, conflict, stale, error, and retry states.

## Planned module boundaries

The exact names may specialize to local conventions, but the intended ownership is:

```text
lib/
  research/
    contracts/
    discovery/
    retrieval/
    normalization/
    extraction/
    verification/
    orchestration/
  integrations/
    gemini/
    tavily/
    ror/
    openalex/
  security/
    outbound-url.ts
    research-limits.ts
```

Provider SDK types must stop at the integration adapter. UI and domain code must not depend on Gemini/Tavily response shapes.

## Persistence decision

Do not make Supabase persistence a prerequisite for Phase 2A–2E correctness. First prove the pipeline in memory using stable contracts and deterministic fixtures.

Once contracts and evidence semantics are stable, a later Phase 2 task may add source/claim persistence. Before private/user-owned research history exists, database migrations and RLS must be designed and verified. Public reusable research caching may be considered separately with explicit freshness rules.

## Phase 2 completion criteria

Phase 2 is complete when a bounded research request can produce a validated `ResearchResult` containing source records, normalized claims, supporting passages, evidence states, evidence coverage, conflicts/unknowns/outdated categories, and explicit partial/failure metadata.

Required evidence before completion:

- SSRF and redirect policy tests pass, including IPv4 and IPv6 blocked destinations.
- Retrieval timeout, byte, redirect, source-count, and content-type bounds are exercised.
- All model output crosses structured-output plus Zod validation before claim use.
- Every factual claim resolves to source/supporting evidence.
- Unknown/conflicting/outdated states survive reconciliation without fabricated resolution.
- Gemini rate-limit and provider-failure tests prove bounded retries and partial-result behavior.
- No Gemini secret can enter a client bundle or `NEXT_PUBLIC_*` variable.
- Free-tier Gemini calls contain public research content only.
- `npx tsc --noEmit`, lint, build, relevant automated tests, dependency audit, and workspace verification pass.
- Focused security review covers outbound retrieval, prompt injection, secrets, provider quotas, and safe logging.
- Repository Git operations remain separately authorized actions; the public `origin/main` repository is already initialized and published.

## Explicitly deferred from Phase 2

- applicant eligibility evaluation;
- fit scoring and ranking logic;
- application checklist generation;
- authentication and user-owned research history;
- sensitive document ingestion;
- admission-probability prediction;
- autonomous recursive crawling;
- long-running multi-agent production orchestration;
- deployment, publication changes, destructive Git operations, or Devpost submission.

## Execution order

1. Phase 2A: core contracts, outbound URL policy, retrieval limits, deterministic security tests.
2. Phase 2B: discovery contract and first approved provider adapters.
3. Phase 2C: bounded retrieval implementation and normalized research documents.
4. Phase 2D: Gemini adapter, structured extraction, call budgets, retries, escalation.
5. Phase 2E: deterministic normalization, freshness, conflict, evidence classification.
6. Phase 2F: orchestration, full fixture matrix, focused security review, handoff to Phase 3.

Do not skip Phase 2A to connect live Gemini or Tavily earlier.

## Official Gemini references verified for this plan

- Gemini API overview / Interactions API recommendation: https://ai.google.dev/gemini-api/docs
- Latest models: https://ai.google.dev/gemini-api/docs/latest-model
- Pricing/free-tier availability: https://ai.google.dev/gemini-api/docs/pricing
- Rate-limit behavior: https://ai.google.dev/gemini-api/docs/rate-limits
- API-key setup/security: https://ai.google.dev/gemini-api/docs/api-key
- Interactions storage/retention: https://ai.google.dev/gemini-api/docs/interactions-overview
- Structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Free/unpaid-service data handling: https://ai.google.dev/gemini-api/terms

Re-check these sources before implementing the Gemini adapter because models, free-tier availability, and quotas are mutable.
