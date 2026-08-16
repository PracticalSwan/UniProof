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

Completed in the current Phase 2B–2C batch; retain the runbook below as the acceptance record.

- [x] Add bounded deterministic category-aware query planning; do not use AI for query generation.
- [x] Extend the Phase 2A category contract with first-class `program-structure`, raise the category ceiling to seven, and add a regression before downstream use.
- [x] Add explicit target identity resolution for name-based, program-name-only, subject-area-only, ID-only, unresolved-ID, and question-only requests; never invent official URLs or blindly accept the first/score-ranked ROR match.
- [x] Add project-owned discovery result/attempt types and bounded ordered `ResearchRun.providerAttempts` telemetry without replacing existing Phase 2A compatibility fields.
- [x] Implement Tavily Search as primary general-web discovery with small/basic requests and no answer/raw-content evidence use.
- [x] Implement Brave Web Search as sequential fallback only when Tavily yields no usable candidates after bounded handling.
- [x] Implement degraded discovery using trusted resolved official targets plus disambiguated ROR.
- [x] Canonicalize/deduplicate candidates and enforce per-domain/total source budgets before retrieval.
- [x] Add/extend `npm run setup:providers` so discovery setup requires only Tavily/Brave keys, preserves `.env.local`, and never exposes secrets.
- [x] Add deterministic tests for provider success, empty/config/auth/429/timeout/5xx/invalid-response fallback, Unicode-safe target/ROR identity matching, current ROR display-name/website semantics, provenance-aware deduplication, budgets, partial coverage, and secret-safe telemetry.

### Phase 2C — DNS-pinned retrieval and normalization

Completed in the current Phase 2B–2C batch; retain the runbook below as the acceptance record.

- [x] Implement actual HTTP(S) transport that connects through the Phase 2A validated address set; do not validate and then call ordinary `fetch(url)` with an uncontrolled second DNS lookup.
- [x] Revalidate and re-pin every redirect; enforce connect/request timeouts, redirect limit, streamed byte cutoff, supported MIME types, minimal headers, and no credential/cookie forwarding.
- [x] Fail closed on unsupported content encoding in the initial transport unless bounded decompression is deliberately implemented/tested.
- [x] Normalize `text/html` and `text/plain` deterministically into provenance-preserving ResearchDocument records; preserve headings/tables/supporting text and truncate within Phase 2A bounds.
- [x] Promote discovery candidates to Source/ResearchDocument only after safe retrieval/usable normalization; deduplicate by canonical URL and normalized-content SHA-256.
- [x] Keep PDF retrieval explicitly bounded but do not fabricate a ResearchDocument when no PDF normalizer exists.
- [x] Add local/mock transport tests for DNS pinning, redirect-to-private rejection, stalled-body timeout, declared and streamed oversize responses, MIME/encoding rejection, response-header isolation, sanitized failures, normalization, and duplicate content.
- [x] Add one offline integration fixture from ResearchRequest -> discovery -> safe retrieval -> normalized sources/documents with no AI dependency.

### Phase 2D — Multi-provider structured extraction

Implement only after Phase 2B–2C passes its acceptance gate.

- [x] Make the minimal additive Phase 2D contract changes: bounded optional provider-attempt `model` provenance, bounded optional `ClaimCandidate.intake`, and bounded trusted `ClaimCandidate.extractionProvider` provenance, with regressions; `VerifiedClaim` identity remains unchanged for Phase 2E.
- [x] Define one strict portable provider-facing extraction schema shared by Gemini/Groq/OpenRouter: all object properties required at JSON-schema level, nullable optionals, no trusted IDs/source authority/evidence state/model confidence, max 12 claims/response; validate raw supporting text exactly before normalization and preserve valid siblings when another returned claim fails promotion.
- [x] Deterministically segment normalized ResearchDocuments (5,000 Unicode code points, 250 same-section overlap with monotonic advancement), preserve section/source boundaries, and verify returned segment ID + exact supporting substring before promotion to ClaimCandidate; overlap dedupe preserves distinct-source/document provenance.
- [x] Implement one project-owned AI structured-task interface over fixed server-owned REST endpoints with credentials in headers, `redirect:"error"`, 30-second timeout, 256 KiB response bound, one transient retry, concurrency 1, provider-specific attempt ceilings, and a 24-actual-request total extraction budget; provider-local exhaustion fails over while total exhaustion stops dispatch.
- [x] Implement Gemini `gemini-3.5-flash-lite` with exactly one `gemini-3.5-flash` quality escalation only for recorded invalid-response/integrity failure; use the live-validated `/v1beta/interactions` surface statelessly with `store:false` and current text/JSON `response_format`, keep the explicit two-model Phase 2D allowlist, and treat any future migration to Google’s stable `/v1/interactions` as a separately revalidated provider-contract change; never opt into paid inference.
- [x] Implement Groq `openai/gpt-oss-120b` as availability fallback using strict JSON-schema Structured Outputs, low reasoning, `max_completion_tokens`, no streaming/tools, and no paid model substitution.
- [x] Implement OpenRouter `openrouter/free` as final availability fallback with strict structured output, `require_parameters`, `data_collection="deny"`/configured ZDR policy, concrete returned-model provenance, and no paid route fallback.
- [x] Extend the existing provider setup CLI to the fixed Tavily/Brave/Gemini/Groq/OpenRouter key set; preserve unrelated `.env.local` content/newlines/comments, never print secret fingerprints, run no connectivity check by default, and do not automatically enable live research mode.
- [x] Preserve earlier validated candidates across retry/fallback/budget exhaustion and classify config/auth/429/timeout/5xx/invalid-response/capability/policy/budget through the existing bounded vocabulary without raw provider errors in telemetry.
- [x] Add the deterministic Phase 2D matrix for portable schema constraints, segmentation/quote integrity, UTF-16-safe generated IDs/model provenance, mixed valid/invalid and valid-empty extraction results, all seven categories, exact provider request/response shapes, quality-vs-availability fallback, provider-local versus total budget exhaustion, pre-abort/in-flight-abort semantics, non-blocking bounded-response cleanup, privacy-safe telemetry, once-per-run configuration skips, setup CLI behavior, and full-chain exhaustion while all Phase 2A–2C regressions stay green.
- [x] After explicit authorization and provider-key configuration, run one bounded live smoke request each against Tavily, Brave Search, Gemini, Groq, and OpenRouter; all five configured connections succeeded on 2026-08-16 without exposing key material, and normal automated tests remain offline.

### Phase 2E — AI-assisted reconciliation with deterministic evidence gates

- [ ] Evolve `VerifiedClaim` before gating so university identity is truthful ID-or-name (with optional program ID/name and intake), preserve Unicode-safe cross-record identity checks, and never fabricate IDs for name-only research.
- [ ] Normalize university/program/degree/period/property/value identity deterministically before semantic grouping; the live contract has no trusted campus field, so campus-specific evidence remains scope-incompatible unless a deliberate tested campus contract is added.
- [ ] Define strict portable semantic relationship output: equivalent, contradictory, period/scope differences, general-specific compatibility, conditional exception, broader/narrower compatibility, or insufficient evidence; only supplied candidate IDs may be referenced.
- [ ] Use AI reconciliation only for genuinely semantic ambiguity; exact equivalence and provable period/scope differences remain deterministic, and AI equivalence cannot override identity/period incompatibility.
- [ ] Implement deterministic source/scope/freshness/independence gates for verified, university-reported, corroborated, conflicting, outdated, anecdotal, inferred, and category-level unknown states with explicit precedence.
- [ ] Ensure mirrors/shared datasets/same-origin evidence do not count as independent corroboration; unresolved independence fails closed, and current credible contradiction is not promoted away by majority count.
- [ ] Represent a **processed** category with no eligible evidence through exact EvidenceSummary coverage/categoriesUnknown and zero claims; keep operational extraction/reconciliation exhaustion unprocessed/failed instead of calling it unknown.
- [ ] Add optional evidence-bounded explanation with strict supplied-ID references and deterministic fallback; explanation failure cannot change a successful evidence decision.
- [ ] Add deterministic gate tests for name-only identity, intake/scope separation, absent-campus behavior, source independence, verified/university-reported distinction, conflicts, stale/unknown/anecdotal/inferred states, AI exhaustion, rejected model proposals, and explanation fallback.

### Phase 2F — Orchestration and Phase 2 verification

- [ ] Implement a new small in-memory coordinator that resolves target identity once and reuses the Phase 2B/C modules through discovery -> retrieval -> segmentation/extraction -> normalization -> reconciliation -> evidence gate -> explanation/fallback -> ResearchResult; keep `runDiscoveryRetrieval()` as the existing B/C boundary.
- [ ] Finalize schema invariants for terminal lifecycle/timestamps: orchestrator emits only succeeded/partial/failed; terminal partial boolean is exact; created <= started <= updated <= completed; no legacy completed/queued emission.
- [ ] Make requested-category lifecycle a complete partition: processed/unprocessed unique/disjoint/union=requested, run and EvidenceSummary sets match, failed is operational, unknown is processed-only, and retained source/candidate data alone does not make a run partial.
- [ ] Make EvidenceSummary exact from final gated claims: one coverage row per processed category only, exact claimCount/statuses/hasEvidence, zero-claim unknown row, exact total/statusCounts, conflict/outdated subsets derived from claims.
- [ ] Calculate the legal worst-case provider-attempt count from actual discovery/extraction/reconciliation/explanation budgets; raise the current max only if required, to the smallest justified bound with regression, never truncate history.
- [ ] Retain the complete offline fixture matrix for name/ID identity, all seven categories, discovery/retrieval security failures, segmentation/extraction failover, evidence independence/conflict/unknown/outdated/anecdotal/inferred states, semantic rejection, explanation fallback, and succeeded/partial/failed lifecycle invariants.
- [ ] Run focused security/secret/requirements-traceability review plus typecheck, lint, build, tests, audit, workspace verification, diff/encoding checks; repeatedly fix and re-review until the final integrated reviewer reports no remaining fixable issues.
- [ ] Keep pipeline correctness in memory; persistence remains a later explicit task after stable contracts/evidence semantics and RLS design.

## Phase 3 — Research Mode

- [ ] Build university/program discovery and filters.
- [ ] Build evidence-first dossier sections for admissions, tuition, scholarships, program structure, research, outcomes, and support.
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
