# UniProof Hackathon Task Plan

Deadline snapshot: 2026-08-22 16:00 UTC / 23:00 ICT. Re-verify Devpost before final submission.

## Phase 0 — Repository Foundation

- [x] Create cross-agent governance and mandatory `LESSONS.md` workflow.
- [x] Create product requirements, architecture, security, source policy, and hackathon snapshot.
- [x] Create repository hygiene files and workspace verification script.
- [x] Initialize Git and public remote after explicit authorization.

## Phase 1 — Application Foundation

- [x] Scaffold current Next.js + TypeScript application after checking official versions.
- [x] Add Tailwind/shadcn UI foundation using the minimum required dependencies.
- [x] Configure Supabase client/server boundaries and environment validation.
- [x] Define initial Zod schemas and TypeScript domain types for University, Program, Source, Claim, and evidence states.
- [x] Implement the approved Figma-derived responsive Home, Research, Compare, and Guide UI foundation with reusable evidence states.
- [ ] Extend domain contracts for ApplicantProfile, Comparison, and ApplicationPlan when their feature phases begin.
- [ ] Create database migrations with Row Level Security for user-owned data before enabling persistence.
- [ ] Seed a small deterministic university/program dataset for development and fallback demo use.

## Phase 2 — Evidence and Research Pipeline

Canonical architecture: `docs/planning/phase-2-evidence-research-pipeline.md`.

Implementation runbooks:

- Phase 2B–2C: `docs/planning/phase-2b-2c-discovery-retrieval.md`
- Phase 2D–2F: `docs/planning/phase-2d-2f-ai-reconciliation-orchestration.md`
### Phase 2A — Research safety and core contracts

- [x] Define strict Zod-first ResearchRequest, ResearchRun, CandidateSource, ResearchDocument, ClaimCandidate, VerifiedClaim, EvidenceSummary, and ResearchResult contracts.
- [x] Implement/review SSRF-resistant outbound URL validation with DNS/IP, conservative IPv6 classification, redirect validation, and sanitized failure metadata.
- [x] Centralize bounded retrieval/research limits for timeout, redirects, response bytes, MIME types, source counts, normalized text, calls, and claims.
- [x] Add retained deterministic Phase 2A security/contract regressions without live provider credentials.

### Phase 2B — Discovery and discovery-provider setup

Next-batch scope; implement together with Phase 2C.

- [ ] Add bounded deterministic category-aware query planning; do not use AI for query generation.
- [ ] Add project-owned discovery result/attempt types and bounded provider-attempt telemetry without replacing existing Phase 2A compatibility fields.
- [ ] Implement Tavily Search as primary general-web discovery with small/basic requests and no answer/raw-content evidence use.
- [ ] Implement Brave Web Search as sequential fallback only when Tavily yields no usable candidates after bounded handling.
- [ ] Implement direct/structured degraded discovery using trusted official targets plus ROR/OpenAlex baseline adapters.
- [ ] Canonicalize/deduplicate candidates and enforce per-domain/total source budgets before retrieval.
- [ ] Add/extend `npm run setup:providers` so discovery setup requires only Tavily/Brave keys, preserves `.env.local`, and never exposes secrets.
- [ ] Add deterministic tests for provider success, empty/config/auth/429/timeout/5xx/invalid-response fallback, deduplication, budgets, partial coverage, and secret-safe telemetry.

### Phase 2C — DNS-pinned retrieval and normalization

Next-batch scope; implement together with Phase 2B.

- [ ] Implement actual HTTP(S) transport that connects through the Phase 2A validated address set; do not validate and then call ordinary `fetch(url)` with an uncontrolled second DNS lookup.
- [ ] Revalidate and re-pin every redirect; enforce connect/request timeouts, redirect limit, streamed byte cutoff, supported MIME types, minimal headers, and no credential/cookie forwarding.
- [ ] Fail closed on unsupported content encoding in the initial transport unless bounded decompression is deliberately implemented/tested.
- [ ] Normalize `text/html` and `text/plain` deterministically into provenance-preserving ResearchDocument records; preserve headings/tables/supporting text and truncate within Phase 2A bounds.- [ ] Promote discovery candidates to Source/ResearchDocument only after safe retrieval/usable normalization; deduplicate by canonical URL and normalized-content SHA-256.
- [ ] Keep PDF retrieval explicitly bounded but do not fabricate a ResearchDocument when no PDF normalizer exists.
- [ ] Add local/mock transport tests for DNS pinning, redirect-to-private rejection, timeout, oversize, MIME/encoding rejection, header isolation, normalization, and duplicate content.
- [ ] Add one offline integration fixture from ResearchRequest -> discovery -> safe retrieval -> normalized sources/documents with no AI dependency.

### Phase 2D — Multi-provider structured extraction

Implement only after Phase 2B–2C passes its acceptance gate.

- [ ] Define a strict provider-facing extracted-claim schema that excludes trusted IDs, source authority, and final evidence state.
- [ ] Implement one project-owned AI task interface and shared bounded provider error/attempt model.
- [ ] Implement Gemini `gemini-3.5-flash-lite` with `gemini-3.6-flash` only for recorded quality escalation, current Interactions API, `store: false`, and structured output.
- [ ] Implement Groq Free `openai/gpt-oss-120b` as availability fallback using strict JSON-schema Structured Outputs where supported.
- [ ] Implement OpenRouter `openrouter/free` as final availability fallback with parameter-capability/privacy filtering and concrete returned-model provenance.
- [ ] Extend the same provider setup CLI for Gemini/Groq/OpenRouter keys; no second configuration workflow and no automatic paid inference.
- [ ] Verify supporting passages against the supplied ResearchDocument before application code promotes provider output to ClaimCandidate.
- [ ] Add deterministic tests for schema rejection, supporting-passage integrity, quality escalation, sequential failover, retries/budgets, privacy-safe telemetry, and full-chain exhaustion.

### Phase 2E — AI-assisted reconciliation with deterministic evidence gates

- [ ] Normalize entity/program/campus/period/property/value identity deterministically before semantic grouping.
- [ ] Define strict semantic relationship output: equivalent, contradictory, period/scope differences, general-specific compatibility, conditional exception, broader/narrower compatibility, or insufficient evidence.
- [ ] Use AI reconciliation only for genuinely semantic ambiguity; exact cases remain deterministic and provider output can reference only supplied candidate IDs.
- [ ] Implement deterministic source/scope/freshness/independence gates for verified, university-reported, corroborated, conflicting, outdated, anecdotal, inferred, and unknown states.
- [ ] Ensure mirrored/shared-origin sources do not count as independent corroboration and current contradictions are not promoted away.
- [ ] Add optional evidence-bounded explanation with deterministic fallback and no new factual values.- [ ] Add deterministic gate tests for source independence, scope/year separation, verified/university-reported distinction, conflicts, stale/unknown/anecdotal states, AI exhaustion, and rejected model proposals.

### Phase 2F — Orchestration and Phase 2 verification

- [ ] Implement a small in-memory deterministic coordinator for discovery -> retrieval -> extraction -> normalization -> reconciliation -> evidence gate -> explanation -> ResearchResult.
- [ ] Finalize schema invariants for terminal lifecycle/timestamps: orchestrator emits succeeded/partial/failed, not legacy completed/queued, and partial boolean matches terminal status.
- [ ] Keep evidence outcomes separate from operational outcomes: unknown/outdated/conflicting can be fully processed; unprocessed/failed categories remain explicit operational state.
- [ ] Make EvidenceSummary counts/coverage/hasEvidence semantics match the final gated claims and category lifecycle exactly.
- [ ] Retain the complete offline fixture matrix for discovery/AI failover, network failures, evidence states, malformed provider output, policy-gate rejection, and succeeded/partial/failed runs.
- [ ] Run focused security/secret review plus typecheck, lint, build, tests, audit, workspace verification, and diff checks.
- [ ] Keep pipeline correctness in memory; persistence remains a later explicit task after stable contracts/evidence semantics and RLS design.

## Phase 3 — Research Mode

- [ ] Build university/program discovery and filters.
- [ ] Build evidence-first dossier sections for admissions, tuition, scholarships, research, outcomes, and support.
- [ ] Build claim/source drawer with freshness and evidence-state badges.
- [ ] Implement loading, partial, conflict, stale, empty, and failure states.
- [ ] Verify desktop and narrow/mobile layouts with keyboard navigation.

## Phase 4 — Comparison Mode

- [ ] Support comparison of two to four programs.
- [ ] Add include/exclude controls for supported evidence categories.
- [ ] Implement deterministic weighted user-fit scoring with visible inputs and coverage.
- [ ] Keep missing evidence separate from poor fit.
- [ ] Generate evidence-bounded trade-off explanations.
## Phase 5 — Guide Mode

- [ ] Build applicant profile input and validation.
- [ ] Implement requirement-to-profile assessment states.
- [ ] Generate application checklist, timeline, official links, and risk warnings.
- [ ] Prevent admission guarantees or fabricated numeric admission probabilities.
- [ ] Test missing applicant data and unclear official requirements.

## Phase 6 — Hardening and Submission Readiness

- [ ] Run full type, lint, unit/integration, and core Playwright E2E checks.
- [ ] Run focused security review and pre-commit secret scan.
- [ ] Run `requirements-traceability` against MVP requirements.
- [ ] Verify responsive behavior, keyboard flows, source links, provider failures, and partial-result behavior.
- [ ] Prepare README screenshots and architecture explanation only from verified live behavior.
- [ ] Deploy only with explicit authorization, then run live smoke tests.
- [ ] Re-check current Devpost rules, dates, and deliverables.
- [ ] Prepare approximately three-minute demo covering problem, three modes, evidence verification, conflicts/unknowns, and meaningful AI use.
- [ ] Submit to Devpost only with explicit authorization.

## Scope Control

Defer until P0 is stable: global university coverage, document uploads, automatic application submission, admission-probability prediction, complex multi-agent production orchestration, multilingual UI, browser extensions, and counselor collaboration.