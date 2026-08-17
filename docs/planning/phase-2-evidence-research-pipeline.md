# Phase 2 — Evidence and Research Pipeline

Status: Phase 2A–2F implemented. Phase 2 is complete at the validated in-memory backend boundary; deterministic offline verification covers the full discovery -> retrieval -> extraction -> reconciliation -> evidence gate -> explanation -> terminal `ResearchResult` flow. The configured Tavily, Brave, Gemini, Groq, and OpenRouter connections each passed one authorized live smoke request on 2026-08-16; no additional live provider calls were used to complete Phase 2F. Persistence/RLS and live Research UI wiring remain later work.

Implementation runbooks:

- Phase 2B–2C: `docs/planning/phase-2b-2c-discovery-retrieval.md` is the completed-batch implementation and acceptance record.
- Phase 2D–2F: docs/planning/phase-2d-2f-ai-reconciliation-orchestration.md records the implemented Phase 2D extraction and Phase 2E reconciliation/evidence-gate boundaries plus the remaining Phase 2F execution specification.

The parent plan owns Phase 2 architecture and cross-phase invariants. A batch runbook may specialize file paths and execution order but may not weaken this plan, `AGENTS.md`, Phase 2A contracts, or the security model.

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
- Discovery and AI-provider failover must be sequential, bounded, and provenance-preserving rather than parallel fan-out by default.
- Free-tier AI processing must receive only public-source research content and the minimum non-sensitive research question; it must not receive applicant personal data or sensitive documents.
- Deployment, publication, destructive Git operations, and production persistence remain out of scope unless separately authorized; repository initialization/publication was separately authorized and has already occurred.

## AI provider and fallback decision — researched 2026-08-16

UniProof will use project-owned provider interfaces for both discovery and AI inference so that orchestration never depends on one vendor payload or SDK. The application must preserve the same research contracts, evidence rules, and partial-result semantics regardless of which provider is active.

### Primary AI provider: Gemini

Primary extraction model: `gemini-3.5-flash-lite`.

Use it for high-volume claim extraction, document classification, category assignment, temporal-field extraction, and first-pass semantic reconciliation.

Gemini quality escalation model: `gemini-3.5-flash`.

Use it only when Gemini is available, the active account still exposes it on the intended free-tier path, and a recorded extraction-quality/integrity condition requires escalation. The Phase 2D allowlist is intentionally limited to `gemini-3.5-flash-lite` plus `gemini-3.5-flash`; the implementation must not switch automatically to `gemini-3.6-flash` or another unplanned model merely because it is newer or available, and it must never opt into paid inference.

Gemini integration rules:

- use the implemented Gemini Interactions REST endpoint `https://generativelanguage.googleapis.com/v1beta/interactions` through the same bounded server-side provider transport pattern used by the other AI adapters; that exact endpoint passed the authorized live smoke on 2026-08-16, while Google also supports stable `/v1/interactions`, so any migration should be explicit and revalidated; no SDK dependency is required for this batch;
- authenticate with `x-goog-api-key` header, never an API-key query parameter;
- use the current Interactions API statelessly with `store: false`, no tools/background/previous interaction ID;
- request schema-constrained JSON and validate it again with project Zod contracts;
- omit removed/deprecated Gemini output/sampling fields rather than copying old examples;
- keep `GEMINI_API_KEY`, model IDs, budgets, and retry configuration server-only;
- do not use Google Search grounding as the discovery layer; Phase 2B owns source discovery independently.

### AI availability fallback 1: Groq

If the Gemini provider is unavailable after bounded handling, use Groq Free with model `openai/gpt-oss-120b`.

Groq is an availability fallback, not a silent quality downgrade. Its adapter must use the project-owned extraction/reconciliation interface and strict JSON-schema Structured Outputs when supported by the active endpoint. Groq provider/model identity, retry count, bounded duration/outcome, and fallback reason must be recorded through the existing safe provider-attempt vocabulary; do not add token/prompt/response metadata to the Phase 2D attempt contract.

The implementation must remain within the account's current free-plan limits. It must never upgrade a plan, enable billable capacity, or spend money automatically.

### AI availability fallback 2: OpenRouter Free

If Gemini and Groq are unavailable, use `openrouter/free` as the final inference fallback.

Do not pin the final fallback to one nominally free model because OpenRouter's free-model inventory changes. The adapter must request the required structured-output capability, require providers to support the requested parameters, and validate the response with the same project Zod schema. Record the concrete model ID returned by OpenRouter on every successful call so claim provenance identifies the actual model that performed the work.

Use provider data-policy filtering so the router does not select an endpoint that collects prompt data when the requested privacy policy cannot be met. If no eligible free endpoint is available, fail closed to a partial research result instead of relaxing the policy or selecting a paid model.

### Quality escalation versus availability failover

These are separate mechanisms:

1. normal Gemini call uses `gemini-3.5-flash-lite`;
2. a recorded semantic/quality condition may escalate within Gemini to `gemini-3.5-flash`;
3. provider unavailability triggers cross-provider failover to Groq `openai/gpt-oss-120b`;
4. Groq unavailability triggers final failover to `openrouter/free`;
5. if all eligible providers fail, keep validated work and return a partial result.

Availability failover may be triggered by a missing/disabled provider key, bounded retry exhaustion, quota/rate-limit exhaustion, timeout, provider `5xx`, service unavailability, or a required capability being unavailable. Authentication/configuration failures should be recorded distinctly, but the run may continue to the next configured provider.

Do not call multiple AI providers in parallel for the same extraction merely to compare answers. Sequential failover conserves free quotas and makes provenance/failure behavior deterministic.

### Rate-limit and call-budget strategy

Provider limits are mutable and must be treated as runtime configuration rather than hard-coded product promises.

- treat each provider's current dashboard/documentation as the operational source of truth;
- default to one concurrent AI request per research run;
- impose per-provider and total AI-call budgets per run;
- batch or segment normalized documents only when source identity and supporting passages remain recoverable;
- honor provider retry hints where available;
- retry only transient failures with bounded backoff; any jitter/randomness must be injected or otherwise deterministic under tests;
- never spin in an unbounded retry loop;
- stop using a provider when its per-run budget or current free quota is exhausted;
- continue through the configured fallback chain and return partial/incomplete research when all eligible providers are exhausted.

### Free-tier privacy consequence

Phase 2 sends only public university/research source content plus the minimum non-sensitive research question to every free AI provider.

Applicant citizenship, GPA, contact information, personal documents, financial documents, and other sensitive/profile data must not enter the Phase 2 AI extraction or reconciliation chain. Groq and OpenRouter have their own data-control behavior, so adapters must use the strongest compatible no-training/no-collection settings and must never silently relax a configured privacy requirement to obtain a response.

### Operator credential setup

Phase 2B/2D implementation must include a cross-platform setup command such as `npm run setup:providers`. The intended operator experience is that the user obtains provider API keys and pastes them into prompts; the implementor handles the rest.

The setup command must:

- prompt only for the provider keys required by the enabled live mode;
- write/update `.env.local` without echoing or logging secret values;
- preserve unrelated existing environment values;
- ensure local secret files remain Git-ignored;
- update/validate the server environment schema and `.env.example` as providers are implemented;
- configure model IDs, fallback order, endpoints, retry policies, and safe defaults automatically;
- perform no provider connectivity/capability call by default; any future live connectivity check must be an explicit opt-in command/path that uses no private source content and never prints secrets;
- report missing/invalid providers individually and explain which fallback path remains usable.

No popup-specific mechanism is required. A repository-owned CLI is preferred because it is reproducible across Windows, WSL, and CI/dev environments and does not require manually editing source files.

## Planned server configuration

The provider implementation should introduce server-only configuration equivalent to:

- `TAVILY_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_PRIMARY_MODEL=gemini-3.5-flash-lite`
- `GEMINI_ESCALATION_MODEL=gemini-3.5-flash`
- `GROQ_FALLBACK_MODEL=openai/gpt-oss-120b`
- `OPENROUTER_FALLBACK_MODEL=openrouter/free`
- provider-specific maximum calls/retries plus a total AI-call budget;
- conservative concurrency configuration.

Exact numeric quotas must be checked against the active provider accounts before live research is enabled. Do not expose quota or fallback configuration to untrusted clients.

## End-to-end Phase 2 flow

```text
ResearchRequest
  -> project-owned target identity resolution
  -> deterministic discovery query planning
  -> Tavily discovery
       -> Brave Search fallback for still-unsatisfied queries after bounded Tavily empty/config/auth/rate-limit/timeout/upstream/invalid-response handling
       -> trusted direct/ROR degraded fallback for still-unsatisfied institutional queries
  -> outbound URL policy
  -> bounded retrieval
  -> document normalization
  -> provider-neutral AI structured claim extraction
       -> Gemini
       -> Groq fallback
       -> OpenRouter Free final fallback
  -> Zod validation
  -> deterministic value/scope normalization
  -> AI-assisted semantic reconciliation
  -> deterministic evidence-policy gate
  -> evidence-bounded AI explanation
  -> ResearchResult + partial/failure/provider metadata
```

## Phase 2A — Research safety boundary and core contracts

Purpose: establish safe, testable boundaries before any live search or AI provider is called.

Implemented 2026-08-16:

- Zod-first contracts live under `lib/research/contracts/` and reuse the existing domain/evidence schemas. Research-specific boundaries now override permissive base fields where necessary so request intent, source records, claims, document URLs/hashes, provenance references, and evidence-summary aggregates remain bounded and internally consistent.
- Server-owned research/retrieval bounds live under `lib/security/research-limits.ts`, including normalized-document text, claim/run ceilings, source budgets, response bytes, redirects, and timeouts.
- `lib/security/outbound-url.ts` exposes syntax validation, conservative canonicalization, public IPv4/IPv6 classification, resolver-injected resolution-time validation, and redirect-target revalidation. The post-review IPv6 policy fails closed outside the current IANA `2000::/3` global-unicast allocation and blocks special-purpose/reserved prefixes such as IETF protocol assignments, documentation, returned 6bone, and mapped private IPv4 destinations.
- Deterministic tests run with Vitest and do not perform live DNS, web, Tavily, Gemini, or Supabase calls. Review regressions cover current IANA cases, alternate loopback literals, unsafe redirect forms, candidate URL/domain consistency, canonical research-document URL/hash identity, bounded claim/evidence payloads, and result/evidence-summary provenance consistency.
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

## Remaining-phase execution contract

The following rules remove ambiguity for Phase 2B–2F implementations.

### Contract-change discipline

Phase 2A contracts and security primitives are implemented source-of-truth code, not illustrative pseudocode. Before changing `lib/research/contracts/research.ts`, `lib/security/outbound-url.ts`, or `lib/security/research-limits.ts`, identify the exact downstream requirement, add a regression that fails under the old behavior, and preserve all existing Phase 2A regression coverage.

Phase 2B must make one required additive contract change before query planning: add first-class `program-structure` to the research category vocabulary, raise the server-owned category ceiling from six to seven, and regression-test the change. The MVP requirements explicitly include program-structure information; do not silently fold it into admissions or research.

Provider payloads must never become domain contracts. Each adapter converts vendor data into project-owned internal types before orchestration sees it.

When a model/provider needs a narrower schema than the final domain object, define a provider-facing schema instead of asking the provider to manufacture trusted IDs, source authority, evidence states, or application-owned metadata.

### Provider-attempt telemetry

Multi-provider fallback requires an ordered attempt history. Add one bounded project-owned attempt shape when Phase 2B first needs it and reuse it through Phase 2D–2F.

At minimum record:

- stage: discovery, retrieval, extraction, reconciliation, or explanation;
- provider;
- optional concrete model;
- optional requested category/query identifier;
- outcome: success, empty, skipped, or failed;
- retry count;
- safe duration metadata when available;
- bounded failure kind such as configuration, authentication, rate-limit, timeout, upstream, invalid-response, capability, policy, or budget.

Do not record API keys, provider request/response bodies, full source text, full prompts, or full completions in attempt telemetry.

Keep existing `ResearchRun.discoveryProvider` / `extractionModel` fields for compatibility until an explicit migration removes them. Do not encode fallback history into comma-separated strings.

### Default test boundary

The default Vitest suite is deterministic and offline. Provider adapters use mocked HTTP responses; retrieval uses injected DNS plus local/mock HTTP servers. Real Tavily, Brave, Gemini, Groq, OpenRouter, university, DNS, or Supabase access must not be required for `npm test`.

Optional live smoke checks must be explicit commands, use synthetic/public research inputs only, consume the minimum quota, and never become a completion prerequisite when credentials are unavailable.

### Partial-result semantics

Evidence outcome and pipeline execution status are different concepts.

- `unknown`, `outdated`, and `conflicting` may be valid outputs from a fully executed category.
- `unprocessed` means a requested category could not complete the required pipeline because a stage was skipped/exhausted/blocked.
- `failed` category metadata means the pipeline attempted the category but a stage ended in a terminal operational failure.
- already validated candidates/documents/claims survive failures in later stages.

A later phase must not relabel a legitimate `unknown` as a provider failure merely because the evidence was absent.

### Phase 2F lifecycle decision

Orchestration will use these terminal semantics:

- `succeeded`: every requested category completed the required pipeline; evidence may still be unknown, outdated, anecdotal, or conflicting;
- `partial`: at least one requested category completed and at least one requested category is unprocessed/operationally failed;
- `failed`: no requested category reached a usable gated result because of fatal validation/configuration/pipeline failure.

`completed` remains a legacy accepted contract value but the Phase 2F orchestrator must not emit it. `queued` is reserved for a future asynchronous queue and is not emitted by the in-memory MVP orchestrator.

For orchestrator-produced runs, `partial` must equal `status === "partial"`. `completedAt` is required for every terminal status and must not precede `startedAt`; `updatedAt` must not precede `createdAt`. Add these schema invariants when orchestration is implemented rather than leaving the timestamp semantics implicit.

### Evidence-summary decision

A category is `processed` when deterministic/AI stages required for that category ran to an evidence-policy decision, even if the final result is `unknown`.

`hasEvidence` means the category has at least one non-`unknown` gated claim. `outdated`, `conflicting`, `anecdotal`, and `inferred` are still evidence-bearing states. When a completed category has no eligible factual evidence, represent that absence in `EvidenceSummary` with zero claims, `hasEvidence=false`, and membership in `categoriesUnknown`; do not fabricate an `unknown` claim value merely to populate the category.

`categoriesUnprocessed` is operational and must remain disjoint from `categoriesProcessed`. `categoriesFailed` may identify attempted categories with operational failure but must not be used as a synonym for `unknown`.


## Phase 2B — Source discovery and provider adapters

Purpose: discover likely authoritative sources without coupling research orchestration to one provider payload, and preserve useful research when a discovery provider is unavailable.

Exact execution details, file ownership, retry semantics, setup behavior, and deterministic acceptance tests are defined in docs/planning/phase-2b-2c-discovery-retrieval.md.

### Discovery policy

Prefer sources in this order when the claim category allows it:

1. official university/program/admissions pages;
2. government, accreditation, or regulator sources;
3. authoritative structured datasets such as ROR/College Scorecard/Discover Uni;
4. high-quality independent sources;
5. rankings or community sources only for categories where those sources are semantically appropriate.

Search providers discover candidate URLs; they are not evidence authorities. Store and later retrieve the underlying publisher URL whenever possible.

### Discovery failure model

The required web-discovery failover is:

```text
Tavily unavailable
  -> Brave Search
  -> direct/structured providers
  -> partial ResearchResult when coverage remains incomplete
```

Tavily remains the primary general-web discovery adapter. Brave Search is the independent-index fallback and must use its Search API/free monthly credits rather than its answer-generation product. If both general-web providers are unavailable, continue with trusted resolved official URLs and ROR. College Scorecard, Discover Uni, and other national datasets remain deliberate later additions rather than baseline blockers.

Provider failure must be recorded by provider and reason. A discovery outage must not erase candidates already found by another provider. If provider/transport exhaustion prevents the category from completing the required research path, mark it operationally unprocessed/failed and preserve an explicit partial result. If every required discovery mechanism completes successfully but no usable evidence exists, that is evidence absence and may later become a processed `unknown`, not a provider failure.

Fallback should be sequential, not automatic parallel fan-out. Treat timeout, `429`/quota exhaustion, provider `5xx`, and provider unavailability as retryable/failover conditions after bounded handling. Missing or invalid credentials are configuration failures but may still fall through to the next configured provider.

### Adapter boundary

Every discovery adapter returns normalized `CandidateSource` records and hides provider-specific response fields. Initial adapters should include:

- Tavily general-web discovery;
- Brave Search fallback;
- ROR as the baseline structured identity adapter, plus selected national/open authoritative datasets when separately implemented;
- direct known-source candidates where the university/program identity already supplies an authoritative URL.

Discovery must support category-aware queries, deduplicate equivalent URLs, avoid repeatedly selecting many pages from one domain, retain provider provenance, and enforce a source-count budget before retrieval.

Do not persist search-provider snippets or payloads beyond what provider terms/license permit; use them to identify the underlying publisher source and fetch that source through Phase 2C when possible.

No adapter may bypass the outbound URL policy when a discovered URL is later fetched directly.

### Credential/setup requirement

The Phase 2B implementor owns provider wiring, environment-schema changes, fallback configuration, adapter setup, and tests. The user-facing setup should require only `TAVILY_API_KEY` and `BRAVE_SEARCH_API_KEY` entry through the repository setup command; the user should not need to edit adapter code, endpoints, or fallback logic manually.

## Phase 2C — Source acquisition and normalization

Purpose: convert safely retrieved source material into a stable model/input representation while preserving provenance.

Use the same Phase 2B–2C runbook for the required DNS-pinned transport, streamed byte enforcement, redirect revalidation/re-pinning, MIME/content-encoding policy, HTML/plain-text normalizers, and mock/local transport tests.

`ResearchDocument` should retain the canonical URL, title, publisher/domain, source type, retrieval timestamp, HTTP metadata needed for diagnostics, content type, normalized readable text, section/headings where useful, and a deterministic content hash.

Normalization rules:

- never render or execute retrieved HTML in the application;
- remove scripts/styles/navigation noise where practical without deleting relevant factual text;
- preserve headings, tables converted to readable text, and nearby labels needed to interpret dates/fees;
- keep exact supporting substrings recoverable for evidence attribution;
- normalize whitespace and obvious encoding issues safely;
- detect duplicate content by canonical URL and content hash;
- keep raw provider payloads out of domain contracts;
- truncate/segment oversized documents deterministically before AI-provider input;
- mark partial/truncated documents explicitly.

The MVP should use focused page retrieval, not recursive crawling. A research run has a hard source/page budget.

`application/pdf` remains transport-allowed by the Phase 2A MIME contract, but PDF text normalization is not required in the Phase 2B–2C batch. A safely retrieved PDF without an implemented bounded normalizer must produce an explicit normalization/unsupported-normalizer failure, never a fabricated empty ResearchDocument. Broad document-upload support remains outside Phase 2.

## Phase 2D — Multi-provider structured claim extraction

Purpose: extract claim candidates from normalized public-source documents while surviving free-tier provider limits without allowing model output to become truth directly.

Exact provider-facing schemas, adapter error/fallback rules, setup extension, and acceptance tests are defined in docs/planning/phase-2d-2f-ai-reconciliation-orchestration.md.

### Project-owned AI adapter

Create one server-only project interface for structured extraction and semantic-evidence tasks. Provider HTTP/wire types stop at their adapters. Phase 2D uses fixed server-owned REST endpoints plus the repository's bounded response reader rather than introducing an SDK dependency unless a future verified API requirement makes REST insufficient.

Provider order:

1. Gemini (`gemini-3.5-flash-lite`, with `gemini-3.5-flash` only for recorded quality escalation);
2. Groq Free `openai/gpt-oss-120b`;
3. OpenRouter Free `openrouter/free`.

All three paths must produce the same project-owned result contract and then cross the same Zod validation boundary.

The provider layer must:

- read only server-side provider configuration;
- use schema-constrained JSON/Structured Outputs when supported;
- validate every response with the project Zod contract;
- classify provider errors into retryable, quota/unavailable, capability, configuration/authentication, and non-retryable categories;
- implement bounded retries/backoff only for transient failures, with any delay/jitter source injectable or deterministic in tests;
- record only the safe provider-attempt fields the live contract owns: provider/model when applicable, bounded duration, outcome, retry count, and bounded failure kind/failover reason;
- never log API keys, full source documents, or prompt/completion bodies;
- preserve already-validated candidates when later provider calls fail;
- never route to a paid model automatically.

### Gemini adapter

Use the stable Gemini Interactions REST endpoint with `x-goog-api-key`, `store: false`, bounded non-streaming structured output, no tools/background/previous interaction state, and no credential-bearing redirects.

Normal path: `gemini-3.5-flash-lite`.

Quality escalation: `gemini-3.5-flash`, only under an explicitly recorded extraction-quality/integrity condition and only while it remains eligible for the intended free-tier path. A provider outage, authentication problem, capability/policy failure, or exhausted Gemini free quota moves to Groq rather than repeatedly escalating Gemini calls. Do not automatically select `gemini-3.6-flash` or any model outside the explicit Phase 2D allowlist, and never opt into paid inference.

### Groq adapter

Use Groq's OpenAI-compatible API with `openai/gpt-oss-120b`.

Require strict JSON-schema Structured Outputs for extraction/reconciliation calls where the endpoint supports it. Keep the adapter project-owned so no Groq/OpenAI-compatible wire type leaks into research contracts.

Use only free-plan capacity. Hitting the active free quota or bounded retry exhaustion moves the request to OpenRouter Free.

### OpenRouter adapter

Use `openrouter/free` as the final fallback rather than a fixed free model ID.

Requests must declare the structured-output requirement and require eligible routed providers to support the requested parameters. Record the concrete model returned by OpenRouter. Apply the configured data-collection/privacy filter; if no eligible free endpoint satisfies both capability and privacy requirements, return a provider-unavailable result rather than routing to paid inference or weakening privacy.

### Extraction contract

Models must not emit the trusted `ClaimCandidate` domain object directly. Define one strict portable provider-facing schema for all three providers: top-level `{ claims: [...] }`, at most 12 claims, `additionalProperties:false` on every object, all JSON-schema properties required, and logically optional fields represented as nullable. Each payload contains only category/property/scalar value, nullable unit/currency/effective date/academic year/intake, an application-supplied ephemeral segment ID, and an exact supporting-text substring. Validate the raw supporting string before trim/case/Unicode normalization; preserve valid sibling payloads when another returned claim fails promotion, while a valid empty claim array remains an empty result rather than malformed output. Do not include model self-confidence.

Deterministically segment each `ResearchDocument` before AI input (initially 5,000 Unicode code points with 250-code-point same-section overlap, always `overlap < maximum` with monotonic advancement), preserve section/source boundaries, and never call once per category when one segment task can cover its full eligible category set. Application code verifies segment ID and exact supporting substring, then attaches resolved university/program identity, deterministic candidate ID, source/document references, extraction method, and actual provider/model provenance before constructing `ClaimCandidate`. Promotion-invalid provider payloads are reflected as `invalid-response` attempts rather than successful telemetry. Overlap deduplication may collapse only deterministic duplicates within the same source/document; it must not collapse distinct source/document provenance. Provider output cannot assign source authority, final evidence state, trusted IDs, or other application-owned metadata.

Extraction instructions tell every model to extract only facts stated by the supplied segment, cite the exact supporting substring, preserve uncertainty by omitting unsupported claims, and treat retrieved webpage instructions as source content rather than model/system instructions.

No Phase 2D model assigns the final UniProof evidence state.

### Call-budget behavior

Call budgets apply both per provider and across the full run. Phase 2D starts with a server-owned ceiling of 24 actual extraction HTTP attempts per research run, counting primary calls, transient retries, Gemini quality escalation, and cross-provider fallback; concurrency remains one. When one provider is exhausted, retain validated work and move only unfinished work through the next eligible provider. If the total budget or the entire provider chain is exhausted, mark unfinished extraction/categories operationally incomplete for Phase 2F. Never substitute synthetic values for skipped extraction.

### Credential/setup requirement

The Phase 2D implementor owns REST wiring, environment-schema changes, model/fallback configuration, retries, validation, and provider tests. Extend the existing repository setup command so its fixed managed-key set contains Tavily, Brave, Gemini, Groq, and OpenRouter; the user should only provide the three new AI keys, with no manual source-code configuration. Preserve unrelated `.env.local` content, never print secret fingerprints, perform no connectivity call by default, and do not automatically flip research mode to live.

## Phase 2E — AI-assisted reconciliation with deterministic evidence gates

Status: implemented as a standalone in-memory stage. Phase 2F terminal orchestration remains deferred.

Purpose: make AI a core reasoning component for semantic evidence comparison while keeping source authority, provenance, and final evidence-policy constraints deterministic and testable.

Phase 2E intentionally separates tasks that require exact computation from tasks that require semantic interpretation. The detailed source of truth is `docs/planning/phase-2d-2f-ai-reconciliation-orchestration.md`; this parent plan records the same hard boundaries at architecture level.

Phase 2E remains a standalone in-memory stage rather than the Phase 2F terminal orchestrator. It consumes validated Phase 2D candidates plus application-owned source/document/target context and an explicit caller-supplied set of categories that are operationally eligible for an evidence decision. Only that eligible set may become category-level `unknown`; a retrieval/extraction/reconciliation gap must remain operationally incomplete instead of being mislabeled as missing evidence.

The Phase 2D provider transport is generalized, not duplicated, so telemetry can use `extraction`, `reconciliation`, and `explanation` stages while preserving the verified extraction behavior. Extraction remains capped at 24 actual AI HTTP attempts/run. Phase 2E adds product-owned ceilings of 12 reconciliation attempts/run and 6 explanation attempts/run, with provider-specific counters, one active request at a time, the existing bounded retry/backoff behavior, at most 12 semantic pair questions/request, and at most 144 ambiguous semantic questions/run. Pair overflow is unresolved/incomplete, never silently truncated. These are application safety/cost bounds, not mutable vendor-quota promises; Phase 2F still calculates the integrated provider-attempt result-contract ceiling.

Final claims must be mechanically traceable to extracted candidates. `VerifiedClaim` evolves to truthful university ID-or-name identity, optional program ID/name/intake, and required bounded unique `candidateIds`; its source/document/supporting provenance is derived exactly from those candidates. Final claims do not carry uncalibrated extraction confidence and do not use claim-level `verificationStatus="unknown"`. No reconciled factual scalar may be synthesized from thin air: every emitted value must correspond to at least one referenced candidate after only allowed deterministic normalization.

### Step 1 — Deterministic normalization

Application code normalizes facts that have objective transformations before semantic comparison:

- university/program identity, using stable IDs when available and Unicode-normalized trusted names otherwise;
- trusted degree/program scope; the live claim contract has no campus field, so campus-specific evidence must remain scope-incompatible unless a deliberate tested campus contract is added;
- property/category names;
- dates, effective dates, academic years, and intake periods;
- currencies and units without inventing exchange-rate conversions;
- booleans and known categorical values;
- canonical URLs/source identity;
- duplicate values and duplicate content.

This prevents the model from spending quota on transformations that code can perform exactly and keeps comparisons scoped to the same entity, period, and property.

### Step 2 — AI semantic reconciliation

For candidate claims that are not safely comparable by exact rules, use the Phase 2D AI-provider chain to classify their semantic relationship.

The structured reconciliation result should distinguish at least:

- materially equivalent wording;
- genuine contradiction;
- different academic/intake periods;
- different campuses/program scopes/degree levels;
- general rule versus program-specific rule;
- exception or conditional qualification;
- broader/narrower statements that can coexist;
- insufficient evidence to determine the relationship.

The model must cite only the supplied candidate/source/document references in its reconciliation output. It cannot create new source IDs, facts, or evidence.

AI reconciliation is a core product capability because university requirements are frequently expressed in different natural-language forms that exact string/value comparison cannot reliably resolve.

### Step 3 — Deterministic evidence-policy gate

Application code converts validated candidate relationships into allowed UniProof evidence states according to explicit source-policy rules.

The AI may propose semantic relationships, but it cannot override hard evidence constraints. For example:

- only an eligible authoritative source can satisfy the policy for `verified`;
- multiple materially equivalent independent reliable sources are required for `corroborated`;
- credible current sources that remain materially contradictory stay `conflicting`;
- anecdotal/community evidence cannot be promoted to institutional fact;
- old-period evidence remains `outdated` when the requested period is newer;
- missing evidence remains `unknown`;
- AI-derived interpretation remains `inferred` when it is not itself a source fact.

Conflict records preserve each competing value/source. Unknown values never become zero, false, or a pessimistic substitute.

### Step 4 — Evidence-bounded AI explanation

After the deterministic gate produces the allowed claim/evidence graph, AI may generate concise user-facing explanations of equivalence, conflict, scope differences, or freshness decisions.

Explanations must reference only gated claims and evidence, must not introduce new factual values, and must remain replaceable by a non-AI fallback representation if all AI providers are unavailable.

### Provider-failure behavior

If AI reconciliation becomes unavailable after the full Gemini -> Groq -> OpenRouter Free chain, deterministic rules still resolve exact/obvious cases. A category that cannot reach its required evidence-policy decision because semantic reconciliation was operationally required remains unprocessed/failed as applicable; do not relabel provider exhaustion as evidence `unknown`. Only a category that completed the required pipeline with no eligible factual evidence becomes category-level unknown.

`EvidenceSummary` exposes state counts, category coverage, conflicts, stale categories, and unprocessed/failed categories. Unresolved semantic questions remain bounded Phase 2E stage diagnostics and make affected categories operationally incomplete; do not invent an `EvidenceSummary` field that the live contract does not contain.

This design keeps AI central to extraction, semantic interpretation, reconciliation, and explanation while keeping the product's evidence guarantees outside model control.

## Phase 2F — Full in-memory orchestration and Phase 2 completion

Purpose: join the already verified Phase 2B–2E stages into one truthful end-to-end `ResearchResult`, prove provider/category lifecycle and evidence invariants under every bounded failure mode, and complete the Phase 2 backend before any Research UI or persistence wiring.

The implementation-grade source of truth is `docs/planning/phase-2d-2f-ai-reconciliation-orchestration.md`. Phase 2F must preserve the released Phase 2E hardening rather than reinterpreting it: mandatory candidate provenance, ownership-established university authority, conservative period/scope semantics, bounded semantic overflow, truthful attempt telemetry, zero-claim unknown semantics, UTF-16-safe explanation fallback, and the public-only AI seams all remain mandatory.

Create fixtures/tests for:

- one current authoritative claim;
- corroborated equivalent claims expressed with materially different wording;
- materially conflicting current claims;
- same-looking values that apply to different years/campuses/scopes;
- an AI semantic-equivalence decision accepted by the deterministic policy gate;
- an AI-proposed evidence state that the deterministic gate must reject/downgrade;
- old intake/year evidence classified as outdated;
- no usable evidence classified as unknown;
- anecdotal-only evidence;
- duplicate canonical URLs and duplicate content;
- Tavily success without Brave use;
- Tavily timeout/429/unavailability followed by successful Brave discovery;
- Tavily and Brave failure followed by retained direct/structured sources and a partial result;
- malformed AI-provider JSON;
- valid structured output that fails project semantic validation;
- Gemini quota/unavailability followed by successful Groq extraction;
- Gemini and Groq failure followed by successful `openrouter/free` extraction;
- OpenRouter provenance recording the concrete routed model ID;
- complete AI-provider-chain exhaustion with retained validated candidates and unprocessed categories;
- provider retry exhaustion and non-retryable failure;
- retrieval timeout/oversize/unsupported content;
- blocked SSRF URL and redirect-to-private-IP case;
- partial research run with successful and failed categories.

The orchestrator should remain a small deterministic pipeline coordinator, not a production-style multi-agent system. Each stage consumes and returns project-owned contracts, records bounded provider/failure status, and never discards validated results because a later stage fails.

Mandatory integration rules:

- resolve the target once; refactor the Phase 2B/C compatibility pipeline to expose a project-owned stage result rather than re-resolving identity later;
- canonicalize the requested category set before dispatch so equivalent requests are permutation-stable;
- preserve multi-category associations when canonical source dedupe chooses one strongest `CandidateSource`;
- distinguish discovery `covered`, clean `empty`, degraded direct/ROR salvage, and operational `failed` after final source selection; degraded salvage is retained but is not decision-eligible, and category coverage is derived after source-count/domain limits rather than from pre-budget hits;
- a selected category-associated retrieval/normalization failure keeps that category incomplete unless exact redundancy with a retained usable document is proven;
- a clean empty category bypasses retrieval/extraction AI and may become category-level unknown only after the required bounded work completed;
- add a backward-compatible per-document category scope to extraction so Phase 2F sends each segment only the categories actually associated with that document; an unprocessed segment makes those associated categories incomplete, not unrelated categories, while preserving earlier candidates;
- Phase 2E receives only categories that completed B/C/D; final claims are filtered to Phase 2E-completed categories while sources/documents/candidates from incomplete work remain retained;
- add bounded final evidence explanations to `ResearchResult` instead of generating and discarding Phase 2E explanation output; every processed category has exactly one validated/model or deterministic-fallback explanation, and zero-claim unknown categories consume no explanation AI;
- split discovery's 32-record attempt limit from the final result-history limit and derive the whole-run ceiling as **86 = 32 discovery + 28 extraction + 16 reconciliation + 10 explanation**; actual HTTP attempts are never truncated and repeated non-dispatched budget/configuration telemetry is deduplicated to the documented bound;
- do not fabricate retrieval provider attempts; retrieval/normalization failures remain sanitized operational failures;
- split the existing 60-second `RESEARCH_MAX_RUN_TIMEOUT_MS` into a discovery-specific deadline rather than applying it to the full Phase 2F pipeline;
- caller cancellation is a truthful `cancelled` operational outcome, never mislabeled timeout, and cannot trigger another retry/fallback after abort;
- `categoriesFailed` is always a subset of unprocessed; provider failures that later fall back successfully remain telemetry, not terminal category failures;
- rebuild EvidenceSummary and explanations from final processed categories/final claims, then validate the complete `ResearchResult` at the return boundary.

Delegation for any future rework of this completed Phase 2F path follows the canonical model-specific policy in `AGENTS.md`: GLM-5.3 Max performs implementation and final review entirely in the main agent with zero subagents, while native OpenAI GPT models retain the final read-only `code-reviewer` step after their own inline review and local gates. Historical Phase 2F GLM-reviewer instructions are superseded and must not be reused.

Only after these tests pass should Phase 3 connect `/research` to a live research endpoint and expose loading, partial, conflict, stale, unresolved-semantic, error, provider-fallback, and retry states.

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
    groq/
    openrouter/
    tavily/
    brave/
    ror/
  security/
    outbound-url.ts
    research-limits.ts
```

Provider SDK/wire types must stop at the integration adapters. UI, orchestration, and domain code must not depend on Gemini, Groq, OpenRouter, Tavily, or Brave response shapes.

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
- Discovery failover tests prove Tavily -> Brave -> direct/structured degraded behavior without losing validated candidates.
- AI-provider tests prove Gemini -> Groq -> OpenRouter Free failover, bounded retries, concrete model provenance, and partial-result behavior.
- No AI/search provider secret can enter a client bundle or `NEXT_PUBLIC_*` variable.
- Free-tier AI/search calls contain only public research content and minimum non-sensitive research context.
- AI semantic reconciliation cannot bypass deterministic evidence-policy gates.
- Phase 2F proves the exact 86-record integrated provider-attempt ceiling without enlarging discovery beyond its separate 32-record bound or truncating actual attempts.
- Final `ResearchResult` explanations are evidence-bounded, claim-referenced, deterministic-fallback capable, and present exactly once per processed category; zero-claim unknown categories consume no explanation AI.
- Terminal lifecycle tests prove succeeded/partial/failed partitions, cancellation, monotonic timestamps, categoriesFailed subset unprocessed, and final-claim pruning for incomplete categories.
- `npx tsc --noEmit`, lint, build, relevant automated tests, dependency audit, and workspace verification pass.
- Focused security review covers outbound retrieval, prompt injection, provider failover, secrets, free-tier quotas, privacy routing, and safe logging.
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

1. Phase 2A is complete: core contracts, outbound URL policy, retrieval limits, and deterministic security tests.
2. Phase 2B + Phase 2C are complete and verified: Unicode-safe target resolution, Tavily -> Brave -> direct/ROR discovery, DNS-pinned retrieval, bounded normalization, provider telemetry, and deterministic regressions are the implemented baseline recorded in the dedicated runbook.
3. **Phase 2D is implemented and verified** — portable structured extraction, deterministic segmentation/exact quote promotion, Gemini 3.5 Flash-Lite -> bounded 3.5 Flash quality escalation -> Groq -> OpenRouter Free failover, provider-specific plus total attempt budgets, bounded retries/telemetry, and the fixed provider-key setup flow. On 2026-08-16, one explicitly authorized live request succeeded for each configured Tavily, Brave, Gemini, Groq, and OpenRouter connection; normal automated tests remain offline and deterministic.
4. **Phase 2E is implemented, independently re-reviewed, and released in `bc1901b`** — truthful ID-or-name verified-claim identity, mandatory candidate provenance, deterministic normalization, AI semantic reconciliation, ownership-established authority/independence gates, conservative period/scope handling, bounded reconciliation/explanation budgets, category-level unknown semantics, and evidence-bounded deterministic explanation fallback.
5. **Phase 2F is implemented and verified** — `runPhase2Research` now coordinates B/C/D/E in memory with exact category lifecycle, caller cancellation across target resolution/retrieval/AI stages, per-document extraction category scope, processed-category-only final claims, one validated/fallback explanation per processed category, a derived 86-record final provider-history bound with discovery still capped at 32, and deterministic succeeded/partial/failed output. Phase 2 is complete; Phase 3 Research Mode is next.

Do not skip the established Phase 2A safety boundary when connecting live discovery or AI providers.

## Official provider references verified for this plan

Gemini:

- Interactions API: https://ai.google.dev/api/interactions-api-v1
- Interactions API overview: https://ai.google.dev/gemini-api/docs/interactions
- Interactions API changes: https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026
- Pricing/free-tier availability: https://ai.google.dev/gemini-api/docs/pricing
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Structured outputs: https://ai.google.dev/gemini-api/docs/structured-output

Groq:

- GPT-OSS 120B: https://console.groq.com/docs/model/openai/gpt-oss-120b
- Structured Outputs: https://console.groq.com/docs/structured-outputs
- Free-plan rate limits: https://console.groq.com/docs/rate-limits
- Data handling: https://console.groq.com/docs/your-data

OpenRouter:

- Free Models Router: https://openrouter.ai/docs/guides/routing/routers/free-router
- Structured Outputs: https://openrouter.ai/docs/guides/features/structured-outputs
- Provider routing/privacy controls: https://openrouter.ai/docs/guides/routing/provider-selection
- Provider logging/data retention: https://openrouter.ai/docs/guides/privacy/provider-logging/

Brave:

- Search API/pricing: https://brave.com/search/api/
- API privacy notice: https://api-dashboard.search.brave.com/privacy-policy

Tavily:

- Search API/authentication/parameters: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Rate limits: https://docs.tavily.com/documentation/rate-limits

ROR:

- ROR REST API: https://ror.readme.io/docs/rest-api
- Automatic affiliation matching: https://ror.readme.io/docs/api-affiliation

Re-check provider models, free quotas/credits, privacy controls, and API behavior immediately before implementing or materially changing an adapter because these are mutable external facts.
