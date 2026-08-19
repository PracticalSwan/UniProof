# Phase 6B Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED PROCEDURE: follow `AGENTS.md` model-specific delegation/review rules. Use TDD/systematic debugging and current primary documentation for Vercel/Supabase/provider behavior. Do not let a generic workflow authorize deployment or other external changes.

**Goal:** Make the Phase 0–6A application safe and predictable for public hosting by adding a whole-run deadline, production-aware failure handling, CI/release gates, and an exact durable rate-limit/deployment configuration plan without deploying or mutating hosted services in this batch.

**Architecture:** Keep the application-level Research pipeline authoritative and bounded before platform termination, handle platform-generated failures explicitly, define Vercel WAF as the deployment-layer distributed abuse control, preserve nonce CSP/auth refresh, and add least-privilege CI using fixtures/local Supabase only. External Vercel/Supabase configuration is verified/read-only where possible and applied only in Phase 6C after explicit authorization.

**Tech Stack:** Next.js 16.3.1 Node runtime, Vercel Functions/Firewall, Supabase local stack, GitHub Actions, npm/Node 22, Vitest, Playwright, existing provider adapters.

**Spec:** `docs/planning/phase-6-hardening-submission-readiness.md`, especially Sections 5, 7, 8, and 9.

## Global constraints

- Phase 6A must be locally complete and its final regression matrix green before starting 6B.
- No public/preview deployment in this batch.
- No Vercel project creation/linking/env/domain/firewall mutation in this batch without separate explicit authorization.
- No hosted Supabase mutation.
- No live provider requests unless separately authorized; default verification uses injected deterministic transports/fixtures.
- No CI workflow may use production provider keys, hosted database credentials, or deploy privileges.
- No automatic GitHub/Vercel deployment workflow.
- Do not replace current deterministic partial-result semantics with generic 500/timeout behavior.
- Do not weaken provider attempt budgets to make tests pass.
- Do not add an in-memory token bucket and call it distributed rate limiting.
- Preserve `ui-flow-screenshots/`.

---

## Task 1 — Revalidate mutable platform/provider assumptions before code

**Read first:** canonical Phase 6 spec, design/security docs, `/api/research`, Phase 2 orchestration/budget modules, proxy/browser policy, Playwright harness, package/Next config.

**Current-source checks:**

- [ ] Vercel current maximum-duration mechanism and selected account-plan limits.
- [ ] Whether Fluid Compute is enabled/expected and whether the selected plan supports the planned 240s function maximum.
- [ ] Vercel current WAF rate-limit availability, pricing, fixed-window semantics, keys/actions, and whether configuration is dashboard/API/CLI-accessible.
- [ ] Vercel current cancellation semantics/configuration for Node functions.
- [ ] Current provider endpoints/models/privacy/free-route rules for Gemini/Groq/OpenRouter/Tavily/Brave.
- [ ] Current Supabase/Auth behavior introduced in 6A.

If any assumption materially changed, update `docs/planning/phase-6-hardening-submission-readiness.md` before implementation. Never code to stale platform limits.

---

## Task 2 — Add an application-owned whole-Research deadline

**Inspect exact orchestration ownership before editing. Expected owners:**
- `app/api/research/route.ts`
- `lib/research/orchestration/*`
- existing shared timeout/cancellation utilities

**Create/modify only at the smallest coherent layer:**
- one central whole-run deadline constant/config;
- deadline signal composition helper only if existing `AbortSignal` handling cannot express caller-cancel + server-deadline safely;
- targeted tests under `tests/`.

Planned limits:

- [ ] application whole-run deadline: 210,000 ms;
- [ ] Vercel route export `maxDuration = 240` seconds;
- [ ] all existing shorter provider/stage deadlines remain unchanged unless a current-source conflict is proven.

Required semantics:

- [ ] start whole-run clock only after request validation/target resolution reaches the accepted Research dispatch boundary documented in the spec;
- [ ] caller cancellation and server deadline are distinct reasons internally but both terminally stop new provider/discovery work;
- [ ] whichever aborts first owns cancellation; later timers/listeners are cleaned up;
- [ ] abort signal propagates through target resolution, discovery, retrieval, extraction, reconciliation, explanation, and finalization as currently supported;
- [ ] after whole-run deadline, do not start a new retry, fallback provider, DNS lookup, retrieval, extraction task, semantic task, or explanation request;
- [ ] preserve validated completed evidence/categories and truthfully mark unfinished categories operationally incomplete/partial rather than unknown;
- [ ] explanation fallback remains deterministic and cannot delay terminal evidence finalization beyond deadline;
- [ ] timer/listener resources are cleared on every success/error/cancel path;
- [ ] no `Promise.race` branch leaves uncontrolled work running after the response.

### RED/GREEN cases

- [ ] deadline before any discovery result;
- [ ] deadline after one category complete and another pending;
- [ ] deadline during DNS/retrieval;
- [ ] deadline during provider body read;
- [ ] deadline between transient failure and retry dispatch;
- [ ] deadline between Gemini failure and Groq fallback;
- [ ] deadline during explanation does not mutate evidence;
- [ ] caller abort wins before deadline;
- [ ] deadline wins before later caller abort;
- [ ] completion at/just before deadline;
- [ ] timer cleanup verified with fake timers/open-handle check where practical;
- [ ] no post-terminal provider-attempt history record implies an HTTP call that never occurred.

---

## Task 3 — Make deployment-generated 429/timeout failures first-class client outcomes

**Inspect:**
- Research client transport/public error contracts;
- Compare sequential Research transport/error mapping;
- Guide Research transport/error mapping;
- existing UI retry/preserved-result behavior.

**Modify:** owning Research public transport/error contract and consumers only as necessary.

Requirements:

- [ ] Recognize HTTP 429 even when Vercel WAF returns a non-application body.
- [ ] Map 429 to one stable sanitized public code/message such as `rate-limited`; do not expose WAF internals/source IP/rule name.
- [ ] Respect a bounded valid `Retry-After` for display only if supplied; do not auto-loop/retry at browser level.
- [ ] Preserve prior Research/Compare/Guide results on rate-limit failure exactly as other recoverable refresh failures do.
- [ ] Compare stops/marks remaining targets according to existing batch failure policy without fan-out or rapid blind retry.
- [ ] Guide does not lose the applicant form/prior result.
- [ ] Recognize platform 504/non-JSON HTML/empty timeout responses as sanitized upstream/timeout failures rather than JSON parser crashes.
- [ ] Keep response-byte/content-type protections for application-owned success/error JSON.

**RED browser cases:** intercepted 429 JSON/HTML/empty body, 429 during second of four Compare targets, Guide refresh 429 with prior result, 504 during Research, repeated Retry click does not automatically spam requests.

---

## Task 4 — Prove hard platform timeout is not normal control flow

**Create deterministic timing acceptance tests:**

- [ ] simulate stage timings that approach 210s under fake/injected clocks without actually waiting minutes;
- [ ] prove application produces a terminal partial/failed result before 240s;
- [ ] prove no stage can intentionally set a timeout greater than remaining whole-run budget and then start after the budget;
- [ ] clamp bounded retry/backoff to remaining budget;
- [ ] prove response serialization/public dossier finalization cannot initiate new network work.

If observed normal deterministic fixture paths can exceed 210s because internal stage scheduling ignores remaining budget, fix scheduling rather than increasing the platform limit automatically.

---

## Task 5 — Define and test the Vercel WAF rule contract without publishing it

**Create:**
- `docs/operations/vercel-production.md`
- optional non-secret machine-readable example such as `docs/operations/vercel-waf-rule.example.json` only if it matches a current official API/export format; otherwise keep exact settings in Markdown rather than inventing config.

Document the planned rule:

- [ ] target only `POST /api/research` on the UniProof project;
- [ ] fixed window 60 seconds;
- [ ] count by source IP on the intended Vercel plan;
- [ ] initial threshold 20 requests/source/window;
- [ ] first publish in Log mode for observation;
- [ ] after normal-flow verification and explicit billable-use authorization, use Rate Limit with default 429 action;
- [ ] no broad site-wide rule that can block static assets/auth callbacks;
- [ ] no challenge requiring browser JS for API calls unless specifically tested and justified;
- [ ] record rollback/disable steps before enforcement.

**Local acceptance simulation:**

Create client/browser tests that model the 20/60s external outcome without pretending they exercise Vercel itself:

- [ ] normal single Research;
- [ ] four-target Compare;
- [ ] Guide Research;
- [ ] one refresh/retry path;
- [ ] 21st synthetic request receives rate-limit response and causes no provider call in the simulated boundary;
- [ ] shared-source/NAT risk is documented as an operational tradeoff.

Do not claim the WAF is active until Phase 6C observes it on Vercel.

---

## Task 6 — Production environment contract and fail-closed configuration

**Inspect/modify:**
- `lib/env/public.ts`
- `lib/env/server.ts`
- setup/provider scripts only if needed
- `docs/operations/vercel-production.md`

Requirements:

- [ ] classify variables as public, server-only provider, optional auth, deployment metadata;
- [ ] anonymous static/core UI build must not crash solely because optional Supabase Auth config is absent if production auth is intentionally disabled;
- [ ] account/save UI is enabled only when the required Supabase public/auth configuration is valid;
- [ ] live Research stays explicit through `UNIPROOF_RESEARCH_MODE` and current provider configuration semantics;
- [ ] never require `SUPABASE_SERVICE_ROLE_KEY` if runtime paths do not use it;
- [ ] invalid provider keys are not detected by echoing/printing them;
- [ ] no server secret gets a `NEXT_PUBLIC_` alias;
- [ ] Preview and Production configuration are documented separately;
- [ ] production canonical app URL cannot silently default to localhost.

**RED cases:** malformed Supabase URL/key, missing auth config with auth disabled, partial auth config, missing production app URL, secret variable accidentally imported by client graph.

---

## Task 7 — Production TLS/HSTS/header policy

**Inspect:**
- `next.config.ts`
- `proxy.ts`
- `lib/security/browser-policy.ts`
- existing CSP/header E2E.

**Plan/implementation:**

- [ ] keep nonce CSP generated per HTML request;
- [ ] preserve auth `Set-Cookie` behavior introduced by 6A;
- [ ] add HSTS only conditionally for actual Production HTTPS responses, never local dev/HTTP;
- [ ] initial header exactly `Strict-Transport-Security: max-age=31536000` unless current deployment review justifies a different bounded value;
- [ ] do not use `includeSubDomains` or `preload` in the hackathon release by default;
- [ ] do not attempt to set policy for parent `vercel.app`;
- [ ] verify canonical origin redirect/host behavior in 6C rather than assuming config.

**Tests:** development lacks HSTS; built production fixture with simulated HTTPS/production has intended header where implementation can model it; CSP still has no production script unsafe directives; header composition survives auth refresh.

If Next static headers cannot safely distinguish the real production HTTPS environment, defer actual HSTS injection to a verified Vercel/project route configuration in 6C and keep this as an explicit release gate rather than shipping a misleading local conditional.

---

## Task 8 — Add least-privilege CI with no deployment

**Create:** `.github/workflows/ci.yml`

Before implementation, inspect current official action versions and immutable commit SHAs where practical.

Workflow design:

- [ ] triggers: pull request and pushes to `main` as appropriate; no workflow_dispatch that mutates external state;
- [ ] `permissions: contents: read` at top level;
- [ ] concurrency group cancels superseded runs on the same ref;
- [ ] explicit `timeout-minutes` per job;
- [ ] Node 22 and npm lockfile cache;
- [ ] `npm ci` from `package-lock.json`;
- [ ] TypeScript, ESLint, Vitest, `next build`, production dependency audit/workspace verifier;
- [ ] local Supabase migration reset/lint/pgTAP in a dedicated job or sequence, never hosted project;
- [ ] Playwright browsers installed deterministically and core fixture/intercepted E2E run with retries zero;
- [ ] production-built Playwright matrix run if duration fits the hackathon CI budget; if split into jobs, every required group is explicit and none is silently omitted;
- [ ] no provider live mode;
- [ ] no production env secrets;
- [ ] no Vercel/Supabase remote deploy command;
- [ ] failure artifacts are sanitized and narrowly selected;
- [ ] never upload `.env*`, Supabase local generated secrets, auth cookies/session state, private profile fixtures, raw traces with secrets, or `ui-flow-screenshots/` as mutable output.

**CI failure cases to validate:** test failure causes red workflow; missing generated Playwright browser does not fallback silently; local Supabase startup failure is visible; audit failure is not ignored unless a documented severity policy explicitly permits it.

---

## Task 9 — Add release verification scripts only where deterministic and safe

Prefer existing scripts. Add a new script only if it removes repeated error-prone manual checks.

Potential exact paths if justified:
- `scripts/verify-release.mjs`
- `scripts/scan-client-boundary.mjs`

Allowed deterministic checks:

- [ ] required release files/license/docs exist;
- [ ] forbidden provider secret variable names in client production graph;
- [ ] built static contains no configured secret values (values supplied privately at runtime, never printed);
- [ ] production CSP static assertions;
- [ ] no dev-only test seam imported into production graph;
- [ ] no `.env`/Playwright auth state/release screenshot private marker in Git-tracked set;
- [ ] Phase 6 migration/test paths exist when persistence is enabled.

Do not create a script that logs environment values, probes remote accounts, deletes residue broadly, or claims live verification from static checks.

---

## Task 10 — Requirements traceability against the exact MVP

**Create:** `docs/planning/phase-6-requirements-traceability.md`

For every bullet/acceptance item in `docs/requirements.md`, record:

- requirement ID/short text;
- implementing files/modules;
- unit/integration evidence;
- dev browser evidence;
- built browser evidence;
- deployment/live evidence required or not applicable;
- status: implemented/verified-local/verified-live/blocker;
- notes/residual risk.

Mandatory attention:

- [ ] 10–15 university supported scope as actually cataloged;
- [ ] Research evidence/source/unknown/conflict/freshness/direct official links;
- [ ] Compare 2–4 targets/weights/coverage/suppression/no ranking;
- [ ] Guide six states/privacy/no probability/checklist/timeline;
- [ ] anonymous judge flow;
- [ ] optional save/auth if implemented;
- [ ] responsive/keyboard;
- [ ] provider failure/partial behavior;
- [ ] deployed no-critical-error requirement remains `verified-live` pending 6C, never marked complete locally.

Any unexplained MVP requirement gap is a 6B blocker. Do not alter requirements merely to make traceability green unless product scope is intentionally changed and justified.

---

## Task 11 — Current-provider policy/privacy release review

Use only primary provider documentation. No live key use required.

For each configured provider, create/update a concise table in the Phase 6 spec or `docs/operations/provider-release-check.md`:

- [ ] endpoint and model/route;
- [ ] free/paid eligibility assumption;
- [ ] retention/data-control flag used by UniProof;
- [ ] whether applicant/private data is sent (must be no);
- [ ] current quota caveat;
- [ ] failure/fallback behavior;
- [ ] exact verification date/source.

If a provider no longer supports the required privacy/capability/free route, mark release blocker or plan a bounded provider-order change. Do not switch models/routes during a documentation check without updating design/requirements and tests.

---

## Task 12 — Full local browser acceptance expansion

Re-run/extend all core flows on 6B source:

### Research
- [ ] success/partial/unknown/conflict/outdated;
- [ ] provider/network/timeout/rate-limit sanitized errors;
- [ ] cancellation and refresh with preserved prior result;
- [ ] evidence/source/official links;
- [ ] max-content stress.

### Compare
- [ ] 2/3/4 targets;
- [ ] all weights/category coupling;
- [ ] incomplete target and 429 mid-batch;
- [ ] cancellation/retry/stale ownership;
- [ ] evidence collisions;
- [ ] responsive/mobile.

### Guide
- [ ] all six states;
- [ ] saved/anonymous profile privacy after 6A;
- [ ] partial Research/rate-limit/timeout;
- [ ] deadlines/budget/scholarship/manual evidence;
- [ ] cancellation/reassessment;
- [ ] responsive/mobile.

### Auth/Saved
- [ ] signed-out core flows;
- [ ] sign-in local session;
- [ ] save/list/load/delete;
- [ ] cross-account isolation;
- [ ] no storage/provider leakage.

### Security/browser
- [ ] CSP violations zero;
- [ ] XSS-shaped data inert;
- [ ] no unexpected third-party requests;
- [ ] no critical console/page errors;
- [ ] keyboard and reduced motion;
- [ ] source links use safe attributes/referrer policy.

Use the established viewport matrix and content stress. Do not navigate to real external evidence links during automated acceptance.

---

## Task 13 — Lifecycle stress and resource-leak checks

Run at least five repetitions with Playwright retries zero for:

- [ ] Research cancel/deadline/retry;
- [ ] Compare multi-target cancellation/rate-limit ownership;
- [ ] Guide post-response cancellation/reassess;
- [ ] Auth refresh/signout/account switch/private request races;
- [ ] saved-artifact capacity/concurrent save as appropriate.

After tests:

- [ ] inspect task-created Next/Supabase/test processes;
- [ ] remove only validated inactive disposable Playwright snapshots under the exact authorized root;
- [ ] never kill unrelated node/docker processes;
- [ ] report environmental socket/resource failures separately from deterministic product defects and rerun the complete affected group after diagnosis.

---

## Task 14 — Full static/build/security gate

On final 6B source run and observe:

- [ ] local Supabase reset/lint/pgTAP;
- [ ] full Vitest;
- [ ] TypeScript;
- [ ] ESLint;
- [ ] Next production build;
- [ ] production dependency audit;
- [ ] install dry-run as appropriate;
- [ ] development Playwright full matrix;
- [ ] built-production Playwright full matrix;
- [ ] lifecycle repeats;
- [ ] workspace verifier;
- [ ] `git diff --check` with repository newline policy;
- [ ] UTF-8/control scan;
- [ ] secret-value scan without printing secrets;
- [ ] provider `NEXT_PUBLIC_*`/client-boundary scan;
- [ ] auth/private-data marker scan;
- [ ] built static/source-map scan if maps exist;
- [ ] protected screenshot integrity/no-touch evidence;
- [ ] GitHub workflow YAML/schema/action-permission review.

Do not say CI is green unless the workflow actually ran on GitHub; local workflow/config inspection is lower-level evidence. If no authorized Git push occurs, report CI as configured/unexecuted remotely.

---

## Task 15 — Final security/privacy/over-engineering review

Review specifically:

- whole-run deadline correctness and post-abort work;
- WAF threshold usability and pricing/authorization caveat;
- platform 429/504 mapping;
- auth + CSP Proxy composition from 6A;
- RLS/service-role absence;
- HSTS scope;
- Vercel/CI secret handling;
- workflow token permissions and untrusted PR behavior;
- test artifact privacy;
- provider policy assumptions;
- any new abstraction/dependency that can be removed.

Fix substantive local defects and rerun affected/full gates. Do not apply remote settings merely to close review findings.

---

## Task 16 — Synchronize planning/status for Phase 6C handoff

Update from observed local implementation only:

- [ ] `docs/planning/phase-6-hardening-submission-readiness.md`
- [ ] `docs/planning/tasks.md`
- [ ] `docs/planning/phase-6-requirements-traceability.md`
- [ ] `docs/requirements.md`
- [ ] `docs/design.md`
- [ ] `docs/security.md`
- [ ] `docs/security-threat-model.md`
- [ ] `docs/operations/vercel-production.md`
- [ ] provider release check if created
- [ ] `README.md` only for verified local setup/architecture changes
- [ ] `CHANGELOG.md`
- [ ] `AGENT_MEMORY.md`
- [ ] `LESSONS.md` only for reusable corrections.

Produce a Phase 6C handoff that clearly separates:

- verified local behavior;
- configured-but-not-applied Vercel/Supabase settings;
- remote actions requiring authorization;
- live provider/deployment evidence still missing;
- exact rollback/stop conditions.

**Stop condition:** Phase 6B ends before any public deployment or hosted-service mutation unless the user has separately authorized that exact action. Phase 6C owns external release execution.
