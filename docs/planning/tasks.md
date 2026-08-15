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
- [ ] Extend domain contracts for ResearchRun, ApplicantProfile, Comparison, and ApplicationPlan when their feature phases begin.
- [ ] Create database migrations with Row Level Security for user-owned data before enabling persistence.
- [ ] Seed a small deterministic university/program dataset for development and fallback demo use.

## Phase 2 — Evidence and Research Pipeline

Detailed plan: `docs/planning/phase-2-evidence-research-pipeline.md`.

### Phase 2A — Research safety and core contracts

- [x] Define Zod-first ResearchRequest, ResearchRun, CandidateSource, ResearchDocument, ClaimCandidate, VerifiedClaim, EvidenceSummary, and ResearchResult contracts.
- [x] Implement SSRF-resistant outbound URL validation with DNS/IP and redirect revalidation.
- [x] Define bounded retrieval limits for timeout, redirects, response bytes, MIME types, source counts, and duplicate URLs.
- [x] Add deterministic security tests without requiring live provider credentials.

### Phase 2B–2C — Discovery, retrieval, and normalization

- [ ] Add provider-neutral source discovery contracts and approved adapters, starting with Tavily and authoritative structured sources where useful.
- [ ] Implement focused bounded retrieval through the Phase 2A outbound policy.
- [ ] Normalize retrieved content into provenance-preserving ResearchDocument records and deduplicate by canonical URL/content hash.

### Phase 2D–2F — Gemini extraction, evidence reconciliation, and verification

- [ ] Integrate server-only Gemini via `@google/genai`: `gemini-3.5-flash-lite` primary and `gemini-3.6-flash` bounded escalation.
- [ ] Use Interactions API `store: false`, structured JSON output, Zod validation, bounded retries, and free-tier-aware call budgets.
- [ ] Implement deterministic normalization, freshness, missing-data, deduplication, conflict detection, and evidence classification.
- [ ] Build fixtures for verified, corroborated, conflicting, outdated, unknown, anecdotal, malformed-model, rate-limit, retrieval-failure, SSRF, and partial-run cases.
- [ ] Keep pipeline correctness in memory first; add persistence only after contracts/evidence semantics stabilize and RLS requirements are designed.

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
