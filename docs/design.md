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

Phase 2D sends public normalized research segments only to the extraction chain. Applicant profiles and sensitive/personal documents are outside the free-tier extraction/reconciliation boundary. The extraction stage is sequential and bounded to 24 actual AI HTTP attempts per run, with provider-specific counters checked before the shared total; provider-local exhaustion falls through to the next eligible provider while total exhaustion stops dispatch. The existing 100-call extraction schema ceiling remains a separate contract limit. Phase 2E reconciliation and Phase 2F lifecycle orchestration remain separate runtime batches.

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
        -> optional later persistence after migrations/RLS/freshness policy
        -> Research / Comparison / Guide composer
        -> evidence-aware UI
```

## Core Server Modules

- `research`: source discovery, retrieval policy, content cleaning, and research orchestration.
- `claims`: structured extraction, deterministic normalization, AI semantic reconciliation, evidence-policy gating, freshness, conflict handling, and evidence-bounded explanation.
- `comparison`: deterministic category normalization and weighted user-fit calculation.
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

The fit score is deterministic and explainable. It represents compatibility with the user's selected priorities, not institutional quality.

Missing evidence should lower confidence/coverage rather than automatically assign the worst category score. The UI must show category weights, supporting values, evidence coverage, and conflicts near the score.

## Failure Model

Core flows must preserve partial verified results when a provider or model fails. Discovery degrades sequentially Tavily -> Brave -> direct/structured sources -> partial result. AI inference degrades Gemini -> Groq `openai/gpt-oss-120b` -> OpenRouter `openrouter/free` -> partial result. Do not replace unavailable evidence with plausible generated text, do not fan out to all providers by default, and never select paid inference automatically. Research runs should expose the provider/fallback path and actionable partial/incomplete retry behavior.

## Architecture Review Gate

Before changing providers, persistence contracts, claim semantics, authentication, or external-source policy, update this design and the affected requirements first. Use `api-designer`, `data-engineer`, or `security-auditor` when the change crosses those boundaries.
