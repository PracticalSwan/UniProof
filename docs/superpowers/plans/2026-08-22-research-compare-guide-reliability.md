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
- Publication evidence (commit SHA, exact-SHA CI, Production deployment metadata, post-deploy checks, bounded live-provider result) must be appended only after those actions are observed.