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
| AI | Provider-neutral structured AI: Gemini primary, Groq `openai/gpt-oss-120b` fallback, OpenRouter `openrouter/free` final fallback |
| Web research | Tavily primary discovery -> Brave Search fallback -> direct/structured approved sources |
| Research datasets | ROR, College Scorecard, Discover Uni |
| Tests | Vitest + Playwright |
| Hosting | Vercel + Supabase |

Exact package versions must be resolved from current official documentation at scaffold time and recorded in the lockfile.

## AI Provider Policy

Phase 2 uses a project-owned AI interface so extraction, reconciliation, and explanation are not coupled to one vendor.

Availability order:

1. Gemini free: `gemini-3.5-flash-lite` normal path, with `gemini-3.5-flash` only for bounded recorded quality escalation while the active Gemini account exposes free-tier Standard inference;
2. Groq Free: `openai/gpt-oss-120b`;
3. OpenRouter Free: `openrouter/free`, requiring the requested structured-output capability and recording the concrete routed model.

Use fixed server-owned REST endpoints for Gemini Interactions, Groq chat completions, and OpenRouter chat completions through one bounded provider transport pattern: credentials in headers, `redirect: "error"`, explicit timeout/response-byte bounds, best-effort non-blocking failure-body cleanup, and no raw error-body logging. The current Gemini adapter uses `/v1beta/interactions`, which passed the authorized live smoke on 2026-08-16; Google also supports GA stable `/v1/interactions`, so any endpoint migration must be deliberate and separately live-validated. Gemini uses stateless Interactions with `store: false`; Groq uses strict JSON-schema Structured Outputs; OpenRouter requires compatible parameters plus configured data-collection/privacy filtering and records the concrete routed model. All provider output crosses the same portable project schema and Zod validation boundary.

Free-tier quotas, model availability, and account billing configuration are mutable. The server uses provider-specific and total call budgets, sequential failover, bounded retry/backoff, and one-request-at-a-time defaults. Availability failover and Gemini quality escalation are separate mechanisms. UniProof never deliberately selects a paid-only model/route or enables paid capacity automatically, but a supplied provider account's billing configuration remains operator-controlled; do not claim a per-request zero-cost guarantee that the provider does not expose.

Phase 2D sends public normalized research segments only to the extraction chain. Applicant profiles and sensitive/personal documents are outside the free-tier extraction/reconciliation boundary. The extraction stage is sequential and bounded to 24 actual AI HTTP attempts per run, with provider-specific counters checked before the shared total; provider-local exhaustion falls through to the next eligible provider while total exhaustion stops dispatch. The existing 100-call extraction schema ceiling remains a separate contract limit. Phase 2E is a separate in-memory runtime batch and generalizes this same bounded AI transport to stage-aware reconciliation/explanation without changing extraction behavior: implemented ceilings are 12 actual reconciliation attempts/run and 6 explanation attempts/run, with at most 12 semantic pair questions/request and 144 ambiguous pair questions/run. Phase 2F remains the terminal lifecycle orchestrator. Its implementation plan keeps discovery on a separate 32-record history limit, bounds repeated non-dispatched AI telemetry, and derives the final whole-run provider-history contract as 86 records (32 discovery + 28 extraction + 16 reconciliation + 10 explanation) without truncating actual attempts.

Phase 2E final claims are application-owned evidence records, not model output. Each final factual claim requires the exact extracted candidate IDs that support its value, with source/document provenance derived from those candidates; application-owned stable IDs may enrich matching name-only candidate identity without inventing IDs. The deterministic gate owns authority, independence, scope, period/freshness, conflict, and evidence status: direct authoritative normative support retains `verified` precedence, anecdotal/ranking material cannot manufacture corroboration, all ownership-established official pages for the resolved university count as one owner while a generic university source type alone fails closed, future or opaque/missing period evidence is not silently treated as current, and broken candidate provenance is operational incompleteness rather than evidence `unknown`. Semantic AI is not given authority-ranking metadata and cannot create evidence states. Missing evidence is category-level `unknown` only after the caller-established operational work for that category completed, with zero fabricated claims.

Phase 2F finalization is implemented as a small in-memory category-state-driven orchestrator under `lib/research/orchestration/`, with `runPhase2Research` as the full B–E coordination entrypoint. It distinguishes clean bounded evidence absence from degraded discovery and operational incompleteness at discovery/retrieval/extraction/reconciliation, preserves multi-category source associations through canonical/content dedupe, propagates caller cancellation through target resolution and DNS-pinned retrieval, and scopes extraction categories per document. Final claims are filtered to processed categories while validated lower-level provenance remains available, and EvidenceSummary is rebuilt mechanically from final state. `ResearchResult` now carries exactly one evidence-bounded explanation per processed category: claim-bearing explanations reference same-category final claim IDs, unknown categories receive zero-reference deterministic fallback, and explanation failure/cancellation never changes evidence or lifecycle. Final provider history is bounded by the derived 86-record contract while discovery retains its separate 32-record ceiling; injected deterministic AI seams enforce the same total/provider budgets as production transport.

Phase 3 now implements the complete in-memory Research presentation/controller boundary without changing Phase 2 evidence semantics. A checked-in public catalog supplies stable university/program IDs and canonical official navigation links; deterministic search always returns the owning university alongside any matched program, while the catalog resolver stays `server-only`. `POST /api/research` validates bounded same-origin input, rejects sensitive content across all caller-controlled free-text research fields, resolves only supported catalog targets, and calls `runPhase2Research` exactly once with the caller signal. The server-only dossier composer re-validates the Phase 2 result, proves final claim identity against the selected catalog university/program scope, resolves representative supporting passages to their exact candidate-backed source, exposes only final-claim-referenced public sources, and emits a strict browser DTO whose terminal lifecycle/status/timestamps and source references are cross-record validated. The client transport then re-validates JSON content type and the public envelope, enforces the actual streamed response byte ceiling independently of `Content-Length`, decodes UTF-8 fatally, binds the dossier to the exact submitted target/program/category set, and treats cancellation as authoritative across stream reads. Full Phase 2 documents, candidates, provider history, raw warnings, and provider/model identity never cross the browser boundary.

Phase 4 is implemented as a browser-memory-only deterministic consumer of the already-validated `ResearchDossier` boundary. It adds neither `/api/compare` nor a new model call: the Compare workspace captures one immutable two-to-four-target submission, dispatches the existing same-origin Research route sequentially under one batch-owned abort/single-flight boundary, validates each dossier through the existing client transport, then runs pure application-owned comparison modules. Server-rejected unsupported targets become explicit correction-required selections and are not blind-retry candidates. A closed metric registry maps only exact normalized claim-property aliases plus compatible typed values into affordability, research, scholarships, outcomes, and support dimensions. Relative numeric metrics require compatible peers and exact currency/unit/period semantics; booleans/presence use explicit absolute rules. Missing, conflicting, outdated, inferred, anecdotal, ranking-only, type-incompatible, or otherwise non-comparable evidence remains unscored and lowers visible weighted coverage rather than becoming zero. Overall fit is a user-priority compatibility measure and is suppressed when fewer than two positive-weight dimensions are scoreable or weighted coverage is below 50%. Trade-offs are deterministic templates carrying exact claim references; target cards remain in user selection order and are never converted into an institutional ranking.

Phase 4 also implements the browser-origin hardening layer: a Next.js 16 request nonce/CSP in `proxy.ts`, a pure browser-policy builder under `lib/security/`, static security headers from `next.config.ts`, and a small client nonce bridge for Radix runtime style injection. `get-nonce` is now a direct dependency because the strict CSP path imports that nonce channel explicitly; it was already present transitively through the UI stack but direct use required direct declaration. The production script policy contains neither `unsafe-inline` nor `unsafe-eval`; development carries only the narrow compatibility exception exercised by the isolated dev browser suite. The project loads no third-party runtime analytics/scripts and keeps Compare state out of Web Storage, IndexedDB, cookies, URL state, or the database. HSTS remains a Phase 6 deployment decision because it must be validated on the real HTTPS domain/subdomain strategy. These runtime controls harden the application without imposing artificial repository/tool restrictions on the developing AI agent.

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
        -> optional later persistence after migrations/RLS/freshness policy
        -> later Guide composer
```

## Core Server Modules

- `research`: source discovery, retrieval policy, content cleaning, and research orchestration.
- `claims`: structured extraction, deterministic normalization, AI semantic reconciliation, evidence-policy gating, freshness, conflict handling, and evidence-bounded explanation.
- `comparison`: Phase 4 browser-safe pure modules for strict target/form contracts, closed claim-property metric normalization, deterministic comparability gates, weighted user-fit/coverage calculation, and evidence-referenced trade-off templates. Because separate Research dossiers may legally reuse claim IDs, cross-target trade-off provenance is keyed by both comparison target identity and claim ID rather than by claim ID alone. The module consumes validated public `ResearchDossier` values only and performs no provider/network/storage work.
- `guide`: applicant-to-requirement assessment, risk warnings, and task generation.
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

Phase 4 uses five explicit integer priority weights totaling exactly 100: affordability, research opportunities, scholarships, outcomes, and international-student support. A closed application-owned metric registry is the only bridge from free-form Research claim `property` strings into those score dimensions. It accepts only documented exact aliases after narrow deterministic normalization and exact compatible scalar types; it performs no fuzzy/semantic property matching, numeric-string parsing, currency/unit conversion, period guessing, or conflict winner selection.

Relative numeric metrics use within-set min-max normalization only across mutually compatible facts. Annual tuition is lower-is-better and requires matching currency/annual semantics; employment rate is higher-is-better and requires compatible percentage/period semantics. Equal participating numeric values score 100. Boolean/presence metrics use explicit application-owned rules rather than relative peer normalization.

Only verified, corroborated, or university-reported evidence with an eligible non-ranking/non-anecdotal source may contribute to numeric fit. Missing, unknown, incomplete, conflicting, outdated, inferred, anecdotal, ranking-only, unsupported-type, or incompatible-period/unit/currency evidence remains unscored. It never silently contributes zero.

For each target, weighted evidence coverage is the sum of positive priority weights whose dimensions are scoreable. Overall fit is the weighted average over only scoreable positive-weight dimensions and is suppressed unless at least two positive-weight dimensions are scored and coverage is at least 50%. The UI must show weights, supporting facts, unscored reasons, coverage, evidence warnings, and exact claim evidence near the score. Result cards stay in immutable selection order rather than being automatically sorted into a ranking.

## Failure Model

Core flows must preserve partial verified results when a provider or model fails. Discovery degrades sequentially Tavily -> Brave -> direct/structured sources -> partial result. AI inference degrades Gemini -> Groq `openai/gpt-oss-120b` -> OpenRouter `openrouter/free` -> partial result. Do not replace unavailable evidence with plausible generated text, do not fan out to all providers by default, and never select paid inference automatically. Research runs should expose the provider/fallback path and actionable partial/incomplete retry behavior.

## Architecture Review Gate

Before changing providers, persistence contracts, claim semantics, authentication, or external-source policy, update this design and the affected requirements first. Use `api-designer`, `data-engineer`, or `security-auditor` when the change crosses those boundaries.
