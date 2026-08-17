# AGENT_MEMORY.md — UniProof

Cross-agent session handoff log. Read this after `LESSONS.md` at session start, then verify mutable facts against the live workspace.

This file is append-only. Never rewrite or delete earlier entries to correct history; append a dated correction instead.

## Entry Format

### YYYY-MM-DD — agent / model

**Summary:** One-line description of the session outcome.

- Changed: files, behavior, configuration, or structure changed.
- Decided: material decisions and why they were selected.
- Verified: commands, tests, rendered checks, or external facts actually verified.
- Deferred: known work intentionally left for later.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol

**Summary:** Initialized UniProof repository governance and agentic workflow foundation for the Pixel Forge AI Hackathon.

- Changed: Created project instruction, memory, planning, security, source-policy, and repository-hygiene files under `D:\Side Projects\UniProof`.
- Decided: Reuse global Codex agents/skills by reference instead of copying them locally; keep `LESSONS.md` process-only and `AGENT_MEMORY.md` append-only for session handoffs.
- Verified: Pixel Forge submission phase, rules, judging criteria, and deliverables were re-checked through Devpost on 2026-08-16 before project setup.
- Deferred: Application scaffold, dependencies, Git initialization, remote repository, deployment, and Devpost submission are not part of this setup task.

## 2026-08-16 — Verification addendum

**Summary:** Completed repository-foundation verification after final documentation formatting fixes.

- Verified: `scripts/verify-workspace.ps1` passed with all 20 required files present and Git intentionally not initialized.
- Verified: Markdown heading-spacing scan passed across all project Markdown files.
- Deferred: No application dependencies, Git repository, remote, deployment, or external submission were created in this task.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol

**Summary:** Completed Phase 1A Next.js application scaffold without initializing Git or starting the research/AI pipeline.

- Changed: Added the Next.js App Router application, shared layout shells, `/`, `/research`, `/compare`, and `/guide`, plus TypeScript, ESLint, Tailwind/PostCSS, npm package metadata, and lockfile.
- Decided: Used the manual official Next.js installation path because the existing non-empty project root contains governance files that must not be overwritten; used npm with Next.js 16.3.1, React 19.2.8, and the create-next-app-supported TypeScript 5.x line.
- Verified: Node.js v22.19.0 and npm 10.9.3; TypeScript check passed; ESLint passed; `next build` passed and prerendered all four requested routes; a live `next dev` server returned HTTP 200 for all four routes; `npm audit --omit=dev` reported 0 vulnerabilities; `scripts/verify-workspace.ps1` passed; Git remained uninitialized; the temporary dev server was stopped and port 3000 was free.
- Deferred: shadcn/ui, Supabase, Zod domain schemas, database/RLS, seed data, Vitest/Playwright, evidence/research pipeline, Git initialization, remote repository, deployment, and publication.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol

**Summary:** Completed Phase 1B application foundation and created the UniProof product UI design in the connected Figma account.

- Changed: Initialized shadcn/ui with the Radix Nova preset; added Button, Card, Badge, Input, Select, Tabs, Separator, Skeleton, and Tooltip primitives; added Figma-derived application tokens, responsive Home/Research/Compare/Guide foundations, all eight evidence-status badge styles, Zod environment/domain schemas, and Supabase browser/server client boundaries.
- Changed: Created Figma file `UniProof — Product UI / Phase 1B` (`AH20TP7s4p13wE1WJj49gX`) with design-system, Home, Research, Compare, and Guide pages; updated `.env.example`, `README.md`, and Phase 1 task status to match the implemented foundation.
- Decided: Keep Supabase configuration lazy so UI-only builds do not require credentials; defer auth refresh proxy, persistence, database migrations/RLS, deterministic seed data, extended ResearchRun/ApplicantProfile/Comparison/ApplicationPlan contracts, and all live AI/research-provider work to later phases.
- Verified: `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed; all four routes prerendered; a live Next.js dev server returned HTTP 200 while desktop Home/Research/Compare/Guide and a narrow layout were rendered and visually inspected in headless Edge; workspace verification passed; production dependency audit reported 0 vulnerabilities; Git remained uninitialized; port 3000 was freed after testing.
- Deferred: CodexPro was requested for implementation but its plugin was not exposed as an invokable tool in this session, so no CodexPro execution was claimed.
## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 1B visual completion update

**Summary:** Reconciled the existing Phase 1B scaffold with the user-approved revised Figma art direction and completed fresh implementation/runtime verification.

- Changed: Replaced the earlier green-heavy UI tokens with the approved editorial research palette (`#F6F4EF` canvas, `#171B1E` ink, `#213B57` primary, `#365D6D` link/accent); updated all eight reusable evidence-state styles; rebuilt Home, Research, Compare, and Guide shells to use the revised low-radius, rule/row-oriented Figma layouts; added active navigation state and a UTF-8-safe app icon.
- Changed: Kept all displayed university/program/profile content explicitly illustrative, updated the Phase 1 task checklist, added `.playwright-cli/` to ignored test artifacts, and recorded the SVG encoding lesson in `LESSONS.md`.
- Decided: Retain the already-installed minimal shadcn foundation and the existing Zod/Supabase/domain boundaries because they match current Phase 1B scope; keep auth refresh proxy, persistence/RLS, seed data, live retrieval, AI extraction, comparison logic, and Guide logic deferred.
- Verified: Current official Supabase guidance still uses `@supabase/ssr`, separate browser/server clients, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; current shadcn guidance supports Tailwind 4/React 19 and `@theme` tokens. Fresh `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit`, and workspace verification passed; production build prerendered `/`, `/research`, `/compare`, `/guide`, and `/icon.svg`.
- Verified: A live Next.js dev server returned HTTP 200 for all four routes. Playwright rendered and visually checked all four desktop routes against the revised Figma frames plus all four at 390px mobile width; Guide mobile had no horizontal overflow; keyboard tab order reached the header links/actions logically with a visible focus ring; browser console showed 0 errors and 0 warnings after the favicon fix.
- Verified: Git remains uninitialized. No real secrets, live research calls, database persistence, deployment, publication, or Git operations were introduced.
- Deferred: CodexPro was requested but its exact plugin URI and plugin discovery exposed no invokable connector in this session, so no CodexPro execution is claimed.

## 2026-08-16 — Phase 1B cleanup addendum

- Verified: Closed the Playwright browser session and stopped the temporary Next.js dev server after QA; port 3000 was confirmed free.
- Verified: Final workspace verification still passed and Git remained uninitialized after documentation/memory updates.


## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2 planning

**Summary:** Replaced the planned OpenAI integration with a free-tier-aware Gemini architecture and added the complete Phase 2 evidence/research implementation plan.

- Changed: Added `docs/planning/phase-2-evidence-research-pipeline.md`; expanded the Phase 2 checklist in `docs/planning/tasks.md`; updated `docs/design.md`, `README.md`, `docs/security.md`, and root `SECURITY.md` to make Gemini the AI provider.
- Decided: Use `gemini-3.5-flash-lite` as the primary high-volume structured extraction model and `gemini-3.6-flash` only as a bounded escalation model. Use the Gemini Interactions API with `store: false`; keep Tavily/direct retrieval separate because Gemini 3.x Google Search grounding is unavailable on the free tier.
- Decided: Do not hard-code free-tier RPM/TPM/RPD values because current Google documentation makes active AI Studio project limits the operational source of truth. Design around bounded concurrency, per-run call budgets, 429 backoff, and partial results.
- Security: While using unpaid Gemini quota, send public university/research source content only; do not send applicant profiles or sensitive/personal documents to Gemini.
- Deferred: No Gemini SDK dependency, API calls, research contracts, retrieval code, Git operations, deployment, or persistence were implemented in this planning task. Phase 2A is the next implementation milestone.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2A safety boundary

**Summary:** Implemented the Phase 2A research contracts and outbound safety boundary for the Pixel Forge build.

- Changed: Added Zod-first research contracts under `lib/research/contracts/`, centralized server-owned limits under `lib/security/research-limits.ts`, resolver-injected SSRF/DNS/IP/redirect primitives under `lib/security/outbound-url.ts`, and deterministic Vitest coverage under `tests/phase2a.test.ts`.
- Changed: Replaced active `OPENAI_API_KEY` configuration with optional server-only `GEMINI_API_KEY`, added Vitest, updated the MIT attribution to Sithu Win San, and documented Phase 2A plus its deferred transport/provider work.
- Decided: Resolution-time DNS validation returns addresses for a future pinned transport; it does not claim that a later ordinary `fetch(url)` is protected from DNS rebinding. Phase 2C must pin or revalidate the connection lookup.
- Verified: `npm.cmd test` (14 tests), `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit` (0 vulnerabilities), and `scripts/verify-workspace.ps1` passed on 2026-08-16. No live Gemini, Tavily, DNS, or university retrieval call was added.
- Deferred: Live discovery/retrieval transport, Gemini integration, extraction/reconciliation, persistence/RLS, deployment, and Devpost submission remain out of scope for Phase 2A.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — GitHub setup

**Summary:** Initialized and published the authorized public GitHub repository required for Pixel Forge open-source judging.

- Changed: Initialized Git on `main`, created the public `PracticalSwan/UniProof` repository, configured `origin`, and pushed commit `375cb6adf45d5125fdfe504dfe4ab9fead6eec98`.
- Verified: GitHub reports `isPrivate: false`, default branch `main`, detected `MIT License`, and the remote tree is clean/tracking `origin/main`.
- Decided: Keep Devpost project creation/submission, hosted deployment, and demo-video publication separate until explicitly requested and those deliverables are ready.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — deletion and cleanup governance

**Summary:** Added project-wide deletion, cleanup, and destructive-operation rules, including narrow standing authorization for disposable test residue.

- Changed: Added the canonical deletion/cleanup workflow to `AGENTS.md` and added sensitive-residue protections to `docs/security.md` and root `SECURITY.md`.
- Decided: Task-local disposable test residue inside the UniProof workspace should be removed after its purpose is complete unless it has regression, debugging, reproducibility, acceptance-evidence, or future-session value. Broader cleanup requires exact-target inspection and evidence; protected or irreversible targets require explicit exact-scope authorization.
- Decided: Preserve regression fixtures, historical decisions, append-only memory, canonical plans/migrations/datasets, and meaningful test evidence; never remove tests merely to make failures disappear, and never treat destructive Git/database cleanup as ordinary residue removal.
- Verified: `scripts/verify-workspace.ps1` passed after the governance/security updates and reported the Git repository as initialized.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2A independent review and hardening

**Summary:** Reviewed the completed Phase 2A safety/contracts implementation, fixed verified SSRF and contract-bound defects, synchronized documentation, and prepared the authorized commit/push.

- Changed: Hardened IPv6 classification to fail closed outside the current IANA `2000::/3` global-unicast allocation while blocking special-purpose ranges; fixed the deprecated `2001:10::/28` coverage via the broader IETF protocol-assignment boundary; blocked returned `3ffe::/16`; and retained IPv4-mapped IPv6 classification through the IPv4 policy.
- Changed: DNS resolver normalization now rejects invalid or mismatched family metadata instead of coercing unexpected values, and DNS validation failures no longer expose raw resolver error strings.
- Changed: `ResearchResult` source/document arrays and verified-claim source/document references now derive their maximum from `RESEARCH_MAX_SOURCES_PER_RUN` instead of duplicated larger/hard-coded bounds.
- Verified: The focused `tests/phase2a.test.ts` regression suite passed 15/15 after the fixes; full repository verification is recorded in the final task result after all checks complete.

## 2026-08-16 — Phase 2A review verification addendum

- Verified: `npm test` passed 15/15 tests; the exact `tests/phase2a.test.ts` regression path also passed 15/15 after the final code edit.
- Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit` (0 vulnerabilities), `scripts/verify-workspace.ps1`, and `git diff --check` all passed.
- Verified: A fresh `git fetch origin main` confirmed local `HEAD` and `origin/main` were both `a861728bd890143a101b3f1140e6af5939bc60a4` before the authorized review commit.
- Verified: Only `.env.example` exists at the repository root; no active `OPENAI_API_KEY` or `NEXT_PUBLIC_GEMINI_*` configuration was found in active code/config. UI behavior was unchanged, so browser QA was not required for this review.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2A follow-up review

**Summary:** Continued the Phase 2A re-review without CodexPro at the user's direction, proved additional contract/error-sanitization defects with regressions, fixed them narrowly, and re-verified the repository.

- Changed: Research requests reject mixed structured/legacy targeting and contradictory structured university/program IDs. Research claims are restricted to supported Phase 2 categories; verified-claim document IDs are unique and optional `sourceId` must belong to `sourceIds`.
- Changed: `ResearchRun` now rejects contradictory partial/succeeded state and processed/unprocessed category overlap. Research-document content types are constrained by the centralized MIME allowlist.
- Changed: `ResearchResult` validates unique IDs and source/document/candidate/claim provenance, and its evidence summary must match actual claim totals and evidence-status counts. Evidence summaries also reject duplicate category coverage and processed/unprocessed overlap.
- Changed: Outbound validation failure metadata now removes HTTP(S) paths, queries, fragments, and credentials and does not echo opaque-scheme payloads. Planning/security documentation was synchronized with that behavior and with the Phase 2C transport boundary.
- Decided: Retain the intentionally conservative `2001::/23` IPv6 exclusion. Current IANA globally reachable special-purpose service prefixes were reviewed but were not newly blocked merely because they appear in the special-purpose registries.
- Verified: `npm test` and focused `tests/phase2a.test.ts` each passed 22/22; `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit` (0 vulnerabilities), `scripts/verify-workspace.ps1`, and `git diff --check` passed after the code/documentation changes.
- Verified: Root environment-file inspection found only `.env.example`; tracked secret-pattern scanning found only historical documentation mentions of old configuration names, and no non-empty server credential assignments or key/private-key patterns were found.
- Deferred: Phase 2C still must pin validated addresses or revalidate transport DNS and implement/test actual HTTP connect/request timeouts, streamed byte limits, response MIME enforcement, and redirect following. `completed` versus `succeeded` lifecycle naming and stricter timestamp/failure-state semantics remain for orchestration design rather than being guessed in Phase 2A.
- Tooling note: This continuation intentionally did not use CodexPro. A separate fresh CodexPro re-review is requested next and must not silently fall back if CodexPro is not functioning as intended.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Full CodexPro Phase 2A re-review

**Summary:** Performed the requested fresh CodexPro-led Phase 2A falsification review from `d90a7aec528f17be7ea48ae5927d0b7a05256c4c`, found additional contract-boundary defects, regression-proved them, and tightened the implementation without entering Phase 2B/2C transport scope.

- Tooling: CodexPro was verified healthy against `D:\Side Projects\UniProof`. Its command surface uses the WSL-mounted path, and the user explicitly authorized continuing in that environment for this review after the initial environment-mismatch stop.
- Changed: Tightened research-specific request, candidate-source, source, document, claim-candidate, verified-claim, evidence-summary, and result contracts so permissive Phase 1 schema behavior cannot silently bypass the narrower Phase 2A trust boundary. Added canonical HTTP(S) document URL/hash identity, IDN-aware candidate domain consistency, bounded normalized section text, stricter claim/reference payloads, and stronger result/evidence-summary cross-record invariants.
- Changed: Centralized the normalized-text, extraction-call, and claim-count ceilings in `lib/security/research-limits.ts`; added `tests/phase2a-codexpro-review.test.ts` as retained deterministic regression coverage; synchronized the active Phase 2 plan.
- Security: Fresh IANA review confirmed the current `2000::/3` global-unicast allocation model and the mixed semantics inside `2001::/23`. The conservative `2001::/23` exclusion remains intentional; globally reachable special-purpose ranges are not blanket-blocked merely because they are registry entries. Alternate loopback literals, mapped/zone-scoped IPv6, unsafe redirects, globally reachable sanity ranges, and the conservative IANA exceptions were regression-checked.
- Verified before final repository-wide verification: original Phase 2A tests plus the new CodexPro regressions passed 39/39; `npx tsc --noEmit` passed; direct `npx eslint .` passed. The npm lint wrapper returned exit code 1 without ESLint diagnostics in the CodexPro WSL command surface, so direct ESLint was used to distinguish an invocation quirk from a lint defect.
- Deferred: Phase 2C must still pin validated DNS addresses or revalidate the transport lookup and implement/test actual HTTP connect/request timeouts, streamed byte limits, response MIME enforcement, and redirect following. Lifecycle semantics such as `completed` versus `succeeded`, timestamp ordering, failure-state combinations, and exact `hasEvidence` semantics remain intentionally unguessed until orchestration defines them.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2 fallback and AI-reconciliation plan update

**Summary:** Revised the remaining Phase 2 architecture to remove single-provider failure domains and make AI semantic reasoning central while preserving deterministic evidence guarantees.

- Changed: Phase 2B now specifies sequential discovery fallback `Tavily -> Brave Search -> direct/structured providers -> partial ResearchResult`; Brave is an independent-index discovery fallback, not evidence authority.
- Changed: Phase 2D now uses a provider-neutral free inference chain: Gemini (`gemini-3.5-flash-lite`, bounded `gemini-3.6-flash` quality escalation) -> Groq Free `openai/gpt-oss-120b` -> OpenRouter `openrouter/free`; the concrete OpenRouter-selected model must be recorded in provenance and no paid inference may be selected automatically.
- Changed: Phase 2E is now AI-assisted reconciliation with deterministic evidence gates: exact normalization is deterministic, AI resolves semantic relationships/scopes/conflicts, application policy assigns/limits final evidence states, and AI may produce evidence-bounded explanations.
- Decided: Phase 2B/2D implementation must provide a repository-owned cross-platform provider setup command so the user only supplies API keys; environment files, schemas, endpoints, fallback order, models, budgets, and safe defaults are handled by the implementor without echoing secrets.
- Security: Free-provider discovery/inference receives public research context only. Sequential failover is bounded, privacy requirements fail closed, and provider exhaustion preserves validated work as an explicit partial result.
- Verified: Provider choices were re-checked against current official Brave Search API, Gemini, Groq, OpenRouter, and Tavily documentation on 2026-08-16 before updating the plan.
- Deferred: No provider SDK/adapter, setup script, environment-schema change, live API call, or Phase 2B–2E runtime implementation was performed in this documentation task.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2 implementation-grade planning review

**Summary:** Reconciled the remaining Phase 2 architecture into implementation-grade runbooks and selected Phase 2B + Phase 2C as the next implementation batch.

- Changed: Added dedicated Phase 2B–2C and Phase 2D–2F execution runbooks with exact module ownership, trust boundaries, sequential fallback behavior, contract-evolution rules, setup UX, deterministic test matrices, lifecycle semantics, and completion gates; expanded the canonical task checklist to match.
- Changed: Clarified that provider models emit narrow untrusted payloads rather than trusted ClaimCandidate/evidence state, Phase 2C must use DNS-pinned transport rather than validation followed by ordinary fetch, unsupported PDF normalization is explicit, and persistence remains optional/deferred after an in-memory validated ResearchResult.
- Changed: Specialized evidence policy so authority is claim/scope/period-specific, independent corroboration excludes mirrors/shared underlying sources, operational unprocessed/failed state is distinct from processed unknown evidence, and terminal Phase 2F lifecycle/hasEvidence semantics are explicit.
- Decided: Implement Phase 2B + Phase 2C together next because discovery is not acceptance-complete until candidates pass the actual safe retrieval/normalization boundary; implement Phase 2D, Phase 2E, and Phase 2F as separate later batches for diagnosable failure domains.
- Verified: Current provider assumptions were re-checked against official Tavily, Brave Search, Gemini, Groq, and OpenRouter documentation on 2026-08-16. `npm test` passed 39/39; `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit --omit=dev` (0 vulnerabilities), workspace verification, UTF-8 replacement scan, secret-pattern scan, targeted contradiction search, and `git diff --check` passed.
- Tooling: CodexPro opened/read the correct workspace initially, then became unreliable with connection failures and a later connector `404`; Windows-native Remote Desktop Commander evidence was used for final inspection and verification rather than assuming failed CodexPro calls changed repository state.
- Deferred: No Phase 2B–2F runtime code, provider dependency, live provider call, environment-schema/provider-key change, persistence, deployment, or paid-provider action was introduced by this planning review.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — CodexPro Phase 2 planning re-review

**Summary:** Independently falsified the Phase 2 implementation runbooks with CodexPro, fixed remaining small-model ambiguities and provider/security inconsistencies, and kept runtime implementation deferred.

- Changed: Added first-class planned `program-structure` research coverage, explicit request-target identity resolution/ROR disambiguation, ordered provider-attempt semantics, deterministic discovery-satisfaction rules, current keyed-OpenAlex optionality, and tighter DNS-pinned transport/redirect/header requirements for Phase 2B–2C.
- Changed: Defined evidence absence as a processed zero-claim `EvidenceSummary` unknown state rather than a fabricated sentinel-valued claim; repaired fused Phase 2 checklist items and a control-character corruption in the PDF planning text.
- Decided: Phase 2B + Phase 2C remain the next implementation batch; OpenAlex is not a required Phase 2B–2C operator key, and discovery coverage must not be confused with processed/evidence coverage.
- Deferred: No Phase 2B/2C runtime implementation, provider call, persistence, deployment, commit, or push was performed in this review.
- Verified: Canonical Windows `npm.cmd test` passed 39/39 and `npm.cmd run build` passed; direct CodexPro Vitest, TypeScript, ESLint, production build, and production dependency audit passed; workspace verification and `git diff --check` passed; changed Markdown contains no control/replacement characters or fused checklist markers.

## 2026-08-16 - ChatGPT / GPT-5.6 Sol - Phase 2 planning review continuation addendum

**Summary:** Finalized the interrupted Phase 2 planning falsification pass, closed additional small-model identity/provider/transport ambiguities, and kept Phase 2B-2C runtime implementation deferred.

- Changed: Explicitly specified subject-area-only and program-name-only target behavior, project-owned bounded identity-resolution outcomes, application-ID cross-checks, and ROR v2 automatic matching via a compatible active `chosen:true` result rather than first-result/score selection.
- Changed: Defined optional `OPENALEX_API_KEY` handling without adding a Phase 2B-2C setup prompt, pinned Tavily Search authentication/basic-depth behavior, Brave header/query constraints, isolated Phase 2C sockets with `agent: false`, and an offline socket-pinning test strategy that does not introduce a runtime private-network bypass.
- Changed: Reconciled Phase 2D-2F with all seven research categories and current Gemini/Groq/OpenRouter structured-output/privacy semantics; synchronized the architecture/security docs and restored program-structure coverage in the Phase 3 task list.
- Verified: Windows `npm.cmd test` passed 39/39, `npm.cmd run lint` passed, and `npm.cmd run build` passed. CodexPro direct Vitest passed 39/39, `npx tsc --noEmit`, direct ESLint, direct Next.js production build, and `npm audit --omit=dev` passed with 0 vulnerabilities. Workspace verification, `git diff --check`, tracked-file secret-pattern scan, and changed-Markdown control/replacement/mojibake/fused-checklist scans passed.
- Tooling: CodexPro ordinary repository reads/searches/status/direct verification remained reliable. Its npm-script wrapper intermittently returned exit code 1 with only the script banner for test/lint/build, while equivalent direct CodexPro commands and canonical Windows npm commands passed; this was treated as a wrapper/reporting anomaly, not a CodexPro connector failure.
- Deferred: No Phase 2B/2C runtime code, live provider request, dependency or environment-schema change, persistence, deployment, commit, or push was performed.
- Changed: Clarified HTTPS SNI behavior so DNS-host requests preserve the original hostname for SNI/certificate identity while IP-literal requests send no IP SNI and never disable certificate verification.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2B–2C implementation closure

**Summary:** Implemented and verified the authorized Phase 2B discovery plus Phase 2C retrieval/normalization batch, removed OpenAlex from active UniProof architecture, and preserved the deferred API-key boundary.

- Changed: Added project-owned target resolution, seven-category deterministic query planning, bounded Tavily -> Brave -> direct/ROR sequential discovery, ordered provider-attempt telemetry, provider exception/timeout budgets, known-ROR identity cross-checking, candidate deduplication/source budgets, and a deterministic private-data guard that never sends detected applicant values or sensitive document references to search providers.
- Changed: Added server-only Tavily, Brave, and ROR adapters with bounded response parsing, safe retry handling, no raw payload/snippet promotion, no credential-bearing telemetry, and noninteractive `npm run setup:providers` behavior. Setup validates already-present values only; no API-key prompt or connectivity check was requested in this batch.
- Changed: Added DNS-pinned Node HTTP(S) retrieval with per-hop redirect validation, public-address pinning, isolated connections, SNI/certificate safeguards, timeout/byte/MIME/encoding bounds, allowlisted response headers, parse5-based HTML normalization, plain-text normalization, PDF explicit unsupported-normalizer behavior, provenance-preserving Source/ResearchDocument promotion, and normalized-content SHA-256 deduplication.
- Changed: Removed OpenAlex from active provider contracts, adapters, environment/setup docs, source policy, architecture docs, runbooks, and task planning. Historical OpenAlex references in this append-only memory remain intact as provenance and are not active runtime configuration.
- Changed: Preserved the user-requested context references to CodexPro Full 2.0 and Remote Desktop Commander; no external ChatGPT usage connector or API-key input was needed to complete this local batch.
- Verified: `npm.cmd test -- --run` passed 63/63; `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build` passed; `npm.cmd audit --omit=dev` reported 0 vulnerabilities; `scripts/verify-workspace.ps1` passed; `git diff --check` passed with only expected Windows LF-to-CRLF warnings; targeted secret-pattern scanning found no non-empty provider/server-key assignments or public credential assignments; active OpenAlex scanning found no references outside append-only `AGENT_MEMORY.md`.
- Verified: `npm.cmd run setup:providers` reported Tavily and Brave as not configured, ran no connectivity checks, and requested no API-key prompt. No live provider request, persistence, deployment, commit, or push was performed.
- Deferred: Phase 2D–2F AI extraction/reconciliation/orchestration, provider-key entry, persistence/RLS, UI wiring, live provider smoke tests, deployment, and publication remain later authorized phases.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Interactive discovery-key setup

**Summary:** Completed the deferred interactive entry path for Tavily and Brave discovery keys without exposing values in chat, logs, or project memory.

- Changed: `scripts/setup-providers.mjs` now prompts only when stdin and stdout are interactive TTYs, reads printable key characters with terminal echo disabled, restores terminal state during cleanup, preserves an existing managed value when a blank line is submitted, and never prints key values. `--non-interactive` and `UNIPROOF_NON_INTERACTIVE=1` retain the no-prompt behavior.
- Changed: The interactive prompt now prints one neutral `*` mask character per accepted printable keystroke and erases it on backspace, so terminal input is visibly active without revealing the key.
- Verified: A PTY run accepted blank input for both prompts and completed without writing credentials; `npm.cmd run setup:providers -- --non-interactive` and `node --check scripts/setup-providers.mjs` passed. No real key value was entered or stored during verification.
- Verified: A separate PTY run accepted synthetic test values, displayed only mask characters, reported both providers as configured, and the temporary `.env.local` was removed immediately afterward. No real credential was used.
- Verified: After the setup change, the full relevant gate remained green: `npm.cmd test -- --run` passed 63/63, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --omit=dev`, workspace verification, `git diff --check`, the active OpenAlex scan, and the targeted secret-assignment scan all passed.
- Decided: This setup command configures only `TAVILY_API_KEY` and `BRAVE_SEARCH_API_KEY`; Gemini, Groq, and OpenRouter entry remains deferred to Phase 2D, and OpenAlex remains removed from active configuration.
- Tooling: CodexPro Full 2.0 and Remote Desktop Commander remain the project context references; no external ChatGPT usage connector or API-key input was needed for this local setup change.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Configured discovery-key review

**Summary:** Reviewed the completed Tavily and Brave key entry without exposing credential values and confirmed the configured environment is safe for local use.

- Verified: `.env.local` contains only the two intended server-side discovery keys, both nonempty and free of control or surrounding-whitespace characters; the file remains ignored by Git. Noninteractive setup reports both providers as configured.
- Verified: The configured key values were not found outside `.env.local`, including source files and the generated `.next` output. `npm.cmd test -- --run` passed 63/63; TypeScript, lint, production build, audit (0 vulnerabilities), workspace verification, diff check, and the active OpenAlex scan passed.
- Decided: No live Tavily or Brave request was made because provider smoke tests consume external quota and were not explicitly authorized; actual credential validity and provider quota remain unverified until that separate check is requested.
- Deferred: `UNIPROOF_RESEARCH_MODE` remains at the safe default `seed`, and AI-provider key entry/orchestration remains deferred to Phase 2D.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2B–2C post-implementation review

**Summary:** Independently reviewed the completed Phase 2B–2C implementation, fixed identity/discovery/provenance and ROR adapter defects, expanded the security regression matrix, and reconciled the Phase 2 documentation before the authorized Git publication.

- Fixed: Made application-owned university identity comparison Unicode-safe and failed closed when a resolved program's parent university cannot be cross-checked against a supplied university name.
- Fixed: Preserved per-query discovery coverage across canonical-URL deduplication, reused a confidently resolved ROR identity for later direct fallback, enabled the documented built-in ROR degraded fallback by default, and preferred stronger trusted provenance when duplicate canonical URLs disagree on source type.
- Fixed: Updated ROR v2.1 handling to use the `ror_display` name and `website` link type rather than array order, reject conflicting Unicode identity, preserve returned country context, and classify ROR timeout/rate-limit outcomes through the shared bounded attempt vocabulary.
- Fixed: Included discovery-uncovered categories in `EvidenceSummary.categoriesFailed` while keeping all categories operationally unprocessed until later evidence-policy phases.
- Tested: Added regressions for the above defects plus streamed response-byte cutoff, stalled-body timeout, private redirect revalidation, response-header allowlisting, and origin-only sanitized retrieval failures. The full suite passed 76/76.
- Verified: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --omit=dev` (0 vulnerabilities), workspace verification, and `git diff --check` passed. Changed-file encoding/control scans and publication-set secret-prefix/nonempty-credential-assignment scans passed; `.env.local` remains ignored and outside the publication set.
- Deferred: No live Tavily, Brave, ROR, or arbitrary public-site smoke request was made during this review. Phase 2D–2F AI extraction/reconciliation/orchestration, persistence/RLS, and UI wiring remain deferred.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Playwright UI QA and one-pass live discovery

**Summary:** Installed Playwright for local browser QA, exercised the rendered home/research workflow on desktop and mobile, fixed two reproducible Research-page UI defects, and used the actual server pipeline for one explicitly authorized live discovery/retrieval pass.

- Changed: Added `playwright@^1.62.1` as a development dependency. The Research preview now lists all seven categories including Program structure, uses a real disabled Research button, and explains that live research is not yet connected to the preview UI.
- Verified: Playwright navigated Home -> Research at 1440px and 390px widths, accepted query text, confirmed the Research action remains disabled by design, and finished with no console warnings/errors after disabling Playwright's screenshot caret-hiding artifact. No clipping or horizontal-overflow defect was observed.
- Live check: Exactly one routable QA invocation of `runDiscoveryRetrieval()` was made with one admissions question. Tavily succeeded on the first provider attempt; the pipeline produced 4 candidates, 4 retrieved sources, and 4 normalized documents with no failure codes. The run remained `partial` as expected because Phase 2D claim extraction/reconciliation is not implemented. No second provider pass was sent.
- Cleanup: The temporary server-only QA route, temporary browser scripts, generated `next-env.d.ts` dev change, and stale dev server were handled as disposable task-local residue; no QA route remains in the app.
- Verified: `npm.cmd test -- --run` passed 76/76; TypeScript, lint, production build, audit (0 vulnerabilities), workspace verification, and `git diff --check` passed.
- Deferred: Research UI-to-pipeline wiring remains a later phase; the current page is intentionally an illustrative preview rather than a live result surface.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2D implementation-plan closure

**Summary:** Reconciled the live Phase 2A–2C contracts and current provider documentation into a Phase 2D-only implementation runbook, preserving unrelated UI/Playwright work and keeping Phase 2E/2F runtime behavior deferred.

- Changed: Corrected Gemini planning to the explicit `gemini-3.5-flash-lite` -> bounded `gemini-3.5-flash` quality path, fixed the current Interactions REST/structured-output shape, and removed the stale claim that `gemini-3.6-flash` is paid-only; 3.6 remains outside the Phase 2D allowlist by product policy, not pricing assumption.
- Changed: Tightened the portable extraction contract, non-transforming exact-quote provenance checks, mixed-valid/invalid response handling, deterministic segmentation/provenance-preserving dedupe, pre/in-flight abort semantics, and the distinction between the 24 actual-AI-attempt operational budget and the existing 100-call schema ceiling.
- Changed: Reconciled setup/privacy/telemetry requirements, removed stale campus-field and SDK/token-metadata assumptions, and kept OpenAlex explicitly inactive. Phase 2E name-only identity/evidence semantics and Phase 2F lifecycle/attempt-ceiling work remain separate later batches.
- Verified: Windows `npm.cmd test -- --run` passed 76/76; `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --omit=dev` (0 vulnerabilities), workspace verification, `git diff --check`, strict changed-file UTF-8/control scanning, tracked-file secret scanning, and targeted contradiction scanning passed. `git diff --check` emitted only expected LF-to-CRLF working-copy warnings.
- Tooling: CodexPro Full 2.0 and Remote Desktop Commander were both used against `D:\Side Projects\UniProof`; one transient CodexPro network read failure succeeded on retry, and RDC provided the independent Windows-side status/edit/verification path.
- Deferred: No Phase 2D runtime code, live AI-provider request, provider-key entry, persistence/RLS, UI wiring, deployment, commit, or push was performed by this planning review.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2D extraction implementation

**Summary:** Implemented the Phase 2D-only provider-neutral structured extraction boundary while preserving the dirty UI/Playwright work and leaving Phase 2E/2F runtime behavior deferred.

- Changed: Added deterministic code-point segmentation with bounded same-section overlap, one strict portable extraction schema, exact non-transforming supporting-text promotion, typed overlap dedupe, bounded `ClaimCandidate.intake`, and safe provider-model provenance.
- Changed: Added server-only native REST adapters for Gemini (`gemini-3.5-flash-lite` plus one `gemini-3.5-flash` quality escalation), Groq `openai/gpt-oss-120b`, and OpenRouter `openrouter/free`, with current Gemini `/v1beta/interactions` handling, strict structured output, concrete OpenRouter model enforcement, sequential fallback, bounded retries, cancellation, response limits, and a distinct 24-actual-HTTP-attempt budget.
- Changed: Extended the existing provider setup command to exactly Tavily/Brave/Gemini/Groq/OpenRouter while preserving unmanaged `.env.local` content, newline style, terminal restoration, server-only keys, seed mode, and no-connectivity defaults.
- Tested: Added deterministic Phase 2D regressions for schema closure/scalars/categories, exact quote mutations and mixed validity, segmentation/dedupe, prompt privacy, adapter request shapes, model provenance, failure mapping, Retry-After, bounded malformed bodies, cancellation, quality/fallback behavior, budget exhaustion, setup behavior, and contract additions.
- Verified so far: Focused Phase 2D tests pass (18/18), the complete suite passes (90/90), and TypeScript validation passes. Full lint/build/audit/workspace/encoding/secret/contradiction gates and required final-review cycles remain part of closure.
- Deferred: No live AI-provider request, real provider-key modification, persistence/RLS, Phase 2E reconciliation, Phase 2F orchestration, deployment, publication, commit, or push occurred.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2D implementation and final GPT review closure

**Summary:** Completed the authorized Phase 2D-only extraction boundary, addressed all findings from the bounded GPT review cycles, and closed the final read-only GPT code review with no remaining valid fixable issues.

- Changed: Added strict provider-neutral extraction/promotion contracts, deterministic Unicode/code-point segmentation and deduplication, exact supporting-text provenance, trusted provider/model candidate provenance, server-owned 24-actual-HTTP-attempt budgeting, sanitized retry/failure telemetry, bounded response/body cleanup, sequential Gemini quality escalation followed by Groq and OpenRouter Free fallback, and canonical `.env.local` provider setup with masked interactive input and no arbitrary file override.
- Changed: Added the final regression coverage for malformed Unicode, caller-overridden budgets, timeout/fallback behavior, response-stream cancellation, earlier-candidate preservation, no-key preflight, provider ZDR precedence, setup masking/backspace/terminal restoration, and promotion-invalid attempt relabeling.
- Tested: Focused Phase 2D tests passed 24/24; the complete suite passed 100/100. `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --omit=dev` (0 vulnerabilities), `scripts/verify-workspace.ps1`, `git diff --check`, strict changed/public-file UTF-8/control scanning, targeted secret/public-boundary scanning, and the contradiction scan all passed. Diff output contained only expected Windows LF-to-CRLF working-copy warnings.
- Reviewed: The first GPT review identified five findings and the final GPT-variant read-only closure review found no remaining valid fixable issues. Earlier GLM delegation attempts returned HTTP 429 and were stopped; no further GLM delegation was attempted. Finished children were interrupted, and exactly one bounded final GPT code reviewer was used for closure.
- Deferred: No live AI-provider request, real provider-key modification, persistence/RLS, Phase 2E reconciliation, Phase 2F orchestration, deployment, publication, commit, or push occurred. Existing user-owned UI/Playwright/package/screenshot changes remain preserved.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2D live-provider and website release review

**Summary:** Performed the explicitly authorized one-pass live connectivity validation for all five configured providers, re-reviewed the full Phase 2D extraction boundary and all public routes, fixed post-review correctness/security/UI defects, and prepared the verified release for Git publication.

- Live providers: Exactly one bounded request each succeeded for Tavily, Brave Search, Gemini `gemini-3.5-flash-lite`, Groq `openai/gpt-oss-120b`, and OpenRouter `openrouter/free`; OpenRouter returned concrete route `dots-studio/dots-3-note-preview:free`. No key or raw provider response was recorded. Gemini live validation used the implemented `/v1beta/interactions`; Google stable `/v1/interactions` remains a future deliberate revalidated migration.
- Fixed: Aligned generated segment/candidate IDs and returned model provenance with UTF-16 schema bounds; made rejected/oversize response cancellation best-effort/non-blocking; added provider-specific attempt budgets with provider-local fallback versus total-run terminal semantics; recorded reached missing providers once per run; changed Compare/Guide preview actions to native disabled controls.
- Website QA: Playwright checked `/`, `/research`, `/compare`, and `/guide` at 1440x1000 and 390x844; all responses were 200 with no console/page errors or horizontal overflow, internal links resolved, the Research evidence anchor worked, provider environment names were absent from rendered HTML, and all preview actions were natively disabled.
- Verified: `npm.cmd test` passed 105/105; TypeScript, lint, production build, `npm audit --omit=dev` (0 vulnerabilities), workspace verifier, `git diff --check`, strict UTF-8/control scan, ignored-env check, tracked/unignored secret scan, targeted contradiction scan, and final browser QA passed. Diff check emitted only expected LF-to-CRLF warnings.
- Deferred: Phase 2E reconciliation/evidence gating, Phase 2F full orchestration, persistence/RLS, live Research UI wiring, and deployment remain deferred.

## 2026-08-16 — ChatGPT / GPT-5.6 Sol — Phase 2E implementation-plan hardening

**Summary:** Reconciled the planned Phase 2E reconciliation/evidence-gate batch against the live Phase 2D implementation and converted the remaining design into implementation-grade contracts, quotas, provenance rules, failure semantics, and deterministic test cases.

- Planned: Phase 2E remains a standalone in-memory stage with an explicit caller-supplied decision-eligible category set. It reuses/generalizes the Phase 2D AI transport to stage-aware telemetry/budgets while preserving extraction's 24-request behavior; reconciliation is capped at 12 actual requests/run, explanation at 6, semantic batches at 12 pair questions/request, and ambiguous semantic work at 144 questions/run.
- Planned: `VerifiedClaim` becomes truthful ID-or-name with optional program ID/name/intake and required candidate IDs bounded by the existing run candidate ceiling; each candidate may back at most one final factual claim, final source/document/supporting provenance is derived from those candidates, final extraction confidence is removed, claim-level `unknown` is rejected, and every final factual scalar must originate from referenced candidates after conservative deterministic normalization.
- Planned: Phase 2E reuses the exact Phase 2B Unicode identity normalization rule, fails closed on unmodeled scope/period/freshness/independence, uses deterministic pair-question structured reconciliation with partial valid-sibling fallback, keeps source authority application-owned, preserves separate conflicting value clusters, and makes explanation presentation-only with deterministic fallback.
- Review policy: For this Phase 2E implementation batch, no implementation/testing/docs/security subagents are allowed. Only the final looping read-only reviewer is permitted: GLM variant first; any GLM failure is terminal and switches once to GPT; any GPT failure ends subagent use; one child/iteration, close after result/error, maximum three successful review iterations.
- Deferred: Runtime Phase 2E implementation, Phase 2F orchestration, additional live provider calls, commit/push, deployment/publication, and the preserved `ui-flow-screenshots/` artifacts remain untouched.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 2E implementation closure

**Summary:** Implemented the authorized Phase 2E standalone reconciliation/evidence-gate stage, generalized the Phase 2D structured transport for stage-aware budgets, and preserved the Phase 2F/UI/persistence boundary.

- Changed: Added shared Phase 2B identity normalization, stage-neutral extraction/reconciliation/explanation AI budgets and telemetry, bounded semantic pair planning/overflow handling, strict relationship/explanation schemas, public-only prompts, sequential provider fallback with Gemini-only quality escalation for invalid semantic output, and caller-abort/total-budget behavior.
- Changed: Added candidate-traceable Phase 2E claims, deterministic scalar/property/period normalization, source authority/independence/freshness/conflict/inferred/anecdotal gates, category-level unknown versus operational incompleteness, and evidence-bounded explanation fallback. Program identity, document/source consistency, candidate-derived provenance, and permutation-stable IDs are cross-checked at the result boundary.
- Tested: Added `tests/phase2e-reconciliation.test.ts` with 35 focused deterministic tests covering the required identity, provenance, normalization, semantic schema/overflow, provider quality/fallback, budget/abort, privacy, authority/independence/conflict/freshness, unknown/incomplete, explanation, and permutation cases. Focused Phase 2E passed 35/35; the complete suite passed 140/140.
- Verified: TypeScript, lint, focused/full suites, production build, production dependency audit (0 vulnerabilities), workspace verifier, `git diff --check`, strict changed-text UTF-8/control scan, secret/public-boundary scan, and ignored-environment checks all passed after the final inline review fixes. The full suite passed 140/140.
- Reviewed: The mandated GLM-5.3 read-only reviewer was dispatched first and timed out without a result; it was closed and not retried. The one permitted GPT fallback was dispatched once, also timed out, and was closed. No further subagents were used; the main agent completed the remaining review inline and applied the fail-closed fixes before rerunning focused/full/type/lint checks.
- Deferred: Phase 2F lifecycle orchestration, integrated provider-attempt ceiling, persistence/RLS, live Research UI wiring, additional live provider requests, deployment/publication, commit/push, and changes to user-owned `ui-flow-screenshots/` remain deferred.

## 2026-08-17 — User correction — reviewer liveness/fallback semantics

**Correction to the Phase 2E closure review record:** The earlier entry described the GLM/GPT reviewers as having "timed out" after bounded waits. The user clarified that this interpretation is incorrect when a child has returned neither a result nor an error; such a child may still be actively thinking.

- Durable rule: A bounded wait/poll window expiring without a child result or child error does **not** establish timeout or failure. Inspect the child/task state. If it is still running/ongoing, keep it alive and continue checking rather than closing it or starting the fallback reviewer.
- Fallback trigger: For the user's reviewer policy, the timeout/rate-limit condition means an explicit HTTP 429 / API request-limit response. Other explicit terminal child errors/failures may use the fallback allowed by the active plan, but pending execution alone may not.
- Concurrency: Never start GPT fallback while the GLM reviewer is still healthy/running. The same liveness rule applies to a GPT reviewer: no result/error plus a running state means continue checking, not failure.
- Forward use: Apply this corrected liveness behavior to future implementation/review batches unless the user explicitly specifies a different subagent policy.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 2E independent review and release hardening

**Summary:** Independently re-reviewed the completed Phase 2E implementation from Codex thread `01a00b6d-68cb-7b92-9d3f-da9fc50209b9`, added failing regressions for uncovered edge cases, fixed the confirmed defects, synchronized the canonical docs, and completed the release gates before the authorized Git publication.

- Fixed contracts/provenance: `VerifiedClaim.candidateIds` is mandatory; final identity permits application-owned stable-ID enrichment only when candidate names/IDs prove the same entity; final result provenance uses the same scalar/unit/currency/academic-year/intake/effective-date normalization as reconciliation; processed zero-claim coverage must be category-level unknown.
- Fixed evidence logic: future effective dates and opaque academic-year tokens no longer become current/outdated by guesswork; broken candidate source/document provenance remains operationally incomplete; university authority requires ownership evidence for the resolved target; anecdotal/ranking and unresolved university sources cannot manufacture corroboration; direct authoritative normative evidence keeps `verified` precedence.
- Fixed reconciliation/AI boundaries: canonical-equivalent target/period context produces stable IDs; missing period data is not a fabricated mismatch; semantic overflow diagnostics remain bounded; total reconciliation budget exhaustion stops later-provider dispatch; the injected semantic seam receives only public task data; resolved target context is JSON-quoted untrusted prompt data.
- Fixed explanation behavior: wholly rejected model explanations are recorded as `invalid-response`; deterministic fallback truncation is UTF-16 safe; categories with zero gated claims never consume explanation-provider quota even when other categories do.
- Tested: Phase 2E focused suites passed 55/55 (50 primary + 5 independent-review regressions); the complete deterministic suite passed 160/160 across seven files. TypeScript, lint, Next.js production build, `npm audit --omit=dev` (0 vulnerabilities), workspace verification, Windows `git diff --check`, UTF-8/control scanning (72 files), provider-secret/public-env scanning (0 hits), and `.env.local` ignored/untracked checks passed.
- Reviewed: The prior implementation thread's reviewer closures are not counted because they violated the corrected liveness rule. The current ChatGPT/CodexPro host exposes no executable `runSubagent`/child-review action, only handoff-file helpers, so no GLM/GPT child was fabricated; the main agent completed the final read-only `review-agent` rubric inline and found no remaining actionable Phase 2E defect after the fixes above.
- Deferred/preserved: Phase 2F lifecycle orchestration and integrated attempt ceiling, persistence/RLS, live Research UI wiring, additional live provider calls, and deployment remain deferred. User-owned `ui-flow-screenshots/` remains unmodified and excluded from publication.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 2F implementation plan hardening

**Summary:** Hardened the final Phase 2F integration plan against the released `bc1901b` Phase 2E baseline. No runtime implementation was changed and no live provider calls, commit, push, deployment, persistence, or UI wiring were authorized in this planning pass.

- Integration boundary: Phase 2F will add a small `lib/research/orchestration/` coordinator, preserve `runDiscoveryRetrieval()` as the Phase 2B/C compatibility surface, extract a project-owned B/C stage seam, resolve the target exactly once, and canonicalize requested category order before stage dispatch.
- Attempt bounds: discovery keeps a separate exact 32-record history bound. Bounded non-dispatched AI telemetry makes extraction <=28 records, reconciliation <=16, and explanation <=10 while preserving actual HTTP budgets 24/12/6; final whole-run `ResearchRun.providerAttempts` ceiling is therefore derived as **86**, never obtained by truncation. The existing 60-second run timeout is discovery-specific and must not be reused as a full-pipeline deadline.
- Category lifecycle: discovery must distinguish covered vs clean-empty vs operational failure after final source selection; multi-category canonical-source associations survive dedupe; selected relevant retrieval/normalization failures remain incomplete unless exact redundancy is proven; clean-empty categories consume no downstream AI; any unprocessed segment conservatively makes all categories sent to the current extraction run incomplete; Phase 2E receives only B/C/D-complete categories.
- Final result: sources/documents/candidates from incomplete work may remain as validated provenance, but final claims are pruned to processed categories. EvidenceSummary is rebuilt from final state. Phase 2F adds strict final evidence explanations so Phase 2E explanation quota is not discarded: exactly one per processed category, same-category final claim references, zero-reference deterministic fallback for unknown, none for unprocessed categories, and explanation failure/abort never changes lifecycle.
- Lifecycle/errors: terminal statuses are succeeded/partial/failed only; processed/unprocessed exactly partition validated requested categories; failed has zero processed; `categoriesFailed` is a subset of unprocessed; add truthful `cancelled` and run-level `normalization`; pre/in-flight abort stops new retries/fallbacks while preserving completed work; final failures represent unresolved operational effect rather than every transient provider failure.
- Reviewer policy for Phase 2F: no implementation/research/test/security/docs subagents. Only final looping read-only `code-reviewer-glm` (`C:\\Users\\LOQ\\.codex\\agents\\code-reviewer-glm.toml`, GLM-5.3 Max) is permitted after local gates. No GPT fallback. A running child with no result/error remains alive. Explicit HTTP 429 closes GLM and skips further subagent review; any other terminal GLM failure also ends subagent use. Main Codex always completes final inline review; max three successful GLM review iterations.
- Planning refinement from the same review pass: direct/ROR after **both** Tavily and Brave fail is degraded salvage, so validated sources may be retained but the category is not decision-eligible. Extraction will use a backward-compatible per-document category scope so an unfinished tuition-only segment does not incorrectly demote admissions; clean-empty categories are not sent into unrelated documents. Discovery/retrieval caller cancellation must propagate through the B/C seams, and the extraction injected test seam must no longer receive API-key-bearing options or bypass the shared 24-attempt budget.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 2F implementation completion

**Summary:** Resumed the interrupted Phase 2F task after the user's GLM-5.3 Coding Plan run stopped on HTTP 429, completed the implementation inline, performed a defect-first review, updated canonical documentation, and prepared the user-authorized final commit/push. No live provider calls, deployment, persistence/RLS, or Research UI wiring were used.

- Full orchestration: added `lib/research/orchestration/` with `runPhase2Research`, canonical category ordering, UUID-based run IDs, injectable monotonic clocks, exact succeeded/partial/failed lifecycle, final failure aggregation, canonical explanation ordering, and EvidenceSummary rebuilt from final processed-category state.
- B/C integration: preserved `runDiscoveryRetrieval()` compatibility while adding a project-owned B/C stage result that resolves target identity once, carries multi-category source associations through canonical/content dedupe, distinguishes covered/clean-empty/degraded/failed discovery, and retains lower-level provenance from incomplete categories. Direct/ROR evidence after both Tavily and Brave fail remains degraded salvage and is never decision-eligible.
- Cancellation/retrieval: caller abort now propagates through target resolution, discovery, DNS-pinned retrieval, redirects, extraction, reconciliation, and explanation. Final review found and fixed an abort race after asynchronous target resolution and a fail-open case where discovery timeout/budget exhaustion after clean general-web emptiness could otherwise become evidence `unknown`.
- Extraction/AI seams: added backward-compatible per-document extraction category scope, so unfinished segments affect only genuinely associated categories. Extraction callbacks receive public task data only. All injected extraction/reconciliation/explanation paths now use one strict shared attempt-budget accountant that rejects wrong-stage/non-AI attempts and total/provider overruns instead of silently clamping impossible synthetic histories.
- Contracts/telemetry: discovery keeps its exact 32-record attempt-history bound; final provider history is derived as 86 = 32 discovery + 28 extraction + 16 reconciliation + 10 explanation, with provider/total budget-skip telemetry deduplicated and actual attempts never truncated. `ResearchResult` now carries one bounded explanation per processed category; unknown explanations must be zero-reference deterministic fallbacks. Final conflict/outdated summaries cannot over-report categories without matching claims.
- Verification from the frozen code/docs state: focused Phase 2F 23/23; complete Vitest suite 183/183; `npx tsc --noEmit` passed; ESLint passed with zero warnings; Next.js production build passed; `npm audit --omit=dev` reported 0 vulnerabilities; workspace verifier passed; authoritative Windows `git diff --check` passed after removing one extra EOF blank line; changed-file UTF-8/control scan covered 33 files with 0 findings; changed-file secret-value scan found 0 hits; provider `NEXT_PUBLIC_*` scan found 0 hits; `.env.local` remained ignored with no Git status entry.
- Review: the current ChatGPT/CodexPro host exposes no executable subagent-dispatch action, so no `code-reviewer-glm` child result was fabricated. The main agent applied the local defect-first review rubric and fixed the cancellation race, discovery empty/timeout bug, injected-budget parity bug, evidence-summary over-reporting, unknown-explanation fallback invariant, failure-priority nondeterminism, mixed-failure over-specificity, and canonical explanation ordering before release gates.
- Deferred: Supabase persistence/migrations/RLS, seed data, live Research endpoint/UI wiring, Phase 3 Research Mode, deployment, and further live provider calls remain outside Phase 2. User-owned `ui-flow-screenshots/` remains untouched and excluded from publication.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 3 Research Mode implementation planning

**Summary:** Created implementation-grade Phase 3 plans only. No runtime code, dependency, environment, provider, database, UI, deployment, Git publication, or protected screenshot changes were performed.

- Canonical Phase 3 architecture is in `docs/planning/phase-3-research-mode.md`, with dependency-ordered Phase 3A–3D runbooks under `docs/superpowers/plans/` and matching unchecked execution items in `docs/planning/tasks.md`.
- Phase 3A plans a checked-in supported catalog of 10–15 verified universities across US/UK/Thailand, browser-safe public Research contracts, deterministic catalog search/filter, and an explicit server-only catalog target resolver. Catalog identity/navigation metadata is not research evidence; canonical catalog official links require HTTPS and current official-source verification during implementation.
- Phase 3B plans a Node-runtime same-origin `POST /api/research` boundary with 16 KiB actual-body ceiling, strict UTF-8/JSON, origin/fetch-site and sensitive-input guards, exactly one `runPhase2Research` dispatch with caller cancellation/catalog resolution, and a deterministic server-only dossier composer. The browser never receives Phase 2 documents/candidates/provider history/raw warnings; public sources are limited to final-claim references, and representative source selection must match candidate-backed supporting text exactly. A 4 MiB final envelope fails closed rather than truncating evidence.
- Phase 3C plans a catalog-driven Research workspace with all seven canonical categories, pure reducer + synchronous single-flight guard, immutable form controls during active requests, explicit cancel/retry, stale-response protection, ready/unknown/incomplete separation, exact evidence badges, conflict/outdated behavior, deterministic formatting with no unit/currency/scalar reinterpretation, and an accessible evidence Sheet/Dialog rendering retrieved text only as text.
- Phase 3D plans deterministic Playwright Test browser acceptance through `/api/research` interception, not production test modes or live providers. It covers lifecycle/error/malformed-response/XSS-looking/long-content fixtures, cancel/refresh/unmount races, evidence/source association, keyboard/focus behavior, viewport overflow matrix, console/page-error checks, client secret/provider-call scans, requirements traceability, and final defect-first review. The implementation-time manifest must align the Playwright Test runner at the existing 1.62.x version if it still declares only the direct `playwright` package; no unrelated dependency upgrade is planned.
- Planning review corrected two potential implementation defects before coding: Phase 2 final evidence sources can validly be public HTTP or HTTPS, so the public dossier source schema must preserve that transport shape while catalog official links remain HTTPS-only; and server transport errors are distinct from client-only `network-error`/`invalid-response` controller states.
- Public deployment remains blocked until the later hardening/deployment phase verifies current platform duration/cancellation behavior and a durable/deployment-layer rate limit for the expensive Research endpoint. Phase 3 remains in-memory and explicitly excludes Supabase persistence/RLS, saved history, background jobs/queues, Comparison/Guide behavior, deployment, and automatic live-provider smoke calls.

## 2026-08-17 — Codex / GLM-5.3 — Phase 3A + 3B implementation closure

**Summary:** Implemented the supported Research catalog, browser-safe public contracts, bounded Node-runtime Research API, and deterministic public dossier composer without entering Phase 3C/3D or changing dependencies.

- Phase 3A added `lib/research/mode/public-contracts.ts`, catalog schema/data/search/index/server-only resolver, and focused cross-contract tests. The checked-in catalog contains 10 universities and 14 computing programs across GB/TH/US (10 bachelor and 4 taught-master entries); identities, official homepages, program identities, degree levels, subjects, and canonical official program URLs were checked against owning-university pages on 2026-08-17. Catalog data contains identity/navigation metadata only, not factual research evidence.
- Phase 3B added a strict 16 KiB actual-body reader with exact declared-length checks and abort-safe bounded reads; a same-origin/fetch-site, catalog-ownership, and sensitive-question/intake/year guard; one `runPhase2Research` dispatch with the exact caller signal and catalog resolver; and `app/api/research/route.ts` on the Node runtime. Responses are validated, `no-store`, and bounded to 4 MiB without evidence truncation.
- The server-only dossier composer preserves final scalar/status values, resolves representative sources from exact candidate-backed passages, keeps category unknown separate from operational incomplete, projects only final-claim-referenced public sources, uses sanitized fixed failure mappings, and excludes documents, candidates, provider history, discovery telemetry, raw warnings, model/provider identity, and secrets.
- Review: inline review fixed duplicate public claim/reference validation, exact Content-Length handling, stalled-body abort propagation, double serialization, and requested-category partition enforcement. GLM review iteration 1 then found and the main agent fixed an intake/academicYear sensitive-data bypass and unsanitized abort-time exception propagation; its documentation finding was resolved by this entry. Focused Phase 3A+3B passed 47/47 after those fixes.
- Verified: complete Vitest suite 230/230; `npx tsc --noEmit`, ESLint, Next.js production build, `npm audit --omit=dev` (0 vulnerabilities), workspace verifier, Windows `git diff --check`, strict UTF-8/control scan (22 files), changed-surface provider-secret scan, provider `NEXT_PUBLIC_*` scan, client/server import-boundary scan, production placeholder scan, no staged files, ignored/untracked `.env.local`, and protected `ui-flow-screenshots/` status all passed. No live UniProof provider smoke call, commit, or push was performed.
- Deferred: Phase 3C Research UI, Phase 3D browser acceptance, Supabase persistence/migrations/RLS, authentication, saved history, Comparison, Guide, background jobs, deployment, public durable/deployment-layer rate limiting, and live provider smoke tests remain outside this batch.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 3A + 3B independent review and governance update

**Summary:** Independently reviewed the uncommitted Phase 3A+3B implementation from Codex thread `01a00e26-8af7-7e52-9a10-eca84b42e589`, fixed additional defects beyond the completed historical GLM review iteration, synchronized the Phase 3 documentation, and applied the user's model-specific delegation correction. No new live UniProof provider calls, persistence, UI implementation, deployment, or protected screenshot changes were used.

- Catalog search ownership: fixed program/subject searches that could return a matching program without its owning university. Search now builds program matches from the country-scoped university set and unions every matched program owner into the visible university results while preserving degree/subject narrowing. Added a regression proving every returned program's `universityId` resolves within the same search result.
- Catalog link review: current official university pages were rechecked and the year-specific Imperial Computing BEng and UCL Computer Science BSc links were replaced with their stable current official course routes; catalog identity/navigation verification remains separate from evidence freshness.
- Dossier target integrity: added a fail-closed selected-target check so every final claim must carry the selected application-owned university ID and, for program-scoped runs, the selected program ID. University-only dossiers reject program-scoped final claims. This closes the possibility of presenting an internally valid Phase 2 result under the wrong catalog target label.
- Public DTO hardening: `researchDossierSchema` now independently rejects unused/unreferenced public sources, terminal run statuses that contradict processed/incomplete category rows, and non-monotonic created/started/updated/completed timestamps. This keeps malformed server responses from reaching the Phase 3C browser renderer even if the production composer is bypassed or regresses.
- Existing Phase 3B privacy fixes from the prior implementation review were preserved and documented: sensitive-data detection covers all caller-controlled free-text research fields (`question`, `intake`, `academicYear`), abort-time upstream exceptions are sanitized, public responses are `no-store`, and only final-claim evidence crosses the browser boundary.
- Delegation policy: `AGENTS.md` is now authoritative. When the active main model is GLM-5.3 Max (`zai-coding/glm-5.3`), all planning/research/implementation/debugging/tests/security/docs/traceability/final review run in the main agent with zero subagents, including no reviewer child. Native OpenAI GPT models retain the final read-only `code-reviewer` step after the main agent's own defect-first review and all local gates; valid findings are fixed in the main agent with regression coverage and gates rerun. Active Phase 3 runbooks were updated to defer to this rule.
- Verification after the independent fixes: Phase 3A+3B focused suite 48/48; complete Vitest suite 231/231; `npx tsc --noEmit` passed; ESLint passed with no warnings; Next.js 16.3.1 production build passed including dynamic `/api/research`; `npm audit --omit=dev` reported 0 vulnerabilities; workspace verifier passed; authoritative Windows `git diff --check` passed; strict UTF-8/control scan covered 28 intended changed files with 0 findings; provider-secret scan had 0 hits; client import/provider boundary scan had 0 hits; production placeholder scan had 0 hits; `.env.local` remained ignored/untracked; `ui-flow-screenshots/` remained untouched and outside the intended publication set.
- Deferred: Phase 3C interactive Research UI, Phase 3D Playwright/browser/accessibility acceptance, persistence/RLS/authentication/saved history, Comparison/Guide, background jobs, deployment, durable public endpoint rate limiting, and further live provider smoke tests remain unimplemented.

## 2026-08-17 — ChatGPT / GPT-5.6 Sol — Phase 3C implementation-plan hardening

**Summary:** Reconciled the Phase 3C Research workspace plan against the independently reviewed Phase 3A/3B implementation, removed stale client assumptions, and expanded deterministic form/transport/concurrency/evidence/browser-sanity acceptance before runtime implementation.

- Planned form/state boundary: added pure catalog-aware form/request construction with explicit program ownership and program-to-university-only scope transitions, canonical category toggles, deterministic subject/target labels, blank optional free-text omission, UTF-16/astral bounds, immutable `ResearchSubmissionSnapshot`, and exact retry-versus-new-request semantics.
- Planned transport boundary: added one injectable client `/api/research` transport with no-store/redirect-error request semantics, strict JSON/public-envelope validation, HTTP/envelope agreement, submitted university/program/category binding, sanitized network/invalid-response outcomes, and signal-authoritative cancellation rechecked across await boundaries.
- Planned UI/accessibility/security: sensitive-input is a free-text-group error because Phase 3B checks question/intake/year together; search/textarea Enter cannot trigger accidental research; unknown remains distinct from incomplete; one controlled Radix evidence sheet returns focus to the exact claim trigger, closes stale claim state before dossier replacement, renders retrieved content as text only, and uses no-referrer safe external anchors.
- Planned verification: Phase 3C now requires focused state/form/transport/format TDD, full test/type/lint/build/audit/workspace/diff gates, UTF-8/control and secret/client-boundary/residue scans, `.env.local` isolation, protected screenshot verification, and deterministic desktop/mobile rendered sanity with `/api/research` intercepted outside production code. Phase 3D remains responsible for the checked-in Playwright Test dependency/E2E suite.
- Synchronized: updated the canonical Phase 3 architecture, Phase 3C task ledger, and downstream Phase 3D browser-hardening runbook so later acceptance explicitly tests wrong-target/category dossiers, HTTP/envelope mismatch, blank optional omission, cancellation races, immutable retry payloads, unsupported-target reselection, and all-three-field sensitive-input behavior.
- Deferred: No Phase 3C runtime code, dependency/lockfile change, live provider call, commit, push, deployment, persistence, Comparison/Guide work, or protected `ui-flow-screenshots/` modification occurred in this planning pass.

## 2026-08-17 — Codex / GLM-5.3 — Phase 3C implementation closure

**Summary:** Implemented the interactive Research workspace and evidence UX on top of the Phase 3A/3B boundary without subagents, dependencies, live provider calls, persistence, deployment, or Git publication.

- Client seams: added `client-form.ts` (catalog target ownership, explicit program-to-university-only scope switching, canonical category toggles, deterministic subject filters/target labels, blank optional omission, UTF-16 bounds, strict final request validation), `client-state.ts` (immutable `ResearchSubmissionSnapshot`, sequence-safe reducer, previous-result preservation), `client-transport.ts` (single no-store/redirect-error POST, strict JSON/envelope validation, HTTP/envelope agreement, submitted target/program/category binding, signal-authoritative cancellation, sanitized failures), and `format.ts` (UTC/en-US presentation-only formatting with no currency/unit/date reinterpretation).
- React layer: `app/research/page.tsx` now renders the server-supplied public catalog through one client workspace with catalog search/filters/native target selection, seven native category checkboxes, optional free-text fields with group privacy guidance, immutable single-flight submissions, explicit cancel/retry semantics, succeeded/partial/failed banners, ready/unknown/incomplete category sections, and one controlled Radix Dialog-based evidence Sheet with exact focus return and safe no-referrer external anchors. The illustrative factual preview is fully removed.
- Defect-first review findings fixed during the batch: a partial-dossier test fixture initially carried `succeeded` status with incomplete categories; browser sanity exposed a false click target where Playwright case-insensitive `text=Cancel` matched loading copy instead of the Cancel button (the production cancellation path was correct once the test used a role-exact selector); and final review removed an unused claim-trigger registry whose focus-restore behavior was already fully owned by the stored trigger element state.
- Verified: focused Phase 3C suites 60/60; complete Vitest suite 291/291; `npx tsc --noEmit` passed; ESLint passed with zero warnings; Next.js production build passed; `npm audit --omit=dev` reported 0 vulnerabilities; workspace verifier passed; rendered desktop 1440px, 1024px failed-state, and 390px mobile sanity passed with `/api/research` intercepted only by disposable tooling (6 POSTs across scenarios; one expected Chromium 400 network log from the intentional sensitive-input fixture; no page/console errors or horizontal overflow); strict UTF-8/control scan, provider-secret scan, `NEXT_PUBLIC_*`/client-boundary/import-boundary scan, residue scan, dependency/lockfile isolation, ignored `.env.local`, untouched `ui-flow-screenshots/`, and Windows `git diff --check` all passed.
- Deferred: Phase 3D checked-in Playwright Test dependency/E2E acceptance, persistence/RLS/authentication/saved history, Comparison/Guide, background jobs, deployment, durable public rate limiting, and live provider smoke tests. No commit or push was authorized or performed.

## 2026-08-18 — ChatGPT / GPT-5.6 Sol — Phase 3C independent review and release preparation

**Summary:** Independently reviewed the completed Phase 3C implementation from Codex thread `01a0104f-0b80-7522-8b31-1ae278affc20`, added rendered/UI regressions for gaps not covered by the original pure suites, fixed verified state/accessibility defects, synchronized Phase 3C/3D documentation, and prepared the exact intended change set for the user-authorized commit/push to `origin/main`.

- Accessibility fixes: target and free-text validation errors now have stable IDs and are referenced by the corresponding controls; target search exposes invalid state when selection is missing/stale; server `sensitive-input` marks only populated free-text controls invalid while blank optional fields remain neutral. Target-selection actions also clear stale local field errors.
- Preserved-result fixes: validated dossier headings now use the server-returned canonical target, a newer refresh error owns the only visible retry action while an older preserved partial dossier is shown, retry copy distinguishes the immutable failed snapshot from a new current-form request, and `Clear result` now actually clears instead of restoring the same preserved dossier.
- Refresh/evidence fixes: prior dossier evidence remains safely inspectable while a refresh is active, but accepting a newer validated dossier clears any evidence sheet that was reopened against the previous result so stale claim/source state cannot survive replacement.
- Regression coverage: added `tests/phase3c-research-ui.test.ts`; focused Phase 3C coverage is now 65/65 and the complete Vitest suite is 296/296. The new tests cover field-error ARIA association, populated-only sensitive invalid state, server target labeling, retry ownership, and preserved evidence navigation; the state suite also now enforces true clear-result semantics.
- Deterministic rendered review: production `/research` was exercised with disposable Playwright interception only. Four research POSTs were intercepted; same-tick single-flight held, blank optionals were omitted, prior evidence remained usable during refresh, duplicate retry ownership was prevented, stale evidence closed on replacement, client-invalid submission made zero API calls, sensitive-field ARIA behavior was correct, mobile overflow was 0 px, and there were zero page errors, unexpected console errors, or provider-domain requests.
- Final local gates after fixes: focused 65/65; full 296/296; TypeScript passed; ESLint passed; Next.js 16.3.1 production build passed; `npm audit --omit=dev` reported 0 vulnerabilities; workspace verifier passed; Windows `git diff --check` passed with only expected LF→CRLF warnings. Strict UTF-8/control scanning covered the intended text set with zero findings; the five real provider credential values were checked across intended/build artifacts with zero hits; client-boundary, `NEXT_PUBLIC_*`, residue, and `.env.local` isolation checks were clean; dependencies/lockfile remained unchanged; `ui-flow-screenshots/` remained untouched/untracked.
- Reviewer policy: the active CodexPro server exposed no executable subagent/code-reviewer action after full action discovery. The installed read-only `review-agent` skill was therefore loaded and applied as a separate defect-first final pass over the complete change; it produced no additional qualifying findings. This limitation is recorded rather than claiming a delegated child review occurred.
- Deferred after this release: Phase 3D checked-in `@playwright/test` browser/accessibility acceptance, persistence/RLS/authentication/saved history, Comparison/Guide, background jobs, deployment, durable public rate limiting, and live provider smoke tests remain future work.
