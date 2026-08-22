# Phase 6 Requirements Traceability

This matrix binds Phase 6 hardening/release requirements to implementation and observed evidence. Devpost final submission remains intentionally excluded until the final video is supplied and explicitly approved.

| Requirement | Implementation owner | Verification evidence | Current status |
| --- | --- | --- | --- |
| Research has a 240-second application deadline under a 300-second host ceiling | `lib/security/research-limits.ts`, execution budget, Research route | deadline regressions, production build, Vercel deployment build | Verified configuration/deployment |
| Caller cancellation/deadline ownership remains deterministic | Research execution budget/orchestrator | lifecycle regressions + hosted intercepted browser acceptance | Verified deterministically; no new live provider call after 3/3 budget |
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
| Live provider smoke is bounded | Phase 6C runbook + `final_testing_plan.md` | accepted call accounting | Historical Phase 6C **3/3 exhausted**; final-testing **1/5 used**; cumulative accepted total **4** |
| GitHub CI is least privilege and deterministic | `.github/workflows/ci.yml` | GitHub Actions run `32545347640` | **Verified** on executable SHA `f797e0a692f113a29b3f4aa3491a216ead292b2a`; application and local-Supabase jobs succeeded |
| Exact repository/deployment traceability | Git + Vercel | public Git SHA + GitHub Actions + Vercel deployment metadata | **Verified executable revision**: Production deployment `dpl_8pYdBJEyvcohHuMm2e2cXt7cAYm7` records `githubCommitSha` = `f797e0a692f113a29b3f4aa3491a216ead292b2a` and serves the canonical alias |
| Devpost rules/assets are current | `docs/hackathon.md`, `docs/submission/` | Devpost recheck 2026-08-20 | Draft-ready; final video/submission pending |

## Current executable verification

The 2026-08-22 reliability executable revision passed:

- Vitest **625/625** across 41 files;
- TypeScript and ESLint;
- Next.js 16.3.1 production build on the Node 22 contract;
- release/workspace verifiers;
- `npm audit --omit=dev` with **0 vulnerabilities**;
- Compare **63/63**, Guide **55/55**, and Research **70/70** browser verification;
- local Supabase Auth/Saved **12/12**, plus schema reset/lint/advisors and pgTAP in exact-SHA CI;
- exact-value secret/client-bundle scan with five configured secrets checked and zero configured-secret matches/provider-key markers/source-map markers.

Executable SHA `f797e0a692f113a29b3f4aa3491a216ead292b2a` passed GitHub Actions run `32545347640` with both `application` and `local-supabase` jobs successful. Vercel Git integration created Production deployment `dpl_8pYdBJEyvcohHuMm2e2cXt7cAYm7`, `READY`, target `production`, metadata-bound to that SHA and serving `https://uniproof-beta.vercel.app`. Post-deploy route/header/WAF/client-bundle/log checks passed, including 8/8 mobile/desktop core-route loads with zero console/page errors.

## Live-smoke limitation

All three historical Phase 6C accepted Research executions remain accounted separately. The 2026-08-22 final-testing plan consumed **1/5** additional accepted execution for the specific unresolved hypothesis that the repaired provider path should terminate boundedly under current provider pressure. Edinburgh Artificial Intelligence MSc, Research only, returned HTTP 200 in about **18.6 seconds**, exposed one source and zero claims, and finalized `research` as `ready` with a sanitized `provider-error` source gap. This is fail-closed operational evidence, not successful live evidence production. A preceding malformed public request returned HTTP 400 before Research execution and is not charged. Final accounting is **3 historical + 1 final-testing = 4 accepted executions**.
