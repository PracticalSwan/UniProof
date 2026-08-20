# Vercel Production Operations

This runbook records the Phase 6C Vercel release contract and the observed 2026-08-20 configuration. Devpost publication is a separate final gate.

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

- Release source SHA: `21d645baaf9eca381a167246d22538c23bb29427`.
- GitHub Actions: run `32367630411`, conclusion `success`; both `application` and `local-supabase` jobs succeeded.
- Vercel Production deployment: `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN` / `https://uniproof-ba5rt3slh-practicalswans-projects.vercel.app`.
- Canonical alias: `https://uniproof-beta.vercel.app`.
- Vercel metadata records both `githubCommitSha` and release metadata `releaseSha` as the release source SHA above.
- Runtime: Node `22.x`; deployment state `READY`, target `production`.

## Security / privacy observations

Final Production verification observed:

- HTTP 200 for `/`, `/research`, `/compare`, and `/guide` on the canonical origin;
- private/no-cache/no-store application responses;
- request-nonce CSP with `connect-src 'self'`, `strict-dynamic`, `script-src-attr 'none'`, and no production `unsafe-eval`/script `unsafe-inline` policy;
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, COOP/CORP, restrictive Permissions Policy;
- Vercel HSTS: `max-age=63072000; includeSubDomains; preload`;
- all 15 browser script bundles on `/research` remained same-origin;
- five configured local secret values were compared against the deployed browser bundles without printing them and produced zero matches;
- no provider key names/provider identifiers, browser source-map references, Vercel toolbar, or Vercel runtime analytics markers were found in the deployed page/bundles;
- recent exact-deployment log inspection showed the expected successful GET smoke traffic, no error-level entries, and no HTTP 5xx entries in the observed window.

UniProof does not duplicate Vercel's HSTS at the application layer.

## Release smoke evidence

The owner-authorized live Research budget was capped at three accepted executions and is exhausted at **3/3**. Do not make another live Research call as part of this release.

The third pass used University of Waterloo Bachelor of Computer Science admissions. The request returned HTTP 200 and a schema-valid public response, but the category remained operationally incomplete with zero claims. That pass exposed two deterministic resilience defects subsequently fixed without another live call:

1. usable same-category claims now survive another selected source failing retrieval/normalization, with a sanitized `sourceGap` marker;
2. program-scoped Research always retains the catalog-owned official program URL as a trusted direct candidate, even when general web discovery succeeds.

Source-gap claims remain visible in Research but are non-definitive in Compare and Guide. The corrected executable source passed 602/602 Vitest tests and 104/104 deterministic hosted Preview Research/Compare/Guide browser acceptance cases. This does **not** convert the live smoke into a successful evidence-producing run; residual live-provider/source variability remains an explicit release limitation.

## Exact-SHA production procedure

1. Run the short final local gates on the exact staged source: focused/full Vitest as appropriate, TypeScript, ESLint, production build, release/workspace verifier, dependency audit, secret/client-bundle audit, and final diff review.
2. Stage only intended release files. Never stage `ui-flow-screenshots/`, `.env*`, generated output, or temporary `.ai-bridge` files.
3. Commit and push `main`.
4. Verify `origin/main` equals the local release SHA.
5. Require GitHub Actions to complete successfully on that exact SHA.
6. Deploy that exact committed source to Vercel Production.
7. Confirm `https://uniproof-beta.vercel.app` serves the new deployment and verify the deployment metadata is tied to the expected Git SHA.
8. Run only deterministic post-deploy checks: route/navigation availability, headers/CSP/cache, WAF configuration, browser/client-bundle privacy, and runtime logs. **Do not perform another live Research call.**

## Rollback

If the exact-SHA production deployment introduces a material regression, stop publication work and use Vercel's reversible rollback/promote mechanism for the previously verified deployment. Do not rewrite Git history, delete hosted data, or remove security controls as a rollback shortcut. Re-run the affected deterministic production checks after rollback.
