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
| Durable distributed abuse control protects expensive Research | Vercel WAF | live firewall-rule inspection | **Enabled**: exact POST `/api/research`, source IP, fixed 20/60s, 429 |
| Production browser policy is strict | Proxy/security headers | hosted Preview headers + CSP browser flow | Nonce CSP, `connect-src 'self'`, private/no-store, anti-frame/MIME/referrer/permissions controls verified |
| HSTS is deployment-owned, not duplicated by app | Vercel edge + app header config | hosted response headers | Vercel HSTS observed: `max-age=63072000; includeSubDomains; preload` |
| Secrets/provider internals stay out of tracked/client output | server-only env boundaries | exact-value tracked/bundle scan; no source maps | Verified; no configured secret value/key name/provider identifier in browser bundle |
| Protected local screenshots stay private | `.vercelignore`, Git review | Git status + release verifier | `ui-flow-screenshots/` remains untracked/unpublished |
| Release screenshots are separate and reviewable | `docs/assets/screenshots/phase-6/` | deterministic hosted capture + visual inspection | 8 reviewed PNGs retained |
| Live provider smoke is bounded | Phase 6C runbook | accepted call accounting | **3/3 exhausted**; final call HTTP 200/schema-valid but operationally incomplete; no successful-live-evidence claim |
| GitHub CI is least privilege and deterministic | `.github/workflows/ci.yml` | GitHub Actions run `32367630411` | **Verified** on release SHA `21d645baaf9eca381a167246d22538c23bb29427`; application and local-Supabase jobs succeeded |
| Exact repository/deployment traceability | Git + Vercel | public Git SHA + GitHub Actions + Vercel deployment metadata | **Verified**: Production deployment `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN` records `githubCommitSha` and `releaseSha` = `21d645baaf9eca381a167246d22538c23bb29427` |
| Devpost rules/assets are current | `docs/hackathon.md`, `docs/submission/` | Devpost recheck 2026-08-20 | Draft-ready; final video/submission pending |

## Current executable verification

Before the documentation-only release synchronization, the hardened executable tree passed:

- Vitest **602/602**;
- TypeScript and ESLint;
- Next.js 16.3.1 production build on Node 22.19.0;
- release/workspace verifiers;
- `npm audit --omit=dev` with **0 vulnerabilities**;
- deterministic hosted Preview Research/Compare/Guide browser acceptance **104/104**;
- exact-value secret/client-bundle scan with zero configured-secret matches and zero browser source maps.

Release screenshots were captured from the verified hosted Preview with deterministic intercepted Research fixtures. The executable release was then published as `21d645baaf9eca381a167246d22538c23bb29427`; GitHub Actions run `32367630411` completed successfully on that exact SHA, and Vercel Production deployment `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN` was promoted to the canonical origin. Post-deploy route/header/WAF/client-bundle/log verification was deterministic and consumed no additional live Research quota. This documentation-only closeout records that already-observed external state and does not alter the deployed executable source.

## Live-smoke limitation

All three owner-authorized accepted live Research executions have been used. The third call (University of Waterloo Bachelor of Computer Science, admissions) returned HTTP 200 and a schema-valid public envelope, but the category was operationally incomplete with zero claims/sources. That evidence uncovered the program-direct-source weakness and followed earlier source-gap failures; both deterministic root causes were fixed and regression-covered. No fourth call is permitted, so final Production verification must remain deterministic and the Devpost text must not claim a successful evidence-producing live smoke.
