# Historical Vercel Production Operations

> **Historical record:** The UniProof Vercel project was deleted on 2026-09-23. Its deployments, aliases, environment variables, WAF rules, and project settings are no longer available. The canonical alias returned HTTP 404 after deletion. The sections below preserve the Phase 6C release state verified on 2026-08-23; do not execute them to recreate or deploy a project without new explicit owner authorization. See [`project-closure.md`](project-closure.md).

This document preserves the Phase 6C Vercel release contract and the observed Production state from 2026-08-23. Devpost publication was a separate final gate.

## Last verified release configuration (2026-08-23)

- Canonical origin: `https://uniproof-beta.vercel.app`
- Runtime contract: Node `22.x`; Research function cap 300 seconds; application-owned Research deadline 120 seconds.
- Research mode: `live` in Preview and Production.
- Discovery: Tavily primary, Brave fallback.
- Structured AI in the hosted release: Groq primary, OpenRouter fallback.
- Gemini: adapter remains implemented/tested, but `GEMINI_API_KEY` is intentionally absent from Preview/Production because current Gemini API terms prohibit API clients directed toward or likely to be accessed by under-18 users.
- Hosted Supabase Auth/save: intentionally absent from the public environment because production email delivery is not configured. Anonymous Research/Compare/Guide is the judge-facing release.
- `.vercelignore` excludes private env files, protected `ui-flow-screenshots/`, and generated verification output from deployment input.

## Historical WAF contract (removed 2026-09-23)

At last verification, exactly one durable custom rate-limit rule was enabled:

- method: `POST`
- path: `/api/research`
- key: source IP
- algorithm: fixed window
- threshold: 20 requests
- window: 60 seconds
- excess action: HTTP 429

Do not add a second in-process limiter merely to duplicate this protection. Application clients classify raw deployment/WAF 429 and platform 504 before body/schema parsing and do not automatically retry them.

## Final Production release evidence

- Verified executable SHA: `e2ae1414c6f856a0bdeb2aa8a473dcb32215ab3c` (`fix: bound transient research provider failures`).
- GitHub Actions: run `32629551286`, conclusion `success`, on that exact SHA.
- Vercel Production deployment: `dpl_GAXGwwiY1KASC3S3Rwt8VisncaNA` / `https://uniproof-bb5bx8ldw-practicalswans-projects.vercel.app`, verified `READY`, target `production`, on 2026-08-23.
- Canonical alias: `https://uniproof-beta.vercel.app`; `vercel inspect` resolved the alias to that Production deployment with no alias error.
- The deployment was built from the pushed `main` checkout at the verified executable SHA above; the remote Vercel build completed Next.js compilation and TypeScript successfully.
- Runtime remains Node `22.x` by repository contract.

## Security / privacy observations

Final Production verification of the 2026-08-22 reliability deployment observed:

- HTTP 200 for `/`, `/research`, `/compare`, and `/guide` on the canonical origin;
- private/no-cache/no-store application responses;
- request-nonce CSP with `connect-src 'self'`, `strict-dynamic`, `script-src-attr 'none'`, and no production `unsafe-eval`/script `unsafe-inline` policy;
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, COOP/CORP, restrictive Permissions Policy;
- Vercel HSTS: `max-age=63072000; includeSubDomains; preload`;
- all 15 browser script bundles on `/research` remained same-origin;
- five configured local secret values were compared against the deployed browser bundles without printing them and produced zero matches;
- no provider key names/provider identifiers, browser source-map references, Vercel toolbar, or Vercel runtime analytics markers were found in the deployed page/bundles;
- exact-deployment log inspection showed expected verification traffic plus the bounded Research POST; no `/api/research` runtime error cluster was present in the observed hour;
- a bounded desktop/mobile browser smoke loaded `/`, `/research`, `/compare`, and `/guide` at both 390x844 and 1440x900: 8/8 loads returned 200 with zero console/page errors;
- a non-provider `GET /api/research` request returned the expected HTTP 405, confirming the deployed Research function responds without invoking providers.

UniProof does not duplicate Vercel's HSTS at the application layer.

## Release smoke evidence

The historical Phase 6C live Research allowance remains exhausted at **3/3**. The later 2026-08-22 `final_testing_plan.md` five-call accounting is historical as well; subsequent reliability testing was separately authorized and should not be interpreted through that obsolete remaining-call count.

On the 2026-08-23 Production deployment, a Chulalongkorn MSc Admissions-only Research browser run returned HTTP 200 in about **21.0 seconds**, `runStatus: succeeded`, Admissions `ready` with three claims, and no generic mode error. After a deliberate 60-second test cooldown, a two-target MIT/Stanford Compare run serialized the underlying Research requests with another 60-second gap; both returned HTTP 200 and the UI rendered a partial comparison without whole-mode failure. After another 60-second cooldown, Guide for the Chulalongkorn MSc target returned HTTP 200 in about **73.0 seconds**, rendered a partial requirement assessment, and the Research request contained only the public target/categories rather than citizenship, GPA, or applicant-profile fields.

The Compare validation also clarified request-scope semantics: priority weights determine scoring, while the seven Research-category checkboxes independently determine Research scope. Explicitly selected zero-weight categories are intentionally retained; when only Scholarships is selected, deterministic browser regression coverage proves both Compare target requests contain only `categories: ["scholarships"]`. Provider `rate-limit`/upstream gaps remained observable even with test cooldowns, so those external conditions are handled fail-closed rather than masked by arbitrary client delays.

Deterministic evidence remains primary: source-gap claims are visible in Research but non-definitive in Compare and Guide, long provider quota windows fail over rather than being clamped into short retries, persistent provider unavailability is circuit-broken for the current Research run, and no global provider/time budget was increased.

## Exact-SHA production procedure

1. Run the short final local gates on the exact staged source: focused/full Vitest as appropriate, TypeScript, ESLint, production build, release/workspace verifier, dependency audit, secret/client-bundle audit, and final diff review.
2. Stage only intended release files. Never stage `ui-flow-screenshots/`, `.env*`, generated output, or temporary `.ai-bridge` files.
3. Commit and push `main`.
4. Verify `origin/main` equals the local release SHA.
5. Require GitHub Actions to complete successfully on that exact SHA.
6. Deploy that exact committed source to Vercel Production.
7. Confirm `https://uniproof-beta.vercel.app` serves the new deployment and verify the deployment metadata is tied to the expected Git SHA.
8. Run deterministic post-deploy checks first: route/navigation availability, headers/CSP/cache, WAF configuration, browser/client-bundle privacy, and runtime logs. Any later live Research request is governed exclusively by the separate final-testing allowance and its written hypothesis/accounting rules.

## Rollback

If the exact-SHA production deployment introduces a material regression, stop publication work and use Vercel's reversible rollback/promote mechanism for the previously verified deployment. Do not rewrite Git history, delete hosted data, or remove security controls as a rollback shortcut. Re-run the affected deterministic production checks after rollback.
