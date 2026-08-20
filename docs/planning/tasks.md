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
- [x] Extend domain contracts for ApplicantProfile, Comparison, and ApplicationPlan in their feature phases.
- [x] Create database migrations with Row Level Security before enabling user-owned persistence.
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

- [x] Freeze the reviewed Phase 3C baseline before Phase 3D work: confirm current commit/status, run the existing 65-test Phase 3C focused and full Vitest baselines, and record filename+size+SHA-256 for the ten protected untracked `ui-flow-screenshots/` PNGs so accidental overwrites are detectable even though Git cannot track them.
- [x] Replace the redundant direct `playwright@1.62.1` dev dependency with exact `@playwright/test@1.62.1`, add a dedicated deterministic Playwright config (`reuseExistingServer:false`, one worker, zero retries, blocked service workers, ignored artifacts, dev/built-server harness only), and do not perform unrelated dependency upgrades.
- [x] Add deterministic schema-validated valid browser fixtures plus explicitly raw invalid fixtures for all-ready, unknown, partial, failed, conflict, outdated, long/12-source, 500-claim maximum, XSS-looking, wrong-target/program/category, malformed/lifecycle/source-reference, HTTP/envelope mismatch, and every public/client transport-error scenario; use actual catalog identities and invented data only.
- [x] Close the remaining client trust-boundary gap with TDD: enforce the **actual <=4 MiB streamed response byte count**, fatal UTF-8 decoding, signal-authoritative cancellation during stream reads, and best-effort/non-blocking reader cleanup even when `Content-Length` is absent or dishonest.
- [x] Build split Playwright specs/helpers with deterministic request barriers/queues and a fail-closed browser network guard; prove catalog search/selection, exact request body/blank omission/canonical categories, client validation, same-tick single-flight, cancel/refresh/unmount/stale ownership, exact retry-vs-new-request semantics, unsupported/sensitive recovery, malformed-response rejection, and zero automatic retry.
- [x] Lock the reviewed Phase 3C presentation fixes in real-browser flows: result headings use server canonical identity, a newer refresh error owns the only Retry, `Clear result` truly clears while preserving current form input, prior dossier evidence remains usable during refresh, and replacement closes stale evidence/focus safely.
- [x] Prove every lifecycle/evidence state and claim/source association, representative-source ordering, conflict no-winner behavior, outdated period versus retrieval labeling, safe official/evidence links, inert XSS-looking text, no JS dialogs/popups/external requests, no provider secrets/internal Phase 2 arrays, and zero unexpected page/application-console errors.
- [x] Verify 320/375/390/768/1024/1440 viewport matrix, no horizontal page overflow, near-contract-max names/values/explanations/URLs/2,000-character evidence, 12-source sheet scrolling, 500-claim render stress, keyboard-only form/evidence/error recovery, focus trap/return, sticky-header focus non-obscuration, practical target geometry, exact error associations, controlled announcements, and reduced-motion behavior.
- [x] Run Phase 3 requirements traceability plus fresh focused/full Vitest, dev Playwright, five-repeat race Playwright, typecheck, lint, production build, audit, built-application Playwright, workspace verifier, Windows diff check, UTF-8/control + real credential-value + public-env/client-boundary/persistence/test-backdoor scans, exact Playwright dependency verification, `.env.local` isolation, and before/after protected screenshot hash equality.
- [x] Perform the final Phase 3D defect-first review **inline in the main ChatGPT agent with zero subagents/reviewer agents**, fix every verified defect with regression coverage where practical, rerun affected/full gates, and update tasks/docs/append-only memory from observed results rather than intent.
- [x] Complete the post-implementation publication review: constrain inherited Playwright dev-harness IDs and recursive cleanup to `output/playwright`, make queued Research fixture replies fail teardown when unconsumed, separate valid from deliberately unvalidated JSON fixture APIs, and add a keyboard-visible skip link/focusable main target across all current pages; retain regression coverage and rerun 306/306 Vitest, 66/66 dev Playwright, 35/35 repeated races, and 66/66 built-app Playwright before publication.
- [x] Keep public deployment blocked until Phase 6 verifies current platform duration/cancellation behavior and a durable/deployment-layer rate limit for the expensive Research endpoint; local single-flight and Phase 2 attempt budgets are not a distributed abuse control.
- [x] Keep Research pipeline results in memory in Phase 3; Supabase persistence, migrations, RLS, saved history, background jobs/queues, and deployment remain later explicit work.

## Phase 4 — Comparison Mode

Detailed architecture/acceptance specification: `docs/planning/phase-4-comparison-mode.md`.

Detailed implementation runbook: `docs/superpowers/plans/2026-08-18-phase-4-comparison-mode.md`.

Security/privacy threat model: `docs/security-threat-model.md`.

- [x] Create and reconcile the complete one-batch Phase 4 specification/runbook against the reviewed Phase 3D baseline, including score formulas, target/result ownership, evidence eligibility, lifecycle/race behavior, accessibility/responsive acceptance, security/privacy controls, and the explicit zero-subagent execution policy.
- [x] Freeze the Phase 3D implementation baseline and ten-file protected screenshot manifest before Phase 4 code changes; require the existing Research/type/lint/build/browser gates to be green before Comparison implementation proceeds.
- [x] Add the browser-origin hardening layer first: Next.js 16 request-nonce CSP through `proxy.ts`, strict production script policy without `unsafe-inline`/`unsafe-eval`, no third-party runtime scripts, static security headers, framework disclosure removal, and real dev/built-browser CSP compatibility tests. Keep HSTS deferred until an authorized real HTTPS deployment is verified.
- [x] Replace the static illustrative `/compare` preview with a catalog-driven accessible workspace for exactly two to four unique supported targets; reject mixed university/program scope and mixed program degree level; never silently retarget a selected option.
- [x] Reuse only the hardened Phase 3 `POST /api/research` + validated `ResearchDossier` boundary for Comparison data. Dispatch selected targets sequentially under one synchronous single-flight guard and batch-owned `AbortController`; do not add `/api/compare`, browser fan-out, or a new scoring/explanation provider call.
- [x] Add include/exclude controls for the seven canonical Research categories plus separate display-only ranking/student-opinion evidence filters. Ranking/anecdotal evidence may be shown on explicit opt-in but must never contribute to numeric fit.
- [x] Add five visible 0–100 relative priorities—Affordability, Research opportunities, Scholarships, Outcomes, and International-student support—with native sliders, raw values shown beside each control, deterministic `raw/sum(raw)` scoring normalization, all-zero rejection, and explicit validation when a positive-weight dimension's backing Research category is excluded.
- [x] Implement a closed application-owned comparison metric registry over exact normalized property aliases and compatible typed values. Never fuzzy/AI-match claim properties, parse numeric-looking strings, convert currency/units, infer effective periods from retrieval time, or select a conflict winner.
- [x] Score only eligible verified/corroborated/university-reported evidence with an eligible non-ranking/non-anecdotal source. Preserve conflict/outdated/inferred/anecdotal/ranking-only/type/currency/unit/period/duplicate-inconsistency cases as explicit unscored reasons rather than zeros.
- [x] Implement deterministic numeric/boolean/presence metric scoring, weighted evidence coverage, and overall user-fit. Relative numeric metrics require compatible peers; missing evidence reduces coverage; overall fit is suppressed below 50% coverage or with fewer than two positive-weight scored dimensions; result cards remain in immutable selection order rather than becoming a university ranking.
- [x] Generate deterministic evidence-bound trade-offs and gaps with exact target-scoped supporting claim references across independent dossiers. Do not generate prestige, winner, admission-probability, causal-quality, or unsupported recommendation language.
- [x] Implement immutable comparison submissions, truthful sequential target progress, cancellation/unmount/stale-response protection, preserved prior results, exact retry ownership, and literal Clear-result semantics. Retry only exact failed/incomplete targets from the immutable prior submission; a new Compare uses the current editable form.
- [x] Reuse exact Research evidence/source inspection while preserving modal focus trap/Escape/return, safe external-link attributes, server-returned canonical target identity, and React-text-only rendering of untrusted evidence.
- [x] Keep Phase 4 privacy-minimized: no free-form Compare question, applicant profile/private data, authentication, third-party analytics, Web Storage, IndexedDB, Cache Storage, cookies, URL/query persistence, service worker, database persistence, or saved comparison history.
- [x] Verify complete keyboard/ARIA/live-region/reduced-motion behavior and 320/375/390/768/1024/1440 responsive layouts, including four-target long-content/Unicode/12-source/2,000-character evidence/high-claim-count stress without page-level horizontal overflow.
- [x] Add complete Phase 4 Vitest and deterministic Playwright coverage for form/contracts, registry normalization, scoring/coverage/suppression, trade-offs/evidence references, lifecycle/races/retry ownership, accessibility, CSP/security headers, XSS-shaped data, no browser persistence/exfiltration, and responsive stress. Keep Playwright retries at zero and repeat the critical comparison lifecycle/race suite at least five times.
- [x] Run the full Phase 2/3/4 final matrix: Vitest, dev Playwright, repeated Comparison races, TypeScript, ESLint, production build, `npm audit --omit=dev`, built-application Playwright, workspace verifier, `git diff --check`, UTF-8/control scan, real credential-value scan, client-boundary/storage/test-backdoor scans, `.env.local` isolation, dependency boundary, requirements traceability, and exact protected screenshot hash equality.
- [x] Perform a separate final two-stage defect-first review inline in the main ChatGPT agent with **zero subagents/reviewer agents**: first Phase 4 specification compliance, then code/security/privacy quality. Fix every verified finding regression-first where practical and rerun affected plus full gates.
- [x] Update README/design/security/tasks/append-only memory only from observed completed Phase 4 behavior and verification; add `LESSONS.md` only for a reusable correction actually discovered during implementation.
- [x] Keep public deployment, persistence/auth/RLS, durable distributed Research rate limiting, live-provider smoke, Phase 5 Guide implementation, commit, and push outside Phase 4 unless separately explicitly authorized.
- [x] Complete the independently requested post-implementation publication review: fix simultaneous conflict/outdated warning suppression, make trade-off evidence target-scoped when claim IDs are reused across dossiers, and prevent root TypeScript from discovering generated `output/playwright` snapshots. Fresh publication gates passed 346/346 Vitest, 121/121 dev Playwright, 70/70 five-repeat lifecycle executions, 121/121 built Playwright, type/lint/build/audit/workspace/diff/security-integrity checks, with zero live-provider/deployment activity.

## Phase 5 — Guide Mode

Architecture/spec: `docs/planning/phase-5-guide-mode.md`

Execution runbook: `docs/superpowers/plans/2026-08-18-phase-5-guide-mode.md`

- [x] Replace the illustrative `/guide` preview with one supported-program Guide workspace; university-only assessment is out of scope.
- [x] Implement strict browser-memory-only applicant profile/submission contracts with bounded citizenship/current country, qualification, optional GPA/scale, English test, optional budget/currency/scope, scholarship need, and optional public intake/year context.
- [x] Prove applicant profile values never enter `/api/research`, provider/search/retrieval traffic, logs, URLs, Web Storage, IndexedDB, Cache Storage, cookies, service workers, or a database.
- [x] Derive exactly one existing `ResearchModeRequest` from catalog target + optional intake/year + fixed `admissions`, `tuition`, and `scholarships` categories; omit free-form question and all profile data.
- [x] Add a collision-safe one-entry in-memory validated dossier reuse path so profile-only reassessment performs zero provider request; target/intake/year changes and explicit refresh must research again; failed refresh may preserve reusable prior evidence, while a later `unsupported-target` invalidates reuse for that target and requires explicit correction.
- [x] Implement a closed exact Guide requirement-property registry with collision checks; no fuzzy/substr/embedding/LLM matching or generic scalar coercion.
- [x] Implement defense-in-depth evidence/applicability gates: only compatible verified/corroborated/university-reported evidence with eligible sources can drive definitive status; conflict/outdated/inferred/anecdotal/ranking/unknown/incomplete/incompatible/unrecognized evidence fails closed, and conflict + outdated render independently when both apply.
- [x] Add one pure defense-in-depth Guide finalizer that revalidates submission/request/dossier/catalog target+category consistency, rejects failed/mismatched inputs, and maps invariant failures to a sanitized local workspace error without partially derived output.
- [x] Implement all six requirement states: meets, probably meets, does not meet, missing applicant information, unclear requirement, manual confirmation required.
- [x] Implement conservative qualification/subject logic; `probably meets` may represent only narrow application-owned broad-background rules and never formal equivalency.
- [x] Implement same-scale GPA comparison only; no grade/GPA conversion.
- [x] Implement same-test IELTS/TOEFL iBT/PTE threshold logic including component requirements where represented; no cross-test conversion or waiver inference.
- [x] Implement exact currency + annual/total scope budget/tuition comparison only; no FX, duration/living-cost inference, or scope conversion.
- [x] Implement scholarship-need risk/checklist semantics without changing admission status or inventing award probability.
- [x] Capture one local-civil `assessmentDate` per accepted submission without UTC `toISOString()` rollover, then implement strict ISO date-only application/scholarship deadline handling with leap/past/today/30/31-day and profile-only day-rollover tests; ambiguous/rolling/non-ISO dates remain manual.
- [x] Preserve unrecognized published admissions evidence in an evidence-linked manual-review section rather than silently dropping it.
- [x] Generate deterministic risks, checklist, timeline, and official links without inventing documents, contacts, dates, fees, visa claims, or applicant readiness states.
- [x] Scope every factual Guide evidence reference by both target key and dossier-local claim ID.
- [x] Implement immutable submission/result ownership, synchronous single-flight guard, cancellation, preserved prior result, explicit retry/refresh, unmount abort, and stale-response rejection.
- [x] Reuse the existing `ClaimEvidenceSheet`; catalog identity exclusively owns official program/university navigation URLs, while validated dossier sources own exact evidence links. Add a hostile same-ID dossier-canonical-URL regression and do not introduce a second evidence viewer or caller-supplied external URL boundary.
- [x] Add accessible form/result behavior: labels/fieldsets/errors, one live status, complete keyboard flow, focus restoration, reduced-motion meaning, sticky-header focus visibility, and non-color-only states.
- [x] Add Guide responsive/content-stress acceptance at 320x740, 375x812, 390x844, 768x1024, 1024x768, and 1440x900 including long Unicode text, all states, 12 sources, 2,000-character evidence, and high valid claim counts.
- [x] Add security/privacy browser acceptance for request marker leakage, URL/history/storage/cookies/IndexedDB/Cache Storage/service workers, hostile text/XSS, CSP violations, external request guard, and provider/internal exposure.
- [x] Repeat the complete Guide lifecycle/race suite at least five times with zero configured retries.
- [x] Run full Phase 2–5 Vitest, TypeScript, ESLint, production build, production dependency audit, dev/built Playwright, workspace/diff/UTF-8/secret/client-boundary scans, protected screenshot integrity, and a two-stage defect-first review performed inline by the GLM-5.3 Max main agent with zero subagents before marking Phase 5 complete.
- [x] Synchronize requirements/design/security/threat-model/README/CHANGELOG/memory from observed implementation only after verification; keep auth/persistence/RLS/deployment/release automation in Phase 6.

## Phase 6 — Hardening and Submission Readiness

Canonical specification: `docs/planning/phase-6-hardening-submission-readiness.md`.

Phase 6 is split into three dependency-ordered batches because authentication/private persistence, production infrastructure, and publication are separate trust/rollback boundaries. Do not bypass a batch gate. External mutations remain authorization-gated even after local implementation is complete.

### Phase 6A — Identity, Ownership, and Persistence

Execution plan: `docs/superpowers/plans/2026-08-19-phase-6a-identity-persistence.md`.

- [x] Keep Research, Compare, and Guide fully usable without an account; authentication adds optional private save/history behavior rather than an auth wall.
- [x] Implement current Supabase SSR passwordless email/PKCE authentication with assurance-appropriate server identity; compose session refresh into the existing nonce/CSP `proxy.ts` rather than adding a competing middleware/proxy path, and require current Auth-server validation for private saved-artifact operations.
- [x] Keep authentication/session material out of Web Storage and derive every private owner from server-validated identity, never caller-supplied user IDs/emails; do not claim local JWT claim verification alone gives immediate global revocation.
- [x] Extend browser `connect-src` only with the exact validated `NEXT_PUBLIC_SUPABASE_URL` origin required for optional Auth/save (plus the existing development websocket); never add wildcard Supabase, generic `https:`, or Research/search/AI provider browser origins.
- [x] Add reproducible local Supabase imperative migrations generated through the installed CLI for immutable versioned `saved_artifacts`; explicitly control table grants **and** RLS, deny anonymous private-table CRUD, expose no ordinary UPDATE path, and enforce the race-safe 20-artifact owner cap.
- [x] Enforce strict version-1 saved-artifact schemas and byte bounds, server-derived presentation titles, stable descending bounded-list ordering, and fail-closed unknown/tampered snapshots without truncating evidence/results. With only 20 rows per owner, do not add cursor/offset pagination.
- [x] Add same-origin, strict UTF-8/body-bounded, private/no-store saved-artifact APIs using current Auth-server-confirmed identity plus user-scoped Supabase/RLS; treat DB rows as untrusted persisted input, use the exact canonical persistence error vocabulary, do not use the service-role credential, and never blind-auto-retry non-idempotent Save/Delete after ambiguous transport completion.
- [x] Centralize current-catalog ownership of official university/program navigation in one pure Research-dossier binder shared by Research/Compare/Guide; preserve source/evidence URLs and every target-scoped evidence ref, and fail saved restore when the target was removed/reassigned.
- [x] Add explicit save/restore for profiles, Research, Comparison, and Guide through one account-bound **memory-only cross-route restore handoff**; no query/hash/Web Storage/IndexedDB/Cache/service-worker/cookie restore channel. Saved results remain historical snapshots; refresh/re-run/reassess is explicit.
- [x] Preserve all post-Phase-5 audit invariants through round-trip: immutable request/target ownership, unsupported-target correction, previous-result preservation, Guide intake/year/category finalizer binding, closed alias/GPA/currency/context rules, context-rejected evidence visibility, all competing evidence refs, and cancellation re-check after presentation awaits. A restored Guide dossier does not seed current-session `reusableDossier`.
- [x] Verify account switch/local-scope sign-out races, cross-user RLS/grants, own-row tampering rejection, restore/new-run stale races, ambiguous mutation reconciliation, persistence limits, applicant-provider non-transmission, accessibility/responsive behavior, CSP/cache/session coexistence, and anonymous degradation when Supabase is unavailable. Hosted token-refresh/revocation behavior remains a Phase 6C live boundary.
- [x] Develop and verify Phase 6A against the local Supabase CLI stack (`db reset`, lint, DB advisor, pgTAP, local Auth/Mailpit) only; hosted project linking/migration remains Phase 6C.
- [x] Run the complete Phase 0–6A unit/type/lint/build/dev-browser/built-browser/security/privacy/lifecycle matrix, preserve all reviewed pre-6A regressions, and perform a **main-agent-only two-pass final review with zero subagents** before closing 6A. Authenticated built-mode against local HTTP Supabase is intentionally not claimed because production CSP requires an HTTPS Supabase origin; authenticated local-stack evidence is recorded separately.

### Phase 6B — Production Hardening

Execution plan: `docs/superpowers/plans/2026-08-19-phase-6b-production-hardening.md`.

- [x] Re-verify current Vercel/provider platform limits and policies before implementation and again before 6C live smoke. Current 2026-08-19 planning baseline replaces the stale 210s/240s assumption with a 240s application deadline beneath a common 300s Fluid Node baseline; do not guess the actual selected project/plan state.
- [x] Add one server-owned 240,000ms whole-Research execution budget, keep caller abort=`cancelled` distinct from deadline=`timeout`, propagate the composed signal through all existing stages, make Tavily/Brave retry waits abort-aware, stop new retries/fallback work after terminal ownership, and preserve already validated partial evidence.
- [x] Configure Research Node `maxDuration=300` plus Vercel `supportsCancellation:true` for the Research function only; local tests prove signal behavior while actual Vercel disconnect propagation remains Phase 6C live evidence.
- [x] Handle raw deployment/WAF HTTP 429 and platform 504 before application JSON/content-type parsing as sanitized client-local Research/Compare/Guide outcomes, with no body reflection, retry storm, or loss of prior results; stop an active Compare batch on terminal platform rate-limit/timeout rather than amplifying traffic.
- [x] Define and locally exercise the exact durable Vercel WAF contract for only `POST /api/research`: fixed-window source-IP 20 requests/60s, Log-first, shared-NAT risk documented. Do not substitute an in-memory limiter/hidden test mode or claim WAF is active before Phase 6C.
- [x] Migrate Gemini structured calls from the current new-schema `/v1beta/interactions` endpoint to stable `/v1/interactions` while retaining `gemini-3.5-flash-lite` -> `gemini-3.5-flash`, `store:false`, no tools, strict structured output, and public-source-only inputs; freeze Groq/OpenRouter/Tavily/Brave privacy/cost invariants without live calls.
- [x] Add a non-secret release-configuration verifier: production canonical app URL must be an exact non-local HTTPS origin; live Research configuration explicit; optional Supabase Auth either fully valid or absent; no service-role requirement; verifier never prints secret values/fingerprints or becomes an authorization trust source.
- [x] Preserve production nonce CSP/header behavior and **do not add duplicate app-owned HSTS**; current Vercel documentation supplies HSTS and Phase 6C must verify the actual deployed header/TLS/canonical origin. Keep `includeSubDomains`/`preload` out of UniProof policy unless a future explicit domain-wide review authorizes them.
- [x] Add least-privilege GitHub Actions CI: `permissions: contents: read`, no `pull_request_target`, no provider/Vercel/hosted-Supabase secrets or deploy actions, full-SHA-pinned official actions, deterministic local Supabase/Playwright/static gates, and no secret-bearing artifact uploads. Do not claim CI is green until GitHub actually runs the workflow on an authorized pushed commit.
- [x] Create requirement-to-code/test/deployment traceability plus a deterministic release verifier; leave deployment-only requirements unverified until Phase 6C and never inspect/echo `.env.local` or Supabase `.temp` secret values.
- [x] Run full Phase 0–6B dev/built browser, deadline/429/cancel lifecycle repeats, local Supabase, static/build/audit, secret/privacy/client-boundary, protected-artifact, and **main-agent-only two-pass final review with zero subagents** gates. Final development Research/Compare/Guide passed **69/69 + 59/59 + 52/52 = 180/180** on isolated origins, and a fresh built-production Research/Compare/Guide run also passed **180/180**. High-risk repeats passed with retries zero: Guide lifecycle **60/60**, Compare deployment 429/504 plus retry-after-stop **15/15**, and local Auth/Saved **21/21** with a separate fresh **7/7** run. Local Supabase lint/advisors and pgTAP **40/40** passed; Vitest **588/588**, TypeScript, ESLint, production build, release/workspace verifiers, dependency audit, and installation dry-run were green on the final executable tree.

### Pre-Phase 6C — UI and Comparison Weight Cleanup

- [x] Align Guide Intake/Academic year and Budget/Currency/Scope controls while preserving narrow-screen stacking; render qualification levels with title-cased labels while keeping the lowercase contract/persistence values unchanged.
- [x] Move the visible Research categories and Comparison priorities headings inside their card bodies while retaining accessible grouping semantics.
- [x] Replace Comparison numeric weight inputs with five keyboard-accessible native 0–100 sliders and visible raw values; reject only the all-zero vector and positive-weight/category mismatches.
- [x] Normalize Comparison scoring deterministically as `raw_i / sum(raw_weights)`, preserve raw values for UI/version-1 saved snapshots, use normalized evidence coverage for the 50% gate, and keep legacy exact-total-100 snapshots valid.
- [x] Document the exact bounded catalog from `lib/research/catalog/data.ts`: **30 universities, 45 computing programs, 11 country codes**.
- [x] Verify the final affected tree: Vitest **593/593**, TypeScript, ESLint, Windows-native production build, release/workspace verifiers, production dependency audit, and Windows-native `git diff --check` passed. Development Compare **60/60** and Guide **54/54**, built-production Compare **60/60** and Guide **54/54**, three-repeat Compare lifecycle **51/51**, and local Supabase Auth/Saved **21/21** passed with retries zero. The review found and fixed one slider accessibility defect where passive `<output>` elements created five unintended `status` roles. Phase 6C remains unstarted.

### Phase 6C — Deployment and Submission

Execution plan: `docs/superpowers/plans/2026-08-19-phase-6c-deployment-submission.md`.

- [x] Re-check live Devpost rules/schedule/deliverables and mutable hosting/provider assumptions. On 2026-08-20 the event title was `Pixel Forge AI Hackathon ($18,000+ in Prizes)`, submissions remained open, and the deadline remained 2026-08-22 16:00 UTC / 23:00 ICT.
- [x] Prove the exact Vercel/GitHub targets read-only before mutation. The release target is `PracticalSwan/UniProof` `main` and Vercel project `uniproof` under `practicalswans-projects`; no similarly named target was guessed.
- [x] Keep hosted Supabase unlinked/unconfigured for the judge-facing release because production email delivery is not configured. Local Auth/RLS/persistence evidence remains valid, but hosted account/save is intentionally not advertised or partially enabled.
- [x] Configure the exact Vercel project/environment for anonymous live Research: Tavily + Brave discovery, Groq + OpenRouter structured AI, `UNIPROOF_RESEARCH_MODE=live`, canonical app origin, no Gemini key, and no Supabase browser/Auth variables.
- [x] Enable and inspect the single durable `POST /api/research` WAF rule: source-IP fixed window, 20 requests/60 seconds, 429 on excess. No second app-level limiter was added.
- [x] Deploy verified Preview candidates and pass deterministic deployed acceptance. The final hardened executable Preview passed **104/104** Research/Compare/Guide browser cases; security/header/client-bundle checks were also observed without spending live provider quota.
- [x] Promoted the final committed release candidate `21d645baaf9eca381a167246d22538c23bb29427` to Vercel Production after GitHub Actions run `32367630411` completed successfully. Deployment `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN` now serves the canonical `https://uniproof-beta.vercel.app`; deterministic Production route/TLS/HSTS/CSP/header/cache/WAF/client-bundle/log checks passed without another live Research call.
- [x] Consume the authorized live-provider budget without exceeding it: **3/3 accepted Research executions used**. The last returned HTTP 200/schema-valid but operationally incomplete admissions with zero claims, exposing resilience defects that were fixed deterministically. No fourth live call is permitted and no successful-live-evidence smoke claim is made.
- [x] Verify the hosted judge release intentionally has no Auth/save surface because hosted Supabase browser variables are absent; therefore no production auth test records/accounts were created or require cleanup.
- [x] Bound Production to public Git SHA `21d645baaf9eca381a167246d22538c23bb29427`: GitHub Actions run `32367630411` succeeded on that exact SHA, and Vercel deployment metadata for `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN` records both `githubCommitSha` and `releaseSha` as the same value. This later documentation closeout does not change the deployed executable source.
- [x] Prepare release README/architecture/security/operations/traceability updates plus **8 reviewed screenshots** under `docs/assets/screenshots/phase-6/`; protected `ui-flow-screenshots/` remains untouched/untracked.
- [x] Draft `docs/submission/devpost-draft.md`, `demo-script.md`, and `demo-checklist.md` from verified behavior with explicit live-smoke limitations and no hosted-Auth overclaim.
- [ ] **Devpost final submission remains intentionally blocked** until the final approximately three-minute video is supplied, verified, reconciled with the draft, and explicitly authorized. Do not post before then.
- [ ] After the video hold is released and Devpost is actually submitted, verify the submitted project/live links and append final submission evidence without overstating any skipped/unobserved check.

## Side Phase UCE — University Catalog Expansion

Canonical specification: `docs/planning/side-phase-university-catalog-expansion.md`.

One-batch implementation runbook: `docs/superpowers/plans/2026-08-19-side-phase-university-catalog-expansion.md`.

This side phase expands the checked-in supported catalog without changing the Research evidence model, Compare scoring model, Guide applicant/privacy boundary, Phase 6A saved-artifact schema, provider routing, or Phase 6 deployment authorization boundaries. The four agreed university batches are implementation/source-review groupings only; implementation exposes the complete expanded catalog atomically after all source and regression gates pass.

- [x] Re-freeze the live baseline before implementation and preserve every newer Phase 6A/6B fix/current working-tree change rather than resetting to a historical commit.
- [x] Source-freeze all 20 approved Canada/US/EU university identities and every selected computing program from current primary official sources/ROR where applicable; unresolved campus/college/program/canonical-URL ambiguity blocks data edits rather than becoming guessed catalog data.
- [x] Add one browser-safe closed country source for exactly `BE`, `CA`, `DE`, `DK`, `FI`, `GB`, `IT`, `NL`, `SE`, `TH`, `US` and reuse it across catalog schema, public Research dossier, search/form types, and Research/Compare country controls.
- [x] Expand the bounded university schema from max 15 to max 40 while keeping the program max at 60; ship exactly 30 universities via an independent release-manifest test rather than making the schema unbounded/exact-count-only.
- [x] Add all 20 universities and source-frozen applicant-meaningful CS/AI/Data Science-related programs in one deterministic catalog edit; preserve every existing university/program ID and ownership, keep catalog data identity/navigation-only, and keep batch priority out of production ranking/order metadata.
- [x] Reject normalized cross-university canonical-name/alias collisions, omit ambiguous aliases such as bare `UW`, preserve NFKC deterministic search/owner projection, and never add fuzzy/model-assisted target retargeting.
- [x] Regression-prove and narrowly align trusted official-host normalization for leading `www.`/true subdomains without broad registrable-domain trust; preserve all existing Phase 2 authority/corroboration/SSRF boundaries.
- [x] Remove semantic test/fixture dependence on catalog array positions; use explicit stable IDs while retaining the intentional generic catalog ordering tests.
- [x] Prove new Canada/EU/US targets bind through strict Research public/server/client contracts, remain practically discoverable in Research/Compare/Guide, preserve Compare/Guide deterministic semantics, and introduce no applicant/provider or internal-public-data leak.
- [x] Prove Phase 6A saved-artifact version-1 backward compatibility for original targets plus new-country Research/Comparison/Guide targets; add no migration/version bump/auto-refresh/re-score/reassess path for additive catalog rows.
- [x] Run the complete current focused/full Vitest, type, lint, build, audit, dev/built Playwright, repeated lifecycle, local persistence/Auth where applicable, security/privacy, secret/client-boundary, generated-residue, protected-screenshot, workspace/diff, and all landed Phase 6B verification gates.
- [x] Perform a two-pass defect-first source/spec then code/security/privacy review, fix verified findings regression-first, and synchronize README/requirements/design/data-sources/security/threat-model/tasks/changelog/memory only from observed final behavior and counts.
- [x] Repository publication completed under the owner's explicit 2026-08-20 authorization: the reviewed Phase 6B + UCE candidate was pushed as `11b4c4e`, the first clean-checkout CI run exposed one screenshot-presence test defect, and the regression fix was pushed as `b0cb34d`; GitHub Actions run `32326520878` then completed green for both application and local-Supabase jobs. Hosted Supabase/Vercel/WAF/Devpost mutation, deployment, and live Research provider smoke remain outside this side phase and deferred to Phase 6C.

## Scope Control

Defer until P0 is stable: arbitrary/global university coverage beyond the checked-in supported catalog, document uploads, automatic application submission, admission-probability prediction, complex multi-agent production orchestration, multilingual UI, browser extensions, and counselor collaboration.
