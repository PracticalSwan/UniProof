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