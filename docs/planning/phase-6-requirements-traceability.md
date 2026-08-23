# Phase 6 Requirements Traceability

This matrix binds Phase 6 hardening/release requirements to implementation and observed evidence. Devpost final submission remains intentionally excluded until the final video is supplied and explicitly approved.

| Requirement | Implementation owner | Verification evidence | Current status |
| --- | --- | --- | --- |
| Research has a 120-second application deadline under a 300-second host ceiling | `lib/security/research-limits.ts`, execution budget, Research route | deadline regressions, production build, Vercel deployment build | Verified configuration/deployment |
| Caller cancellation/deadline ownership remains deterministic | Research execution budget/orchestrator | lifecycle regressions + hosted intercepted browser acceptance | Verified deterministically; later bounded 2026-08-23 Production mode checks completed under the same 120-second contract |
| Partial selected-source failure preserves usable claims without becoming definitive downstream evidence | pipeline/orchestrator/public dossier, Compare scoring, Guide eligibility | Phase 2F/3B/4/5 regressions + Research browser source-gap regression | Verified |
| Program-scoped Research retains the catalog-owned official program page even when web discovery succeeds | target resolver + discovery orchestrator | Phase 2B + end-to-end Phase 2F regressions | Verified |
| Raw deployment HTTP 429/504 is sanitized before body/schema parsing and not blind-retried | Research transport, Compare/Guide lifecycle | unit/browser regressions + hosted deterministic acceptance | Verified |
| Production configuration is validated without printing/fingerprinting secrets | release verifier | release-config tests + CLI verifier | Verified |
| Hosted discovery has at least one primary/fallback path | Vercel env + provider adapters | Vercel env-name inspection | Tavily + Brave configured |
| Hosted structured AI has bounded fallback | Vercel env + provider adapters | Vercel env-name inspection | Groq + OpenRouter configured; Gemini intentionally absent |
| Gemini public-release compatibility | environment policy | current Gemini terms rechecked 2026-08-20 | Adapter retained/tested; public key intentionally absent due under-18 API-client restriction |
| Supabase Auth is either fully configured or fully absent | release verifier/auth boundary | Vercel env-name inspection | Hosted browser/Auth vars intentionally absent; anonymous core release |
| Magic Link completion is bound to the initiating browser | Auth intent route/cookie + callback | unit contract + local cross-context Mailpit browser test | Verified locally; hosted Auth remains absent |
| Saved derived results remain evidence-bound | version-1 Guide/Comparison recomputation | tampered assessment/score regressions | Verified |
| Private save work authenticates before body buffering | saved-artifact server request handler | unread-body pre-auth regression | Verified |
| Account-derived restores clear on account change | Research/Guide/Compare restore ownership | local profile/Research sign-out and delayed-restore browser tests | Verified |
| Durable distributed abuse control protects expensive Research | Vercel WAF | live firewall-rule inspection | **Enabled**: exact POST `/api/research`, source IP, fixed 20/60s, 429 |
| Production browser policy is strict | Proxy/security headers | hosted Preview headers + CSP browser flow | Nonce CSP, `connect-src 'self'`, private/no-store, anti-frame/MIME/referrer/permissions controls verified |
| HSTS is deployment-owned, not duplicated by app | Vercel edge + app header config | hosted response headers | Vercel HSTS observed: `max-age=63072000; includeSubDomains; preload` |
| Secrets/provider internals stay out of tracked/client output | server-only env boundaries | exact-value tracked/bundle scan; no source maps | Verified; no configured secret value/key name/provider identifier in browser bundle |
| Protected local screenshots stay private | `.vercelignore`, Git review | Git status + release verifier | `ui-flow-screenshots/` remains untracked/unpublished |
| Release screenshots are separate and reviewable | `docs/assets/screenshots/phase-6/` | deterministic hosted capture + visual inspection | 8 reviewed PNGs retained |
| Live provider smoke is bounded | Phase 6C runbook + later explicit reliability authorization | accepted call records + deliberate cooldown/serialization evidence | Historical Phase 6C **3/3 exhausted**; later reliability checks were separately authorized and are recorded by date rather than folded into the obsolete 2026-08-22 remaining-call count |
| GitHub CI is least privilege and deterministic | `.github/workflows/ci.yml` | GitHub Actions run `32629551286` | **Verified** on live-validated executable SHA `e2ae1414c6f856a0bdeb2aa8a473dcb32215ab3c`; CI succeeded |
| Exact repository/deployment traceability | Git + Vercel | public Git SHA + GitHub Actions + Vercel deployment inspection | **Verified live-validated executable baseline**: Production deployment `dpl_GAXGwwiY1KASC3S3Rwt8VisncaNA` serves `e2ae1414c6f856a0bdeb2aa8a473dcb32215ab3c` at the canonical alias; this follow-up changes documentation/tests only |
| Devpost rules/assets are current | `docs/hackathon.md`, `docs/submission/` | Devpost recheck 2026-08-20 | Draft-ready; final video/submission pending |

## Current executable verification

The live-validated 2026-08-23 executable baseline `e2ae1414c6f856a0bdeb2aa8a473dcb32215ab3c` passed:

- Vitest **644/644** across 44 files before the documentation/test-only follow-up;
- TypeScript and full ESLint;
- Next.js 16.3.1 production build on the Node 22 contract;
- release/workspace verifiers and dependency audit with **0 vulnerabilities**;
- the previously verified Compare+Guide browser matrix **120/120** for the runtime remediation;
- exact-SHA GitHub Actions run `32629551286`, conclusion `success`;
- Vercel Production deployment `dpl_GAXGwwiY1KASC3S3Rwt8VisncaNA`, `READY`, target `production`, serving `https://uniproof-beta.vercel.app`.

The current documentation/test-only follow-up adds a deadline-contract regression and a Compare explicit-scope regression without modifying Production runtime modules. On this working tree, Vitest is **645/645** across 44 files and the complete Compare form browser spec is **10/10**; TypeScript, targeted ESLint, release/workspace verifiers, and `git diff --check` also pass.

## Live-smoke limitation

Historical Phase 6C accepted Research executions remain accounted separately at **3/3**. Later reliability testing was separately authorized rather than treated as remaining capacity from the obsolete 2026-08-22 five-call plan. On 2026-08-23, bounded Production browser checks returned HTTP 200 for Chulalongkorn Admissions-only Research, both serialized MIT/Stanford Compare target Research requests, and Chulalongkorn Guide. Deliberate 60-second cooldowns were used between mode/provider bursts. Provider rate-limit/upstream gaps remained sanitized and visible; these checks establish bounded fail-closed mode behavior under current provider pressure, not universal provider availability.
