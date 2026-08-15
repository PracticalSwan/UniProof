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
| AI | Google Gemini Developer API via `@google/genai`, schema-validated structured output |
| Web research | Tavily plus direct approved-source retrieval |
| Research datasets | OpenAlex, ROR, College Scorecard, Discover Uni |
| Tests | Vitest + Playwright |
| Hosting | Vercel + Supabase |

Exact package versions must be resolved from current official documentation at scaffold time and recorded in the lockfile.

## Gemini Model Policy

For the Google AI Studio / Gemini Developer API free tier, use `gemini-3.5-flash-lite` as the default high-volume extraction/classification model and `gemini-3.6-flash` only as a bounded escalation model for ambiguous, conflict-heavy, or repeatedly schema-invalid extraction. Both model IDs and request budgets remain server-side configuration.

Use the Interactions API with `store: false`, keep `GEMINI_API_KEY` server-only, and validate structured JSON output again with project Zod contracts. Do not use Gemini Search grounding on the free tier; source discovery remains a separate Tavily/approved-source concern. Because unpaid Gemini usage has different data-use terms from paid service, Phase 2 sends public research content only and does not send applicant personal data to Gemini.

Exact free-tier RPM/TPM/RPD limits are not hard-coded because Google states active limits vary by model/project and are visible in AI Studio. The server must use bounded concurrency, call budgets, and retry/backoff behavior.

## Primary Data Flow

```text
Applicant profile + research request
        -> query/research planner
        -> approved-source discovery
        -> bounded source retrieval and cleaning
        -> structured claim extraction
        -> schema validation and normalization
        -> conflict/freshness/evidence classification
        -> PostgreSQL claim/source store
        -> Research / Comparison / Guide composer
        -> evidence-aware UI
```

## Core Server Modules

- `research`: source discovery, retrieval policy, content cleaning, and research orchestration.
- `claims`: structured extraction, normalization, evidence metadata, freshness, and conflict detection.
- `comparison`: deterministic category normalization and weighted user-fit calculation.
- `guide`: applicant-to-requirement assessment, risk warnings, and task generation.
- `integrations`: Gemini, Tavily, Supabase, OpenAlex, ROR, College Scorecard, and other approved providers.
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

Core flows must preserve partial verified results when a provider or model fails. Do not replace unavailable evidence with plausible generated text. Research runs should surface partial/incomplete status with actionable retry behavior.

## Architecture Review Gate

Before changing providers, persistence contracts, claim semantics, authentication, or external-source policy, update this design and the affected requirements first. Use `api-designer`, `data-engineer`, or `security-auditor` when the change crosses those boundaries.
