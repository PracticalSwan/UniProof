# Phase 2D–2F Execution Runbook — AI Extraction, Reconciliation, and Orchestration

Status: Phase 2D, Phase 2E, and Phase 2F implemented. Phase 2F now provides the full in-memory terminal orchestrator and completes Phase 2 at the backend contract boundary. Deterministic automated coverage remains offline; on 2026-08-16 one explicitly authorized live smoke request succeeded for each configured Tavily, Brave, Gemini, Groq, and OpenRouter connection, and no additional live provider calls were used for Phase 2F completion.

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

The current `main` baseline implements Phase 2A–2D. Treat these facts as source-of-truth inputs for the remaining phases:

- discovery has explicit Unicode-safe target resolution, Tavily -> Brave -> direct/ROR sequential fallback, and a built-in credential-free ROR degraded path;
- canonical-URL deduplication preserves stronger source provenance and discovery coverage independently of candidate deduplication;
- safe retrieval is DNS-pinned per hop, rejects redirect downgrade/private targets, bounds streamed bytes/time/MIME/encoding, and exposes only allowlisted response headers;
- normalized HTML/plain-text documents are the only model-ready content; PDF transport without a normalizer is an explicit failure and never produces a fake document;
- `runDiscoveryRetrieval()` intentionally stops before AI, returns no claims, leaves requested categories operationally unprocessed, and may already record discovery/retrieval failures in `EvidenceSummary.categoriesFailed`;
- active provider contracts contain Tavily, Brave, ROR, direct, Gemini, Groq, and OpenRouter only. OpenAlex is not an active provider;
- Phase 2D already enforces UTF-16-compatible generated ID/model-provenance bounds, provider-specific plus total extraction attempt budgets, provider-local budget fallback versus total-budget termination, non-blocking best-effort rejected-body cancellation, and once-per-run configuration-skip telemetry;
- the Phase 2D structured AI transport has been generalized for Phase 2E: `StructuredTaskKind` supports extraction/reconciliation/explanation, attempt records carry the actual stage, and compatibility extraction budget wrappers preserve the verified Phase 2D extraction behavior.

The following Phase 2D contract changes are already implemented and must remain compatible while Phase 2E evolves the next boundary:

1. Extend `researchProviderAttemptSchema` with an optional bounded `model` string so AI attempts can record model provenance safely. On a successful AI attempt, prefer the concrete model identifier returned by the provider and require it for OpenRouter because `openrouter/free` is only a router ID. On an attempt that fails before a concrete route/model is known, `model` may contain the server-owned requested model/router ID. Do not add separate requested-model fields, prompts, completions, raw errors, API keys, or arbitrary metadata to attempt telemetry in Phase 2D.
2. Add bounded optional `intake` to `ClaimCandidate` now because the request already carries intake and later period-aware reconciliation requires it. Provider-facing nullable `intake` is converted to application-owned `undefined` when absent.
3. Add bounded optional `extractionProvider` to `ClaimCandidate` so promoted model output retains the actual trusted provider alongside `extractionModel`; the provider-facing payload still cannot supply either field.
4. Phase 2D intentionally did not change `VerifiedClaim` identity semantics. Phase 2E must resolve the existing mismatch that `ClaimCandidate` supports university-name-only research while `VerifiedClaim` currently requires `universityId`. Phase 2E also owns candidate-level provenance for final claims; source/document IDs alone are insufficient to prove which extracted candidate(s) support a reconciled value.
5. Do not raise the global provider-attempt ceiling speculatively in Phase 2D. Phase 2F must calculate the complete discovery + extraction + reconciliation + explanation worst-case under the actual operational budgets and then raise the bound only if the full orchestrator requires it, with a regression.
6. Preserve `ResearchRun.discoveryProvider` and `extractionModel` only as compatibility summaries. Ordered `providerAttempts` is the execution-history source of truth.

Phase 2D is the implemented extraction baseline and Phase 2E is now implemented as a standalone in-memory reconciliation/evidence-gate stage. Phase 2F runtime orchestration, persistence, Research UI wiring, and deployment remain outside this batch.

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
lib/research/reconciliation/orchestrator.ts
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

## Phase 2E.0 — Stage boundary and bounded AI reuse

Implementation status: complete and independently re-reviewed against the live contracts. `tests/phase2e-reconciliation.test.ts` now covers the implementation plus post-implementation regressions for mandatory candidate provenance, stable ID/name enrichment, conservative missing/future/opaque-period handling, bounded overflow diagnostics, truthful invalid-response telemetry, UTF-16-safe explanation fallback, source-authority/independence precedence, stage-total budget termination, canonical question IDs, and the public-only injected semantic seam. The stage remains in-memory and does not emit Phase 2F lifecycle state.

Phase 2E is a standalone in-memory stage. It consumes already validated `ClaimCandidate[]`, `ResearchSource[]`, `ResearchDocument[]`, the one application-owned `ResolvedResearchTarget`, requested period context, and an explicit caller-supplied set of categories that are **operationally eligible for an evidence decision**. It does not rerun discovery/retrieval/extraction and it does not emit the terminal Phase 2F `ResearchResult` lifecycle. This eligibility input is mandatory so Phase 2E cannot turn an extraction/retrieval gap into category-level `unknown` merely because no candidate reached it.

Generalize the existing Phase 2D AI boundary narrowly rather than cloning provider transports:

1. extend `StructuredTaskKind` to `"extraction" | "reconciliation" | "explanation"` and make the transport/attempt builder receive the stage explicitly instead of hard-coding `stage="extraction"`;
2. generalize the attempt-budget implementation to a stage-neutral AI budget with provider-specific plus total counters, while retaining compatibility wrappers/types for the already-tested extraction API so Phase 2D callers and tests do not need a broad rewrite. Remove or replace the currently misleading unused `RESEARCH_MAX_AI_HTTP_ATTEMPTS_PER_RUN = 24` alias so no generic-looking constant implies that extraction's 24-attempt ceiling also governs reconciliation/explanation;
3. keep the Phase 2D extraction ceiling exactly 24 actual HTTP attempts per run;
4. add a server-owned reconciliation ceiling of **12 actual AI HTTP attempts per run**, a server-owned explanation ceiling of **6 actual AI HTTP attempts per run**, provider-specific ceilings defaulting to each stage total, one active AI HTTP request at a time, and the same one-transient-retry/bounded `Retry-After` rules already proved in Phase 2D;
5. batch at most **12 semantic pair questions per reconciliation request** and create at most **144 semantic pair questions per Phase 2E run**. If deterministic reduction still leaves more than 144 genuinely ambiguous pair questions, do not truncate and pretend completion: preserve resolved work, leave the overflow unresolved, and make every affected category operationally ineligible/incomplete for the final evidence decision;
6. configuration skips are recorded once per provider **per stage/run**, not once per question/batch; provider-local reconciliation/explanation budget exhaustion may fail over to the next provider, while that stage's total budget exhaustion stops new calls for that stage;
7. reconciliation failure may block an affected category from reaching an evidence decision; explanation failure never does. Explanation always has a deterministic fallback.

The 12/6 limits are product-owned safety/cost bounds, not claims about mutable vendor free-tier quotas. Phase 2F still owns the integrated discovery + extraction + reconciliation + explanation `providerAttempts` ceiling calculation.

Do not consume live provider quota to accept Phase 2E. Default tests use injected/mocked adapters. The previously authorized one-pass live provider smoke is sufficient unless the user separately authorizes another live call.

The Phase 2E coordinator should expose one project-owned stage result rather than leaking provider wire types. At minimum it returns: final `claims`; validated semantic `relationships` tagged application-side as `deterministic` or `model`; `unresolvedQuestionIds`; `completedCategories` that actually reached an evidence decision; `incompleteCategories` that were decision-eligible but could not finish reconciliation; ordered `providerAttempts`; sanitized `failures`/`warnings`; optional validated/fallback `explanations`; and reconciliation/explanation budget usage. `completedCategories` and `incompleteCategories` are unique/disjoint subsets of the explicit decision-eligible input. Categories outside that input are not silently claimed as completed or unknown. Phase 2F later maps these stage diagnostics into run lifecycle and `EvidenceSummary`.

## Phase 2E.1 — Claim identity contract and deterministic normalization key

Before Phase 2E emits any `VerifiedClaim`, evolve the live contract so it can truthfully represent the same university/program identities accepted by Phase 2B/2D. `VerifiedClaim` must accept bounded `universityId` and/or bounded `universityName`, with at least one required; `programId` and `programName` are optional non-null scope identifiers and must be cross-checked when both are present. Add bounded optional `intake` so period semantics survive the gate. Never hash, slugify, or otherwise fabricate an application-owned university/program ID from a name just to satisfy a schema.

The Phase 2E gate and `verifiedClaimSchema` require a unique `candidateIds` provenance array on every final claim, bounded to **1–`RESEARCH_MAX_CLAIMS_PER_RUN` IDs**. Legacy fixtures that model a final `VerifiedClaim` must therefore provide candidate provenance too. Because the complete run already bounds candidate count, do not add a smaller arbitrary provenance cap that could silently drop decision evidence. A final Phase 2E claim must reference at least one existing candidate, and one candidate ID may belong to at most one final factual claim. Its `sourceIds` and `documentIds` must equal the unique source/document sets derived from those referenced candidates rather than being arbitrary supersets, and its compatibility `sourceId`/representative `supportingText` must correspond to one of those referenced candidates. This makes corroboration/conflict provenance mechanically traceable and keeps total candidate references bounded by the run's candidate ceiling. Keep competing values as separate final claims when a conflict remains; do not attach a contradictory candidate to the provenance list of the opposite value merely to show that a conflict existed.

Remove inherited final-claim `confidence` from this research boundary; extraction confidence is not calibrated evidence confidence. Keep the evidence-status vocabulary unchanged, but Phase 2E must never emit a claim-level `verificationStatus="unknown"`: processed no-evidence is category-level summary state with zero claims. Strengthen `ResearchResult` cross-record validation accordingly: claim-level `unknown` is rejected; `statusCounts.unknown` is therefore zero; `categoriesUnknown` is a subset of processed categories; every unknown category has exactly one coverage row with `claimCount=0`, `hasEvidence=false`, and `statuses=[]`; no unknown category has a final claim; and for every coverage row `hasEvidence` is exactly `claimCount > 0`. A processed zero-claim category is unknown, while an unprocessed/failed category cannot be unknown. Add contract/result regressions for all of these cases so a fabricated unknown-valued/unknown-status final claim cannot satisfy the Phase 2E/Phase 2F output boundary.

Update `ResearchResult` cross-record validation so a verified claim with IDs must match application-owned identity where available, while a name-only claim remains valid only when its normalized identity is consistent with every referenced candidate. Keep Unicode-safe identity comparison consistent with the implemented Phase 2B rule: NFKC, `toLocaleLowerCase("en-US")`, non-letter/non-number collapse, trim, and whitespace collapse. Do not duplicate a subtly different identity normalizer; export/reuse the application-owned helper or move it to a neutral identity module without changing Phase 2B behavior.

Make reconciliation artifacts deterministic and permutation-stable. Generate `questionId` and final claim IDs application-side from SHA-256 hashes of canonical comparison/provenance keys using bounded hash-only forms such as `question-${digest32}` and `claim-${digest32}`. Sort candidate IDs, source IDs, document IDs, question batches, relationship records, and final claims by stable canonical keys before returning them. Reordering semantically identical input candidates must not change IDs, grouping, evidence states, or output ordering; ordered provider-attempt telemetry remains the exception because it represents actual execution order.

Before semantic reconciliation, build a non-mutating normalized comparison view; never rewrite candidate evidence strings or IDs in place. Group only claims eligible for comparison. The deterministic comparison key includes:

- normalized university identity (stable ID when available, otherwise Unicode-normalized trusted name);
- optional program identity (stable ID when available, otherwise normalized program name);
- trusted degree-level scope when available from the resolved target;
- category and normalized property;
- academic year, intake, and effective date/period when known.

The live claim contracts do **not** currently contain a trusted campus field. Do not pretend the pipeline is campus-aware by stuffing campus names into property strings or IDs. If supporting evidence is visibly campus-specific and no trusted campus scope exists, classify it as different/insufficient scope and prevent it from verifying another scope. Add a first-class campus field only through a deliberate contract change with regressions if a later MVP requirement truly needs campus-scoped claims.

Do not merge different programs, degree levels, periods, or known incompatible scopes merely because values look alike. Normalize exact representations in code with conservative rules:

- identities use the shared Phase 2B identity normalizer;
- property comparison keys use NFKC plus stable case/whitespace/punctuation normalization while preserving the original property for output;
- booleans remain booleans and finite numbers remain numbers; do not coerce arbitrary numeric-looking strings into numbers;
- currencies uppercase to the existing three-letter code and may compare only like-for-like; never perform exchange-rate conversion;
- units may use a small explicit alias table only when the unit is semantically identical (`month`/`months`, etc.); do not perform dimensional conversion unless an exact project-owned conversion is explicitly added and tested;
- academic-year/intake normalization accepts only unambiguous recognized forms and otherwise preserves a normalized opaque token; never infer a missing year/intake from the current date;
- ISO effective dates compare as dates only after successful parsing; unknown/missing dates remain unknown rather than receiving fabricated currentness;
- typed value equality includes the scalar type so string `"0"`, number `0`, and boolean `false` never collapse together.

An exact-equivalence bypass is allowed only when identity/property/value/period/scope keys match **and** the supporting passages are equivalent under minimal NFKC/whitespace normalization. If differently worded passages could hide an unmodeled qualifier such as campus, modality, residency, cohort, exception, or conditional scope, route that pair to semantic reconciliation even when the scalar values happen to match. This prevents same-looking values from silently crossing an unmodeled scope.

Freshness is category/scope/period-aware. Do not invent one global "stale after N days" rule. `retrievedAt` proves when UniProof observed a page, not the period for which its claim is valid. When the request specifies academic year/intake/effective-period context, evidence lacking a compatible period cannot satisfy that requested period merely because it was retrieved recently; if all otherwise relevant evidence lacks the required period, the category may become category-level unknown only after operational work completed. Emit `outdated` only when the available period evidence is explicitly older/inapplicable to the requested period; unknown freshness is not the same as outdated. When the request itself is period-unconstrained, an undated currently retrieved official page is not automatically stale or excluded, but the final claim must not invent an academic year/intake/effective date that the evidence did not provide.
## Phase 2E.2 — Semantic reconciliation schema

AI receives only the candidate claims and exact supporting passages already accepted for one deterministic comparison group. It never receives unrelated documents or candidates merely for additional context. Treat every candidate property/value/supporting passage as untrusted quoted data: delimit it explicitly, instruct the model never to follow commands embedded in evidence text, and never interpolate evidence into system/developer-like instruction positions.

Use the generalized project-owned structured-task/provider chain from Phase 2D and a strict portable schema. Do not send source authority, publisher ranking, evidence state, URLs, or provider/discovery metadata to the semantic model; semantic comparison sees only the minimum public claim text/value/scope context needed to compare meaning.

The application constructs deterministic pair questions before dispatch. A question has a deterministic bounded `questionId` and exactly two distinct candidate IDs ordered lexicographically. Deduplicate repeated pairs before quota accounting. Retain at most 144 ambiguous questions. Once overflow is proven, retain only one bounded overflow sentinel question ID per affected category while continuing the canonical scan only far enough to preserve later deterministic relationships; do not retain the full O(n²) ambiguous overflow set. Any affected category remains operationally incomplete. A provider request contains a unique candidate dictionary plus at most 12 supplied pair questions so the same passage is not duplicated for every pair. The strict provider output is exactly `{ relationships: [...] }`; each relationship contains only `questionId`, `leftCandidateId`, `rightCandidateId`, and one relationship enum value. All objects are closed and every declared JSON-schema property is required.

The bounded relationship vocabulary is:

- `equivalent`;
- `contradictory`;
- `different-period`;
- `different-scope`;
- `general-specific-compatible`;
- `conditional-exception`;
- `broader-narrower-compatible`;
- `insufficient-evidence`.

Require exact question/candidate-ID references in the supplied deterministic order. Reject unknown, duplicate, self-referential, reversed/mismatched, or out-of-batch IDs. A valid relationship must answer one supplied question and cannot create a new question. Preserve independently valid sibling answers, but leave missing/invalid questions unresolved and send only those unresolved questions through the next eligible fallback batch. If the envelope is malformed or no relationship is usable, classify the logical response as `invalid-response`; do not free-form repair it.

Reject any model-created factual value, source/document ID, evidence state, authority judgment, normalized entity ID, candidate, URL, or arbitrary metadata. Keep free-form reasoning out of the trusted relationship object.

Resolve safe exact-equivalent normalized evidence and structurally provable different-period/different-program/different-degree cases deterministically without an AI call. Use AI only when natural-language semantics are materially necessary. Because there is no trusted campus/modality/residency field yet, differently worded evidence that might carry such qualifiers is not eligible for a blind exact-value bypass. A model's `equivalent` proposal still passes deterministic identity/period/scope/source gates before it can affect evidence status.

Reconciliation uses Gemini `gemini-3.5-flash-lite` first, then the existing one-step `gemini-3.5-flash` quality path only when the primary response is schema/provenance-invalid, then Groq, then OpenRouter Free. A valid `insufficient-evidence` relationship is a successful semantic answer and must not trigger quality escalation. Availability/authentication/rate-limit/timeout/upstream/capability/policy failures follow the existing bounded retry/fallback rules and never trigger the stronger Gemini model merely for availability.

If the AI chain is exhausted or the semantic output is invalid, leave the affected ambiguous questions unresolved. Do not guess equivalence or contradiction to simplify downstream gating, and do not turn semantic-provider exhaustion into an `unknown` evidence value when operational work is actually incomplete.

## Phase 2E.3 — Deterministic evidence-policy gate

Evidence-state assignment is application code with explicit source/scope rules. AI may classify semantic relationships but cannot promote or override evidence state. The gate receives only application-owned source/document/candidate records plus validated reconciliation relationships; it never reads raw provider responses.

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

For Phase 2E, use a conservative deterministic authority table rather than asking AI whether a source is authoritative:

- `government` and `accreditation` may directly satisfy authoritative/normative support when the claim is current and in scope;
- a `university` source may directly satisfy authoritative/normative support for `admissions`, `tuition`, `scholarships`, `program-structure`, and direct official `support` facts only when current/in scope **and ownership by the resolved university is established** from the resolved official host or normalized publisher identity; a generic university source type alone is insufficient;
- university-only `outcomes` and university-only performance/marketing-style `research` claims default to `university-reported` unless a future explicit property policy proves a narrower normative case;
- `dataset` and `independent` may contribute reliable corroboration but do not become `verified` merely from their source type;
- `ranking` does not verify ordinary institutional facts by default;
- `anecdotal` can produce only anecdotal support and never upgrades an institutional fact.

If a property falls outside an explicit normative rule, fail conservatively to `university-reported`/corroboration logic rather than upgrading it to `verified` by guesswork.

Source independence is based on distinct owning organizations **and underlying evidence origin**, not URL count. Build a deterministic source-origin/ownership assessment from application-owned source metadata where possible. Treat identical content/source IDs as one origin and the same normalized publisher as one owner. Once university ownership is established for the resolved target, all of its official pages remain one owner even when departmental labels, hosts, or subdomains differ. A distinct hostname or generic `university` source type alone does not establish target ownership or independence. Mirrors, press-release copies, syndication feeds, pages derived from the same dataset, or multiple interfaces over one originating dataset do not become independent merely because URLs/publishers differ. If target ownership or distinct evidence origin cannot be established safely from the available metadata, do not use that source to verify/corroborate the target fact.

Translate semantic relationships conservatively before status assignment. Only validated `equivalent` relationships may merge differently worded candidates into one factual value cluster, and only after hard identity/property/period/scope compatibility passes. `contradictory` keeps separate competing value clusters. `different-period` and `different-scope` never corroborate the requested fact; an explicitly older period may become `outdated`. `general-specific-compatible` and `broader-narrower-compatible` are relationship/explanation edges but do not by themselves merge distinct scalar values or count as independent corroboration unless deterministic scope rules prove that both statements assert the same requested fact. `conditional-exception` must preserve the condition/exception boundary; without a trusted structured condition proving applicability, do not flatten it into the general rule. `insufficient-evidence`, missing relationships, or overflow remain unresolved whenever that relationship is required for a decision.

Treat `inferred` conservatively: a final value is `inferred` when keeping it depends on a semantic interpretation that application code cannot prove is directly stated by its exact supporting passage. A project-owned direct-support predicate may prove obvious literal/normalized cases, but failure to prove directness must not be upgraded to `verified`/`corroborated` merely because the source is authoritative. The inferred scalar must still be an existing referenced candidate value; Phase 2E performs no new calculation or factual synthesis.

Apply deterministic precedence per exact claim/scope/period rather than choosing the most flattering state:

1. incompatible identity/scope evidence cannot verify the requested claim; explicit older-period evidence is handled as `outdated` rather than silently dropped;
2. current credible material contradiction produces `conflicting` for the disputed value set even when multiple sources support one side;
3. evidence that applies only to an explicitly older/inapplicable period is `outdated` for the newer requested period and does not corroborate it;
4. anecdotal/community-only support remains `anecdotal` and cannot promote an institutional claim;
5. a source-traceable value whose direct statement cannot be proven and whose retention depends on semantic interpretation is `inferred`, regardless of source authority; inference cannot be promoted to verified/corroborated merely by source rank;
6. authoritative current normative evidence may produce `verified` only when it directly states the requested fact;
7. equivalent independent reliable current evidence may produce `corroborated` only when the supported fact is direct/current/in-scope and no current contradiction remains;
8. university-only current direct self-reported non-normative evidence remains `university-reported` without independent support.

Every emitted `VerifiedClaim.value` must correspond to at least one referenced candidate value after only the explicitly allowed deterministic normalization. Phase 2E does not synthesize a new numeric/date/boolean/string fact during reconciliation. For an unresolved current credible contradiction, emit one `conflicting` final claim per distinct competing value cluster, each with only the candidates that support that value; do not choose a majority winner and do not mix the opposing candidate IDs into the same value's provenance.

A completed category with no eligible factual evidence does **not** get a fabricated `VerifiedClaim`. Only a category explicitly included in Phase 2E's caller-supplied decision-eligible set may reach this outcome. Phase 2F will represent evidence absence through `EvidenceSummary`: the category is processed, appears in `categoriesUnknown`, has exactly one processed-category coverage entry with `claimCount=0`, `hasEvidence=false`, and `statuses=[]`. `unknown` is therefore a category/evidence outcome here, not a claim-level status/sentinel scalar value such as `0`, `false`, `"unknown"`, or empty string.

Operational provider/retrieval/extraction/reconciliation exhaustion is different: if the category did not reach an evidence-policy decision, keep it unprocessed/failed as applicable rather than calling it `unknown`.

## Phase 2E.4 — Evidence-bounded explanations

Explanations are optional derived presentation content, never evidence. Generate them only after the deterministic gate. The model may receive only the gated claim/relationship records needed for the explanation and may reference only application-supplied claim/candidate IDs.

Use one bounded batch schema such as `{ explanations: [{ category, referencedClaimIds, summary }] }` with at most one explanation per supplied processed category and **600 UTF-16 code units maximum per summary**. Every object is strict; referenced IDs must belong to the exact gated claim set for that category. No model-created structured facts, URLs, source IDs, evidence states, or recommendations are allowed. Reject any URL-like token. For number/date/currency-like tokens in free text, require that the token already appears in the rendered value/metadata of a referenced gated claim; otherwise fall back deterministically for that category. The summary remains untrusted presentation text and is never reparsed into claims or used to change evidence state.

Prefer a deterministic non-AI fallback that renders relationship/evidence labels and existing values directly. Explanation uses Gemini Flash-Lite -> Groq -> OpenRouter Free with no Gemini quality escalation; its six-attempt stage budget is presentation-only. Provider/budget/schema exhaustion in the explanation stage must never turn an otherwise succeeded evidence pipeline into an operational failure; omit the rejected AI explanation and use the deterministic fallback.

## Phase 2E.5 — Required reconciliation/gate tests

Implementation status: complete. The focused suite covers the deterministic normalization, semantic validation, provider-budget/abort, evidence-policy, explanation, privacy, and permutation invariants below; all Phase 2A–2D regressions remain green.

At minimum prove:

1. name-only university research can produce a valid `VerifiedClaim` without a fabricated ID, while ID-backed claims retain/cross-check stable IDs and contradictory ID/name pairs fail;
2. final claims require unique existing `candidateIds` bounded by `RESEARCH_MAX_CLAIMS_PER_RUN`; one candidate cannot back two final factual claims, `sourceIds`/`documentIds` equal the referenced candidates' provenance, representative `sourceId`/`supportingText` matches one referenced candidate, and unrelated/contradictory candidates cannot be attached to another value's provenance;
3. final claims reject inherited uncalibrated `confidence` and claim-level `verificationStatus="unknown"`; processed unknown remains a zero-claim category outcome;
4. intake survives candidate -> verified-claim promotion and separates incompatible periods;
5. shared Phase 2B identity normalization is reused exactly, including astral, combining-mark, compatibility-Unicode, and UTF-16 contract-bound cases;
6. comparison normalization preserves original evidence, preserves scalar types, performs no currency exchange or unsafe unit/numeric-string coercion, and does not infer missing periods;
7. safe exact-equivalent evidence bypasses AI, while differently worded same-value evidence with possible scope qualifiers does not blindly bypass semantic reconciliation; provable structured different-period/different-program/different-degree cases bypass AI as incompatible;
8. differently worded equivalent evidence can be classified by AI and then independently gated;
9. deterministic pair generation is stable, lexicographically ordered, deduplicated, self-pair-free, capped at 12 questions/batch and 144/run, and overflow remains unresolved/incomplete rather than silently truncated;
10. reconciliation output with unknown/duplicate/self/reversed/out-of-batch question/candidate IDs or model-created values/source/evidence fields is rejected; valid siblings survive and only unresolved questions fall through;
11. reconciliation attempt telemetry uses `stage="reconciliation"`, configuration skips occur once/provider/stage, provider-local budget exhaustion fails over, total 12-attempt reconciliation exhaustion stops new reconciliation calls, and no 13th request occurs;
12. reconciliation valid `insufficient-evidence` does not quality-escalate; schema/provenance-invalid Gemini output may use exactly one bounded Flash quality path; availability failures do not quality-escalate;
13. different university/program/degree/academic-year/intake/effective-period scopes cannot be reconciled as the same claim merely because values match;
14. campus/modality/residency-specific evidence is not promoted across incompatible/unknown scopes while no trusted field exists; no pseudo-scope ID/property convention is invented;
15. AI-proposed equivalence cannot override deterministic identity/period/scope incompatibility;
16. two mirrors/pages/interfaces of one underlying evidence origin do not become corroborated, same-publisher/same-university ownership does not become independent, and host difference alone is insufficient;
17. two truly independent reliable equivalent sources can become corroborated;
18. a current authoritative normative government/accreditation or eligible university source can become verified;
19. university-only self-reported/non-normative outcomes/research evidence follows `university-reported` semantics, and an unknown property is not guessed upward to verified;
20. a current credible contradiction emits separate conflicting value clusters and remains conflicting even when multiple sources support one side;
21. old-period evidence remains outdated for a newer requested period and does not corroborate it; retrieval recency alone does not make it current; unknown freshness is not mislabeled outdated;
22. anecdotal-only evidence remains anecdotal and cannot elevate institutional fact;
23. inferred evidence remains candidate/source-traceable, cannot introduce a factual value absent from referenced candidates, and never becomes an unsupported new calculation;
24. no eligible evidence after an explicitly decision-eligible/completed category becomes category-level unknown with zero fabricated claims;
25. a category not marked decision-eligible by the caller cannot become unknown, even with zero candidates;
26. operational reconciliation/provider/question-overflow exhaustion leaves affected categories unresolved/incomplete rather than relabeling them unknown;
27. caller abort before dispatch consumes no semantic attempt; in-flight abort prevents retry/escalation/fallback and preserves already resolved relationships/claims;
28. prompts contain only public candidate passages plus minimum public scope context and contain no applicant/private-document data, source authority ranking, API secrets, or raw provider errors;
29. explanation attempt telemetry uses `stage="explanation"`, no Gemini quality escalation occurs, the six-attempt ceiling cannot be exceeded, and explanation budget/provider exhaustion always uses deterministic fallback without changing evidence status;
30. explanation output rejects wrong-category/unknown claim IDs, URLs, or novel numeric/date/currency-like tokens and falls back deterministically without reparsing prose into facts;
31. deterministic IDs/output are permutation-stable: shuffling equivalent candidate input does not change question/final-claim IDs, grouping, provenance arrays, evidence states, or returned ordering (excluding actual-execution provider-attempt order);
32. all Phase 2A–2D tests remain green after the additive contract/AI-transport generalization.

## Phase 2E implementation and final-review policy

For the Phase 2E implementation batch, the main Codex agent performs implementation, testing, documentation, security/requirements checks, and fixes inline. Do **not** dispatch implementation, research, testing, security, documentation, or specialist subagents during the work.

The only permitted subagent role is one read-only **looping final code reviewer** after the implementation is complete and all local verification gates pass:

1. use the exact invocable GLM-variant review agent first;
2. a bounded parent-side wait ending with **no child result and no child error is not failure and is not a timeout**. Inspect the child/task status first. If the GLM child is still running/ongoing, leave it alive and continue checking/waiting; do not close it and do not dispatch GPT concurrently;
3. for this policy, the user's reviewer "timeout" fallback means an explicit HTTP 429 / API rate-limit response. Do not infer timeout from elapsed wall-clock time or a still-thinking child;
4. if GLM returns an explicit HTTP 429/rate-limit response or another explicit terminal child error/failure state (dispatch/model/provider failure, unavailable capacity, malformed terminal result, etc.), treat GLM as terminal for this task, close it, do not retry it, and switch to the exact invocable GPT-variant review agent;
5. apply the same liveness rule to GPT: no result/error plus a running child means keep checking/waiting, not failure. If GPT returns an explicit terminal error/failure once, stop all subagent use and finish the review/fix cycle inline with the main agent;
6. run only one reviewer child at a time and one child per review iteration; never fan out, parallelize, or create a reviewer swarm;
7. terminate/close a child only after a completed result or explicit terminal error/failure; do not close a healthy running reviewer merely because one wait window elapsed;
8. the main agent evaluates every actionable finding, fixes valid defects itself, reruns the relevant focused tests plus required gates, then may run the next review iteration with the still-healthy selected variant;
9. stop when the reviewer returns `No findings.`; cap the loop at three successful reviewer iterations, after which any remaining review/fix work is completed inline rather than spawning more children.

This batch-specific policy overrides normal specialist-agent routing for Phase 2E. It does not authorize commit, push, deployment, publication, live provider calls, destructive cleanup, or any other external action.

## Phase 2F.1 — Deterministic orchestrator

Implementation status: complete. `lib/research/orchestration/` now owns `runPhase2Research`, monotonic run metadata/lifecycle helpers, and exact EvidenceSummary derivation. The Phase 2B/C compatibility wrapper remains available while an internal B/C stage seam carries the one resolved target, category/source associations, normalized sources/documents, and operational state into Phase 2F. Final review additionally hardened cancellation after awaited target resolution, clean-empty versus timed-out supplement semantics, strict injected AI budget accounting, and exact final conflict/outdated/explanation cross-record validation.

The implementation uses one new small in-memory coordinator under `lib/research/orchestration/`; it is not a multi-agent runtime. Reuse the implemented Phase 2B/C modules, but do not overload `runDiscoveryRetrieval()` with Phase 2E/F lifecycle semantics. That function remains a tested discovery/retrieval boundary and compatibility helper.

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

Category processing is independent enough that one category failure need not erase successful work from another category. Preserve validated sources/documents/candidates and any provisional claim artifacts internally as the run advances. A later failure may make a category operationally incomplete, but it cannot delete earlier lower-level provenance merely to simplify terminal-state calculation. At the final decision boundary, however, `ResearchResult.claims` contains only processed-category claims; provisional claims from an incomplete category are intentionally excluded so the final result cannot contradict its own lifecycle state.

Before finalizing the orchestrator's provider-attempt ceiling, split the current overloaded discovery/result-history bound. Keep discovery at its own exact `RESEARCH_MAX_DISCOVERY_PROVIDER_ATTEMPTS_PER_RUN=32`; do not enlarge discovery merely because the final result needs more history. The final whole-run result ceiling must be derived from the implemented stages and bounded non-dispatched telemetry: discovery 32; extraction 24 actual HTTP attempts + at most 3 provider-scoped configuration/provider-budget skips + 1 total-budget skip = 28; reconciliation 12 + 3 + 1 = 16; explanation 6 + 3 + 1 = 10. Therefore the smallest justified final `RESEARCH_MAX_PROVIDER_ATTEMPTS_PER_RUN` is **86**. Add a pure derivation/regression from the stage constants; never use an unexplained magic number, silently truncate history, or let repeated provider-budget checks append duplicate skip records.

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
- `categoriesFailed` is a subset of `categoriesUnprocessed` for Phase 2F output; it is never copied into processed/unknown and it never includes a category whose fallback path ultimately completed;
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

## Phase 2F.5 — Hardened integration decisions

The following decisions are mandatory for the final integration batch and specialize the Phase 2F.1–2F.4 skeleton above.

### B/C compatibility seam and one-time target resolution

Do not make `runDiscoveryRetrieval()` own Phase 2F lifecycle. Extract a project-owned B/C stage helper from the existing implementation that returns the validated request, the one `TargetResolutionResult`, discovery queries/telemetry, canonical candidate-source associations, normalized sources/documents, sanitized failures/warnings, and per-category B/C completion state. Keep `runDiscoveryRetrieval()` as a compatibility wrapper over that helper so its existing tests/return shape remain valid.

Phase 2F calls the B/C stage helper exactly once and carries `resolution.target` through extraction promotion and reconciliation. Never re-resolve the university/program later from names or provider text. Extend `DiscoveryOptions` with a caller `signal?: AbortSignal` and compose it with the existing discovery-only timeout signal; add explicit project-owned discovery termination state (caller-cancelled vs discovery-timeout vs attempt-budget/completed) rather than inferring cancellation from warning strings. Extend the B/C retrieval seam and `fetchPublicUrl` with the same caller signal; pre-abort performs no DNS/network work, in-flight abort destroys/cancels the active pinned request and prevents another redirect/hop, and retrieval reports a truthful sanitized `cancelled` failure code rather than `request-timeout`/`transport`. Remove abort listeners/timers in `finally` so repeated research runs do not leak handlers.

Create the full coordinator under `lib/research/orchestration/`, preferably split into `types.ts`, `lifecycle.ts`, `summary.ts`, `orchestrator.ts`, and `index.ts`, with one canonical entrypoint such as `runPhase2Research(input, options)`. Do not repoint the legacy `runResearchPipeline` alias during this batch if that risks compatibility/circular imports; Phase 3 can explicitly adopt the new entrypoint.

### Canonical category order and deterministic run metadata

Expose one project-owned canonical research-category array from the contract and use it for all Phase 2F stage dispatch/lifecycle arrays:

```text
admissions, tuition, scholarships, program-structure, research, outcomes, support
```

After request validation, canonicalize the requested category set once before discovery. Shuffling the same requested category set must not change provider dispatch order or the non-timing semantic result. `providerAttempts` remains ordered by actual execution.

Default production run IDs must not be timestamp-only. Use a bounded application-owned UUID-based ID such as `run-${crypto.randomUUID()}` and inject `createRunId` for deterministic tests. Inject `now(): string`; validate its ISO instants and keep `createdAt <= startedAt <= updatedAt <= completedAt`. Equal adjacent timestamps are valid. If a valid clock moves backward, clamp the next metadata instant to the previous one; invalid injected clock output is an internal/test-seam error.

The existing `RESEARCH_MAX_RUN_TIMEOUT_MS=60_000` is a discovery-stage deadline, not a truthful full-pipeline deadline. Rename/split it to `RESEARCH_MAX_DISCOVERY_RUN_TIMEOUT_MS=60_000` (retain a compatibility alias only if an existing caller needs it). Phase 2F is bounded by the existing per-request timeouts, source/claim limits, stage attempt budgets, and caller `AbortSignal`; do not invent an end-to-end deadline that makes the legal 24/12/6 AI attempt budgets unreachable.

### Discovery category state must distinguish empty from failed

`coveredCategories/uncoveredCategories` alone cannot drive Phase 2F because uncovered conflates clean evidence absence with operational failure. Add internal project-owned category outcomes while retaining compatibility fields:

- `covered`: at least one general-web provider completed the category query (success or clean empty), and at least one finally selected bounded candidate remains associated after all bounded supplements/dedupe;
- `empty`: at least one general-web provider completed the category query, and all bounded general-web/direct/ROR mechanisms completed without leaving a selected candidate;
- `degraded`: neither Tavily nor Brave completed the category query, but direct/ROR salvage retained one or more validated candidates; preserve them, but the category remains operationally incomplete and is not decision-eligible;
- `failed`: neither general-web provider completed the category query and no degraded salvage source is retained; the category remains unprocessed/failed.

Tavily failure followed by a **success or clean empty result from Brave** completes the general-web discovery requirement; the earlier Tavily failure remains telemetry only. Tavily clean-empty + Brave clean-empty + deterministic direct/ROR empty may be clean `empty`. If both Tavily and Brave are unavailable/failed/skipped, direct/ROR remains the established degraded salvage path: retain any validated direct/ROR sources and downstream provenance, but the affected category stays operationally incomplete/failed because structured/direct evidence did not replace the required bounded general-web discovery step. Do not final-gate that category merely because degraded evidence exists. Identity-query failure does not automatically fail categories when the already resolved target remains usable.

The same canonical URL may be discovered for several categories while `CandidateSource.requestedCategory` is singular. Preserve an ephemeral category -> canonical candidate/source association map through dedupe instead of turning the domain field into an ad-hoc array. The strongest candidate provenance may win canonical dedupe while every legitimate category association survives lifecycle accounting.

Derive category coverage **after** canonical/per-domain/per-run source selection. If source-budget selection removes a category's only association and no selected shared source remains, mark it incomplete with `source-limit`; do not report a pre-budget hit as covered. Omitting excess lower-ranked candidates is normal bounded research when at least one selected association remains.

Discovery keeps its own exact 32-record attempt-history ceiling. Fix budget-skip behavior so a 33rd record is never appended just to report that 32 has already been reached.

### Retrieval/normalization completion is fail-closed per selected source

A clean discovery-empty category completes B/C with zero documents and can later become unknown without any AI call.

For a covered category, every selected category-associated canonical source must either produce a usable normalized document or be provably the same canonical/content source as an already retained usable document associated with that category. If two selected candidates converge only **after** redirect canonicalization or content hashing, merge/union their category associations onto the retained usable source/document before lifecycle calculation; otherwise the losing duplicate can make a real category association disappear. An SSRF/policy rejection, DNS/connect/request timeout, oversize response, unsupported MIME/encoding, retrieval failure, or normalization failure on a selected relevant source leaves that category incomplete unless exact redundancy is proven. One successful source cannot hide another selected relevant source failure because the missed source could contain a material conflict.

Failure of a supplemental identity-only source with no category association does not automatically fail every category. Existing accepted bounded/truncated normalized documents remain usable according to the Phase 2C contract; do not invent a new incomplete state solely because application-owned text normalization reached its documented bound.

Do not fabricate `stage="retrieval"` provider attempts using `provider="direct"`; retrieval is not a provider adapter in the current provider enum. Retrieval/normalization effects belong in sanitized final failures/warnings.

### Extraction and reconciliation eligibility

Call extraction only for B/C-complete **covered** categories. Clean discovery-empty categories bypass extraction entirely, are treated as extraction-complete-empty, and consume no AI attempts.

The existing Phase 2D extraction API applies one global category set to every document. That is too coarse for Phase 2F: it could search a clean-empty category inside another category's documents, and a failed tuition-only segment could incorrectly demote admissions. Add one narrow backward-compatible project-owned document-category scope (for example `categoriesByDocumentId`) to the extraction stage. When omitted, preserve the released Phase 2D global-category behavior and all existing tests. When supplied by Phase 2F, each segment task receives only the canonical categories associated with that document by the B/C stage.

Also harden the existing extraction injection seam before Phase 2F relies on it: change `runTask(task, options)` to a minimum public/project-owned `runTask(task)` contract so provider API keys and unrelated provider options are never handed to the test callback. Account injected non-skipped attempts against the same shared extraction budget as live transport (using the same bounded logic already established for reconciliation; a synthetic payload with no attempt record still cannot bypass the budget). A test seam must not be able to process unlimited segments/candidates while production is capped at 24 actual attempts. Add regression coverage that injected execution stops at the budget, preserves already promoted candidates, and does not expose provider keys to the callback.

Derive extraction category completion from that scope: an unprocessed segment makes **only the categories associated with that document** incomplete; a shared document affects every category genuinely associated with it; a failure in a tuition-only document does not poison admissions. Preserve already validated candidates, but do not call an affected category complete merely because an earlier segment produced a candidate. A category whose every associated segment is processed is extraction-complete even when valid outputs are empty. Add explicit completed/incomplete category metadata to the project-owned extraction stage result or derive it mechanically from the segment/document-category map; do not infer it from candidate presence.

Pass Phase 2E `decisionEligibleCategories` as exactly the union of clean discovery-empty categories and covered categories that completed retrieval/normalization/extraction. Semantic overflow, unresolved required relationships, provider exhaustion, or abort remain incomplete. Phase 2E can preserve provisional gated claims for an incomplete category; Phase 2F must filter final `ResearchResult.claims` to final processed categories only while retaining bounded validated sources/documents/candidates from incomplete categories.

### Explanations must become a real final result instead of discarded quota

Phase 2E already returns bounded evidence explanations, but `ResearchResult` currently has no explanation field. Phase 2F must add a strict project-owned explanation contract to `ResearchResult` and retain the Phase 2E result; do not spend the six-attempt explanation budget and then discard the output.

Promote the existing Phase 2E `EvidenceExplanation` shape into one shared domain contract/schema under the research contracts rather than duplicating a second nearly-identical Phase 2F type; Phase 2E imports/reuses that shared type so the stage and final result cannot drift. The final explanation shape contains `category`, unique bounded `referencedClaimIds`, a summary bounded by `RESEARCH_MAX_EXPLANATION_SUMMARY_UTF16`, and optional `fallback`.

Add `ResearchResult.explanations` as a bounded/defaulted array and strengthen cross-record validation: exactly one explanation per processed category, no explanation for unprocessed categories, and every referenced claim exists among final same-category claims. A claim-bearing processed category references at least one final claim. A processed unknown category has zero claims, zero referenced IDs, and deterministic fallback; zero-claim categories never trigger explanation AI. This is an intentional final-contract evolution: update legacy deterministic fixtures that represent processed/final results rather than weakening the invariant. Invalid/model/provider/budget/abort explanation outcomes fall back deterministically and never change evidence state or category lifecycle.

Phase 2F invokes Phase 2E with explanations enabled and retains explanations only for processed categories. This makes the integrated explanation attempt budget meaningful and justifies the final 86-record provider-attempt ceiling.

### Bounded AI skip telemetry required for the 86-record proof

Actual HTTP success/failure/retry/quality/fallback records are never deduplicated or truncated. Non-dispatched records are bounded separately:

- at most one provider-scoped skip per stage/provider (configuration **or** provider-local budget); a provider cannot legitimately be both unconfigured and later provider-budget-exhausted in the same stage;
- at most one total-budget skip per AI stage;
- repeated segment/batch processing after an already recorded provider/total budget skip must not append duplicate skip records.

This proves extraction <=28, reconciliation <=16, explanation <=10 while preserving the actual HTTP ceilings 24/12/6.

### Final lifecycle, abort, and failure aggregation

Phase 2F emits only `succeeded`, `partial`, or `failed`. Strengthen terminal contract invariants with red tests first:

- `run.partial === (status === "partial")`;
- terminal runs require started/completed timestamps in monotonic order;
- succeeded has no unprocessed categories;
- partial has at least one processed and at least one unprocessed category;
- failed has zero processed categories;
- processed/unprocessed are unique, requested-only, disjoint, and union to the validated requested set;
- `categoriesFailed` is a subset of unprocessed;
- run and EvidenceSummary lifecycle sets match exactly.

Add truthful `cancelled` to run/category operational failure vocabulary instead of mapping caller abort to timeout/upstream. Add `normalization` to run-level failure codes so a terminal normalization failure is not mislabeled retrieval. Invalid raw request returns a validated failed result with `failureCode="validation"`, zero provider calls, empty category sets when no trustworthy requested set exists, and no raw Zod detail. Valid unresolved/conflicting target means all requested categories unprocessed/failed and no downstream extraction/reconciliation.

Pre-abort after a valid request makes zero provider dispatches and fails/cancels all requested categories. In-flight abort stops new calls/retries/quality escalation/fallback, preserves already validated work, leaves already completed categories processed, and makes unfinished categories unprocessed; partial if anything completed, failed otherwise. Abort during explanation does not demote an evidence-complete category because deterministic fallback is available.

Expected operational failures return a validated result. A programming/invariant failure where application-owned final construction cannot pass `researchResultSchema` is not disguised as evidence failure; throw one sanitized internal orchestration error without provider/source/Zod payloads.

Do not copy every transient stage failure into final `ResearchResult.failures`. `providerAttempts` already owns provider fallback history. Aggregate at most one salient operational failure per unprocessed category plus at most one global unattributed failure, dedupe by category/code, use bounded generic messages, and canonical category order. A provider failure followed by a successful fallback is never a terminal category failure. This keeps the final failure list comfortably inside the existing `RESEARCH_MAX_FAILURES_PER_RUN` bound without truncating meaningful category state.

Aggregate warnings separately: sanitize/dedupe exact normalized messages in deterministic stage/category order and respect `RESEARCH_MAX_WARNINGS_PER_RUN`. If more unique diagnostic warnings exist than the final contract can carry, retain the first bounded set deterministically and reserve the last slot for one application-owned `additional warnings omitted` marker; never copy raw provider error bodies/prompts/source text into warnings.

Do not silently slice other domain arrays to make the final schema pass. B/C must enforce candidateSource/source/document ceilings before Phase 2F; extraction's live 24-attempt × 12-claims-per-payload bound and corrected injected-budget accounting keep promoted candidates below the 500-run claim/candidate ceiling. If a project-owned stage nonetheless violates a supposedly impossible cardinality invariant, treat it as a sanitized internal programming error rather than dropping arbitrary evidence. Explanations are bounded by the seven processed categories.

For terminal failed runs, choose the run-level primary failure code deterministically in this precedence when applicable:

```text
cancelled > validation > timeout > source-discovery > retrieval > normalization > source-limit > provider-rate-limit > provider-error > unknown
```

Succeeded runs have no failure code. Partial runs use category failures/provider telemetry rather than pretending one global code explains all unfinished categories.

### EvidenceSummary is rebuilt from final state

After final processed/unprocessed categories are known, filter final claims to processed categories and rebuild EvidenceSummary from scratch. Do not trust intermediate counters.

For every processed category emit exactly one coverage row and none for unprocessed categories. `claimCount` comes from final claims, `statuses` is their deterministic unique status set, `hasEvidence === claimCount > 0`, processed zero-claim means category-level unknown, statusCounts/totalClaims come from final claims, conflicts/outdated come from final corresponding statuses, and `categoriesFailed` comes only from terminal operational failures and remains subset of unprocessed. Validate final explanations against final claims, then validate the complete `ResearchResult` at the return boundary.

### Legacy optional run-summary fields must not lie

`ResearchRun.discoveryProvider`, `extractionModel`, `maxExtractionCalls`, and `extractionCallsUsed` predate the full multi-provider/stage-aware orchestrator. Phase 2F must not populate them with misleading guesses merely because the fields exist. Ordered `providerAttempts` and the stage budgets are the source of truth. Leave `discoveryProvider`/`extractionModel` absent unless one unambiguous value truthfully represents the completed run; a failed first provider or mixed final-candidate models must not be collapsed into one label. Do not map the 24-HTTP-attempt extraction budget into the older 100-call schema fields as if those names were equivalent. Preserve compatibility acceptance of the optional fields, but Phase 2F may omit them.

Every final provider attempt must carry its explicit actual stage; do not rely on `researchProviderAttemptSchema`'s historical default-to-discovery behavior in new Phase 2F code.

## Phase 2F.6 — Expanded minimum test matrix

In addition to the Phase 2F.3 fixtures, `tests/phase2f-orchestration.test.ts` must explicitly cover at least these integration regressions:

1. invalid request -> failed/validation, zero provider attempts, sanitized output;
2. valid unresolved/conflicting target -> all requested unprocessed/failed, no downstream AI;
3. deterministic injected run ID/clock plus bounded UUID default and monotonic/backward-clock behavior;
4. shuffled category input yields identical semantic result/provider dispatch order;
5. discovery history stays <=32, including budget exhaustion without record 33;
6. integrated max is derived/proven as 86 and a maximum legal history validates without truncation;
7. repeated provider-local/total budget checks do not duplicate non-dispatched skip telemetry;
8. no fabricated retrieval provider attempt;
9. Tavily failure -> Brave success is complete; earlier failure remains telemetry only;
10. all discovery mechanisms clean-empty -> completed empty, not failure;
11. discovery operational failure + no later usable evidence -> incomplete, never unknown;
12. one canonical URL discovered for two categories retains strongest candidate and both ephemeral category associations;
13. source selection dropping a category's only association -> source-limit; dropping only excess sources while one remains is normal;
14. clean-empty category bypasses retrieval/extraction AI and can finish succeeded/unknown;
15. selected relevant retrieval failure remains category-incomplete even when another selected source succeeds;
16. identity-only supplemental retrieval failure does not poison unrelated categories;
17. duplicate canonical/content source proven redundant does not create false retrieval failure;
18. SSRF/private redirect, DNS/connect/request timeout, oversize, MIME/encoding, retrieval and normalization failures map safely;
19. accepted bounded/truncated document remains usable per Phase 2C;
20. valid-empty extraction completes; per-document category scoping preserves Phase 2D compatibility, keeps clean-empty categories out of unrelated documents, and makes an unprocessed segment incomplete only for the categories associated with that document while earlier candidates survive;
21. complete Gemini -> quality escalation -> Groq -> OpenRouter behavior remains bounded/no-paid with concrete model provenance;
22. provider-local budget fails over and stage-total budget stops dispatch;
23. Phase 2E receives only B/C/D-complete categories;
24. exact semantic cases avoid unnecessary AI; unresolved/overflow/provider exhaustion affects only required categories and never becomes unknown;
25. provisional claims from incomplete categories are absent from final claims while source/document/candidate provenance remains;
26. ownership-established authority, independent corroboration, same-owner/mirror rejection, conflict, outdated, anecdotal, inferred, future/opaque period and unmodeled campus/scope survive end-to-end;
27. `program-structure` end-to-end;
28. final candidate/source/document/claim provenance still passes all Phase 2E hardening;
29. claim-bearing explanation references only same-category final claims;
30. unknown category gets zero-reference deterministic fallback and no AI request for that category;
31. mixed claim-bearing + unknown categories send only claim-bearing categories to explanation AI;
32. invalid/novel-fact/URL/provider-exhausted explanation falls back without lifecycle change;
33. explanation abort does not demote a completed category;
34. pre-abort produces zero provider calls; in-flight abort after one category completes produces partial with no post-abort retry/fallback;
35. fully evidenced succeeded, unknown-only succeeded, mixed partial, and zero-processed failed lifecycle cases;
36. failed run can retain provenance arrays while having zero processed/final claims;
37. categoriesFailed subset unprocessed; unknown/conflict/outdated remain processed evidence semantics;
38. exact coverage/statusCounts/totalClaims/conflict/outdated/unknown derivation;
39. every processed category has exactly one final explanation; unprocessed categories have none;
40. final failures are bounded/deduplicated and successful fallback never becomes terminal category failure;
41. no secrets/private provider payloads/prompts/errors leak into final result or client boundary;
42. all Phase 2A–2E tests remain green.

All default tests remain deterministic/offline and use injected adapters/transports. No live Tavily/Brave/ROR/Gemini/Groq/OpenRouter/DNS/university/Supabase call is a completion requirement.

## Phase 2F.7 — Current model-specific review policy

Phase 2F is complete. Any future rework follows the canonical delegation policy in `AGENTS.md`, which supersedes the historical Phase 2F reviewer rules that previously appeared here.

- When GLM-5.3 Max (`zai-coding/glm-5.3`) is the active main model, it performs planning, implementation, debugging, testing, requirements/security review, documentation, and final defect-first review entirely in the main agent with **zero subagents**, including no reviewer child.
- When a native OpenAI GPT model is the active main model, it performs its own inline defect-first review and all local gates, then retains the final read-only `code-reviewer` step. Valid findings are fixed by the main GPT agent with regression coverage and affected/full gates rerun; the review may repeat up to three successful iterations and stops on no substantive findings.
- Reviewer liveness/fallback rules apply only when subagents are permitted by `AGENTS.md`. Never infer a child result that was not actually returned, and never let historical GLM-reviewer instructions override the current model-specific policy.
- This policy does not authorize commit, push, deployment, publication, or live provider calls; those actions still require their normal explicit authorization.

## Verification discipline

Provider model IDs, APIs, structured-output features, free-tier eligibility, and privacy routing are mutable. Re-check current official documentation immediately before implementing each adapter.

Default automated tests must not consume Tavily, Brave, Gemini, Groq, OpenRouter, or other external quota. Optional live smoke tests are separately invoked and never substitute for deterministic mocked tests.

Do not commit/push as part of implementation unless the invoking user explicitly authorizes those Git actions.
