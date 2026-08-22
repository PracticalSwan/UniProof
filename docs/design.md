# UniProof Technical Design

## Architecture Thesis

Use a single Next.js application for the hackathon MVP. Keep interactive UI in React client components where necessary, but keep database access, credentials, source retrieval, AI calls, and claim verification on the server.

## Planned Stack

| Layer | Choice |
| --- | --- |
| Web application | Next.js App Router + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Runtime validation | Zod |
| Database/auth | Supabase PostgreSQL + Supabase Auth |
| AI | Provider-neutral structured AI adapters: Gemini, Groq `openai/gpt-oss-120b`, OpenRouter `openrouter/free`; hosted release order is Groq -> OpenRouter with Gemini intentionally unconfigured |
| Web research | Tavily primary discovery -> Brave Search fallback -> direct/structured approved sources |
| Research datasets | ROR, College Scorecard, Discover Uni |
| Tests | Vitest + Playwright |
| Hosting | Vercel + Supabase |

Exact package versions must be resolved from current official documentation at scaffold time and recorded in the lockfile.

## AI Provider Policy

Phase 2 uses a project-owned AI interface so extraction, reconciliation, and explanation are not coupled to one vendor.

Implemented adapter order when all compatible providers are configured:

1. Gemini free: `gemini-3.5-flash-lite` normal path, with `gemini-3.5-flash` only for bounded recorded quality escalation while the active Gemini account exposes free-tier Standard inference;
2. Groq Free: `openai/gpt-oss-120b`;
3. OpenRouter Free: `openrouter/free`, requiring the requested structured-output capability and recording the concrete routed model.

For the public hackathon deployment, `GEMINI_API_KEY` is intentionally absent because current Gemini API terms prohibit an API Client directed toward or likely to be accessed by people under 18, while university applicants can include minors. The hosted structured-AI chain therefore starts at Groq and falls back to OpenRouter. This is a deployment-configuration decision; the Gemini adapter and deterministic contract tests remain in the codebase.

Use fixed server-owned REST endpoints for Gemini Interactions, Groq chat completions, and OpenRouter chat completions through one bounded provider transport pattern: credentials in headers, `redirect: "error"`, explicit timeout/response-byte bounds, best-effort non-blocking failure-body cleanup, and no raw error-body logging. Phase 6B migrated the Gemini adapter from the previously live-smoked `/v1beta/interactions` endpoint to stable `/v1/interactions` while preserving the `steps`/`response_format` contract; the stable endpoint is fixture-tested locally and remains separately live-validated only in Phase 6C. Gemini uses stateless Interactions with `store: false`; Groq uses strict JSON-schema Structured Outputs; OpenRouter requires compatible parameters plus configured data-collection/privacy filtering and records the concrete routed model. All provider output crosses the same portable project schema and Zod validation boundary.

Free-tier quotas, model availability, and account billing configuration are mutable. The server uses provider-specific and total call budgets, sequential failover, bounded retry/backoff, and one-request-at-a-time defaults. A provider-advertised 429 delay is retried only when its `Retry-After` fits inside the deliberately short in-run retry window; absent, invalid, or longer quota windows fall through immediately instead of being clamped into a retry storm. Persistent structured-provider failures (`rate-limit`, authentication, policy, capability) open a Research-run-scoped circuit shared across extraction, reconciliation, and explanation, while transient timeout/upstream failures remain retry/failover eligible. Availability failover and Gemini quality escalation are separate mechanisms. UniProof never deliberately selects a paid-only model/route or enables paid capacity automatically, but a supplied provider account's billing configuration remains operator-controlled; do not claim a per-request zero-cost guarantee that the provider does not expose.

Phase 2D sends public normalized research segments only to the extraction chain. Applicant profiles and sensitive/personal documents are outside the free-tier extraction/reconciliation boundary. Multi-category documents are routed by deterministic category-intent matches instead of sending every segment to every associated category; each scoped category still receives a deterministic fallback segment when no intent match exists, and routed work is scheduled by least category load so earlier documents cannot starve later categories. The extraction stage remains sequential and bounded to 24 actual AI HTTP attempts per run, with provider-specific counters checked before the shared total; provider-local exhaustion falls through to the next eligible provider while total exhaustion stops dispatch. The existing 100-call extraction schema ceiling remains a separate contract limit. Phase 2E is a separate in-memory runtime batch and generalizes this same bounded AI transport to stage-aware reconciliation/explanation without changing extraction limits: implemented ceilings are 12 actual reconciliation attempts/run and 6 explanation attempts/run, with at most 12 semantic pair questions/request and 144 ambiguous pair questions/run. Phase 2F remains the terminal lifecycle orchestrator. Its implementation plan keeps discovery on a separate 32-record history limit, bounds repeated non-dispatched AI telemetry, and derives the final whole-run provider-history contract as 86 records (32 discovery + 28 extraction + 16 reconciliation + 10 explanation) without truncating actual attempts. If bounded provider work ends after a category has already produced valid candidates, the category may continue while retaining a sanitized source gap such as `provider-rate-limit`, `provider-budget`, `provider-error`, or `timeout`; Research may show the supported claims, but Compare and Guide treat any source-gap category as non-definitive. A category with no usable claim remains incomplete rather than being converted to evidence `unknown`.

Phase 2E final claims are application-owned evidence records, not model output. Each final factual claim requires the exact extracted candidate IDs that support its value, with source/document provenance derived from those candidates; application-owned stable IDs may enrich matching name-only candidate identity without inventing IDs. The deterministic gate owns authority, independence, scope, period/freshness, conflict, and evidence status: direct authoritative normative support retains `verified` precedence, anecdotal/ranking material cannot manufacture corroboration, and generic general-web `independent` results remain `inferred` because search-provider classification does not establish reliability. `corroborated` requires distinct owners/origins from application-owned reliable source classes such as resolved university, government, accreditation, or dataset evidence. All ownership-established official pages for the resolved university count as one owner while a generic university source type alone fails closed, future or opaque/missing period evidence is not silently treated as current, and broken candidate provenance is operational incompleteness rather than evidence `unknown`. Semantic AI is not given authority-ranking metadata and cannot create evidence states. Missing evidence is category-level `unknown` only after the caller-established operational work for that category completed, with zero fabricated claims.

Phase 2F finalization is implemented as a small in-memory category-state-driven orchestrator under `lib/research/orchestration/`, with `runPhase2Research` as the full B–E coordination entrypoint. It distinguishes clean bounded evidence absence from degraded discovery and operational incompleteness at discovery/retrieval/extraction/reconciliation, preserves multi-category source associations through canonical/content dedupe, propagates caller cancellation through target resolution and DNS-pinned retrieval, and scopes extraction categories per document. Final claims are filtered to processed categories while validated lower-level provenance remains available, and EvidenceSummary is rebuilt mechanically from final state. `ResearchResult` now carries exactly one evidence-bounded explanation per processed category: claim-bearing explanations reference same-category final claim IDs, unknown categories receive zero-reference deterministic fallback, and explanation failure/cancellation never changes evidence or lifecycle. Final provider history is bounded by the derived 86-record contract while discovery retains its separate 32-record ceiling; injected deterministic AI seams enforce the same total/provider budgets as production transport.

Phase 3 now implements the complete in-memory Research presentation/controller boundary without changing Phase 2 evidence semantics. The checked-in public catalog now contains 30 universities and 45 computing programs across the closed country set `BE/CA/DE/DK/FI/GB/IT/NL/SE/TH/US`, with stable IDs, canonical official navigation, a shared browser-safe country schema/label source, global normalized university-name/alias collision rejection, and a bounded 40-university/60-program schema ceiling. Deterministic search always returns the owning university alongside any matched program and malformed ownerless presentation fails closed rather than inventing a country/university; the catalog resolver stays `server-only`. Official-host ownership normalizes only case/trailing dots/one leading `www.` and accepts exact or real dot-delimited subdomains, without broad registrable-domain trust. `POST /api/research` validates bounded same-origin input, rejects sensitive content across all caller-controlled free-text research fields, resolves only supported catalog targets, and calls `runPhase2Research` exactly once with the caller signal. The server-only dossier composer re-validates the Phase 2 result, proves final claim identity against the selected catalog university/program scope, resolves representative supporting passages to their exact candidate-backed source, exposes only final-claim-referenced public sources, and emits a strict browser DTO whose terminal lifecycle/status/timestamps and source references are cross-record validated. The client transport then re-validates JSON content type and the public envelope, enforces the actual streamed response byte ceiling independently of `Content-Length`, decodes UTF-8 fatally, binds the dossier to the exact submitted target/program/category set, and treats cancellation as authoritative across stream reads. Full Phase 2 documents, candidates, provider history, raw warnings, and provider/model identity never cross the browser boundary.

Phase 4 is implemented as a browser-memory-only deterministic consumer of the already-validated `ResearchDossier` boundary. It adds neither `/api/compare` nor a new model call: the Compare workspace captures one immutable two-to-four-target submission, dispatches the existing same-origin Research route sequentially under one batch-owned abort/single-flight boundary, validates each dossier through the existing client transport, then runs pure application-owned comparison modules. Default Research categories are only the categories backing positive default scoring weights (`tuition`, `scholarships`, `research`, `outcomes`); making another priority positive automatically adds its backing category, while explicitly selected zero-weight categories are not silently removed. Server-rejected unsupported targets become explicit correction-required selections and are not blind-retry candidates. A closed metric registry maps only exact normalized claim-property aliases plus compatible typed values into affordability, research, scholarships, outcomes, and support dimensions. Relative numeric metrics require compatible peers and exact currency/unit/period semantics; booleans/presence use explicit absolute rules. Missing, conflicting, outdated, inferred, anecdotal, ranking-only, source-gap, type-incompatible, or otherwise non-comparable evidence remains unscored and lowers visible weighted coverage rather than becoming zero; `ready + sourceGap` evidence remains visible with its sanitized reason. Overall fit is a user-priority compatibility measure and is suppressed when fewer than two positive-weight dimensions are scoreable or weighted coverage is below 50%. Trade-offs are deterministic templates carrying exact claim references; target cards remain in user selection order and are never converted into an institutional ranking.

Phase 4 also implements the browser-origin hardening layer: a Next.js 16 request nonce/CSP in `proxy.ts`, a pure browser-policy builder under `lib/security/`, static security headers from `next.config.ts`, and a small client nonce bridge for Radix runtime style injection. `get-nonce` is now a direct dependency because the strict CSP path imports that nonce channel explicitly; it was already present transitively through the UI stack but direct use required direct declaration. The production script policy contains neither `unsafe-inline` nor `unsafe-eval`; development carries only the narrow compatibility exception exercised by the isolated dev browser suite. The project loads no third-party runtime analytics/scripts and keeps Compare state out of Web Storage, IndexedDB, cookies, URL state, or the database. HSTS remains a Phase 6 deployment decision because it must be validated on the real HTTPS domain/subdomain strategy. These runtime controls harden the application without imposing artificial repository/tool restrictions on the developing AI agent.

Phase 5 is implemented as a privacy-minimized browser-memory consumer of the same validated `ResearchDossier` boundary rather than a new server/provider surface. Guide selects one supported program, validates a bounded applicant profile locally, freezes an immutable submission, and derives a Research request containing only the public catalog target plus optional intake/academic year and fixed `admissions`, `tuition`, and `scholarships` categories. GPA, citizenship/current country, qualification text, English-test results, budget, and scholarship need never enter `/api/research` or the current free-provider chain. Pure `lib/guide/` modules map claim properties only through a closed exact registry, enforce evidence/type/unit/currency/period applicability, classify requirements into the six required Guide states, and deterministically derive risks, checklist items, timeline entries, and exact target-scoped evidence references. One most-recent compatible dossier may be reused in browser memory for profile-only reassessment; target/intake/year changes or explicit refresh require Research again. Phase 5 adds no `/api/guide`, model-based admission assessment, auth, persistence, profile storage, or admission probability.

Phase 6 is the hardening/release layer around the already-validated Phase 0–5 semantics, split into three dependency-ordered batches. **Phase 6A is now implemented locally.** All three product modes remain anonymous-first while optional Supabase passwordless email authentication adds explicit private persistence. The existing root Next.js `proxy.ts` remains the single request Proxy and composes nonce/CSP with Supabase SSR session refresh/cache protection; `/api/research` remains outside the auth-refresh matcher while Auth/Saved routes participate. The pure browser policy remains closed: optional Supabase browser Auth/save adds only the exact validated origin parsed from `NEXT_PUBLIC_SUPABASE_URL` to `connect-src` (plus the existing exact development websocket); wildcard Supabase, generic `https:`, and Research/search/AI provider browser origins remain forbidden. Magic Link initiation creates a high-entropy, short-lived `HttpOnly` same-browser intent cookie and carries the matching state through the email callback; the callback consumes that state before `verifyOtp`, so unsolicited/cross-browser links cannot swap the active account. Private saved-artifact list/read/write/delete operations use current Auth-server `getUser()` validation before exposing or mutating private data, and POST authentication now precedes request-body buffering. Caller-supplied user IDs/emails never authorize access. Ordinary private CRUD remains user-scoped and protected by explicit minimum table grants plus RLS rather than service-role-backed. The implemented persistence shape is one narrow immutable/versioned `saved_artifacts` table for explicit profile, Research, Comparison, and Guide snapshots, with application-derived titles, strict request/payload byte bounds, a race-safe 20-row owner cap, and one bounded metadata list rather than a pagination subsystem. Database rows remain untrusted persisted input: version-1 Guide assessment/planning and Comparison scoring/trade-offs are recomputed from the bound dossier before acceptance. One account-bound memory-only root restore handoff moves an already validated saved artifact from `/saved` to its owning mode; it is single-consume, cleared on account change/signout in every mode, and never uses URL state, Web Storage, IndexedDB, Cache Storage, service workers, or a second persistence channel. Saved results remain historical snapshots and provider separation is unchanged.

Phase 6B adds production execution and abuse boundaries without redesigning provider/evidence logic. The application owns a **240-second Research deadline beneath a 300-second Research-function cap**. Research alone opts into Vercel Node request cancellation through `supportsCancellation:true`; caller cancellation remains `cancelled`, the application deadline becomes `timeout`, completed validated evidence is preserved, and no new retry/fallback/stage dispatch may start after terminal ownership. Raw platform/WAF HTTP 429 and hard-timeout 504 responses are classified before application JSON parsing so hostile/non-JSON bodies cannot leak into UI and no browser retry storm is introduced. The public Vercel project now has one enabled durable WAF rule scoped exactly to `POST /api/research`, keyed by source IP with a fixed 20 requests/60 seconds window and 429 enforcement. Vercel supplies HSTS (`max-age=63072000; includeSubDomains; preload`) at the deployed edge, so UniProof still does not add a duplicate application-owned HSTS policy.

Phase 6C release configuration keeps the core product anonymous. Hosted Supabase browser/Auth variables are absent because production email delivery is not configured; local Supabase Auth/RLS/persistence evidence remains valid but is not presented as a hosted judge feature. The historical Phase 6C live allowance is exhausted at three accepted calls; the third returned a schema-valid but operationally incomplete dossier and no successful-live-evidence claim is made. The later final-testing plan owns a separate maximum-five hypothesis-driven allowance and does not retroactively change the Phase 6C record. Exact final-testing Git/CI/Production identifiers are appended after publication rather than guessed into this architecture document.

The Phase 2B/2D implementation must provide a cross-platform setup command such as `npm run setup:providers`. The user should only obtain and paste API keys; the repository-owned setup flow handles `.env.local`, server environment validation, model/endpoints, fallback order, and safe defaults without echoing secrets.

## Primary Data Flow

```text
ResearchRequest
        -> project-owned target identity resolution
        -> deterministic query/research planner
        -> Tavily discovery -> Brave fallback -> direct/structured degraded discovery
        -> bounded source retrieval and cleaning
        -> Gemini -> Groq -> OpenRouter structured claim extraction
        -> schema validation and deterministic normalization
        -> AI semantic reconciliation
        -> deterministic conflict/freshness/evidence-policy gate
        -> evidence-bounded AI explanation
        -> validated ResearchResult in memory
        -> Phase 3 Research dossier projection for the supported Research API
        -> strict client-safe ResearchDossier
        -> Phase 3 evidence-aware Research UI + hardened client transport
        -> Phase 4 Compare: sequential dossier acquisition -> closed metric registry
             -> deterministic comparability gate -> weighted score/coverage
             -> deterministic evidence-bound trade-offs
        -> Phase 5 Guide: strict local applicant profile + one supported program
             -> public-only Research request (admissions/tuition/scholarships)
             -> validated dossier + closed requirement registry
             -> deterministic six-state assessment + risks/checklist/timeline
        -> optional Phase 6A private snapshot save -> RLS-protected Supabase -> account-bound memory-only restore
```

## Core Server Modules

- `research`: source discovery, retrieval policy, content cleaning, and research orchestration.
- `claims`: structured extraction, deterministic normalization, AI semantic reconciliation, evidence-policy gating, freshness, conflict handling, and evidence-bounded explanation.
- `comparison`: Phase 4 browser-safe pure modules for strict target/form contracts, closed claim-property metric normalization, deterministic comparability gates, weighted user-fit/coverage calculation, and evidence-referenced trade-off templates. Because separate Research dossiers may legally reuse claim IDs, cross-target trade-off provenance is keyed by both comparison target identity and claim ID rather than by claim ID alone. The module consumes validated public `ResearchDossier` values only and performs no provider/network/storage work.
- `guide` (Phase 5 implemented): browser-safe pure modules for strict ephemeral applicant-profile/submission contracts, exact requirement-property registry, deterministic evidence/applicability gating, six-state requirement assessment, budget/scholarship constraints, strict date-only deadline handling, risks, checklist/timeline generation, and target-scoped evidence references. Guide consumes only validated `ResearchDossier` values and performs no provider/storage/auth work.
- `integrations`: Gemini, Groq, OpenRouter, Tavily, Brave, Supabase, ROR, College Scorecard, and other approved providers behind project-owned adapters.
- `security`: outbound URL policy, rate limits, input bounds, and safe logging.

## Initial Domain Entities

- `University`
- `Program`
- `Source`
- `Claim`
- `ClaimConflict`
- `ApplicantProfile`
- `Comparison`
- `ApplicationPlan`
- `ApplicationTask`
- `ResearchRun`

Database shape must not mirror external provider payloads directly. Normalize provider data behind explicit adapters so provider changes do not become application-wide contract changes.

## Claim Boundary

The factual unit of the application is a claim, not a generated paragraph. A displayed factual statement should resolve to one or more stored claims with supporting source metadata.

Generated summaries may combine claims, but they must not introduce new factual values that are absent from the verified claim set. Inferences must be labeled as inferences.

## Retrieval Trust Boundary

All remote content is untrusted input.

The retrieval layer must:

- accept only supported HTTP(S) URLs;
- reject localhost, loopback, link-local, private-network, and metadata-service destinations;
- validate redirects at every hop;
- bound request duration, redirect count, and response bytes;
- resolve and validate every returned DNS address before connection; Phase 2C must pin that validated address or use a transport lookup that re-validates it, because URL validation alone does not eliminate DNS rebinding;
- fail closed for direct IPv6 retrieval outside the current IANA `2000::/3` global-unicast allocation and block reserved/special-purpose prefixes used by the policy; IPv4-mapped IPv6 is evaluated against the IPv4 policy;
- sanitize/normalize readable content before model use;
- never interpret retrieved instructions as agent or system instructions.

## Fit Score

The Phase 4 fit score is deterministic and explainable. It represents compatibility with the user's selected priorities inside the currently selected comparison set, not institutional quality, prestige, admission probability, or an objective university ranking.

Comparison uses five explicit integer relative priority weights from 0–100: affordability, research opportunities, scholarships, outcomes, and international-student support. Raw slider values may have any positive total; an all-zero vector is rejected before Research dispatch, and one application-owned helper derives normalized fractions as `raw_i / sum(raw_weights)` for scoring. A closed application-owned metric registry is the only bridge from free-form Research claim `property` strings into those score dimensions. It accepts only documented exact aliases after narrow deterministic normalization and exact compatible scalar types; it performs no fuzzy/semantic property matching, numeric-string parsing, currency/unit conversion, period guessing, or conflict winner selection.

Relative numeric metrics use within-set min-max normalization only across mutually compatible facts. Annual tuition is lower-is-better and requires matching currency/annual semantics; employment rate is higher-is-better and requires compatible percentage/period semantics. Equal participating numeric values score 100. Boolean/presence metrics use explicit application-owned rules rather than relative peer normalization.

Only verified, corroborated, or university-reported evidence with an eligible non-ranking/non-anecdotal source may contribute to numeric fit. Missing, unknown, incomplete, conflicting, outdated, inferred, anecdotal, ranking-only, unsupported-type, or incompatible-period/unit/currency evidence remains unscored. It never silently contributes zero.

For each target, weighted evidence coverage is the percentage sum of normalized positive priority fractions whose dimensions are scoreable. Overall fit is the weighted average over only scoreable positive-weight dimensions and is suppressed unless at least two positive-weight dimensions are scored and normalized coverage is at least 50%. Raw slider values remain visible and persisted as selected; normalization is derived for scoring and is not written back into the controls. The UI must show priorities, supporting facts, unscored reasons, coverage, evidence warnings, and exact claim evidence near the score. Result cards stay in immutable selection order rather than being automatically sorted into a ranking.

## Failure Model

Core flows must preserve partial verified results when a provider or model fails. Discovery degrades sequentially Tavily -> Brave -> direct/structured sources -> partial result. AI inference degrades Gemini -> Groq `openai/gpt-oss-120b` -> OpenRouter `openrouter/free` -> partial result. Do not replace unavailable evidence with plausible generated text, do not fan out to all providers by default, and never select paid inference automatically. Research runs should expose the provider/fallback path and actionable partial/incomplete retry behavior.

## Architecture Review Gate

Before changing providers, persistence contracts, claim semantics, authentication, or external-source policy, update this design and the affected requirements first. Use `api-designer`, `data-engineer`, or `security-auditor` when the change crosses those boundaries.
