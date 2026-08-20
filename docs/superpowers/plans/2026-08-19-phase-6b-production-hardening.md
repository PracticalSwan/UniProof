# Phase 6B Production Hardening Implementation Plan

> **Execution model:** ZERO SUBAGENTS. GLM-5.3 Max must perform implementation, debugging, security/privacy review, accessibility review, testing, documentation, and both final review passes in the main agent only. Do not spawn a reviewer, specialist, parallel worker, or any other child agent.

**Goal:** Harden the reviewed Phase 6A UniProof application for a Vercel production environment without deploying it: add a truthful whole-Research execution deadline, opt in to host cancellation, safely classify platform rate-limit/timeout responses, migrate Gemini structured calls to stable v1 Interactions, freeze a durable WAF contract, add production-configuration verification and least-privilege CI, and rerun the complete Phase 0–6B local/built/security matrix.

**Implementation status (2026-08-20):** implemented and locally verified. The final review additionally fixed release-verifier publication gaps, replaced the nonce-bearing `next/script` Zod bootstrap with a nonce-authorized first-party static bootstrap after reproducible development hydration/chunk instability, fixed Compare explicit retry after deployment 429/504 so undispatched immutable targets are retried rather than dropped, and made Auth/Saved browser verification derive one shared validated isolated Playwright origin rather than retaining hidden port-3102 assumptions. Phase 6C remains responsible for all hosted/live verification.

**Architecture:** Keep all Phase 0–6A product/evidence/auth/persistence semantics unchanged. The expensive public Research request gains one server-owned 240-second execution budget under a 300-second Vercel Node/Fluid function cap. That budget propagates through the existing AbortSignal path and must produce truthful `timeout` lifecycle failures while caller cancellation remains `cancelled`. Vercel request cancellation is enabled only for Research through repository configuration. Deployment-generated 429/504 responses are classified client-side before JSON parsing because WAF/platform responses are not application envelopes. Durable rate limiting itself remains a Phase 6C Vercel Firewall action; Phase 6B defines and tests the exact contract without adding an in-memory limiter or hidden production test mode.

**Tech Stack:** Next.js 16.3.1 App Router / Node runtime, TypeScript 5, React 19.2.8, Zod 4.4.3, Vitest 4.1.10, Playwright 1.62.1, Supabase CLI 2.114.0 local-only, Vercel CLI 59.1.4 read-only/local validation, GitHub Actions, Gemini/Groq/OpenRouter structured REST adapters.

**Spec:** `docs/planning/phase-6-hardening-submission-readiness.md`

## Global constraints

- Canonical workspace: `D:\Side Projects\UniProof`; branch `main`; Phase 6A reviewed baseline commit `5d3b5de40f00730262c65dcdf83babd75e498ca9`.
- Preserve every Phase 6A invariant recorded in `AGENT_MEMORY.md`: anonymous core use, Auth/RLS ownership, exact saved-artifact validation, account-bound memory-only restore, applicant/provider separation, current-catalog target rebinding, and all Research/Compare/Guide lifecycle rules.
- ZERO SUBAGENTS for GLM-5.3 Max, including the final review. Main agent only.
- Do not link or mutate hosted Supabase. Do not mutate Vercel project settings, Firewall/WAF, environment variables, domains, deployments, or Git integration. Do not send live Tavily/Brave/Gemini/Groq/OpenRouter requests. Do not mutate GitHub or Devpost. Do not commit/push unless a later explicit user instruction authorizes publication.
- Do not touch, delete, or overwrite the ten protected `ui-flow-screenshots/` PNGs.
- Do not add paid provider escalation. Provider order remains Tavily -> Brave discovery and Gemini -> Groq -> OpenRouter structured fallback.
- Do not add `/api/compare`, `/api/guide`, applicant-aware provider prompts, AI scoring, admission probability, analytics, queues/workers, Redis, a Vercel Firewall SDK, or an application in-memory “distributed” rate limiter.
- Prefer existing dependencies. `vercel.json`, GitHub Actions YAML, and application-owned utilities do not require a new runtime package.
- Use TDD regression-first for every behavior or bug fix. Exercise the real path, not import-only/static evidence.
- Evidence labels must remain exact: local/dev, built-production, local Supabase, local workflow/config validation, actual GitHub CI, preview deployment, production deployment are different evidence levels.
- Current external facts revalidated on 2026-08-19 and must be checked again if implementation happens materially later:
  - Vercel Fluid Compute is enabled by default; current documented Node default is 300 seconds. Hobby max is 300 seconds and the ordinary Pro/Enterprise max is 800 seconds. Do not design around the optional 30-minute beta.
  - Next.js App Router supports `export const maxDuration`; Vercel request cancellation is a separate Node-only `supportsCancellation: true` function configuration.
  - Vercel automatically supplies HSTS on deployment responses (`max-age=63072000`). UniProof must not add duplicate `includeSubDomains`/`preload` policy during 6B.
  - Vercel WAF fixed-window rate limiting is available across plans; Log mode can observe before enforcement. UniProof’s proposed 20 requests / 60 seconds / source IP is a provisional product policy, not a Vercel default.
  - Gemini Interactions core features are GA in stable `/v1`; current `gemini-3.5-flash-lite` and `gemini-3.5-flash` are stable and have free-tier availability. The checked-in adapter already uses the post-June-2026 `steps` + `response_format` schema but still targets `/v1beta/interactions`.

---

## Canonical file responsibilities

**Create**
- `lib/research/orchestration/execution-budget.ts` — caller-cancel vs whole-run-deadline composition and classification.
- `lib/integrations/abortable-delay.ts` — tiny abort-aware retry-delay helper shared by Tavily and Brave.
- `vercel.json` — minimal Research-only request-cancellation opt-in.
- `.github/workflows/ci.yml` — least-privilege, no-deploy, no-live-provider CI.
- `scripts/verify-release-config.mjs` — read-only production/configuration contract verifier that never prints secret values.
- `docs/planning/phase-6-requirements-traceability.md` — requirement -> implementation -> evidence map through 6B.
- `docs/operations/vercel-production.md` — exact Phase 6C Vercel/WAF/config runbook; no remote action in 6B.

**Modify**
- `lib/security/research-limits.ts` — add 240,000 ms whole-run deadline and only genuinely needed client/platform bounds.
- `app/api/research/route.ts` — `runtime = "nodejs"`, `maxDuration = 300`.
- `lib/research/mode/handler.ts` — compose deadline after request validation, reuse the shared same-origin mutation guard where appropriate, pass the composed signal, dispose resources.
- `lib/research/orchestration/orchestrator.ts` — map deadline-owned abort to `timeout`, caller abort to `cancelled`, preserve completed evidence, start no new stage after terminal signal.
- `lib/integrations/tavily/search.ts`, `lib/integrations/brave/search.ts` — abort retry waits immediately; no retry dispatch after terminal signal.
- `lib/research/ai/structured-task.ts` — prove global abort wins before retry/fallback dispatch and during backoff without expanding attempt budgets.
- `lib/research/mode/client-transport.ts`, `lib/research/mode/client-state.ts`, Research/Compare/Guide workspaces — client-local deployment 429/504 outcomes before application JSON requirements, no auto-retry, previous-result preservation.
- `lib/integrations/gemini/structured.ts` — stable `/v1/interactions`; preserve current new schema/model/privacy behavior.
- provider adapter tests — freeze current Groq/OpenRouter/Tavily/Brave privacy/capability assumptions without live requests.
- docs/status files only after observed implementation.

**Tests to create/extend**
- `tests/phase6b-research-deadline.test.ts`
- `tests/phase6b-deployment-transport.test.ts`
- `tests/phase6b-production-config.test.ts`
- existing Phase 2D/provider tests
- existing Research state/transport/orchestration tests
- existing Research/Compare/Guide/Auth browser suites and local Supabase gates

---

## Task 1 — Revalidate mutable platform/provider assumptions

- [ ] Read current official Vercel duration, cancellation, WAF, response-header, and project-configuration docs. Record source date/URL in the Phase 6 spec.
- [ ] Verify local `vercel --version`. Use account/project commands read-only only if they return without prompting/mutation. If actual account/project/Fluid state cannot be established, record it as a 6C deployment gate rather than guessing.
- [ ] Read current official Gemini API version/model/pricing/data-use docs, Groq model/structured-output/data docs, OpenRouter routing/privacy/ZDR docs, Tavily Search docs, and Brave Search API privacy/storage docs.
- [ ] Inspect checked-in adapters before editing. Expected baseline: Gemini new `steps` schema but `/v1beta`; Groq `openai/gpt-oss-120b` strict schema; OpenRouter `require_parameters:true` + `data_collection:"deny"` and conditional `zdr:true`; Tavily answer/raw/auto parameters disabled; Brave URL/title discovery-only.
- [ ] Freeze current 6B values: `RESEARCH_TOTAL_DEADLINE_MS = 240_000`, `maxDuration = 300`, WAF contract `POST /api/research`, fixed window 60s, source IP, threshold 20, Log-first.
- [ ] Record privacy residuals truthfully: Gemini unpaid-tier public inputs may be used for product improvement/human review, so applicant/private data must remain mechanically excluded; Brave standard Search API query logs may be retained up to 90 days and raw API-result storage rights are restricted unless the plan grants them; do not claim universal ZDR for free providers.

**Verification:** after implementation/doc synchronization, active 6B requirements must contain no stale `210_000`, `210 seconds`, `maxDuration=240`, custom app-HSTS requirement, or Gemini `/v1beta` production target except explicitly historical/superseded notes.

## Task 2 — Add a truthful whole-Research execution budget

**Interface:**
```ts
export const RESEARCH_TOTAL_DEADLINE_MS = 240_000;

export type ResearchExecutionBudget = Readonly<{
  signal: AbortSignal;
  deadlineReached: () => boolean;
  callerCancelled: () => boolean;
  dispose: () => void;
}>;

export function createResearchExecutionBudget(
  callerSignal: AbortSignal,
  timeoutMs?: number,
): ResearchExecutionBudget;

export function researchAbortFailureCode(signal: AbortSignal): "timeout" | "cancelled";
```

- [ ] RED fake-timer tests: caller pre-abort -> cancelled; caller abort during run -> cancelled; timer expiry -> timeout; first terminal owner wins a caller/deadline race; `dispose()` is idempotent and removes timer/listener behavior; no real multi-minute wait.
- [ ] Implement an internal deadline reason that cannot be confused with arbitrary caller reasons. Never expose/serialize its stack/detail.
- [ ] Do not leave a 240-second timer/listener attached after a normal quick request.
- [ ] Focused tests GREEN.

## Task 3 — Route the deadline through handler/orchestration without losing partial evidence

- [ ] RED tests with some categories completed before deadline. Expected: schema-valid partial dossier; completed categories unchanged; unfinished categories use `timeout` lifecycle failures.
- [ ] Caller cancellation through the same path remains `cancelled`, not timeout.
- [ ] Start the expensive-run timer only after content-type/JSON/public target/sensitive-input validation reaches accepted Research dispatch.
- [ ] Handler passes only the composed signal to `runResearch` and always disposes the execution budget in `finally`.
- [ ] **Replace** the handler-local `isAllowedResearchOrigin` implementation with the existing `isAllowedSameOriginMutation` from `lib/security/same-origin.ts`. Add regressions proving `Sec-Fetch-Site: same-origin` is accepted even when Next's internal request host is `localhost` but the browser origin is `127.0.0.1`, `Sec-Fetch-Site: none` remains allowed, `same-site`/`cross-site` are rejected, and clients without Fetch Metadata fall back to exact Origin comparison. Do not keep two origin-policy implementations.
- [ ] At every post-await orchestration boundary compute the outer terminal code once from ownership, conceptually `const abortCode = signal?.aborted ? researchAbortFailureCode(signal) : undefined`. Use that code instead of a boolean `aborted` in extraction/reconciliation failure classification and final category reasoning.
- [ ] Low-level discovery/retrieval code may internally label an aborted composed signal as `cancelled`; when the **outer 240s deadline** owns the composed signal, overwrite only the final `reasonByCategory` entries for **unprocessed categories** with `timeout` before final failures/evidence summary are built. When the caller owns the signal, keep `cancelled`. Never rewrite processed categories, validated claims, sources, or explanations merely because the signal became terminal later.
- [ ] Once terminal, no new discovery, DNS/retrieval, extraction, reconciliation, explanation, retry, or fallback dispatch starts.
- [ ] Normal deadline behavior stays inside the existing Research lifecycle/dossier contract. If a truly unexpected exception prevents a validated dossier, retain sanitized transport failure instead of fabricating evidence.

## Task 4 — Make discovery retry waits abort-aware

**Create:** `lib/integrations/abortable-delay.ts`

```ts
export async function waitForRetryDelay(
  milliseconds: number,
  signal: AbortSignal | undefined,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<boolean>;
```

- [ ] RED tests: deadline/caller abort during Tavily/Brave Retry-After resolves promptly and dispatches no retry; already-aborted signal does not sleep.
- [ ] Implement a tiny helper with deterministic listener cleanup and injected sleep support.
- [ ] Preserve current provider bounds: one retry; Brave/Tavily Retry-After max 1s; bounded query/result response; Tavily `basic`, no answer/raw/auto parameters.

## Task 5 — Prove AI retry/fallback dispatch obeys the whole signal

- [ ] Extend AI transport fake-timer tests for global abort during fetch, bounded body read, Retry-After wait, and immediately before retry/fallback reservation.
- [ ] No new HTTP attempt is reserved/dispatched after terminal signal. Attempt history must never imply a call that did not happen.
- [ ] Keep existing per-attempt 30s timeout, Retry-After 2s cap, output tokens, response bytes, and total/provider HTTP budgets. Do not increase them to “fit” the global budget.
- [ ] Keep provider cleanup best-effort and sanitized; no prompt/body/error leakage.

## Task 6 — Configure Vercel duration and cancellation without deployment

- [ ] RED config test expects `app/api/research/route.ts` Node runtime and `export const maxDuration = 300`.
- [ ] RED config test expects a minimal `vercel.json` with `supportsCancellation:true` scoped only to the Research function path/glob supported by current Vercel configuration semantics.
- [ ] Keep `maxDuration` in Next route-segment config; do not duplicate it in `vercel.json` unless current Vercel behavior proves a need.
- [ ] `vercel.json` must not add project IDs, regions, deploy commands, environment values, headers, HSTS, or broad all-function cancellation.
- [ ] Prove the function glob against current official docs/schema/local static validation. If exact matching cannot be established without deployment, leave a clearly documented 6C blocker rather than inventing a path.
- [ ] Local tests prove only signal propagation from `request.signal`; actual Vercel disconnect propagation remains 6C live evidence.

## Task 7 — Classify raw deployment 429/504 before JSON parsing

**Client-local outcomes:**
```ts
| { kind: "deployment-rate-limit"; error: { code: "deployment-rate-limit"; message: string } }
| { kind: "deployment-timeout"; error: { code: "deployment-timeout"; message: string } }
```

Do not put these in the application server JSON error schema because WAF/platform responses can occur before application code.

- [ ] RED tests: HTTP 429 with HTML/plain/empty/malformed/oversize body -> deployment-rate-limit without trusting/parsing body; HTTP 504 -> deployment-timeout.
- [ ] Cancel response body best-effort/non-blocking. Never reflect Vercel/WAF body text, source IP, rule name, request IDs, or HTML.
- [ ] No automatic browser retry. Do not create retry countdown/background retry behavior.
- [ ] Ordinary application JSON errors continue through strict content-type/body/schema validation.
- [ ] Research/Compare/Guide preserve previous displayed results on platform 429/504.
- [ ] Preferred Compare rule: a terminal platform 429/504 stops the active sequential batch rather than amplifying rate-limited traffic; preserve already completed target/previous-result state and test it explicitly.
- [ ] Guide retains applicant form/prior result and requires explicit user retry/reassess.

## Task 8 — Migrate Gemini structured REST to stable v1

- [ ] RED exact-endpoint test: `https://generativelanguage.googleapis.com/v1/interactions`.
- [ ] Preserve current request: stable model ID, prompt input, `store:false`, no tools, current `response_format` JSON schema, bounded generation config, current minimal/low thinking policy.
- [ ] Preserve current response parsing: `status:"completed"`, current `steps` model output and documented `output_text` compatibility. Do not reintroduce removed legacy `outputs` schema.
- [ ] Keep `gemini-3.5-flash-lite` normal and `gemini-3.5-flash` quality escalation. Do not switch to a newer preview merely for novelty.
- [ ] No live Gemini call in 6B; fixtures are the implementation evidence. Recheck actual endpoint/model live availability immediately before bounded 6C smoke.

## Task 9 — Freeze provider privacy/cost invariants

- [ ] Gemini: document that free-tier inputs/outputs may be used for product improvement/human review. Tests mechanically prove applicant/account/private saved markers cannot reach Gemini. Do not claim free Gemini is ZDR.
- [ ] Groq: retain `openai/gpt-oss-120b`, strict JSON Schema, non-streaming, bounded output. Document inference is not retained by default but limited abuse/reliability logging can occur; do not mutate account data-control settings in 6B.
- [ ] OpenRouter: test `require_parameters:true`, `data_collection:"deny"`; when `UNIPROOF_OPENROUTER_REQUIRE_ZDR=true`, test `zdr:true`; require concrete returned model and never persist `openrouter/free` as concrete model identity.
- [ ] Tavily: public research query only; basic search; no generated answer/raw content/auto parameters; provider snippets remain discovery metadata, never final evidence truth.
- [ ] Brave: public query only; URL/title/rank discovery-only; do not persist raw Search API response/snippets. Standard Search API query logs can be retained up to 90 days and storage rights depend on plan; do not claim free Brave is ZDR.
- [ ] Provider failure remains partial/unknown through deterministic gates. Never resolve a provider privacy change by sending private data or enabling paid escalation.

## Task 10 — Add a non-secret production configuration verifier

**Create:** `scripts/verify-release-config.mjs`; optionally `npm run verify:release-config`.

- [ ] RED tests for production profile: `NEXT_PUBLIC_APP_URL` exact HTTPS origin, no credentials/path/query/fragment, no local/loopback; `UNIPROOF_RESEARCH_MODE=live`; optional Auth either fully configured with exact HTTPS Supabase origin + publishable key or fully absent/disabled; service-role key not required.
- [ ] Treat provider configuration as a **readiness matrix**, not “all fallbacks are mandatory.” For a release-ready live profile require at least one configured general-web discovery provider (`TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`) **and** at least one configured structured AI provider (`GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENROUTER_API_KEY`). Missing secondary fallbacks are reported as reduced resilience, not invalid configuration. The checked-in direct official-URL discovery path remains a degraded fallback and does not justify declaring a zero-search-key production profile release-ready; similarly, a zero-AI-key profile can degrade truthfully but cannot complete extraction/reconciliation and is not release-ready.
- [ ] Development/CI profile does not require production secrets and allows fixture/built anonymous tests.
- [ ] Verifier prints names/status/reasons only. Never print secret values, lengths, prefixes, hashes, project refs, or fingerprints.
- [ ] Keep `NEXT_PUBLIC_APP_URL` out of authorization/callback logic; it is a release correctness input, not a trust source.
- [ ] No network calls from the verifier.

## Task 11 — Correct TLS/HSTS/header ownership

- [ ] Preserve nonce CSP, frame/referrer/content-type/permissions headers, `poweredByHeader:false`, exact Supabase connect origin, no third-party scripts.
- [ ] Do **not** add app-owned HSTS merely to mirror Vercel. Add regression/static checks that UniProof does not inject `includeSubDomains`/`preload` or conflicting custom HSTS.
- [ ] Phase 6C must verify Vercel’s actual HTTPS response carries HSTS on the canonical deployed origin. Local/built tests cannot prove platform HSTS.
- [ ] Do not attempt to control the parent `vercel.app` domain.

## Task 12 — Freeze the durable WAF contract, not a fake limiter

**Create/update:** `docs/operations/vercel-production.md`.

- [ ] Exact future rule: path equals `/api/research`; method equals POST; fixed window; source IP; 60 seconds; threshold 20; **Log first**.
- [ ] After 6C observation of normal judge traffic and separate authorization/pricing review, enforce Rate Limit/default 429 only if threshold is safe.
- [ ] Document NAT/shared university Wi-Fi false-positive risk and that 20/min is provisional, not a Vercel default.
- [ ] Local 429 tests use fabricated transport Responses or Playwright interception. Never add a production env flag/header/backdoor that simulates WAF inside application code.
- [ ] No deliberate provider/Vercel quota exhaustion or burst traffic in 6B.

## Task 13 — Add least-privilege GitHub Actions CI

**Create:** `.github/workflows/ci.yml`.

- [ ] Triggers: `pull_request` and `push`; no `pull_request_target`.
- [ ] Top-level `permissions: contents: read`; no write/deploy permissions.
- [ ] Bounded `timeout-minutes` and concurrency cancellation for superseded ref runs.
- [ ] Pin Node to the locally verified Node 22 line, preferably exact `22.19.0` unless implementation revalidates another exact baseline; `npm ci` from lockfile.
- [ ] Resolve current official `actions/checkout`, `actions/setup-node`, and `supabase/setup-cli` release tags to their official **full 40-character commit SHAs** at implementation time. Use SHA in YAML and tag only as comment. Never invent a SHA or leave floating `@main`/`@v6`/`@v3`.
- [ ] Prefer `package-manager-cache:false` in setup-node unless a cache is deliberately reviewed and justified.
- [ ] Run Vitest, TypeScript, ESLint, production build, production dependency audit/workspace/release-config checks, deterministic Playwright with retries zero.
- [ ] Local Supabase job uses Ubuntu/Docker and fixed CLI **2.114.0**; `db reset`, `db lint`, `db advisors --local` where exposed, `test db`, local Auth/Saved browser tests. Never `--linked` or remote DB.
- [ ] No provider/Vercel/hosted Supabase secrets. No live providers, deployment, remote DB, or Devpost action.
- [ ] Do not upload traces/screenshots by default. If failure artifacts are truly required, upload only a reviewed bounded sanitized path and prove it cannot contain `.env*`, cookies, Mailpit magic links/message bodies, private profiles, provider responses, or protected screenshots.
- [ ] Locally validate workflow YAML/permissions/static contract, but do not say “CI is green” until GitHub actually executes it on an authorized pushed commit.

## Task 14 — Release verifier and requirements traceability

**Create:** `docs/planning/phase-6-requirements-traceability.md`.

- [ ] Map every current MVP requirement to implementing files plus unit/dev/built/local-Supabase evidence; deployment-only requirements remain clearly `verified-live pending 6C`.
- [ ] Release verifier checks protected screenshot count/path, required docs, no disposable Playwright snapshot publication, ignored secret-bearing paths not staged, provider/service-role client boundary, package/lock consistency, `vercel.json`, CI file, Gemini v1 endpoint, 240s/300s contract, no custom preload/includeSubDomains HSTS.
- [ ] Verifier never reads/echoes `.env.local` or Supabase `.temp` values; path/ignored/staged state only.
- [ ] Test verifier using synthetic env/file metadata, not real credentials.

## Task 15 — Full browser/lifecycle regression on final source

- [ ] Development: rerun all Research/Compare/Guide/Auth-Saved suites plus new 6B cases. Report observed counts; do not guess final totals before collection.
- [ ] Built-production anonymous/core: all Research/Compare/Guide suites, no dev CSP exception.
- [ ] Local Supabase Auth/Saved against local Mailpit. Authenticated built mode remains separately scoped because production CSP rejects local HTTP Supabase.
- [ ] Deadline/browser fixtures use fake/intercepted timing; never wait 240 real seconds.
- [ ] Repeat Guide lifecycle 5x, retries 0.
- [ ] Repeat Auth/Saved/account-switch lifecycle 5x, retries 0.
- [ ] Repeat deadline + raw deployment 429/504 + Compare stop-on-rate-limit lifecycle at least 5x, retries 0.
- [ ] Inspect harness processes/output before cleanup. Remove only exact inactive disposable `output/playwright/phase3d-dev-app-<digits>` snapshots after containment/process checks. Never touch protected screenshots.

## Task 16 — Final static/database/security gates

Run and observe on final source:

- [ ] `npx vitest run`
- [ ] `npx tsc --noEmit`
- [ ] `npx eslint .`
- [ ] `npx next build` without optional Supabase config
- [ ] local Supabase `db reset`, `db lint`, `db advisors --local`, `test db`
- [ ] `npm audit --omit=dev`
- [ ] `npm ci --dry-run --ignore-scripts`
- [ ] workspace verifier
- [ ] synthetic valid/invalid release-config verifier cases
- [ ] `git diff --check` / CRLF-aware equivalent
- [ ] UTF-8/trailing-whitespace/control scan
- [ ] secret/client-boundary scan: no provider/service-role values; no provider key names in `app/`/`components/`; service role unused in ordinary Auth/Persistence/Supabase runtime; ignored Supabase `.temp` outside Git
- [ ] protected screenshot manifest unchanged
- [ ] docs relative-link/command/version verification

## Task 17 — Main-agent-only two-pass final review

**ZERO SUBAGENTS.**

**Pass 1 — requirements/security traceability**
- Compare final code/config/docs against every 6B spec/task/invariant.
- Inspect deadline cause truthfulness, partial evidence preservation, no post-terminal dispatch, WAF contract/client behavior, production config secrecy, provider privacy, CI permissions/SHA pinning, and all Phase 6A regression invariants.

**Pass 2 — fresh defect/complexity review**
- Search for deadline/caller-abort races, live timers/listeners, retry waits outliving deadline, provider attempts after abort, stale response ownership, raw 429 body leakage, hidden retries, duplicate same-origin guards, duplicate HSTS, module-scope request/user mutable state under Fluid Compute, accidental live network calls in CI, secret artifacts, floating action tags, unnecessary dependencies, hidden test modes, and Phase 6C scope creep.
- Fix each concrete defect regression-first. Any source fix invalidates affected verification and requires rerunning the appropriate full matrix before completion.

## Task 18 — Documentation and Phase 6C handoff

Update from observed implementation only:
- `README.md`
- `CHANGELOG.md`
- `AGENT_MEMORY.md`
- `LESSONS.md` only for reusable root-cause corrections
- `docs/planning/tasks.md`
- `docs/requirements.md`
- `docs/design.md`
- `docs/security.md`
- `docs/security-threat-model.md`
- `docs/planning/phase-6-hardening-submission-readiness.md`
- `docs/superpowers/plans/2026-08-19-phase-6c-deployment-submission.md`
- `docs/planning/phase-6-requirements-traceability.md`
- `docs/operations/vercel-production.md`

Phase 6C handoff must explicitly leave these external/unverified:
- exact Vercel account/team/project and Fluid Compute state;
- whether `maxDuration=300` is accepted by that selected project/plan;
- real Vercel request-cancellation propagation;
- WAF pricing/Log observation/enforcement;
- hosted Supabase link/migration/Auth redirect/SMTP;
- production HTTPS/TLS/Vercel-delivered HSTS/canonical host;
- real production environment values;
- bounded live provider smoke/current quota/privacy account controls;
- actual GitHub CI run on exact commit;
- preview -> production deployment/rollback;
- release screenshots/demo/Devpost.

## Completion standard

Phase 6B is complete only when local code/configuration is production-ready **without claiming deployment**: the 240s application deadline is deterministic and truthful under caller/deadline races; the route has a 300s host cap and cancellation opt-in; no work is dispatched after terminal ownership; raw Vercel 429/504 outcomes are sanitized before JSON parsing with no retry storm; Gemini uses stable v1 Interactions with the current schema; provider privacy/cost invariants are frozen; WAF is an exact Phase 6C runbook instead of a fake app limiter; production configuration can be verified without exposing secrets; CI is least privilege/no-live-services; traceability is complete; every Phase 0–6A regression remains green; and the main agent finishes both review passes with no unresolved material defect.
