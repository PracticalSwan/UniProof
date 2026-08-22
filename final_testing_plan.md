# UniProof Final Testing Plan

> **Executor:** Codex using native **GPT-5.6 Sol** with the configured 1M-context environment. This plan is intentionally written for Codex, not ChatGPT. Codex may use native tools, subagents, MCPs, plugins, skills, hooks, CLIs, browser/computer-use surfaces, and code intelligence that are actually available in its session.
>
> **Goal:** Perform one final, evidence-driven test/review of UniProof from repository state through local runtime, browser UX, local Supabase, security/privacy, CI, GitHub publication, GitHub↔Vercel integration, the current Vercel Production release, and preparation of the live Devpost draft; discover and automatically fix real defects or missing implementation where justified; update the authoritative docs, commit and push the verified final change set, connect the existing GitHub repository to the existing Vercel project, ensure the GitHub repository exposes the canonical live website link, redeploy only when necessary, fill and save all truthful non-video Devpost fields/assets while leaving the video pending and the project unsubmitted, and finish with a simple release-oriented status report without over-engineering the project or repeatedly running expensive suites.

## Operating principle

This is a **coverage and decision plan, not a rigid command script**. Codex should reason about the live repository, current external state, and failures it actually observes. It may reorder, combine, narrow, or skip redundant checks when equivalent fresh evidence already exists and the affected code has not changed. It may add a missing edge case or test that this plan did not anticipate when there is a concrete reason.

The plan has three hard priorities:

1. **Find real defects, not theoretical work.** Prefer evidence from code, tests, rendered UI, logs, local database behavior, and hosted configuration.
2. **Fix root causes minimally.** Do not add frameworks, abstraction layers, services, test infrastructure, queues, dashboards, or dependencies unless a verified defect cannot be solved cleanly with the existing stack.
3. **Avoid test inflation.** Run focused tests while iterating and one appropriate final full gate on the stable revision. Do not repeat the same large matrix merely to accumulate passing numbers.

---

# 1. Hard constraints

## 1.1 Repository and project governance

At session start Codex must follow `AGENTS.md` exactly:

1. Read `LESSONS.md` first.
2. Read `AGENT_MEMORY.md` second and verify mutable facts against the live workspace.
3. Read `AGENTS.md`.
4. Read this `final_testing_plan.md` plus the active sources of truth:
   - `docs/planning/tasks.md`
   - `docs/requirements.md`
   - `docs/design.md`
   - `docs/security.md`
   - `docs/security-threat-model.md`
   - `docs/planning/phase-6-hardening-submission-readiness.md`
   - `docs/planning/phase-6-requirements-traceability.md`
   - `docs/operations/vercel-production.md`
5. Resolve the real Git root, branch, remotes, status, and diff before edits or Git actions.
6. Preserve `ui-flow-screenshots/` as protected user-owned, untracked material. Do not stage, publish, overwrite, rename, or delete it.

Do not weaken evidence-first semantics, security boundaries, RLS, CSP, rate limiting, SSRF defenses, cancellation/deadline ownership, or failure transparency just to make a test pass.

## 1.2 Live Research quota: five additional calls for this final run

The user authorizes Codex to use **up to five additional accepted live Research executions during this final-testing run**.

Current project evidence records **3 accepted live Research executions already consumed** during Phase 6C. Those historical calls do not reduce the new allowance. Codex therefore starts this final-testing plan with **5 additional accepted `/api/research` executions available**, for a maximum cumulative accounting of **3 historical + 5 new = 8 accepted executions** if every additional call is actually needed.

Rules:

- Default live quota consumption is still **zero** until a concrete live-only hypothesis requires a call.
- Use an additional live Research execution only when it answers a specific unresolved hypothesis that deterministic/local testing cannot answer, or when final release verification genuinely requires one real provider-path confirmation.
- Every accepted call must have a written purpose before it is sent, for example: “verify that the Production direct-program-source fix actually retrieves at least one source for target X.”
- Never spend a call only to “see what happens,” repeat the same target without a changed hypothesis, brute-force providers/targets, or chase a prettier demo result.
- Count an accepted `/api/research` execution even if providers later fail or the dossier is incomplete.
- A failed request that never reaches/accepts the Research execution should be classified separately rather than silently charged, but Codex must use the application’s actual accepted-run semantics rather than guessing.
- Stop live Research testing immediately when **5 additional accepted executions have been consumed by this final-testing run**, regardless of outcome.
- Do not bypass WAF, provider limits, rate limits, or product safety controls to conserve or expand quota.

The final report must state `3 historical + N final-testing calls = cumulative total`, where `N <= 5`, and record the purpose/outcome of each new accepted call.

## 1.3 Task-completion and release authorization

For this final-testing task, the user explicitly authorizes Codex to complete the UniProof work end to end. Within the verified project/release scope, Codex may:

- inspect, test, debug, edit, refactor minimally, add focused regressions, and update documentation/memory;
- create and remove task-local disposable test/debug artifacts safely;
- change dependencies or configuration only when a verified defect genuinely requires it and the existing stack is insufficient;
- commit the final intended change set to Git and push it to the existing GitHub repository/default branch after verification and secret/diff review;
- update GitHub repository metadata that is directly required for release discoverability, including the repository homepage/website URL;
- connect the existing `PracticalSwan/UniProof` GitHub repository to the existing UniProof Vercel project when the integration is absent or incorrect;
- correct Vercel project/release settings, environment-variable presence, WAF configuration, Git integration, production branch, aliases, or deployment state when a verified release defect requires the change;
- redeploy/promote Production when necessary to publish a verified executable fix or to restore a broken/stale release;
- verify all external changes after mutation and update the canonical docs with the observed final state.

This is authorization to finish the task, not permission for unrelated or reckless operations. Preserve least privilege and reversibility. Do not force-push, rewrite Git history, delete repositories/projects, destroy production data, bypass security/rate limits, expose credentials, or perform unrelated account changes when a normal forward fix is available.

Hosted Supabase Auth/save is intentionally absent from the current judge release. Do not enable or redesign that hosted capability merely because broader release authority is available; only change it if final testing proves the current product requirements actually require such a change.

**Devpost drafting/editing is explicitly authorized; final submission is not.** Codex may create or open the existing UniProof Devpost draft, fill/edit/save every non-video submission field, upload only sanitized/public release assets that are appropriate for the entry, and keep the draft synchronized with the verified final release. The video field must remain unfinished until the user supplies the completed demo video. Codex must not click the final submit/publish action or otherwise submit the project.

If Codex fixes executable code, it must keep release truth exact: verify the final commit, push it, require its CI to pass, then ensure the deployed Production revision contains that verified executable state before claiming the fix is live. If the final change set is documentation-only and Production is already correct, a manual redeploy is unnecessary unless Git/Vercel integration itself triggers one or hosted state otherwise needs correction.

## 1.4 Codex-owned execution and subagent availability

This testing run is owned by Codex itself.

The currently enabled `codex-chatgpt-control@personal` plugin must be **inventoried but not invoked**. Do not hand testing, reasoning, review, or implementation back to ChatGPT or a ChatGPT-control surface.

Codex subagents are explicitly authorized. Many installed roles have both native GPT and `-glm` variants; for this run, Codex may use **either native GPT or GLM variants, or a pragmatic mix**, based on what is actually available, healthy, and best suited to the task. Do not block useful delegation merely because one variant is unavailable. The main GPT-5.6 Sol agent remains responsible for validating subagent findings against real repository/runtime evidence before acting on them.

## 1.5 No over-engineering

Codex should prefer:

- existing Vitest/Playwright helpers over new test frameworks;
- existing scripts over new wrappers;
- existing Zod/contracts over parallel validation layers;
- focused regressions over giant new suites;
- one correct fix over defensive layers everywhere;
- condition-based waiting over arbitrary sleep/retry loops;
- simple deterministic fixtures over elaborate mocks;
- no dependency additions unless the existing stack truly cannot perform the required test/fix.

Do not remove or weaken a valid test merely because it is slow or failing. A test may be simplified only when the requirement it encodes is demonstrably obsolete, duplicated, or invalid.

---

# 2. Current baseline to verify, not blindly trust

As of the plan creation on 2026-08-20, the recorded state is:

- Repository: `D:\Side Projects\UniProof`
- Branch: `main`
- Public repository: `PracticalSwan/UniProof`
- Repository documentation HEAD: `3c0d30098456bc04b1c66136ef65dd936a4fbdf9`
- Documentation-HEAD CI run: `32377252843` — successful
- Production executable SHA: `21d645baaf9eca381a167246d22538c23bb29427`
- Production deployment: `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN`
- Canonical Production URL: `https://uniproof-beta.vercel.app`
- Production runtime: Node `22.x`
- Public Research WAF: exact `POST /api/research`, fixed window 20 requests / 60 seconds / source IP, HTTP 429 on excess
- Hosted discovery: Tavily -> Brave
- Hosted structured AI: Groq -> OpenRouter
- Gemini adapter retained/tested but public key intentionally absent
- Hosted Supabase Auth/save intentionally absent; local Supabase Auth/RLS/save remains implemented and tested
- Catalog: 30 universities, 45 computing programs, 11 country codes
- Historical live Research consumption: 3 accepted executions

Codex must re-check these before relying on them. If any item differs, use the live state and update only the owning documentation when a material source-of-truth change is verified.

---

# 3. Mandatory Codex capability inventory

Codex must begin by inspecting **its own live tool surface**. Do not assume this file’s inventory is complete forever.

For every available MCP/plugin/tool surface, classify it as:

- **USE** — materially useful to UniProof final testing; actually use it.
- **PROBE** — available but unrelated to UniProof; perform only a safe/non-mutating availability or capability probe if such a probe exists.
- **BLOCKED** — explicitly disallowed by this plan/user instruction.
- **UNAVAILABLE** — configured but not exposed/healthy in the current Codex session.

Do not distort the project by using an irrelevant MCP for fake work. A safe health/capability probe plus an explicit `PROBE/N/A` record is sufficient for Blender/OCR/Three.js/etc.

## 3.1 Expected MCP inventory from the current Codex config

The current user-level Codex config contains these MCP servers:

| MCP | Final-testing role |
| --- | --- |
| `MCP_DOCKER` | **USE** for local container/Supabase stack health, bounded logs, and container-state confirmation. Prefer Supabase CLI for lifecycle. |
| `blender` | **PROBE/N/A**; UniProof has no Blender runtime. No scene/file mutation. |
| `context7` | **USE** when current Next.js/React/Supabase/Vercel/Playwright API behavior is uncertain or version-sensitive. Prefer official/current docs. |
| `figma` | **USE** read-only only if the existing UniProof Figma reference is available and visual QA needs a design cross-check; otherwise **PROBE/N/A**. |
| `node_repl` | **USE** for small deterministic runtime/contract/helper experiments when faster than creating a throwaway script. Never print secrets. |
| `notebooklm` | **PROBE/N/A**; no NotebookLM dependency in UniProof. |
| `notion` | **PROBE/N/A**; no Notion production dependency. |
| `ocr_model` | **PROBE/N/A**; no OCR path in UniProof. |
| `playwright` | **MAIN USE** for browser automation, real UI flows, console/network checks, screenshots/traces only when useful. |
| `serena` | **USE** for codebase navigation, symbol/reference analysis, impact analysis, and targeted code understanding where it improves precision. |
| `stitch` | **PROBE/N/A** unless an existing Stitch artifact is part of the current UI design evidence. Do not redesign the site just to use it. |
| `supabase` | **MAIN USE** for local database/Auth/RLS inspection and tests; hosted operations remain read-only unless separately authorized. |
| `threejs-devtools-mcp` | **PROBE/N/A**; UniProof has no Three.js runtime. |

## 3.2 Main non-MCP operator tools

These are main final-testing surfaces and should be used where available:

- **codex-lsp plugin/MCP** — semantic symbols, definitions, references, diagnostics, rename-safety analysis.
- **Playwright CLI and/or Playwright MCP** — browser tests and interactive diagnostics.
- **Vercel CLI** — primary hosted release/config/deployment/log inspection.
- **Supabase CLI** — primary local database/Auth/RLS lifecycle and pgTAP verification.
- **GitHub CLI (`gh`) / GitHub plugin** — CI/run/repository status inspection.
- **native shell/exec** — deterministic project commands and bounded diagnostics.
- **native read/search/grep/tree tools** — source inspection.
- **native patch/write/edit tools** — minimal fixes; prefer them so LSP post-tool hooks can run.
- **browser/chrome/computer-use surfaces** — one final human-like visual/interaction pass where they add evidence beyond Playwright assertions.
- **web/current-doc search** — only for mutable external facts or unclear current APIs; prefer official sources.

## 3.3 Enabled plugin inventory

The current Codex config reports these enabled plugins. Codex must re-inventory them at runtime, then use or probe them according to relevance:

### Expected active/useful

- `browser-use@openai-bundled`
- `browser@openai-bundled`
- `chrome@openai-bundled`
- `computer-use@openai-bundled`
- `codex-app-tools@openai-bundled`
- `build-web-apps@openai-curated`
- `coderabbit@openai-curated` — read-only review only; do not post external review comments without authorization
- `codex-lsp@codex-lsp-local`
- `codex-security@openai-curated`
- `figma@openai-curated` — read-only design reference if available
- `github@openai-curated`
- `sites@openai-bundled`
- `superpowers@openai-curated`
- `vercel@openai-curated`

### Expected probe/N/A unless a concrete test requires them

- `build-web-data-visualization@openai-curated`
- `canva@openai-curated`
- `documents@openai-primary-runtime`
- `game-studio@openai-curated`
- `google-drive@openai-curated`
- `hugging-face@openai-curated`
- `hyperframes@openai-curated`
- `latex-tectonic@openai-bundled`
- `latex@openai-bundled`
- `life-science-research@openai-curated`
- `notion@openai-curated`
- `nvidia@openai-curated`
- `openai-developers@openai-curated`
- `pdf@openai-primary-runtime`
- `presentations@openai-primary-runtime`
- `remotion@openai-curated`
- `sentry@openai-curated` — use only if UniProof is actually configured with Sentry; otherwise probe/N/A
- `shutterstock@openai-curated`
- `spreadsheets@openai-primary-runtime`
- `template-creator@openai-primary-runtime`
- `visualize@openai-bundled`

### Explicitly blocked

- `codex-chatgpt-control@personal` — **BLOCKED** for this run because the user explicitly requires Codex, not ChatGPT.

## 3.4 Hooks

Current hooks include Chronos, Clara, Codex Coordinator, Codex LSP, Codex Process Jobs, Codex Voice Notify, Riqor, TokenX, and Trigger Tree integrations.

Codex should **allow configured hooks to run naturally**. Do not invoke hook implementation files manually. Prefer native mutation tools when practical so `codex-lsp` post-tool diagnostics and other normal hook behavior are not bypassed.

If a hook is clearly causing a test failure, inspect the failure and isolate the root cause rather than disabling the hook globally as a shortcut.

## 3.5 Current Codex CLI caveat

During plan preparation, shell execution of `codex mcp list` failed because the configured model catalog file `C:\Users\LOQ\.codex\codex-router\merged-models.json` was missing the `supports_parallel_tool_calls` field for at least one model entry.

Codex should treat its **in-session native tool/MCP inventory as authoritative** if the session is functioning. Do not modify the global Codex router merely to make `codex mcp list` pretty. Only diagnose/fix this user-level router issue if it actually blocks the Codex session or required MCP access, and keep such a fix outside UniProof unless the user’s broader Codex configuration task explicitly authorizes it.

---

# 4. GPT-5.6 Sol subagent strategy

The main agent is native GPT-5.6 Sol. The user explicitly authorizes the installed native GPT and GLM subagent variants for this run. Where both forms exist (for example `code-mapper` and `code-mapper-glm`), select whichever variant is available/healthy and likely to produce the best independent signal; mixing variants across tasks is allowed. A missing native or GLM variant is not a reason to skip a useful review.

Use subagents to widen coverage, not to create bureaucracy. The main agent remains the owner of evidence, decisions, edits, final verification, external release actions, and reporting.

## 4.1 Recommended first read-only parallel batch

After the main agent maps the repository and current diff, dispatch up to the configured concurrency limit (currently 6) for independent read-only work. For each role below, use either the native role or its `-glm` counterpart according to availability and fit:

1. `code-mapper` / `code-mapper-glm` — map major execution paths and identify high-risk modules/tests.
2. `requirements-traceability` / `requirements-traceability-glm` — map Phase 0–6C + Side Phase catalog requirements to current implementation/tests; report unexplained gaps only.
3. `test-gap-auditor` / `test-gap-auditor-glm` — identify meaningful untested failure paths, avoiding duplicate/low-value tests.
4. `security-auditor` / `security-auditor-glm` — inspect SSRF, CSP, origin checks, Auth/RLS/persistence, secrets/provider boundaries, WAF/client failure handling.
5. `ui-ux-tester` / `ui-ux-tester-glm` — inspect Research/Compare/Guide usability, keyboard/responsive/error/evidence flows and likely browser regressions.
6. `performance-engineer` / `performance-engineer-glm` — only a bounded review for obvious client/server hot paths, repeated requests, bundle/runtime regressions, or pathological test/runtime behavior; do not invent a performance program.

Main agent must inspect each result critically. Subagent findings are hypotheses until verified against source/tests/runtime.

When a child is complete/idle/errored, close/interrupt it according to current Codex multi-agent guidance. Do not leave finished children in the working state.

## 4.2 Conditional specialist subagents

Use only when a verified issue points to them. Prefer whichever native/GLM variant is available and appropriate:

- `debugger` / `debugger-glm` — difficult runtime/test failure.
- `test-automator` / `test-automator-glm` — durable regression coverage for a confirmed bug.
- `typescript-pro` / `typescript-pro-glm` — difficult contract/type issue.
- `node-specialist` / `node-specialist-glm` — Node/Next runtime or transport behavior.
- `backend-developer` / `backend-developer-glm`, `api-designer` / `api-designer-glm` — real Research/API boundary defect.
- `database-optimizer` / `database-optimizer-glm` — only for real database/query/RLS performance/correctness issue.
- `dependency-manager` / `dependency-manager-glm` — only if a dependency issue is proven.
- `documentation-engineer` / `documentation-engineer-glm`, `docs-researcher` / `docs-researcher-glm` — material docs/API-version correction.

Do not dispatch a specialist simply because it exists.

## 4.3 Final reviewer requirement

If Codex changes application source/config/tests:

1. Main GPT-5.6 Sol performs its own final defect-first review.
2. Run one read-only final reviewer against the exact final diff using `code-reviewer` **or** `code-reviewer-glm`, whichever is available/healthy. The user explicitly authorizes either variant for this run.
3. If it returns a valid finding, fix minimally, run the affected regression plus appropriate final gates, then re-review if needed.
4. Maximum three successful final-review iterations. Stop early on `No findings.`
5. Coderabbit may provide an additional read-only signal if available locally, but it does not replace the project final-review step and must not publish comments unless doing so becomes necessary to the explicitly authorized GitHub workflow.

---

# 5. Phase A — Establish a trustworthy baseline

Codex may combine these checks, but it must establish the facts before broad testing.

- [ ] Resolve Git root, branch, HEAD, upstream, status, remote, and current diff.
- [ ] Confirm protected `ui-flow-screenshots/` state before any test cleanup.
- [ ] Read `package.json`, lockfile, `playwright.config.ts`, `.github/workflows/ci.yml`, Supabase config/migrations/tests, Vercel config, and release verifier.
- [ ] Confirm local operator versions or compatible installed versions:
  - Node `22.x`
  - npm compatible with `10.9.3`
  - Playwright `1.62.1` project dependency
  - Supabase CLI
  - Vercel CLI
  - GitHub CLI
- [ ] Inventory Codex tools/MCPs/plugins/hooks and classify them `USE/PROBE/BLOCKED/UNAVAILABLE`.
- [ ] Use codex-lsp `status` and semantic symbol/reference tools on at least the Research API, comparison scoring, Guide assessment, proxy/security boundary, and persistence/auth boundary.
- [ ] Use Serena or equivalent code intelligence to cross-check one or more complex ownership/reference paths where LSP or lexical search alone could miss impact.
- [ ] Inspect the newest relevant GitHub CI run before rerunning equivalent large local matrices.

### Baseline decision

If current HEAD has no executable changes since a fully green CI run, do **not** immediately rerun every heavy browser test. Proceed with focused risk testing, local Supabase verification, browser visual QA, and final gates. If executable code is changed during this plan, escalate to the final full gates described later.

---

# 6. Phase B — Requirements, architecture, and contract audit

Use the main agent plus `requirements-traceability`, `code-mapper`, codex-lsp, Serena, and targeted source reads.

Check that implementation still matches the product contract:

## Research

- supported catalog identity and aliases;
- 30 university / 45 program / 11 country bounded catalog contract;
- category planning and direct official program source behavior;
- Tavily -> Brave -> direct fallback boundaries;
- DNS-pinned retrieval, redirects, MIME/byte/time bounds, SSRF protections;
- extraction/reconciliation schema closure and evidence provenance;
- source-gap semantics;
- 240-second application deadline under the 300-second host cap;
- caller cancellation vs timeout ownership;
- raw platform/WAF 429 and 504 classification before JSON parsing;
- no automatic retry storm;
- strict public dossier/browser validation;
- no provider credentials/provider internals in browser state.

## Compare

- 2–4 compatible targets;
- relative 0–100 slider values and positive-total normalization;
- all-zero priority failure before Research dispatch;
- score/coverage gates and suppression when evidence is insufficient;
- source-gap evidence remains non-definitive;
- immutable batch ownership, cancellation, stale response protection, retry behavior;
- exact target-scoped evidence refs and no cross-dossier ID collision.

## Guide

- applicant values remain local to Guide and excluded from `/api/research`/providers;
- exact registry and evidence/type/unit/currency/period gates;
- no fuzzy equivalency, admission probability, GPA/test/currency conversion, or invented requirements;
- local civil assessment date behavior;
- risks/checklist/timeline derive only from valid evidence or clearly generic manual actions;
- source-gap/conflicting/outdated/inferred/anecdotal/unknown evidence remains non-definitive;
- immutable request ownership, profile-only dossier reuse, refresh/retry rules.

## Auth / Saved snapshots

- anonymous core modes remain usable without account;
- browser/server Supabase separation;
- server-derived identity, no caller user ID ownership;
- private table RLS + minimum grants;
- no ordinary UPDATE path;
- immutable/versioned saved artifacts and bounded payload/count;
- revalidation on read;
- memory-only single-consume restore handoff;
- no private state in URL/localStorage/sessionStorage/IndexedDB/Cache Storage/service worker;
- no provider transmission of applicant/account/private saved data.

Only add implementation/tests for a gap when the gap is real and material to the current MVP/hackathon release.

---

# 7. Phase C — Static and deterministic application verification

Use codex-lsp as a **fast diagnostic**, not as completion proof.

## 7.1 Fast semantic/static gates

On the current stable revision or after each meaningful source fix:

- codex-lsp diagnostics on touched TypeScript/TSX files;
- LSP find-references/change-impact check for modified exported symbols or contracts;
- `npx tsc --noEmit` when TypeScript source/contracts changed;
- `npx eslint .` after source/test/config changes;
- `node scripts/verify-release-config.mjs --profile=ci` for release/config changes;
- `scripts/verify-workspace.ps1` after governance/repository setup/doc contract changes;
- `git diff --check` before finalizing a change set.

Do not run full type/lint repeatedly after every tiny edit if focused LSP diagnostics already identify the immediate issue; run the repository gate once after the affected fix batch stabilizes.

## 7.2 Vitest strategy

Use **focused first, full last**:

- For Research changes, run the affected Phase 2/3/6B test files only.
- For Compare changes, run Phase 4 tests plus the exact affected lifecycle/scoring unit paths.
- For Guide changes, run Phase 5 tests plus affected Phase 6 privacy/persistence tests.
- For Auth/Saved changes, run Phase 6A tests and pgTAP/local browser flow.
- For catalog changes, run Side Phase catalog + Phase 3A + binding/restore regressions.

Run `npx vitest run` **once on the final stable executable revision** if any executable source/config/test changed. If no executable code changed and the exact current HEAD already has fresh green CI including full Vitest, the main agent may rely on that fresh CI evidence plus focused final checks rather than duplicating it locally.

Never increase retries to hide a failure.

---

# 8. Phase D — Browser and UI testing with Playwright as the main surface

Use both the existing `@playwright/test` suites and Playwright MCP/CLI/manual browser automation intelligently.

## 8.1 Core automated browser smoke

The existing CI critical set is the minimum automated browser gate:

```text
tests/e2e/research-evidence.spec.ts
tests/e2e/research-races.spec.ts
tests/e2e/compare-scoring.spec.ts
tests/e2e/compare-lifecycle.spec.ts
tests/e2e/guide-assessment.spec.ts
tests/e2e/guide-lifecycle.spec.ts
```

Keep `--retries=0`.

If a defect is found in form/accessibility/responsive/security behavior, run only the corresponding nearby spec while iterating.

Do not automatically run all 20+ E2E specs three times. Run the complete relevant browser matrix only once if broad executable changes justify it.

## 8.2 Interactive Playwright MCP/CLI flow

Use a real Chromium session and fresh snapshots after navigation or major DOM changes. Exercise a concise judge-style path:

1. Home -> Research.
2. Select a supported university/program.
3. Verify aligned fields, category selection, validation, loading/error/result states.
4. Inspect evidence dialog and source-gap/unknown/conflict presentation using deterministic fixtures or existing test controls.
5. Navigate to Compare; verify two targets, category selection, priority sliders, visible values, keyboard arrow operation, normalization behavior, score suppression/gap UI, evidence inspection.
6. Navigate to Guide; verify applicant fields, title-cased qualification labels, desktop alignment, mobile stacking, assessment states, checklist/timeline, evidence dialog.
7. Confirm navigation during pending work does not leave stale UI or console errors.

Use stable Playwright refs from fresh snapshots; do not rely on stale element IDs.

## 8.3 Responsive/accessibility/visual QA

At minimum inspect:

- desktop around 1440×900/1000;
- mobile around 390×844;
- keyboard-only navigation through the primary form/actions/evidence dialog;
- visible focus indication;
- no horizontal overflow;
- no clipped labels/fieldset legends/title text;
- no overlapping controls;
- no accidental live-region/status duplication;
- readable source/evidence warnings;
- no broken loading/disabled states.

Use the browser/chrome/computer-use plugin surfaces for one independent human-like visual pass if they are available. If Figma is accessible, compare only major layout/tokens/intent; do not redesign the product because of pixel-level differences.

Take screenshots/traces only when they help prove or diagnose a defect. Store disposable browser artifacts under the existing output/test-result conventions and clean them after they no longer have evidence value.

## 8.4 Browser network/security observation

During the interactive pass, inspect:

- no unexpected third-party scripts or analytics;
- no applicant/profile markers in Research/provider-bound requests;
- no provider key names/internal model identifiers in browser responses/bundles;
- no private saved payload in URL or browser persistence;
- cancellation/429/504 UI does not reflect hostile platform bodies;
- no duplicate/fan-out Research dispatch from one user action;
- console/page errors and warnings.

---

# 9. Phase E — Local Supabase as the main persistence/Auth test environment

Use the **Supabase CLI** as the authoritative lifecycle surface and `MCP_DOCKER` only as complementary container evidence.

Recommended one-pass local stack sequence on a stable revision:

1. `supabase start`
2. `supabase db reset`
3. `supabase db lint`
4. `supabase db advisors --local`
5. `supabase test db`
6. `node scripts/run-playwright-local-supabase.mjs tests/e2e/auth-saved.spec.ts --retries=0`
7. inspect relevant local container health/logs only if a failure needs diagnosis
8. `supabase stop --no-backup`

Validate:

- migrations recreate cleanly from zero;
- pgTAP/RLS/ownership tests pass;
- forged owner/cross-user access fails;
- no anonymous private CRUD;
- no ordinary UPDATE path;
- row cap/size/bounded-list behavior;
- Magic Link/PKCE through local Mailpit;
- sign-out/account switching clears memory-only private state correctly;
- saved artifact validation and current-catalog rebinding;
- profile/save actions do not trigger Research/provider traffic;
- no private state in browser persistence channels.

Do not link or mutate a hosted Supabase project merely to make this final test more “real.” The judge-facing hosted release intentionally has Auth/save disabled.

---

# 10. Phase F — Security, privacy, dependency, and abuse-control review

Use the `codex-security` plugin/skill plus the `security-auditor` subagent, secret scanning, browser evidence, and existing tests.

## 10.1 Security review focus

Prioritize actual attack surfaces:

- Research SSRF/DNS rebinding/redirect/IP classification;
- untrusted HTML/text normalization;
- prompt injection content treated as data;
- provider error/body sanitization;
- same-origin mutation protection;
- CSP nonce and `connect-src` closure;
- XSS-shaped university/evidence/profile text;
- applicant/provider non-transmission;
- Supabase ownership/RLS;
- saved-artifact tampering/revalidation;
- WAF/platform 429/504 handling;
- secrets and provider internals in tracked/client/deployed output;
- dependency vulnerabilities.

Do not produce speculative vulnerability findings without a reachable path.

## 10.2 Secret and bundle scan

Without printing secret values:

- verify `.env.local` and other private env files remain ignored;
- scan tracked/staged files for credential patterns;
- compare configured local provider values against built/deployed client bundles by equality/hash-safe local comparison without logging the values;
- check browser bundles for provider key names/internal identifiers;
- confirm no browser source maps/sourceMappingURL if release policy still forbids them.

## 10.3 Dependency/config audit

Run once on the stable revision:

- `npm audit --omit=dev`
- release verifier
- inspect package/lock Node 22 contract
- inspect GitHub workflow permissions and immutable Action pins
- verify no CI live-provider/deployment secrets or automatic Production deployment.

A low-value dependency upgrade is not part of final testing unless it fixes a concrete vulnerability or breakage.

---

# 11. Phase G — Reliability and performance without benchmark theater

Use `performance-engineer`, browser traces, Node REPL, and existing runtime telemetry only where useful.

Look for:

- duplicate Research requests;
- retry/fallback dispatch after cancellation/deadline;
- unbounded loops/queues;
- needless large client payloads;
- obvious repeated rerenders or UI jank in sliders/forms/dialogs;
- slow catalog/form rendering;
- pathological test waits;
- memory/resource leaks obvious from repeated navigation;
- unnecessary browser storage/service workers.

Prefer condition-based waits in tests. Do not add arbitrary sleeps except when the timing itself is the behavior under test and the reason is documented.

Do not add a new observability stack, Lighthouse CI system, synthetic benchmark framework, or performance database for this final pass.

If the app feels responsive and there is no evidence of a meaningful performance regression, record that and move on.

---

# 12. Phase H — Hosted Vercel/GitHub release verification

Use **Vercel CLI as the main hosted operator tool**, with Vercel plugin and GitHub CLI/plugin as complementary evidence.

Begin with read-only inspection, then use the explicit task-completion authorization in Section 1.3 for only the GitHub/Vercel mutations that are necessary to correct and publish the verified final release state.

## 12.1 GitHub/CI

Verify:

- public repository/default branch/current HEAD;
- current workflow definition remains least privilege;
- newest relevant CI run and exact head SHA;
- application and local-Supabase job conclusions;
- no secret-bearing logs or accidental artifacts.

Do not create issues/PRs/releases merely for this test.

## 12.2 Vercel deployment/config

Using bounded Vercel CLI/API inspection, verify:

- canonical alias resolves to the intended Production deployment;
- deployment state `READY`/production;
- Node `22.x`;
- Research function cap/cancellation configuration;
- deployment metadata and source SHA;
- expected environment **names/presence only**, not secret values;
- Tavily/Brave and Groq/OpenRouter hosted configuration remains present;
- Gemini and Supabase browser/Auth vars remain intentionally absent unless product policy changed;
- exact single WAF Research rule remains enabled at 20/60s/IP with 429;
- no unexpected second rate limiter/rule;
- recent runtime/build logs contain no material unexplained error/5xx pattern.

Do not print or pull secret values.

## 12.3 GitHub ↔ Vercel integration and public repository website link

The user explicitly requires the existing GitHub repository and Vercel project to be connected as part of final completion.

Codex must:

1. Inspect the current Vercel project Git integration using the current Vercel CLI/plugin/API surface rather than assuming it is connected because prior CLI deployments exist.
2. Verify the intended repository is exactly `PracticalSwan/UniProof` and the intended production branch is `main`.
3. If the integration is missing, detached, or points elsewhere, connect the **existing** Vercel UniProof project to `https://github.com/PracticalSwan/UniProof` using the supported current Vercel Git-integration command/API. Inspect `vercel git --help` or current official Vercel documentation if command syntax is uncertain; do not create a duplicate Vercel project.
4. Verify the connection after mutation from both sides when practical: Vercel project Git metadata and GitHub deployment/check integration should identify the intended repository/project.
5. Inspect the GitHub repository’s public website/homepage metadata. If the canonical production URL is not already shown, set the repository homepage/website URL to `https://uniproof-beta.vercel.app` using the current GitHub CLI/API and verify the resulting `homepageUrl`/About link from GitHub.
6. Ensure the README still exposes the canonical live site in an obvious release/demo location; update it only if the link is missing, stale, or misleading.
7. If connecting Git integration or pushing the final commit automatically triggers a Vercel deployment, wait for the deployment to reach a terminal state and verify it rather than launching a duplicate manual deploy.
8. If no automatic deployment occurs, redeploy manually **only when necessary**: executable code/config changed, the canonical Production deployment is stale/broken, or the integration correction requires a fresh deployment to establish the intended release state.
9. After any new Production deployment, verify the exact source SHA/deployment metadata, canonical alias, WAF, headers, logs, and browser smoke before claiming it is final.

Do not infer that a GitHub↔Vercel connection succeeded merely because a URL exists. Verify the actual repository/project integration and the public GitHub website link.

## 12.4 Production browser/header smoke

Without consuming Research quota, verify:

- `/`
- `/research`
- `/compare`
- `/guide`

for HTTP success and expected browser policy:

- nonce CSP;
- `connect-src 'self'` in anonymous hosted mode;
- no production script `unsafe-eval` / permissive script policy;
- private/no-store application caching;
- HSTS supplied by Vercel;
- `nosniff`;
- `DENY` framing policy;
- no-referrer;
- COOP/CORP and restrictive Permissions Policy;
- same-origin client scripts;
- no Vercel toolbar/analytics injection if release policy still excludes them;
- no console/page errors in a normal judge navigation pass.

Use Playwright/browser/chrome rather than only `curl` when rendered behavior matters.

---

# 13. Phase I — Conditional live Research tests with five additional calls available

This phase is **optional by design**. The user has authorized up to **five additional accepted live Research executions for this final-testing run**, on top of the 3 historical Phase 6C executions.

Before each live call, the main agent must answer all four questions:

1. What exact unresolved Production behavior are we testing?
2. Why can deterministic/local tests not answer it, or why is one real provider-path confirmation materially useful to final release confidence?
3. What observable result will distinguish the suspected causes or confirm the release behavior?
4. How many of the **five additional accepted calls** remain for this final-testing run?

Only proceed if all four answers are clear.

## Recommended prioritization if live calls are genuinely needed

Codex may use anywhere from **0 to 5 additional accepted calls**. Preserve unused calls whenever the hypothesis is already resolved.

### Additional call 1/5

Prefer the highest-value unresolved Production hypothesis, ideally a supported program/category that exercises the official direct-program-source path and can distinguish retrieval/source-resolution failures from provider extraction/reconciliation failures.

### Additional call 2/5

Use only if the first call exposes a concrete second hypothesis, a materially different fallback path needs verification, or a verified fix needs one live confirmation.

### Additional calls 3/5–5/5

Reserve these for genuinely distinct causes or fix-verification needs. Do not spend them simply because the allowance exists. Repeated calls to the same unchanged target/path require a clear new hypothesis.

For every accepted call, capture only the sanitized evidence necessary for diagnosis/reporting: target/category, lifecycle/result class, source/claim counts where safe, failure classification, and whether the expected path was exercised. Do not persist raw provider secrets or private data.

Stop immediately after the fifth additional accepted execution. The absolute accounting ceiling for this run is **3 historical + 5 additional = 8 cumulative accepted Research executions**.

Never make the final report imply successful live evidence extraction unless an accepted call actually produced usable evidence and the exact result was observed.

---

# 14. Defect remediation loop

When any check fails, Codex should use this loop rather than continuing blindly:

1. **Classify the evidence level** — source/static, unit, browser, DB, hosted config, live provider.
2. **Reproduce narrowly** with the smallest reliable case.
3. **Trace the root cause backward** through callers/contracts/state ownership; do not patch only the visible symptom.
4. Use LSP/Serena references and relevant subagent expertise where useful.
5. Decide whether the issue is:
   - real product defect;
   - security/privacy defect;
   - test defect/flakiness;
   - environment/tooling defect;
   - external provider variability;
   - stale documentation;
   - non-issue/expected limitation.
6. **Implement the smallest coherent fix** if the repository owns the cause.
7. Add or adjust one durable regression when it prevents recurrence; do not add five variants of the same assertion.
8. Run the focused regression and nearest integration boundary.
9. Run LSP diagnostics for touched supported files.
10. Continue the remaining plan; do not restart all testing from Phase A.
11. After all fixes stabilize, run the final gates once.

If a defect is external/provider-only and cannot be fixed safely in UniProof, preserve truthful partial/failure behavior instead of adding brittle hacks.

---

# 15. Final verification gates

The exact set may be adjusted to changed scope, but the final stable revision must have appropriate evidence from each applicable layer.

## If executable application code/config/tests changed

Run once after fixes stabilize:

- [ ] focused regressions for every fixed defect;
- [ ] `npx vitest run`;
- [ ] `npx tsc --noEmit`;
- [ ] `npx eslint .`;
- [ ] `npm run build`;
- [ ] `npm audit --omit=dev`;
- [ ] `node scripts/verify-release-config.mjs --profile=ci`;
- [ ] `scripts/verify-workspace.ps1` where applicable;
- [ ] critical Playwright browser smoke with retries zero;
- [ ] broader relevant Playwright specs only when changed scope warrants them;
- [ ] one local Supabase reset/lint/advisors/pgTAP/Auth-Saved pass if persistence/auth/database boundaries were touched or not otherwise freshly verified;
- [ ] secret/client-bundle scan;
- [ ] `git diff --check`;
- [ ] main-agent defect-first review;
- [ ] final read-only `code-reviewer` subagent.

## If no executable code changed

Do not manufacture work. Final evidence may consist of:

- fresh existing exact-HEAD CI;
- focused semantic/security/requirements audits;
- interactive Playwright/browser visual pass;
- local Supabase verification when desired for final confidence;
- read-only Vercel/GitHub Production inspection;
- secret/privacy checks;
- no valid unresolved findings.

A clean final test pass with no code changes is a valid result.

---

# 16. Phase J — Documentation, Git publication, CI, and final Production state

After testing/fixing is complete and the stable diff has passed the applicable final gates, Codex is explicitly authorized and required to finish the repository/release lifecycle rather than stopping at local verification.

## 16.1 Synchronize documentation before publication

Update only documentation whose source-of-truth facts changed. At minimum inspect:

- `README.md`
- `CHANGELOG.md`
- `AGENT_MEMORY.md` append-only
- `docs/planning/tasks.md`
- `docs/planning/phase-6-hardening-submission-readiness.md`
- `docs/planning/phase-6-requirements-traceability.md`
- `docs/requirements.md`
- `docs/design.md`
- `docs/security.md`
- `docs/security-threat-model.md`
- `docs/operations/vercel-production.md`
- `docs/hackathon.md`

Document actual findings/fixes, final test evidence, quota use, final repository SHA, Vercel/Git integration state, and final Production state. Do not rewrite historical append-only memory/lessons to make history look cleaner.

`final_testing_plan.md` itself is an intended project artifact for this final process and may be included in the final commit. Never stage `ui-flow-screenshots/`.

## 16.2 Final Git review and commit

Before committing:

1. verify real Git root/branch/remotes/upstream;
2. inspect complete working-tree and staged diffs;
3. ensure unrelated user work is excluded;
4. run `git diff --check` / staged equivalent;
5. run the project secret scan against the exact staged set without printing secrets;
6. ensure test/debug residue is removed or deliberately retained as sanitized regression evidence;
7. stage only intended project files.

Then create a clear normal forward commit on the existing branch. Do not amend/rewrite published history or force-push.

## 16.3 Push and require exact-SHA CI

Push the final commit to the existing GitHub repository/default branch. Then:

- verify `origin/main` equals the intended final commit SHA;
- identify the GitHub Actions run for that exact SHA;
- wait with bounded/status-based polling rather than a long blind watch;
- require both the application and local-Supabase jobs to succeed before treating the Git revision as final;
- if CI exposes a real defect, diagnose/fix minimally, recommit/push, and repeat only the affected/final gates needed for the new SHA.

Do not call a local pass equivalent to a green remote CI run.

## 16.4 Connect GitHub to Vercel and expose the live website on GitHub

After the final Git state is published, execute Section 12.3 completely:

- connect `PracticalSwan/UniProof` to the existing UniProof Vercel project if needed;
- verify production branch `main` and integration state;
- ensure the GitHub repository About/homepage website field shows `https://uniproof-beta.vercel.app` if Vercel/GitHub did not populate it automatically;
- verify the public GitHub repository page exposes the live site;
- preserve the existing repository rather than creating a duplicate project/repository.

## 16.5 Redeploy only when necessary, but finish a changed executable release

If executable application/config/runtime behavior changed during final testing, Codex must not stop with a pushed but undeployed fix. After exact-SHA CI is green:

1. first check whether the verified GitHub↔Vercel integration has already created/promoted the correct deployment;
2. if yes, verify that deployment and do not create a duplicate;
3. if no, deploy/promote the final verified SHA using the current supported Vercel CLI/plugin workflow;
4. verify canonical alias, exact source SHA, Node/function settings, WAF, security headers, browser bundle/privacy, logs, and judge-route smoke;
5. update release docs/memory if the final deployment identifiers/status changed materially.

If the final published change is documentation/test-plan-only and Production already serves the correct executable state, do not manually redeploy merely to make repository HEAD and executable SHA identical. If Git integration automatically deploys the documentation commit anyway, verify that new deployment and record the resulting truth.

Any final documentation update needed **after** deployment should be narrowly scoped. Avoid creating an endless commit→deploy→document-SHA loop: record immutable deployment evidence in the final report when self-referential commit metadata cannot be embedded without moving HEAD again.

## 16.6 Prepare the live Devpost draft, but do not submit

After the final repository/Production facts are stable enough to avoid drafting against stale information, Codex is authorized to use the existing authenticated Devpost/browser session to create or edit/save the UniProof project draft. Treat Devpost as an external draft workspace, not as a final publication action.

Before editing the live draft:

- re-check the current hackathon page/rules/deadline/required fields from Devpost or authoritative current sources;
- reconcile `docs/submission/devpost-draft.md`, `docs/submission/demo-script.md`, `docs/submission/demo-checklist.md`, `docs/hackathon.md`, the final GitHub repository, and the final Vercel release;
- verify that every statement about features, AI/provider use, evidence, hosted Auth, live-provider limitations, testing, GitHub, and Production matches observed behavior;
- inspect every asset before upload for secrets, private/user data, misleading test fixtures, or protected material.

Codex may fill/edit/save all available **non-video** Devpost fields, including when present:

- project name/title;
- tagline/short description;
- detailed project story/description;
- problem, solution, architecture, AI usage, challenges, accomplishments, lessons, and next-steps text;
- categories/tracks/tags;
- “Built With”/technology entries;
- public GitHub repository link;
- canonical live website/demo link `https://uniproof-beta.vercel.app`;
- team/project metadata that can be verified from the existing project/submission materials;
- cover/thumbnail/gallery images and captions using only intentionally public/sanitized release assets;
- any other ordinary draft field that is truthful, verifiable, and does not require the missing final video.

For images/media, prefer `docs/assets/screenshots/phase-6/` or another explicitly public sanitized release asset. **Never upload `ui-flow-screenshots/`, secret-bearing files, raw provider captures, local test artifacts, private user data, or screenshots that falsely imply live-provider success.**

The final video field must remain blank/unset unless the user later supplies the completed video. Do not fabricate a video URL, placeholder upload, or substitute clip.

Codex may use browser/chrome/computer-use or an available Devpost-capable browser/plugin workflow to save the draft. After editing, reopen/reinspect the draft where practical to verify that saved fields, links, formatting, and uploaded public assets render correctly.

Prefer drafting the live entry from the already-synchronized `docs/submission/devpost-draft.md` so the repository and Devpost do not diverge. If a material wording/field correction is discovered only while editing the live Devpost draft, mirror that correction back into the appropriate `docs/submission/` file, run the lightweight documentation/release checks, commit and push that docs-only correction, and verify the resulting CI before the final report. Do not manually redeploy Production merely for that docs-only synchronization unless the verified Git integration automatically deploys it or hosted release state otherwise requires correction.

**Hard stop:** do not click `Submit`, `Publish`, `Enter submission`, or any equivalent final submission action. Do not represent the project as submitted. The correct final state for this run is **Devpost draft prepared/saved, video pending, project unsubmitted**.

If Devpost authentication/session access is unavailable, do not request or expose credentials through logs/files. Keep `docs/submission/devpost-draft.md` fully synchronized and report the live-draft access blocker; this is the only acceptable fallback for the draft-editing step.

---

# 17. Completion criteria

Codex may call this final testing task complete when all of the following are true:

- no unresolved release-blocking correctness/security/privacy defect remains in the tested scope;
- every verified defect owned by the repository is fixed minimally or explicitly documented as a residual limitation;
- required tests for the final changed revision pass at the correct evidence level;
- Research/Compare/Guide judge flows are usable on desktop/mobile and evidence inspection works;
- local Supabase Auth/RLS/save behavior remains valid without claiming hosted Auth;
- Production configuration, WAF, headers, client privacy, deployment traceability, and GitHub↔Vercel integration are verified in their final state;
- live Research use remains within the **five additional accepted executions authorized for this final-testing run**, with cumulative accounting never exceeding **3 historical + 5 additional = 8 accepted executions**;
- no secret/private data has been exposed in logs/screenshots/commits;
- protected `ui-flow-screenshots/` is untouched/unpublished;
- docs/memory are updated only where verified behavior/status actually changed;
- no unnecessary dependency, subsystem, abstraction, or duplicate test framework was added;
- the main GPT-5.6 Sol agent completed its own review and, after substantive code changes, a final `code-reviewer` or `code-reviewer-glm` pass found no remaining valid issue or its findings were fixed;
- temporary test/debug residue created by this run is cleaned safely;
- final Git status/diff is inspected and unrelated user work is preserved;
- the intended final change set is committed and pushed to `PracticalSwan/UniProof`;
- the GitHub Actions run for the exact final pushed SHA is green before a changed executable release is considered final;
- the existing GitHub repository is connected to the existing UniProof Vercel project and the integration is verified;
- the GitHub repository homepage/About website field exposes `https://uniproof-beta.vercel.app` if it was not populated automatically;
- any necessary executable redeployment is completed and the canonical Production release is re-verified; unnecessary duplicate deployments are avoided;
- the Devpost draft has been created/opened and all accessible non-video fields are truthfully filled/updated/saved when authenticated access is available; the final video remains pending and the project remains unsubmitted;

---

# 18. Final report format for Codex

Keep the final report compact and evidence-based.

## Status

- `READY` — all applicable gates green; no unresolved material defect.
- `READY WITH LIMITATIONS` — product is releasable, but an external/provider/explicitly deferred limitation remains.
- `NOT READY` — a material verified defect remains unresolved.

## Report these items

1. **Changes/fixes** — only concrete changes, with files/behavior.
2. **Tools actually used** — native tools, native/GLM subagents, MCPs, plugins, hooks/CLIs; include `PROBE/N/A`, `BLOCKED`, or `UNAVAILABLE` for configured surfaces that were not materially applicable.
3. **Verification evidence** — tests/build/browser/Supabase/security/CI/Vercel with actual results.
4. **Live quota accounting** — historical 3 + `N` new accepted calls from this final-testing run, where `0 <= N <= 5`; maximum cumulative total 8; include the purpose and outcome of every new accepted call.
5. **Git publication truth** — final repository SHA, exact-SHA CI run/conclusion, and whether the final commit contains executable changes or documentation/testing-only changes.
6. **GitHub ↔ Vercel integration** — final connected repository/project, production branch, and verification evidence.
7. **GitHub website link** — confirm the repository About/homepage field exposes `https://uniproof-beta.vercel.app`.
8. **Production truth** — deployed executable SHA/deployment ID vs repository HEAD; never conflate a documentation-only commit with deployed code.
9. **Devpost draft status** — which non-video fields/assets were created or updated and saved, whether the live draft was re-verified, and an explicit statement that the video is still pending and the project was not submitted.
10. **Residual risks/limitations** — concise and concrete.
11. **Git/workspace state** — intended changes only; protected screenshots status.
12. **Next action** — only if something genuinely remains.

Do not produce a wall of test counts without explaining what those tests prove.

---

# 19. Efficient default execution order

Codex may change this order based on evidence, but this is the preferred starting sequence:

1. Governance + Git/tool/MCP/plugin inventory.
2. Parallel read-only subagent audits using whichever native/GLM variants are available and appropriate.
3. LSP/Serena architecture + requirements traceability pass.
4. Focused static/unit/security checks.
5. Playwright interactive judge flow + critical automated browser smoke.
6. One local Supabase lifecycle/pgTAP/Auth-Saved pass.
7. Vercel/GitHub/Production inspection, including Git-integration state and GitHub homepage metadata.
8. Conditional live Research call only if a concrete unresolved live hypothesis remains.
9. Minimal fix loop for verified defects.
10. Final stable full gates once, proportional to changed scope.
11. Main-agent review + final `code-reviewer` or `code-reviewer-glm` if substantive source changed.
12. Documentation/memory synchronization and task-local residue cleanup.
13. Final diff/secret review, commit, and push to `PracticalSwan/UniProof`.
14. Wait for exact-SHA GitHub Actions success; fix/re-push only for real failures.
15. Connect/verify GitHub ↔ Vercel and ensure the GitHub repository website field shows the canonical Production URL.
16. Verify any automatic Vercel deployment; manually redeploy/promote only when necessary, especially after executable changes.
17. Run the final Production smoke/config/log verification so the public facts used in submission copy are stable.
18. Open/create the live Devpost draft, fill/edit/save every accessible non-video field and sanitized public asset, verify the saved draft, leave the video field unfinished, and do not submit the project.
19. Give the concise READY / READY WITH LIMITATIONS / NOT READY report.

The executor is expected to think beyond this plan when the repository presents new evidence, but it must remain simple, causal, bounded, and release-focused.


---

# Final-testing execution record (2026-08-22)

- Accepted-call allowance for this plan: 5 additional Research executions; historical Phase 6C record remains 3/3.
- Rejected pre-execution request: Edinburgh Artificial Intelligence MSc / Research only, malformed internal target shape, HTTP 400 `invalid-request` in 743 ms. It did not enter accepted Research execution and is not charged.
- **Accepted final-testing call 1/5:** purpose was to verify that the repaired Production provider path terminates boundedly instead of reproducing the earlier ~161-second Edinburgh Research failure. Public request used `university-edinburgh`, `program-edinburgh-artificial-intelligence-msc`, category `research`.
- Outcome: HTTP 200 in 18,596 ms; one source, zero claims; `research` finalized `ready` with sanitized `provider-error` source gap and no category failure object. Exact-deployment runtime logs recorded the 200 request and no `/api/research` runtime error cluster was present in the observed hour.
- Interpretation: **bounded fail-closed behavior verified; successful live evidence production not claimed.** The repaired path avoids the prior multi-minute retry amplification under current provider pressure.
- Final-testing live quota used: **1/5**. Four additional calls remain unused because no further unresolved live-only hypothesis justifies spending them.
- Cumulative accepted accounting: **3 historical + 1 final-testing = 4 accepted executions**.
