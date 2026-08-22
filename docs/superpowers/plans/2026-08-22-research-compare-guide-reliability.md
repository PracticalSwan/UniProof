# 2026-08-22 Research / Compare / Guide Reliability Pass

## Goal
Make bounded Research finish useful category work efficiently under provider pressure, keep Compare fail-closed but score when definitive evidence exists, and keep Guide private/reliable without increasing global budgets or weakening evidence gates.

## Root causes to prove with regressions
1. Compare defaults request categories that cannot affect positive default weights.
2. University direct discovery associates one generic homepage with every category even after category-specific discovery succeeds.
3. Extraction schedules document-first work and treats every segment of a broadly associated document as mandatory for every category.
4. Structured transport retries rate limits too aggressively: long `Retry-After` values are clamped to 2s and provider rate-limit health is forgotten between tasks/stages.
5. Compare does not explain `ready + sourceGap` as partial/unscored evidence.
6. Guide must be reviewed end-to-end for public-only Research requests, reuse/invalidation, cancellation/stale ownership, source-gap handling, planning, and saved-result invariants.

## Implementation order
1. Add focused failing tests for Compare defaults, direct discovery, extraction scheduling/completion, Retry-After/circuit failover, and source-gap UI semantics.
2. Implement the smallest run-scoped provider-health state and correct 429 retry policy; share it across extraction, reconciliation, and explanation within one Research run.
3. Reduce unnecessary Compare/discovery work and make extraction scheduling category-fair/budget-aware without raising attempt/time limits.
4. Fix Compare partial-evidence presentation.
5. Run a defect-first Guide review; add/fix only concrete regressions found.
6. Run targeted tests, then TypeScript/ESLint/build and the full existing gates once the tree is stable.
7. Inspect final diff, protected-folder status/hash, secrets/client bundle, workspace/release verifiers; then commit/push, require exact-SHA CI, deploy Production, verify SHA/routes/headers/logs, and perform only minimal live Research/Compare/Guide validation.
## Local completion evidence
- Root causes above are covered by focused regressions for structured 429 handling, run-scoped structured-provider health, discovery provider circuits, direct program discovery, category-aware extraction scheduling, public source-gap projection, Compare defaults/source-gap UI, and Guide source-gap/planning behavior.
- Vitest: 625/625 passed across 41 files.
- Playwright Compare: 63/63 passed.
- Playwright Guide: 55/55 passed.
- Playwright Research: 70/70 passed.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npx eslint .` passed.
- Production build: `npx next build` passed on Next.js 16.3.1 / Node 22 contract.
- `scripts/verify-workspace.ps1` and `scripts/verify-release-config.mjs --profile=ci` passed.
- `git diff --check` passed; `ui-flow-screenshots/` remains untracked and contains the expected 10 protected PNG files.
## Publication evidence
- Reliability implementation commit: `e612782a92c4e8088d9592c2c51f1f8252745e57`; follow-up Playwright response-body race stabilization: `f797e0a692f113a29b3f4aa3491a216ead292b2a`.
- Exact-SHA GitHub Actions run `32545347640` completed successfully on `f797e0a692f113a29b3f4aa3491a216ead292b2a`; both `application` and `local-supabase` jobs succeeded. The initial run exposed only the Playwright sign-out response-body race and was not used for release approval.
- Vercel Git integration produced Production deployment `dpl_8pYdBJEyvcohHuMm2e2cXt7cAYm7`, `READY`, target `production`, metadata-bound to the same executable SHA; `uniproof-beta.vercel.app` is an attached alias with no alias error.
- Production `/`, `/research`, `/compare`, and `/guide` returned 200; GET `/api/research` returned 405 without provider dispatch. CSP/cache/HSTS/frame/MIME/referrer protections and the live 20/60s/IP WAF rule were reverified.
- Production mobile/desktop smoke covered the four core routes in 8/8 loads with zero console/page errors. All 15 `/research` scripts were same-origin; five configured local secret values were checked without printing them and produced zero deployed-bundle matches, provider/key markers, or source-map markers.
- Final-testing live call: Edinburgh Artificial Intelligence MSc, `research` only, HTTP 200 in 18,596 ms; one source, zero claims, category `ready` with sanitized `provider-error` source gap. Exact-deployment runtime logs record the 200 request and no runtime error cluster exists for `/api/research` in the observed hour.
- The live result is intentionally not described as successful evidence production. It verifies bounded/fail-closed completion and removes the prior multi-minute retry amplification. Final-testing accepted-call use is 1/5; cumulative accounting is 3 historical + 1 final-testing = 4 accepted executions.
- A later documentation-only exact-SHA CI rerun reproduced the Playwright sign-out response-body/navigation race despite the first mitigation. The E2E was corrected to assert the actual requirement?HTTP 200 plus first-session sign-out and second-session survival?without reading a response body after navigation can discard it. The corrected case passed 3/3 consecutive local repetitions and the full Auth/Saved gate passed 12/12 before final publication.
