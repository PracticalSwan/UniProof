# Vercel Production Operations

This runbook records the Phase 6C Vercel release contract and the observed final-release state, most recently verified on 2026-08-22. Devpost publication is a separate final gate.

## Current release configuration

- Canonical origin: `https://uniproof-beta.vercel.app`
- Runtime contract: Node `22.x`; Research function cap 300 seconds; application-owned Research deadline 240 seconds.
- Research mode: `live` in Preview and Production.
- Discovery: Tavily primary, Brave fallback.
- Structured AI in the hosted release: Groq primary, OpenRouter fallback.
- Gemini: adapter remains implemented/tested, but `GEMINI_API_KEY` is intentionally absent from Preview/Production because current Gemini API terms prohibit API clients directed toward or likely to be accessed by under-18 users.
- Hosted Supabase Auth/save: intentionally absent from the public environment because production email delivery is not configured. Anonymous Research/Compare/Guide is the judge-facing release.
- `.vercelignore` excludes private env files, protected `ui-flow-screenshots/`, and generated verification output from deployment input.

## WAF contract — active

Exactly one durable custom rate-limit rule is enabled:

- method: `POST`
- path: `/api/research`
- key: source IP
- algorithm: fixed window
- threshold: 20 requests
- window: 60 seconds
- excess action: HTTP 429

Do not add a second in-process limiter merely to duplicate this protection. Application clients classify raw deployment/WAF 429 and platform 504 before body/schema parsing and do not automatically retry them.

## Final Production release evidence

- Verified executable SHA: `f797e0a692f113a29b3f4aa3491a216ead292b2a` (`test: stabilize local sign-out response assertion`), containing reliability implementation commit `e612782a92c4e8088d9592c2c51f1f8252745e57`.
- GitHub Actions: run `32545347640`, conclusion `success`; both `application` and `local-supabase` jobs succeeded.
- Vercel Production deployment: `dpl_8pYdBJEyvcohHuMm2e2cXt7cAYm7` / `https://uniproof-1rhm88877-practicalswans-projects.vercel.app`, verified `READY`, target `production`, on 2026-08-22.
- Canonical alias: `https://uniproof-beta.vercel.app`; deployment metadata lists the alias with no alias error.
- Vercel metadata records `githubCommitSha` as the verified executable SHA above, GitHub organization `PracticalSwan`, repository `UniProof`, and ref `main`.
- Runtime remains Node `22.x` by repository contract; the deployment reports four Node.js functions.

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

The historical Phase 6C live Research budget remains exhausted at **3/3**. The separate `final_testing_plan.md` allowance authorized up to five additional accepted executions and consumed **1/5** during the 2026-08-22 reliability verification.

The accepted final-testing call used The University of Edinburgh, Artificial Intelligence MSc, `research` only. Production returned HTTP 200 in **18,596 ms** with one public source, zero claims, and category state `ready` carrying a sanitized `provider-error` source gap. The corresponding exact-deployment runtime log records `POST /api/research 200`, and no `/api/research` runtime error cluster was found in the observed hour. This does **not** establish successful live evidence production; it establishes that the formerly ~161-second provider-failure path now terminates quickly, exposes uncertainty, and does not continue a multi-minute retry storm.

A preceding malformed public request used an internal target shape and was rejected with HTTP 400 `invalid-request` in 743 ms before Research execution; it is not counted as an accepted call. Final live accounting is **3 historical + 1 final-testing = 4 accepted executions**, leaving four additional final-testing calls unused.

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
