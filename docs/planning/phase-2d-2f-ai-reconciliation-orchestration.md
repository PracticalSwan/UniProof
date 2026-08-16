# Phase 2D–2F Execution Runbook — AI Extraction, Reconciliation, and Orchestration

Status: Phase 2D implemented and verified. Deterministic automated coverage remains offline; on 2026-08-16 one explicitly authorized live smoke request succeeded for each configured Tavily, Brave, Gemini, Groq, and OpenRouter connection. Phase 2E–2F remain planned.

Parent architecture: `docs/planning/phase-2-evidence-research-pipeline.md`.

## Purpose and sequence

This runbook removes implementation discretion from Phase 2D–2F while preserving the parent plan and Phase 2A safety/contracts.

Recommended batches:

1. Phase 2D alone: provider-neutral structured extraction and provider failover.
2. Phase 2E alone: deterministic normalization, semantic reconciliation, and deterministic evidence gates.
3. Phase 2F alone: end-to-end orchestration, lifecycle invariants, fixture matrix, and security verification.

Do not combine Phase 2D with unfinished Phase 2B–2C networking work. Provider/schema failures and retrieval-security failures must remain independently diagnosable.

## Protected inputs

Before implementation, read the live Phase 2A contracts, completed Phase 2B–2C modules, environment schema, provider setup command, package manifest/lockfile, security model, and source policy.

Keep the default test suite offline and deterministic. Real provider calls are optional explicit smoke tests only.

All Phase 2D–2F schemas, extraction paths, reconciliation groups, evidence gates, summaries, fixtures, and terminal orchestration must continue to support all seven `researchCategorySchema` values established in Phase 2B: `admissions`, `tuition`, `scholarships`, `program-structure`, `research`, `outcomes`, and `support`. No later phase may silently collapse `program-structure` into another category.

## Live baseline and mandatory contract alignment

The current `main` baseline already implements Phase 2A–2C. Treat these facts as source-of-truth inputs for the remaining phases:

- discovery has explicit Unicode-safe target resolution, Tavily -> Brave -> direct/ROR sequential fallback, and a built-in credential-free ROR degraded path;
- canonical-URL deduplication preserves stronger source provenance and discovery coverage independently of candidate deduplication;
- safe retrieval is DNS-pinned per hop, rejects redirect downgrade/private targets, bounds streamed bytes/time/MIME/encoding, and exposes only allowlisted response headers;
- normalized HTML/plain-text documents are the only model-ready content; PDF transport without a normalizer is an explicit failure and never produces a fake document;
- `runDiscoveryRetrieval()` intentionally stops before AI, returns no claims, leaves requested categories operationally unprocessed, and may already record discovery/retrieval failures in `EvidenceSummary.categoriesFailed`;
- active provider contracts contain Tavily, Brave, ROR, direct, Gemini, Groq, and OpenRouter only. OpenAlex is not an active provider.

Before Phase 2D implementation, add only the contract changes required by the live remaining pipeline:

1. Extend `researchProviderAttemptSchema` with an optional bounded `model` string so AI attempts can record model provenance safely. On a successful AI attempt, prefer the concrete model identifier returned by the provider and require it for OpenRouter because `openrouter/free` is only a router ID. On an attempt that fails before a concrete route/model is known, `model` may contain the server-owned requested model/router ID. Do not add separate requested-model fields, prompts, completions, raw errors, API keys, or arbitrary metadata to attempt telemetry in Phase 2D.
2. Add bounded optional `intake` to `ClaimCandidate` now because the request already carries intake and later period-aware reconciliation requires it. Provider-facing nullable `intake` is converted to application-owned `undefined` when absent.
3. Add bounded optional `extractionProvider` to `ClaimCandidate` so promoted model output retains the actual trusted provider alongside `extractionModel`; the provider-facing payload still cannot supply either field.
4. Do not change `VerifiedClaim` identity semantics in Phase 2D. Phase 2E must resolve the existing mismatch that `ClaimCandidate` supports university-name-only research while `VerifiedClaim` currently requires `universityId`: evolve `VerifiedClaim` to accept a bounded `universityName` alternative and optional `programName` when no application-owned IDs exist, with strict at-least-one identity rules and cross-record regressions. Never fabricate stable IDs from names just to satisfy the current schema.
5. Do not raise the global provider-attempt ceiling speculatively in Phase 2D. Phase 2F must calculate the complete discovery + extraction + reconciliation + explanation worst-case under the actual operational budgets and then raise the bound only if the full orchestrator requires it, with a regression.
6. Preserve `ResearchRun.discoveryProvider` and `extractionModel` only as compatibility summaries. Ordered `providerAttempts` is the execution-history source of truth.

Phase 2D is the implemented extraction batch. Do not implement Phase 2E or Phase 2F runtime behavior in this batch; their contracts remain documented here so Phase 2D does not paint them into an incompatible corner.

## Required module ownership

Use these paths unless the live repository has already established a narrower equivalent:

```text
lib/research/ai/types.ts
lib/research/ai/structured-task.ts
lib/research/extraction/types.ts
lib/research/extraction/schema.ts
lib/research/extraction/segments.ts
lib/research/extraction/promote.ts
lib/research/extraction/orchestrator.ts
lib/research/reconciliation/types.ts
lib/research/reconciliation/schema.ts
lib/research/reconciliation/normalize.ts
lib/research/reconciliation/semantic.ts
lib/research/verification/evidence-policy.ts
lib/research/verification/explanation.ts
lib/research/orchestration/run-research.ts
lib/integrations/gemini/structured.ts
lib/integrations/groq/structured.ts
lib/integrations/openrouter/structured.ts
tests/phase2d-extraction.test.ts
tests/phase2e-reconciliation.test.ts
tests/phase2f-orchestration.test.ts
```

Provider wire types stop at `lib/integrations/*`. Final evidence policy never lives in a provider adapter.
## Phase 2D.1 — Portable provider-facing extraction schema

Do not ask any model to emit the trusted `ClaimCandidate` domain object directly. Define one provider-facing schema and use the same semantic shape for Gemini, Groq, and OpenRouter so fallback does not change what counts as valid extraction.

Use a strict top-level object `{ claims: [...] }`. Every object sets `additionalProperties: false`; the `claims` array has `maxItems: 12`. To remain portable to Groq strict Structured Outputs, every declared JSON Schema property is required; logically optional data uses nullable unions and application code converts `null` to `undefined` after validation. Use portable union forms supported by both Gemini and Groq strict mode: represent the heterogeneous scalar `value` with `anyOf` branches for string/number/boolean, and nullable scalar metadata with a type union including `null` (or an equivalent supported `anyOf`). Keep provider JSON Schema constraints conservative and perform project-specific bounds/date/currency normalization in application validation rather than depending on a vendor-only schema keyword. Do not maintain a looser Gemini schema and a stricter Groq schema.

Each `ExtractedClaimPayload` contains only:

- `category`: one of the seven `researchCategorySchema` values and one of the categories assigned to the extraction task;
- `property`: bounded non-empty property name;
- `value`: bounded scalar `string | number | boolean`; arrays/objects/null are not factual values in this contract;
- `unit`: required-but-nullable bounded string;
- `currency`: required-but-nullable three-letter uppercase currency code;
- `academicYear`: required-but-nullable bounded string;
- `effectiveDate`: required-but-nullable ISO date;
- `intake`: required-but-nullable bounded string;
- `segmentId`: a required ephemeral application-supplied segment ID from the exact task context;
- `supportingText`: bounded non-empty exact supporting substring copied from that segment.

Do not include model self-confidence in Phase 2D. It is not calibrated evidence confidence and adds no deterministic gate value. The model must not choose source authority, evidence status, source/document IDs, university/program IDs, run IDs, provider-attempt IDs, extraction method, source type, provenance, or any other trusted application-owned metadata.

Bound a single response to at most 12 extracted claims and at most 256 KiB of provider response bytes. Preserve the existing Phase 2A aggregate claim ceiling across the run.

After the bounded provider body is decoded and parsed, retain the original parsed strings for provenance checks. The provider-facing project schema must be non-transforming for `segmentId`/`supportingText` (no trim, case-folding, or Unicode normalization). Validate the portable shape/bounds, run the exact supporting-text integrity check against that original parsed string, and only then perform any allowed application normalization/conversion such as nullable `null` -> `undefined` before creating a `ClaimCandidate`. Application promotion must independently prove all of the following:

1. `segmentId` exists in the exact extraction task that was sent;
2. the **raw returned** `supportingText` is checked before trim/case/Unicode normalization and is an exact code-point sequence occurring in that segment's text; reject leading/trailing-whitespace mutation rather than relying on the domain schema's trimming behavior, and allow no fuzzy repair, whitespace invention, normalization, or nearest-quote substitution;
3. `category` belongs to the task's requested/eligible category set;
4. property/value/nullable metadata obey project bounds and date/currency rules;
5. the application, not the model, attaches deterministic candidate ID, university/program identity from the resolved target, `sourceId`, `documentId`, `extractionMethod=model`, and the actual provider/concrete model provenance.

A payload that fails any promotion check is rejected and contributes no candidate. Validate and preserve valid sibling payloads independently when the response envelope itself is schema-valid: one bad claim must not erase other valid claims from the same response. A non-empty response in which **all** claim payloads fail deterministic promotion integrity may classify the logical task as `invalid-response`; an explicitly valid `{ claims: [] }` is an empty extraction result, not malformed output and not by itself a quality-escalation trigger. Repeated text is disambiguated by `segmentId`. Overlapping segments may yield duplicate valid payloads; deduplicate only within the same source/document using a deterministic typed claim key (category + normalized property + scalar type/value + nullable unit/currency/period fields + exact supporting text), while preserving distinct source/document provenance even when factual values match.

## Phase 2D.2 — Deterministic document segmentation

Never send an entire `ResearchDocument.normalizedText` merely because it is under the Phase 2A storage bound. Build deterministic extraction segments first so model inputs stay bounded under the smallest active provider budget while supporting passages remain recoverable.

Initial server-owned segmentation defaults:

- maximum segment size: 5,000 Unicode code points;
- overlap: 250 Unicode code points, only between adjacent chunks of the same source section;
- preserve section order and headings when available;
- prefer paragraph/sentence/whitespace boundaries before a hard code-point cut;
- use code-point-safe slicing so surrogate pairs are never split;
- derive stable ephemeral segment IDs from document ID plus section/chunk ordinal or deterministic hash;
- if `ResearchDocument.sections` is empty, segment `normalizedText` with the same rules;
- never combine text from different documents/sources into one extraction segment.

Treat the segmentation bounds as invariants: `0 <= overlap < maximum segment size`, the next chunk must always advance, and a short/final chunk must not create an empty follow-on chunk or an overlap-only infinite loop. The 5,000-code-point ceiling applies to the segment body; bounded heading metadata may be carried separately rather than prepended in a way that changes the exact substring surface used for provenance.

Each segment task carries the segment, source/document identity in application-owned metadata, and the full requested category set that is eligible for that document. Do **not** multiply calls by seven by making one provider request per category. One structured response can contain claims across the assigned categories.

If segmentation or the extraction call budget leaves later segments unfinished, preserve all earlier validated candidates and mark the unfinished extraction work operationally incomplete for Phase 2F; never synthesize claims for skipped segments.

## Phase 2D.3 — Common provider interface, transport, budgets, and error model

Create one server-only project-owned structured-task interface that receives a task kind, portable JSON schema, bounded public segment context, eligible category set, provider/model policy, abort signal, and shared budget state, then returns either validated structured data plus safe attempt metadata or a bounded provider failure. Provider adapters must not know `ClaimCandidate` or evidence-policy semantics.

Prefer native server-side `fetch` for all three Phase 2D adapters rather than adding SDK dependencies: the current repository already has a bounded JSON response reader and the required APIs have stable REST endpoints. Fixed provider endpoints are application constants, never request/user configuration. Every provider request uses `redirect: "error"`, sends credentials in headers rather than URL query strings, uses an `AbortController`, and feeds the response through the bounded JSON reader before any provider-specific parsing. Do not follow a redirect that could replay an API key to another origin.

Initial Phase 2D operational defaults:

- AI request timeout: 30 seconds per HTTP attempt;
- provider response body ceiling: 256 KiB;
- maximum structured output tokens: 1,500 where the provider exposes an output-token control;
- maximum actual AI HTTP requests for Phase 2D extraction per research run: 24, including retries, quality escalation, and fallback calls;
- one active AI request at a time per research run;
- maximum one transient retry for one provider/task, matching the current `retryCount <= 1` contract;
- an accepted `Retry-After` delay must be numeric/date-parseable, non-negative, and capped at 2 seconds; otherwise use a deterministic bounded backoff supplied/injected by the orchestration layer so tests do not sleep nondeterministically.

Count actual HTTP attempts, not logical tasks, against the extraction request budget. The existing `RESEARCH_MAX_EXTRACTION_CALLS_PER_RUN=100` is a contract/schema ceiling, not the Phase 2D operational network default; the implemented network budget is a distinct server-owned 24-attempt total. The same budget object also owns provider-specific ceilings for Gemini, Groq, and OpenRouter; they default to the run ceiling and may be lowered deterministically without hard-coding mutable vendor quota numbers. Check the provider-local and total budgets **before** every primary call, retry, Gemini escalation, or cross-provider fallback. Provider-local exhaustion records `budget` for that provider and continues to the next eligible fallback; total-run exhaustion records `budget` and stops all new AI calls. Already promoted candidates remain intact. Phase 2D exposes its complete bounded extraction-attempt history without forcing it into a full `ResearchResult` whose existing global provider-attempt ceiling may be too small once discovery attempts are included; Phase 2F owns that integrated ceiling calculation.

Reuse the provider-attempt telemetry introduced in Phase 2B. Extraction attempts use `stage=extraction`; reconciliation and explanation use their respective stages. Each actual provider/model attempt gets one ordered record. Do not put prompt text, response text, provider error bodies, source content, API-key fragments, arbitrary HTTP headers, or token-bearing URLs in telemetry.

Classify failures before fallback:

- missing key / disabled configured provider: `configuration`, no retry;
- explicit authentication/authorization rejection: `authentication`, no retry;
- free-only path encounters billing/payment-required behavior: `policy`, no retry and never opt in to paid capacity;
- `429`: `rate-limit`, honor only the bounded retry rule above, then fail over;
- request deadline / provider transient timeout: `timeout`, at most one retry, then fail over;
- transient `5xx`, connection reset, or service unavailability: `upstream`, at most one retry, then fail over;
- malformed JSON, oversize/invalid UTF-8 body, schema-invalid output, unsupported response shape, or quote/promotion-integrity failure: `invalid-response`; only Gemini may take the explicitly defined one-step quality escalation path, otherwise fail over without asking the same model to free-form repair itself;
- required structured-output/model/routing feature unavailable: `capability`, no retry;
- privacy/free-only/routing constraint cannot be met: `policy`, no retry;
- caller/global run abort is not mislabeled as a provider timeout; a signal already aborted before dispatch issues no HTTP request and consumes no actual-attempt budget, while an abort after dispatch cancels the in-flight request and stops every retry/escalation/fallback for that task/run.

Never log raw provider error payloads because they can echo prompt/source content. Map status/code/exception to the bounded failure vocabulary and discard the body after bounded classification.

No provider error may discard claim candidates already validated from earlier segments/documents/calls. Never fan out the same task across providers merely to compare responses.

## Phase 2D.4 — Gemini adapter

The implemented adapter currently uses `https://generativelanguage.googleapis.com/v1beta/interactions` through the shared bounded transport, and that exact endpoint passed the single authorized live Gemini smoke request on 2026-08-16. Google now also supports the Interactions API as GA on stable `/v1/interactions`; migrate the fixed endpoint only as a deliberate provider-contract change with its own request-shape regression and live validation rather than silently switching a previously verified wire surface. Put `GEMINI_API_KEY` only in the `x-goog-api-key` header; never put it in the request URL. Use non-streaming stateless interactions with `store: false`, no tools, no `background`, and no `previous_interaction_id`.

Normal model: `gemini-3.5-flash-lite` with `thinking_level="minimal"`. Quality escalation: `gemini-3.5-flash` with `thinking_level="low"`, and only for an explicitly recorded quality/integrity condition while that model remains free-tier eligible for the active account. The Phase 2D Gemini allowlist is exactly those two models: do not automatically switch to `gemini-3.6-flash` or any other unplanned model merely because it is newer, available, or also has a free tier, and never opt into paid inference.

Use the current top-level Interactions `response_format` text/JSON shape: `type="text"`, `mime_type="application/json"`, and the portable schema in `schema` (object form or the documented single-entry array form). Parse the completed `model_output` text from the returned Interaction resource, require a completed usable response, and validate the decoded JSON again with the project Zod schema. Do not send removed legacy `response_mime_type` output configuration. Do not send deprecated Gemini 3 sampling controls such as `temperature`, `top_p`, or `top_k` merely because older examples contain them. Keep `max_output_tokens` and `thinking_level` inside the current `generation_config` wire shape.

The one-step Gemini quality escalation is allowed only when the primary Gemini response is syntactically/schema invalid or a non-empty returned claim set yields no usable promoted claim because deterministic extraction-integrity checks fail, such as unrecoverable supporting passages. Preserve any independently valid sibling claims. An empty-but-schema-valid claim set does not automatically escalate. Availability failures (`configuration`, `authentication`, `rate-limit`, `timeout`, `upstream`, `capability`, `policy`) do **not** trigger the stronger Gemini model; they move through bounded retry/failover to Groq. At most one Gemini quality escalation request is permitted for one logical segment task.

`store: false` controls Interaction state storage; it does not turn public-source input into private data or override the provider's service-level data policy. The Phase 2 privacy boundary therefore remains: send only public research source text and minimum non-sensitive research context.

## Phase 2D.5 — Groq adapter

Use the fixed Groq OpenAI-compatible endpoint `https://api.groq.com/openai/v1/chat/completions` with `Authorization: Bearer <GROQ_API_KEY>` and model `openai/gpt-oss-120b`. Keep the request non-streaming and tool-free.

Require strict JSON-schema Structured Outputs (`response_format.type=json_schema`, `strict: true`) and validate the parsed result again with the exact same project Zod schema used by Gemini/OpenRouter. The portable extraction schema must satisfy Groq strict-mode constraints: all properties required, logically optional values nullable, and `additionalProperties: false` on every object. Do not silently drop strict mode to obtain a response.

Use `reasoning_effort="low"` and the current `max_completion_tokens` field; do not use deprecated `max_tokens`. Provider-specific wire types stop inside the integration adapter. Record `provider=groq` and the concrete returned model when present.

Stay within free-plan capacity. Free-plan request/token limits are mutable external account limits, not constants to encode as product promises. The adapter never enables billable capacity, buys credits, or selects a different paid Groq model. If the supplied account is configured in a way that could incur charges, UniProof can guarantee only that it targets the documented free-plan model/path and never performs an explicit paid fallback; account billing configuration remains an operator responsibility.

## Phase 2D.6 — OpenRouter Free adapter

Use the fixed endpoint `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <OPENROUTER_API_KEY>` and model `openrouter/free` as the final availability fallback. Do not send optional attribution headers such as `HTTP-Referer` or `X-Title` unless a future product requirement explicitly needs them.

Require JSON-schema structured output with `strict: true` and `provider.require_parameters=true`. Require `provider.data_collection="deny"`. If project configuration explicitly requires zero-data-retention routing, set the current ZDR routing control too and fail closed when no eligible free route exists. Do not relax structured-output capability, free-only routing, or privacy requirements to obtain a response.

Record the **concrete model ID returned by OpenRouter** in the provider-attempt `model` field and candidate extraction provenance; `openrouter/free` is only the requested router ID. A successful response without a usable concrete model identifier is invalid response/provenance for this pipeline.

Never automatically select a paid model or paid provider route. `openrouter/free` is the only automatic OpenRouter route in this batch. If no eligible free route supports the required schema/parameters/privacy policy, classify `capability` or `policy` as appropriate. Temporary eligible-route outages use `upstream`/`timeout`; rate limiting uses `rate-limit`. Preserve validated work and do not invent a new failure vocabulary.

## Phase 2D.7 — Setup CLI extension

Extend the existing `npm run setup:providers` command; do not create a second setup workflow.

Its managed-key set becomes exactly:

```text
TAVILY_API_KEY
BRAVE_SEARCH_API_KEY
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
```

The current script's update regex is discovery-key-specific; generalize it from the fixed managed-key list without interpolating arbitrary user input into a regular expression. Preserve unrelated lines/comments, existing newline style, and exact non-managed configuration. Interactive secret entry stays masked with terminal state restored on every success/error/cancel path. Blank interactive input preserves an existing managed value. Non-interactive mode never prompts. No default setup run performs provider connectivity calls.

Update `.env.example` and `lib/env/server.ts` in the same change. `.env.example` contains names/placeholders only. Model IDs, endpoints, fallback order, timeouts, retry policy, segmentation bounds, response limits, and request budgets are server-owned repository defaults; the operator supplies keys only.

Do not automatically change `UNIPROOF_RESEARCH_MODE=seed` to `live` merely because all five keys exist. Do not print key lengths, prefixes, hashes, or other fingerprints that make secrets correlatable.

## Phase 2D.8 — Required extraction tests

At minimum prove all of these with deterministic mocked HTTP/provider behavior; the default suite performs no live AI request:

1. one portable schema is accepted by every adapter; every object has `additionalProperties: false`, every property is required at the JSON-schema layer, and logically optional fields are nullable;
2. all seven categories are accepted, unsupported categories/unknown properties are rejected, scalar value types work, and nullable optionals convert to application-owned absence without `null` leaking into `ClaimCandidate`;
3. deterministic segmentation preserves order, code-point safety, headings, 5,000-code-point maximum, 250-code-point same-section overlap, stable segment IDs, and normalizedText fallback;
4. exact supporting-text promotion succeeds only within the returned `segmentId`; wrong segment, fabricated quote, empty quote, altered Unicode/whitespace, and out-of-task category are rejected;
5. repeated supporting text in multiple segments is disambiguated by segment ID, while duplicate payloads caused by overlap collapse deterministically without collapsing distinct-source provenance;
6. provider output cannot assign evidence state, source authority, trusted IDs, extraction method, source/document identity, run metadata, or arbitrary extra fields;
7. `intake`, effective date, academic year, currency, and unit survive valid promotion inside their bounded contracts;
8. Gemini primary success calls neither Gemini escalation, Groq, nor OpenRouter;
9. Gemini malformed/schema-invalid output or a non-empty result whose claims all fail deterministic promotion integrity can trigger **exactly one** `gemini-3.5-flash` quality escalation, and a successful escalation records the actual model; one invalid sibling beside a valid promoted claim and a valid empty claim array do not trigger escalation by themselves;
10. Gemini configuration/authentication/rate-limit/timeout/upstream/capability/policy failure never triggers quality escalation and follows the specified retry/failover behavior;
11. Gemini request uses the current fixed `/v1beta/interactions` endpoint, `x-goog-api-key`, `store:false`, `response_format` with `type=text`/`mime_type=application/json`/portable `schema`, `generation_config.max_output_tokens` plus the allowed `thinking_level`, no tools/background/previous interaction, no deprecated sampling fields, bounded output, and `redirect:"error"`; completed `model_output` text is parsed from the Interaction response, while incomplete/failed/cancelled responses are not treated as successful structured output;
12. Groq request uses the fixed chat-completions endpoint, `openai/gpt-oss-120b`, strict JSON schema, `reasoning_effort=low`, `max_completion_tokens`, no stream/tools, and `redirect:"error"`;
13. Gemini availability exhaustion falls through to Groq, and Groq success prevents OpenRouter use;
14. Gemini + Groq exhaustion falls through to OpenRouter `openrouter/free`;
15. OpenRouter request requires strict structured output, `provider.require_parameters=true`, `provider.data_collection="deny"`, configured ZDR when enabled, fixed endpoint, and no paid-model fallback;
16. OpenRouter success records the concrete returned model rather than only `openrouter/free`; missing concrete model provenance invalidates the success;
17. no eligible OpenRouter free route classifies as capability/policy rather than relaxing routing/privacy constraints;
18. missing key, auth rejection, payment-required/free-policy rejection, `429`, timeout, `5xx`, malformed/oversize/invalid-UTF8/invalid-JSON response, and capability failure map to the shared bounded failure vocabulary exactly;
19. retry count never exceeds one; only transient/rate-limit classes retry; bounded `Retry-After` handling never sleeps past the project cap and sleep/backoff is injectable in tests;
20. every actual primary/retry/escalation/fallback HTTP attempt consumes both its provider counter and the total extraction request budget; provider-local exhaustion yields a bounded `budget` skip and continues failover, total exhaustion stops dispatch, and no 25th request occurs under the default 24-request total ceiling;
21. caller/global abort is distinguishable from provider timeout and stops further provider calls; a pre-aborted signal sends zero requests/consumes zero actual-attempt budget and an in-flight caller abort prevents retry/escalation/fallback;
22. mixed promotion results preserve valid sibling claims while rejecting invalid siblings; a valid empty claim array is not malformed and does not quality-escalate solely for being empty;
23. a later segment/provider failure preserves candidates promoted from earlier segments/documents, and full-chain/budget exhaustion marks remaining work unfinished rather than fabricating values;
24. provider response bodies are byte-bounded before parsing; oversize/non-success stream cleanup is best-effort and cannot extend the bounded failure by waiting forever on `cancel()`; provider errors that echo source/prompt/key material never enter telemetry, logs, thrown public messages, or `ResearchResult`;
25. telemetry is ordered and bounded, records stage/provider/model/outcome/retry/failure kind only as allowed, records a reached-but-unconfigured fallback provider once per extraction run rather than once per segment, and contains no prompts, completions, full documents, API-key prefixes/hashes, or arbitrary provider payloads;
26. prompts contain only public `ResearchDocument` segment content, requested categories, and minimum non-sensitive public research context; applicant/profile/private-document fields are absent;
27. setup CLI safely manages exactly Tavily/Brave/Gemini/Groq/OpenRouter keys, preserves unrelated `.env.local` content/newlines/comments, keeps blank-input values, masks interactive input, restores terminal state on every success/error/cancel path, never prompts non-interactively, never prints secret fingerprints, and runs no connectivity check by default;
28. `.env.example` contains placeholders only, all AI keys remain server-only, and no provider key appears in `NEXT_PUBLIC_*`, client code, fixtures, snapshots, build output, or committed documentation;
29. all pre-existing Phase 2A–2C tests remain green after the additive provider-attempt/intake contract changes.

## Phase 2E.1 — Claim identity contract and deterministic normalization key

Before Phase 2E emits any `VerifiedClaim`, evolve the live contract so it can truthfully represent the same university/program identities accepted by Phase 2B/2D. `VerifiedClaim` must accept bounded `universityId` and/or bounded `universityName`, with at least one required; `programId` and `programName` remain optional scope identifiers and must be cross-checked when both are present. Add bounded optional `intake` to `VerifiedClaim` so period semantics survive the gate. Never hash, slugify, or otherwise fabricate an application-owned university/program ID from a name just to satisfy a schema.

Update `ResearchResult` cross-record validation so a verified claim with IDs must match application-owned identity where available, while a name-only claim remains valid only when its normalized identity is consistent with the promoted candidates/resolved target. Keep Unicode-safe normalization consistent with the Phase 2B identity rules.

Before semantic reconciliation, group only claims eligible for comparison. The deterministic comparison key includes:

- normalized university identity (stable ID when available, otherwise Unicode-normalized trusted name);
- optional program identity (stable ID when available, otherwise normalized program name);
- trusted degree-level scope when available from the resolved target;
- category and normalized property;
- academic year, intake, and effective date/period when known.

The live claim contracts do **not** currently contain a trusted campus field. Do not pretend the pipeline is campus-aware by stuffing campus names into property strings or IDs. If supporting evidence is visibly campus-specific and no trusted campus scope exists, classify it as different/insufficient scope and prevent it from verifying another scope. Add a first-class campus field only through a deliberate contract change with regressions if a later MVP requirement truly needs campus-scoped claims.

Do not merge different programs, degree levels, periods, or known incompatible scopes merely because values look alike. Normalize exact representations in code: dates, booleans, known categorical values, currencies/units without exchange-rate invention, whitespace/case where semantics permit it, canonical source/document identity, and exact duplicate values.

Freshness is category/scope/period-aware. Do not invent one global "stale after N days" rule. When currentness cannot be determined truthfully from effective/academic/intake context, retain the evidence without fabricating a freshness date and let the gate classify only what the available period evidence supports.
## Phase 2E.2 — Semantic reconciliation schema

AI receives only the candidate claims and exact supporting passages already accepted for one deterministic comparison group. It never receives unrelated documents or candidates merely for additional context.

Use the same project-owned structured-task/provider chain from Phase 2D and a strict portable schema. Relationship output references only application-supplied candidate IDs and classifies a pair/group through the bounded vocabulary:

- `equivalent`;
- `contradictory`;
- `different-period`;
- `different-scope`;
- `general-specific-compatible`;
- `conditional-exception`;
- `broader-narrower-compatible`;
- `insufficient-evidence`.

Require explicit candidate-ID references in a deterministic order. Reject unknown, duplicate, self-referential, or out-of-group IDs. Reject any model-created factual value, source/document ID, evidence state, authority judgment, normalized entity ID, or candidate. Keep free-form reasoning out of the trusted relationship object; if a bounded rationale is retained for debugging/explanation, it is untrusted presentation text and never gates status.

Resolve exact-equivalent normalized values and provable different-period/different-scope cases deterministically without an AI call. Use AI only when natural-language semantics are materially necessary. A model's `equivalent` proposal still passes deterministic identity/period/source gates before it can affect evidence status.

If the AI chain is exhausted or the semantic output is invalid, leave the ambiguous relationship unresolved/`insufficient-evidence` at the semantic layer. Do not guess equivalence or contradiction to simplify downstream gating, and do not turn semantic-provider exhaustion into an `unknown` evidence value when operational work is actually incomplete.

## Phase 2E.3 — Deterministic evidence-policy gate

Evidence-state assignment is application code with explicit source/scope rules. AI may classify semantic relationships but cannot promote or override evidence state.

Apply scope and period compatibility before authority/status rules. A highly authoritative source for another program/year cannot verify the requested claim.

Use the following minimum semantics:

- `verified`: a current in-scope authoritative primary/normative source directly supports the claim;
- `university-reported`: a current in-scope university source is the sole support for a self-reported/non-normative institutional fact that lacks independent confirmation;
- `corroborated`: at least two materially equivalent current in-scope reliable sources from independent owning organizations support the claim;
- `conflicting`: current credible in-scope evidence remains materially contradictory after reconciliation;
- `outdated`: otherwise relevant evidence applies only to an older period than the requested/current period;
- `anecdotal`: support is student/community opinion rather than institutional evidence;
- `inferred`: the value/interpretation is derived from identified evidence rather than directly stated as the factual claim;
- `unknown`: the category completed its required pipeline but no eligible factual evidence supports a value.
A university page that directly publishes a normative admissions/fee requirement can be `verified`; the `university-reported` state is primarily for university-originated self-reported claims such as institutional outcomes/marketing facts that are not independently corroborated. This specialization resolves the intentional overlap in the general evidence vocabulary without changing that vocabulary.

Source independence is based on distinct owning organizations **and underlying evidence origin**, not URL count. Build a deterministic source-origin/ownership assessment from trusted source metadata where possible. Two university pages, mirrors, press-release copies, syndication feeds, pages derived from the same government dataset, or multiple interfaces over one originating dataset do not become independent merely because URLs/publishers differ. If independence cannot be established safely, do not count the source toward `corroborated`.

Apply deterministic precedence per exact claim/scope/period rather than choosing the most flattering state:

1. incompatible identity/scope/period evidence cannot verify the claim;
2. current credible material contradiction produces `conflicting` for the disputed value set even when multiple sources support one side;
3. authoritative current normative evidence may produce `verified` when it directly states the fact;
4. equivalent independent reliable current evidence may produce `corroborated` when no current contradiction remains;
5. university-only self-reported non-normative evidence remains `university-reported` without independent support;
6. old-period support is `outdated` for a newer requested/current period and does not corroborate the newer period;
7. anecdotal/community support remains `anecdotal` and cannot promote an institutional claim;
8. `inferred` is permitted only for a documented deterministic/semantic interpretation derived from identified evidence; the inferred value must remain traceable to those sources and may not introduce an unsupported factual value.

A completed category with no eligible factual evidence does **not** get a fabricated `VerifiedClaim`. Represent evidence absence through `EvidenceSummary`: the category is processed, appears in `categoriesUnknown`, has exactly one processed-category coverage entry with `claimCount=0`, `hasEvidence=false`, and `statuses=[]`. `unknown` is therefore a category/evidence outcome here, not a sentinel scalar value such as `0`, `false`, `"unknown"`, or empty string.

Operational provider/retrieval/extraction/reconciliation exhaustion is different: if the category did not reach an evidence-policy decision, keep it unprocessed/failed as applicable rather than calling it `unknown`.

## Phase 2E.4 — Evidence-bounded explanations

Explanations are optional derived presentation content, never evidence. Generate them only after the deterministic gate. The model may receive only the gated claim/relationship records needed for the explanation and may reference only application-supplied claim/candidate IDs.

Use a strict portable schema such as `{ referencedClaimIds: string[], summary: string }` with bounded text and no model-created structured facts, numbers, dates, URLs, source IDs, evidence states, or recommendations. Application code validates that every referenced ID belongs to the exact explanation input. The summary remains untrusted presentation text and is never reparsed into claims or used to change evidence state.

Prefer a deterministic non-AI fallback that renders relationship/evidence labels and existing values directly. Provider exhaustion in the explanation stage must never turn an otherwise succeeded evidence pipeline into an operational failure; omit the AI explanation and use the deterministic fallback.

## Phase 2E.5 — Required reconciliation/gate tests

At minimum prove:

1. name-only university research can produce a valid `VerifiedClaim` without a fabricated ID, while ID-backed claims retain/cross-check stable IDs and contradictory ID/name pairs fail;
2. intake survives candidate -> verified-claim promotion and separates incompatible periods;
3. exact-equivalent candidates bypass AI, and provable different-period/different-scope cases bypass AI too;
4. differently worded equivalent evidence can be classified by AI and then independently gated;
5. different university/program/degree/academic-year/intake/effective-period scopes cannot be reconciled as the same claim merely because values match;
6. campus-specific evidence is not promoted across campuses/scopes while no trusted campus contract exists; no pseudo-campus ID/property convention is invented;
7. reconciliation output with unknown/duplicate/self/out-of-group candidate IDs or model-created values/source/evidence fields is rejected;
8. AI-proposed equivalence cannot override deterministic identity/period incompatibility;
9. two mirrors/pages/interfaces of one underlying evidence origin do not become corroborated;
10. two truly independent reliable equivalent sources can become corroborated;
11. a current authoritative normative source can become verified;
12. university-only self-reported non-normative evidence follows university-reported semantics;
13. a current credible contradiction remains conflicting even when multiple sources support one side;
14. old-period evidence remains outdated for a newer requested period and does not corroborate it;
15. anecdotal-only evidence remains anecdotal and cannot elevate institutional fact;
16. inferred evidence remains source-traceable and cannot introduce a factual value absent from the supported interpretation;
17. no eligible evidence after a **completed** category becomes category-level unknown with zero fabricated claims;
18. operational extraction/reconciliation exhaustion leaves the category unprocessed/failed as appropriate rather than relabeling it unknown;
19. AI-provider exhaustion leaves ambiguous relationships unresolved without fabricated semantic resolution;
20. explanation schema rejects unknown IDs/structured new facts, and explanation-provider failure uses deterministic fallback without changing evidence status/run success.
## Phase 2F.1 — Deterministic orchestrator

Implement one new small in-memory coordinator under `lib/research/orchestration/`; it is not a multi-agent runtime. Reuse the implemented Phase 2B/C modules, but do not overload `runDiscoveryRetrieval()` with Phase 2E/F lifecycle semantics. That function remains a tested discovery/retrieval boundary and compatibility helper.

Resolve request/target identity once at the beginning and carry the project-owned resolved identity through discovery, extraction promotion, normalization, and gating. Do not re-resolve names independently in later stages. Merge provider attempts from every stage in actual execution order and validate the final ordered history against the bounded run contract.

For each validated request:

```text
validate request + resolve target once
-> initialize run/budgets/ordered attempt history
-> deterministic discovery query plan
-> sequential discovery fallback
-> select/dedupe bounded candidates
-> safe pinned retrieval + normalization
-> deterministic document segmentation
-> sequential structured extraction for usable segments/documents
-> deterministic claim normalization/grouping
-> semantic reconciliation only where needed
-> deterministic evidence-policy gate
-> optional evidence-bounded explanation or deterministic fallback
-> exact evidence summary/lifecycle calculation
-> final ResearchResult validation
```

Each stage receives project-owned immutable inputs and returns project-owned outputs plus bounded attempts/failures. Never pass mutable provider clients, raw HTTP responses, raw provider payloads, prompts/completions, API-key-bearing objects, or transient segment text through the final orchestration result.

Category processing is independent enough that one category failure need not erase successful work from another category. Preserve validated sources/documents/candidates/claims as the run advances. A later failure may make a category operationally incomplete, but it cannot delete earlier provenance records merely to simplify terminal-state calculation.

Before finalizing the orchestrator's provider-attempt ceiling, calculate the actual worst-case discovery + extraction + reconciliation + explanation attempts under the implemented budgets. If the current global max of 32 cannot represent a legal bounded run, increase it to the smallest justified server-owned bound with a regression; do not silently truncate attempt history and do not raise it to an arbitrary large number.

## Phase 2F.2 — Lifecycle and evidence-summary invariants

Emit only `succeeded`, `partial`, or `failed` as terminal MVP statuses. The in-memory orchestrator never emits legacy `completed` and never emits `queued` because there is no asynchronous queue.

Terminal status is calculated only from requested-category lifecycle after evidence gating:

- `succeeded`: **all** requested categories reached an evidence-policy decision; they may legitimately be verified/corroborated/university-reported/conflicting/outdated/anecdotal/inferred or category-level unknown;
- `partial`: at least one requested category reached an evidence-policy decision **and** at least one requested category remains operationally unprocessed/failed;
- `failed`: zero requested categories reached an evidence-policy decision because validation/configuration/discovery/retrieval/extraction/reconciliation policy prevented completion. Retained sources/documents/candidates do not by themselves make the run partial.

For every orchestrator-produced terminal run:

- `run.partial === (run.status === "partial")`; therefore succeeded and failed runs have `partial=false`;
- `startedAt` and `completedAt` are required;
- `createdAt <= startedAt <= updatedAt <= completedAt` using parsed instants, and no timestamp may be invalid/NaN;
- `processedCategories` and `unprocessedCategories` are unique, disjoint, requested-category-only sets whose union equals the requested category set;
- `run.processedCategories` exactly equals `evidenceSummary.categoriesProcessed`, and the unprocessed sets also match;
- `categoriesFailed` is a subset of requested categories and may intersect `categoriesUnprocessed`, but it is never automatically copied into processed/unknown;
- `categoriesUnknown` is a subset of processed categories only;
- categoriesWithConflicts/categoriesOutdated are subsets of processed categories and are derived from final gated claims rather than provider failures.

`categoryCoverage` contains exactly one row for every **processed requested category** and no row for an operationally unprocessed category. `claimCount` equals the number of final gated claims in that category; `statuses` is the unique set derived from those claims; `hasEvidence=true` iff the category has at least one gated evidence-bearing claim. For a processed unknown category the row is exactly `claimCount=0`, `hasEvidence=false`, `statuses=[]` and no fake unknown-valued claim exists.

`EvidenceSummary.totalClaims` and every `statusCounts` entry must be recomputed from the final `claims` array, never incrementally trusted from intermediate stages. Conflicting/outdated/anecdotal/inferred claims are still evidence-bearing. Validate the complete final object with `researchResultSchema` before return.
## Phase 2F.3 — End-to-end fixture matrix

Retain deterministic fixtures for at least:

- name-only and ID-backed resolved identities, including Unicode names and an identity conflict;
- authoritative current normative evidence;
- university-only self-reported evidence;
- independent corroboration with different wording;
- same-origin/mirrored/shared-dataset evidence that must not count as corroboration;
- current credible conflict, including multiple sources supporting one side;
- different academic year/intake/effective period/program/degree scope;
- campus-specific wording without a trusted campus field, which must not cross-promote;
- outdated evidence;
- processed category-level unknown with zero claims;
- first-class `program-structure` extraction/reconciliation/summary coverage;
- anecdotal-only and source-traceable inferred evidence;
- Tavily -> Brave discovery failover;
- general-web failure -> direct/ROR degraded discovery;
- duplicate canonical candidates with stronger source provenance preserved;
- redirect-to-private retrieval rejection, streamed oversize cutoff, stalled-body timeout, unsupported MIME/encoding, sanitized retrieval error, and normalization failure;
- deterministic segmentation boundaries/overlap and exact quote promotion;
- Gemini primary success and bounded `gemini-3.5-flash` quality escalation;
- Gemini availability failure -> Groq extraction failover;
- Gemini + Groq -> OpenRouter Free failover with concrete routed model provenance;
- OpenRouter no-eligible-free-route policy/capability failure without paid fallback;
- total AI-provider exhaustion and extraction-budget exhaustion with earlier candidates retained;
- malformed/oversize/invalid UTF-8 provider output and semantically invalid structured output;
- evidence-policy rejection of an AI semantic proposal;
- explanation-provider exhaustion using deterministic fallback;
- one succeeded run whose category is unknown, one normal fully evidenced succeeded run, one partial multi-category run, and one terminal failed run;
- timestamp-order, partial-boolean, processed/unprocessed partition, categoriesFailed/unknown separation, exact categoryCoverage, statusCounts, and provider-attempt-bound regressions.

## Phase 2F.4 — Completion gate

Phase 2 is complete only when the final orchestrator output passes `ResearchResult` validation and the complete relevant automated suite proves provenance, evidence status, partial semantics, network safety, and provider fallback behavior.

Run TypeScript, lint, build, dependency audit, workspace verification, diff check, and the focused security/secret review. Inspect the final diff and update only canonical documentation/memory whose source of truth changed.

Do not add Supabase persistence merely to complete Phase 2. Persistence remains a later explicit task after stable contracts/evidence semantics and before private history it requires designed/tested migrations plus RLS.

Do not wire the live Research UI until this gate passes.

## Verification discipline

Provider model IDs, APIs, structured-output features, free-tier eligibility, and privacy routing are mutable. Re-check current official documentation immediately before implementing each adapter.

Default automated tests must not consume Tavily, Brave, Gemini, Groq, OpenRouter, or other external quota. Optional live smoke tests are separately invoked and never substitute for deterministic mocked tests.

Do not commit/push as part of implementation unless the invoking user explicitly authorizes those Git actions.
