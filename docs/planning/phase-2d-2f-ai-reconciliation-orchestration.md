# Phase 2D–2F Execution Runbook — AI Extraction, Reconciliation, and Orchestration

Status: planned. Execute only after the Phase 2B–2C acceptance gate passes.

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
## Required module ownership

Use these paths unless the live repository has already established a narrower equivalent:

```text
lib/research/extraction/types.ts
lib/research/extraction/schema.ts
lib/research/extraction/orchestrator.ts
lib/research/reconciliation/types.ts
lib/research/reconciliation/schema.ts
lib/research/reconciliation/normalize.ts
lib/research/reconciliation/semantic.ts
lib/research/verification/evidence-policy.ts
lib/research/verification/explanation.ts
lib/research/orchestration/run-research.ts
lib/integrations/gemini/client.ts
lib/integrations/gemini/structured.ts
lib/integrations/groq/client.ts
lib/integrations/groq/structured.ts
lib/integrations/openrouter/client.ts
lib/integrations/openrouter/structured.ts
tests/phase2d-extraction.test.ts
tests/phase2e-reconciliation.test.ts
tests/phase2f-orchestration.test.ts
```

Provider wire types stop at `lib/integrations/*`. Final evidence policy never lives in a provider adapter.
## Phase 2D.1 — Provider-facing extraction schema

Do not ask any model to emit the trusted `ClaimCandidate` domain object directly.

Create a strict bounded `ExtractedClaimPayload` schema containing only model-observable fields, for example:

- category;
- property;
- scalar value;
- optional unit/currency/effective date/academic year/intake;
- exact supporting quote or bounded supporting text copied from the supplied document;
- optional section/segment locator that the application can validate;
- optional extraction confidence only if the project documents its semantics.

The model must not choose source authority, evidence status, source ID, document ID, provider-attempt ID, run ID, application record ID, or any other trusted application-owned identifier.

After structured output passes Zod validation, application code must verify that the supporting quote/locator exists in the supplied `ResearchDocument`, then attach deterministic IDs, `sourceId`, `documentId`, extraction method, actual provider/model provenance, and other trusted metadata to create a `ClaimCandidate`.

Reject a payload whose supporting passage cannot be recovered from the supplied document. Do not repair it by inventing a nearby quote.

One provider response may contain multiple extracted payloads, but total claims and payload size remain bounded by the Phase 2A server limits.
## Phase 2D.2 — Common provider interface and error model

Create one server-only structured-task interface that receives a project-owned task, schema, bounded public document context, and budget state, then returns either validated structured data or a bounded provider failure.

Reuse the provider-attempt telemetry introduced in Phase 2B. Extraction attempts use `stage=extraction`; reconciliation and explanation use their respective stages.

Classify failures before fallback:

- `configuration` / `authentication`: do not retry; continue to the next configured provider;
- `rate-limit`: honor a safe bounded retry hint, then fail over;
- `timeout` / transient `upstream`: bounded retry, then fail over;
- `invalid-response`: one schema-repair/quality path only when explicitly allowed, then fail over;
- `capability` / `policy`: do not weaken requirements; continue to the next eligible provider;
- `budget`: stop that provider or the whole chain according to the exhausted budget.

No provider error may discard claim candidates already validated from earlier documents/calls.

Default concurrency is one AI call at a time per research run. Never fan out the same task across providers merely to compare responses.

## Phase 2D.3 — Gemini adapter

Use the official `@google/genai` SDK and current Interactions API. Set `store: false` on every Phase 2 interaction.

Normal model: `gemini-3.5-flash-lite`. Quality escalation: `gemini-3.6-flash` only for an explicitly recorded quality condition while Gemini remains available.

Use structured JSON/schema output supported by the current API and validate again with the project Zod schema. Do not send deprecated Gemini 3 sampling controls merely because older examples contain them; use only parameters supported by the current model/API documentation.
Gemini quality escalation is not availability fallback. Quota exhaustion, authentication failure, timeout exhaustion, or service unavailability goes to Groq instead of repeatedly escalating within Gemini.

## Phase 2D.4 — Groq adapter

Use Groq's OpenAI-compatible endpoint with `openai/gpt-oss-120b`.

Require strict JSON-schema Structured Outputs (`strict: true`) for structured extraction/reconciliation tasks where supported by the current endpoint. Validate the parsed result again with the same project Zod schema.

Do not copy OpenAI-compatible wire types into domain code. Record `provider=groq` and the actual model returned when available.

Stay within free-plan capacity. Do not enable billable capacity, purchase credits, or silently switch to another paid Groq model.

## Phase 2D.5 — OpenRouter Free adapter

Use `openrouter/free` as the final availability fallback.

Require structured-output-compatible routed providers by using the current parameter-support routing control. Apply the strictest compatible privacy routing, including denial of provider data collection when the current API supports that policy. Do not relax the privacy requirement to get a response.

Record the concrete model ID returned by OpenRouter, not just `openrouter/free`. Never automatically select a paid model or paid provider route.

If no eligible free route supports the required schema/parameters/privacy policy, classify the attempt as unavailable/capability-policy failure and preserve a partial result.

## Phase 2D.6 — Setup CLI extension

Extend the existing `npm run setup:providers` command; do not create a second setup workflow.

Add only these managed secrets:

```text
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

Update `.env.example` and `lib/env/server.ts` in the same change. Model IDs, fallback order, retry policy, and budgets receive repository defaults so the operator only supplies keys.
## Phase 2D.7 — Required extraction tests

At minimum prove:

1. Gemini success does not call Groq/OpenRouter;
2. Gemini availability failure falls through to Groq;
3. Gemini quality escalation uses 3.6 only for a recorded quality condition;
4. Gemini and Groq failure falls through to OpenRouter Free;
5. OpenRouter records the concrete returned model;
6. malformed JSON and schema-invalid output never become claim candidates;
7. valid JSON with an unrecoverable supporting quote is rejected;
8. provider output cannot assign evidence state or trusted IDs;
9. retry/auth/rate-limit/capability/budget classes trigger the specified behavior;
10. complete provider exhaustion preserves previously validated candidates and marks unfinished work explicitly;
11. prompts contain public source content/minimum research context only;
12. logs and telemetry contain no keys, full documents, prompts, or completions.

## Phase 2E.1 — Deterministic normalization key

Before semantic reconciliation, group only claims that are eligible for comparison. The comparison key must include normalized university identity, optional program/campus/degree scope, category/property, and applicable academic year/intake/effective period when known.

Do not merge different campuses, programs, degree levels, or academic years merely because their values look alike.

Normalize exact representations in code: dates, booleans, known categorical values, currencies/units without exchange-rate invention, whitespace/case where semantics permit it, canonical URLs, and duplicate source/document identity.

Freshness is scope/period-aware. Do not invent one global "stale after N days" rule for all evidence categories unless a later documented category policy defines it.
## Phase 2E.2 — Semantic reconciliation schema

AI receives only the candidate claims and supporting passages already accepted for one comparison group.

Its strict structured output classifies relationships using a bounded vocabulary:

- `equivalent`;
- `contradictory`;
- `different-period`;
- `different-scope`;
- `general-specific-compatible`;
- `conditional-exception`;
- `broader-narrower-compatible`;
- `insufficient-evidence`.

The output references only application-supplied candidate IDs. Reject unknown, duplicate, or out-of-group IDs. The model cannot create factual values, source IDs, evidence states, or new candidates.

Exact-equivalent cases should be resolved deterministically without spending an AI call. Use AI only when natural-language semantics are materially necessary.

If the AI chain is exhausted, leave ambiguous relationships unresolved. Do not guess equivalence to simplify downstream gating.

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

Source independence is based on distinct owning organizations/publishers and underlying evidence origin. Two pages that mirror the same dataset, press release, syndication feed, or university statement are not independent corroboration.

When multiple states could appear plausible, preserve the information rather than forcing a promotion. Current contradiction wins over corroboration for the disputed property/scope; older evidence does not corroborate a newer period; anecdotal evidence cannot elevate an institutional claim.

An `unknown` record must never use zero, `false`, empty string, or a guessed sentinel as the factual value. Use the contract representation explicitly designed for missing evidence when Phase 2E finalizes the claim shape; if the current `VerifiedClaim.value` contract cannot represent an unknown without fabrication, evolve the contract with a regression before emitting unknown claims.

## Phase 2E.4 — Evidence-bounded explanations

Explanations are optional derived presentation content. They may summarize why claims were considered equivalent, conflicting, differently scoped, or stale, but may reference only gated claim/candidate IDs and factual values already present in those records.

Validate explanation output against a strict schema. Reject any explanation containing new source IDs or structured factual values not in the gated input. A deterministic non-AI fallback can render relationship/status labels directly.

## Phase 2E.5 — Required reconciliation/gate tests

At minimum prove:

1. exact-equivalent candidates bypass AI;
2. differently worded equivalent evidence can be classified by AI and then independently gated;
3. AI cannot reconcile different years/campuses/programs as the same claim;
4. AI-proposed source/evidence state is rejected because it is outside the schema;
5. two mirrors of one underlying source do not become corroborated;
6. two independent reliable equivalent sources can become corroborated;
7. a current authoritative normative source can become verified;
8. university-only self-reported non-normative evidence follows university-reported semantics;
9. current credible contradictions remain conflicting;
10. old-period evidence remains outdated for a newer requested period;
11. anecdotal-only evidence remains anecdotal;
12. no eligible evidence after a completed pipeline becomes unknown, not failed;
13. AI-provider exhaustion leaves ambiguous relationships unresolved without fabricated resolution;
14. explanation output cannot add new factual values.
## Phase 2F.1 — Deterministic orchestrator

Implement one small in-memory coordinator. It is not a multi-agent runtime.

For each validated request:

```text
validate request
-> initialize run/budgets/attempt history
-> deterministic discovery query plan
-> sequential discovery fallback
-> select/dedupe bounded candidates
-> safe pinned retrieval + normalization
-> structured extraction for usable documents
-> deterministic normalization/grouping
-> semantic reconciliation only where needed
-> deterministic evidence-policy gate
-> optional evidence-bounded explanation
-> evidence summary
-> final ResearchResult validation
```

Each stage receives project-owned inputs and returns project-owned outputs plus bounded attempts/failures. Never pass mutable provider clients or raw provider payloads through the orchestration result.

Category processing is independent enough that one category failure need not erase successful work from another category. Preserve validated sources/documents/candidates/claims as the run advances.

## Phase 2F.2 — Lifecycle and evidence-summary invariants

Emit only `succeeded`, `partial`, or `failed` as terminal MVP statuses. Do not emit legacy `completed`; do not emit `queued` without an actual asynchronous queue.

- `succeeded`: every requested category completed the required pipeline, even if evidence is unknown/outdated/conflicting/anecdotal;
- `partial`: at least one requested category completed and at least one remains unprocessed or operationally failed;
- `failed`: no requested category reached a usable gated result because of fatal validation/configuration/pipeline failure.

For orchestrator output, `run.partial` equals `status === "partial"`. Terminal runs require `completedAt`; timestamp ordering must be schema-validated.

`categoriesProcessed` contains categories that reached an evidence-policy decision. `categoriesUnprocessed` is operational and disjoint. `categoriesFailed` identifies attempted categories with operational failure and is not a synonym for `unknown`.

`hasEvidence=true` only when the category has at least one non-`unknown` gated claim. Outdated/conflicting/anecdotal/inferred claims are evidence-bearing; an unknown-only category is processed but has no evidence.
## Phase 2F.3 — End-to-end fixture matrix

Retain deterministic fixtures for at least:

- authoritative current evidence;
- independent corroboration with different wording;
- same-origin/mirrored evidence that must not count as corroboration;
- current credible conflict;
- different year/campus/program scope;
- outdated evidence;
- unknown after a completed pipeline;
- anecdotal-only evidence;
- Tavily -> Brave discovery failover;
- general-web failure -> direct/structured degraded discovery;
- redirect-to-private retrieval rejection;
- timeout, oversize, unsupported MIME, and normalization failure;
- Gemini -> Groq extraction failover;
- Gemini + Groq -> OpenRouter Free failover with concrete routed model provenance;
- total AI-provider exhaustion;
- malformed structured output and semantically invalid output;
- evidence-policy rejection of an AI semantic proposal;
- one fully successful run, one partial multi-category run, and one terminal failed run.

## Phase 2F.4 — Completion gate

Phase 2 is complete only when the final orchestrator output passes `ResearchResult` validation and the complete relevant automated suite proves provenance, evidence status, partial semantics, network safety, and provider fallback behavior.

Run TypeScript, lint, build, dependency audit, workspace verification, diff check, and the focused security/secret review. Inspect the final diff and update only canonical documentation/memory whose source of truth changed.

Do not add Supabase persistence merely to complete Phase 2. Persistence remains a later explicit task after stable contracts/evidence semantics and before private history it requires designed/tested migrations plus RLS.

Do not wire the live Research UI until this gate passes.

## Verification discipline

Provider model IDs, APIs, structured-output features, free-tier eligibility, and privacy routing are mutable. Re-check current official documentation immediately before implementing each adapter.

Default automated tests must not consume Tavily, Brave, Gemini, Groq, OpenRouter, or other external quota. Optional live smoke tests are separately invoked and never substitute for deterministic mocked tests.

Do not commit/push as part of implementation unless the invoking user explicitly authorizes those Git actions.