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

- [x] Keep Phase 2E standalone/in-memory: consume validated candidates/sources/documents, the one resolved target, requested period context, and an explicit caller-supplied decision-eligible category set; do not rerun B–D stages or emit terminal Phase 2F lifecycle.
- [x] Generalize the Phase 2D structured-AI transport from extraction-only to extraction/reconciliation/explanation stage telemetry and stage-neutral provider/total budgets while preserving the verified extraction API/24-request behavior; add 12 actual reconciliation attempts/run, 6 explanation attempts/run, 12 pair questions/request, and 144 ambiguous pair questions/run with fail-closed overflow.
- [x] Evolve `VerifiedClaim` so university identity is truthful ID-or-name, optional program ID/name/intake survives, Phase 2E `candidateIds` mechanically backs exact source/document/supporting-text provenance, inherited uncalibrated confidence is removed, and claim-level `unknown` is rejected; never fabricate IDs for name-only research.
- [x] Reuse the exact Phase 2B Unicode identity normalizer and build non-mutating conservative property/value/period comparison views; preserve scalar types, perform no exchange-rate/unsafe unit/numeric-string coercion, never infer missing periods, and do not use retrieval recency as claim validity.
- [x] Define deterministic, bounded, deduplicated semantic pair questions and one strict portable relationship schema for equivalent/contradictory/period/scope/general-specific/conditional/broader-narrower/insufficient-evidence; only exact supplied question/candidate IDs may be referenced, valid siblings survive, and only unresolved pairs fail over.
- [x] Use AI only for genuine semantic ambiguity; safe exact-equivalent evidence and structurally provable incompatible program/degree/period cases remain deterministic, same-looking differently worded passages with possible campus/modality/residency/cohort qualifiers do not bypass semantics, and AI equivalence cannot override hard identity/period/scope gates.
- [x] Reconciliation uses Gemini Flash-Lite -> one Flash quality escalation only for schema/provenance-invalid output -> Groq -> OpenRouter Free; valid `insufficient-evidence` and availability failures do not quality-escalate, provider-local budget exhaustion fails over, stage-total exhaustion stops new reconciliation calls, and caller abort prevents retry/escalation/fallback.
- [x] Implement deterministic authority/source/scope/freshness/independence gates with conservative source-type/category rules for verified, university-reported, corroborated, conflicting, outdated, anecdotal, inferred, and category-level unknown; unknown/unsupported properties never guess upward to verified.
- [x] Ensure same content/source, same normalized publisher, multiple official pages for the resolved university, mirrors/shared datasets/syndication, and host-only differences do not manufacture independent corroboration; unresolved independence fails closed, and current credible contradiction produces separate conflicting value clusters without majority override.
- [x] Every final factual value must correspond to a referenced candidate after allowed deterministic normalization; Phase 2E never synthesizes a new factual scalar, and inferred evidence remains candidate/source traceable.
- [x] Only a caller-marked decision-eligible category may become processed category-level unknown with zero claims; operational extraction/reconciliation/question-overflow/provider exhaustion remains unresolved/unprocessed/failed for Phase 2F rather than unknown.
- [x] Add optional evidence-bounded explanation after gating with strict category/claim references, no URLs or novel fact-like tokens, no Gemini quality escalation, six-attempt presentation budget, and deterministic fallback that cannot change evidence status/completion.
- [x] Add the deterministic Phase 2E matrix for truthful identity/provenance, Unicode/UTF-16 boundaries, conservative normalization, pair batching/caps, relationship validation/partial fallback, stage budgets/telemetry/abort, authority/independence/conflict/freshness/unknown/anecdotal/inferred semantics, privacy, explanation rejection/fallback, and preservation of every Phase 2A–2D regression.
- [x] Follow the Phase 2E final-review policy in the execution runbook: no implementation subagents; only the final looping read-only reviewer, GLM variant first, one-way fallback to GPT only after an explicit terminal GLM error/rate-limit, and never treat a still-running child as timed out merely because one wait window elapsed.

### Phase 2F — Orchestration and Phase 2 verification

- [x] Extract a project-owned Phase 2B/C stage seam while preserving `runDiscoveryRetrieval()` compatibility; resolve target identity exactly once and carry that resolved target through D/E/F.
- [x] Implement `lib/research/orchestration/` with one small full-pipeline entrypoint (`runPhase2Research` recommended), canonical requested-category ordering, UUID-based bounded run IDs, injectable monotonic clock/run-id seams, and no provider-wire types/secrets in injected stage callbacks.
- [x] Split discovery's existing 32-record attempt limit from the final whole-run provider-history limit; keep discovery <=32, bound/dedupe non-dispatched AI skip telemetry, and derive/prove the final **86-record** ceiling = 32 discovery + 28 extraction + 16 reconciliation + 10 explanation without truncating actual attempts.
- [x] Split the existing 60-second run timeout into a discovery-specific deadline; compose caller `AbortSignal` through discovery and DNS-pinned retrieval, add truthful cancelled termination/failure state, cancel in-flight pinned requests/redirect chains, clean up listeners/timers, and do not impose the 60-second discovery deadline on the full 24/12/6-attempt Phase 2F AI pipeline.
- [x] Make discovery lifecycle truthful after final source selection: distinguish covered vs clean-empty vs degraded direct/ROR salvage vs operationally failed; degraded salvage is retained but not decision-eligible; preserve multi-category associations across canonical URL dedupe; source-budget loss of a category's only association becomes `source-limit`.
- [x] Make retrieval/extraction lifecycle fail closed: every selected category-associated source must become usable or proven redundant; identity-only source failure does not poison categories; clean-empty categories consume no AI; add backward-compatible per-document category scoping so unprocessed segments make only genuinely associated categories incomplete; narrow extraction `runTask` to the public task only and make injected attempts consume the same shared extraction budget as production while preserving earlier candidates.
- [x] Pass Phase 2E only B/C/D-complete decision-eligible categories; retain source/document/candidate provenance but prune final claims to processed categories, and preserve all Phase 2E authority/period/scope/unknown/conflict invariants.
- [x] Add strict evidence explanations to final `ResearchResult`: exactly one validated/model-or-fallback explanation per processed category, same-category claim references only, zero-reference deterministic fallback for unknown, no explanation for unprocessed categories, and no AI call for zero-claim categories.
- [x] Strengthen terminal lifecycle/failure contracts: succeeded/partial/failed only; exact monotonic timestamps/partial boolean; processed/unprocessed exact request partition; failed has zero processed; `categoriesFailed` subset unprocessed; truthful `cancelled` and run-level `normalization`; bounded deduplicated terminal failures only after fallback exhaustion.
- [x] Rebuild EvidenceSummary from final processed categories/final claims only: exact coverage/statusCounts/totalClaims/conflict/outdated/unknown/failed sets, then validate explanations and complete `ResearchResult` cross-record provenance at the return boundary.
- [x] Add the expanded offline `tests/phase2f-orchestration.test.ts` matrix covering category-order permutation, attempt ceilings, discovery empty-vs-failed, multi-category dedupe, retrieval redundancy/failure, extraction unfinished, all provider fallbacks/budgets, semantic overflow, explanation integrity/fallback, aborts, and succeeded/partial/failed lifecycle; keep all Phase 2A-E regressions green.
- [x] Apply the canonical model-specific delegation policy from `AGENTS.md` to any future Phase 2F rework: GLM-5.3 Max uses zero subagents and performs final review inline; native OpenAI GPT models retain the final read-only `code-reviewer` step after local gates. Historical Phase 2F GLM-reviewer instructions are superseded. The completed Phase 2F implementation itself was finalized through main-agent defect-first review because its active host exposed no executable child-dispatch action.
- [x] Run focused security/secret/requirements traceability plus focused/full tests, typecheck, lint, build, audit, workspace verifier, Windows diff check, UTF-8/control scan, provider-secret/public-env scan, ignored `.env.local` verification, and final diff/status review. No live provider calls, deployment, persistence/RLS, or UI wiring were used; the user separately authorized the final Phase 2F commit and push after these gates pass.

- [x] Keep pipeline correctness in memory; persistence remains a later explicit task after stable contracts/evidence semantics and RLS design.

## Phase 3 — Research Mode

Canonical architecture/edge-case plan: `docs/planning/phase-3-research-mode.md`.

Execution policy follows `AGENTS.md`: GLM-5.3 Max performs all work and final review in the main agent with no subagents; native OpenAI GPT models retain the final read-only `code-reviewer` step after local gates.

### Phase 3A — Supported catalog and browser-safe contracts

Detailed runbook: `docs/superpowers/plans/2026-08-17-phase-3a-research-catalog-and-public-contracts.md`.

- [x] Add strict browser-safe Research category/request/dossier/response schemas without importing server-only Phase 2 limits/contracts into client code; cross-test all duplicated public enums/bounds against Phase 2 so drift fails deterministically.
- [x] Add a checked-in 10–15-university supported catalog across US/UK/Thailand with stable application IDs, HTTPS canonical university/program links, verified CS/AI/Data Science-related bachelor/taught-master coverage where official offerings exist, and no factual admissions/fee/deadline claims in catalog data.
- [x] Verify every catalog identity/program/official URL against current official sources during implementation; use no guessed program names/URLs, and document verification date separately from evidence freshness.
- [x] Add deterministic NFKC search/filter behavior for university/program/alias/subject plus country/degree/subject filters; no fuzzy silent retargeting of unsupported input, and every returned program search result carries its owning university in the same result set.
- [x] Add a no-network catalog-backed Phase 2 target resolver as an explicit `server-only` module; keep the client catalog barrel free of resolver/Phase 2 server coupling.

### Phase 3B — Bounded Research API and dossier composer

Detailed runbook: `docs/superpowers/plans/2026-08-17-phase-3b-research-api-and-dossier-composer.md`.

- [x] Add a Node-runtime same-origin `POST /api/research` handler with 16 KiB actual-body ceiling, strict UTF-8/JSON decoding, Origin/Sec-Fetch-Site guard, catalog membership/ownership validation, and sensitive-content rejection across `question`/`intake`/`academicYear` before provider dispatch.
- [x] Call `runPhase2Research` exactly once per valid request with the exact request `AbortSignal` and catalog resolver; do not add automatic POST retries, durable-job fiction, polling, persistence, caller-supplied provider settings, or live-provider tests.
- [x] Add a deterministic server-only `ResearchResult -> ResearchDossier` composer that exposes only final claims, their exact representative supporting text, final-claim referenced public sources, category explanations/lifecycle, catalog official links, and sanitized operational failures; never serialize documents/candidates/provider-attempt history/raw warnings, and fail closed unless final claim identity matches the selected catalog university/program scope.
- [x] Preserve final scalar types/statuses and resolve the displayed representative source from exact candidate-backed supporting text rather than assuming the first source ID; fail closed on broken cross-record invariants instead of silently rewriting/truncating evidence. The public DTO rejects unused sources, contradictory terminal lifecycle status, and non-monotonic run timestamps.
- [x] Validate every outgoing public response, keep it `no-store`, enforce a defensive 4 MiB serialized envelope without factual truncation, and map unexpected internal errors to a strict non-leaking error envelope.

### Phase 3C — Interactive Research workspace and evidence UX

Detailed runbook: `docs/superpowers/plans/2026-08-17-phase-3c-research-workspace-and-evidence-ui.md`.

- [x] Replace the illustrative `/research` preview with a catalog-driven server-to-client workspace; never mix example factual claims with live/fixture-backed results and keep `app/research/page.tsx` server-rendered with public catalog data only.
- [x] Add pure catalog-aware Phase 3C form/request helpers before React wiring: supported target/program ownership, explicit program -> university-only scope switching, canonical category toggles, deterministic subject filters/target labels, blank optional question/intake/year omission, UTF-16 boundary validation, and final strict public-request validation with zero fuzzy retargeting.
- [x] Add a pure request/result reducer plus immutable `ResearchSubmissionSnapshot` and synchronous active-request guard so same-tick double-click/Enter cannot create duplicate POSTs, mutable controls cannot alter an in-flight request, cancellation/stale outcomes cannot win later, and exact historical retry is distinct from a new request built from current form values.
- [x] Add a pure injectable client transport for exactly one same-origin `/api/research` POST with no-store/redirect-error semantics, strict JSON/public-envelope validation, HTTP/envelope consistency, signal-authoritative cancellation, sanitized network/invalid-response outcomes, and exact submitted university/program/category binding before any dossier can render.
- [x] Implement accessible supported-target search/filter/select, seven native category controls, optional public question/intake/year, explicit free-text privacy guidance, and deterministic client errors; initialize all seven categories selected, forbid zero-category submission, prevent target-search/textarea Enter from accidental research submission, and treat server `sensitive-input` as a free-text-group error across question/intake/year rather than duplicating the detector in the browser.
- [x] Render succeeded/partial/failed run banners and canonical ready/unknown/incomplete category sections without reinterpreting Phase 2 evidence; category-level `Unknown` must never represent operational incompleteness, refresh retains the prior dossier under its original target until replacement, and Retry repeats the exact stored public submission rather than mutable current form values.
- [x] Render verified/corroborated/university-reported/conflicting/anecdotal/inferred/outdated claim badges exactly; never select a conflict winner, infer freshness from retrieval time, convert units/currency, parse numeric strings, or display removed claim confidence.
- [x] Build one controlled keyboard/focus-managed claim evidence Sheet/Dialog from the existing Radix stack showing exact supporting text, representative source first, all claim source links once, explicit period/retrieval metadata, and separate catalog-owned official target links; render retrieved text as React text only, use safe no-referrer external anchors, return focus to the exact trigger, and close stale evidence state before dossier replacement/new research.
- [x] Close Phase 3C with focused state/form/transport/format/rendered-UI TDD, including independent-review regressions for field-error ARIA association, populated-only sensitive-input invalid state, server-returned target labeling, clear-result semantics, retry ownership, and prior-evidence navigation during refresh; run full Vitest/type/lint/build/audit/workspace/diff gates plus UTF-8/control + provider-secret/NEXT_PUBLIC/client-boundary/residue scans, `.env.local` isolation, and deterministic desktop/mobile rendered sanity with `/api/research` intercepted outside production code; make zero live provider calls, make no Phase 3D Playwright dependency change, and keep `ui-flow-screenshots/` untouched.

### Phase 3D — Failure-state, accessibility, security, and browser acceptance

Detailed runbook: `docs/superpowers/plans/2026-08-17-phase-3d-research-hardening-and-browser-qa.md`.

- [ ] Align the dev-only Playwright Test runner at the existing 1.62.x version if the implementation-time manifest still has only the direct `playwright` package; avoid unrelated dependency upgrades and generated browser artifacts in Git.
- [ ] Add strict public-schema-validated browser fixtures for all-ready, unknown, partial, failed, conflict, outdated, long-content, XSS-looking, malformed-response, and transport-error scenarios; browser tests intercept `/api/research` and make zero live provider calls.
- [ ] Prove catalog search/selection, form validation, exact request body, single-flight submit, cancel/refresh/unmount/stale-response behavior, explicit retry, malformed/non-JSON response rejection, and unsupported/sensitive-input recovery.
- [ ] Prove all evidence/lifecycle states, claim/source association, focus trap/return, text-only XSS handling, no browser provider calls/secrets/internal Phase 2 arrays, and zero unexpected console/page errors.
- [ ] Verify 320/375/768/1024/1440 viewport matrix, no horizontal page overflow, long names/URLs/2000-character evidence text, keyboard-only flows, visible focus, form error associations, controlled live-region announcements, and reduced-motion behavior.
- [ ] Run Phase 3 requirements traceability plus focused/full Vitest, Playwright, typecheck, lint, production build, audit, workspace verifier, authoritative Windows diff check, UTF-8/control scan, provider-secret/public-env/client-boundary scans, `.env.local` isolation, and final defect-first diff review while keeping every Phase 2 regression green.
- [ ] Keep public deployment blocked until Phase 6 verifies current platform duration/cancellation behavior and a durable/deployment-layer rate limit for the expensive Research endpoint; local single-flight and Phase 2 attempt budgets are not a distributed abuse control.

- [ ] Keep Research pipeline results in memory in Phase 3; Supabase persistence, migrations, RLS, saved history, background jobs/queues, and deployment remain later explicit work.

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
