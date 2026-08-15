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
