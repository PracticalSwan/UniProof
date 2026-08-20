# Pre-Phase 6C UI and Comparison Weight Cleanup

## Scope

Fix the Guide applicant-profile alignment/capitalization defects and Compare card/priority controls before Phase 6C. Preserve all provider, security, deployment, and hosted-service boundaries. Add README catalog documentation from the checked-in catalog source. Do not touch the protected `ui-flow-screenshots/` directory.

## Architecture decisions

1. **Guide qualification values stay canonical.** Keep the existing lowercase `GuideQualificationLevel` enum and persisted/profile values. Add only a presentation-label map for `Secondary`, `Diploma`, `Bachelor`, `Master`, `Doctorate`, and `Other`.
2. **Comparison sliders store raw relative weights.** Keep five integer raw weights in the existing 0–100 shape. The form uses native range inputs with `step=1`; no drag-time rebalancing occurs.
3. **All-zero comparison weights are invalid.** Reject a raw total of zero with a clear form/schema error. This prevents divide-by-zero/NaN and avoids inventing an equal-weight fallback the user did not select.
4. **Normalize once in scoring.** A pure comparison helper converts a validated positive raw vector to fractions using `raw / rawTotal`. Scoring and weighted evidence coverage consume that normalized representation. UI and persistence retain raw slider values.
5. **Backward compatibility.** Existing saved Comparison snapshots with exact-total-100 raw weights remain valid and preserve their historical stored score/trade-offs without rescore. New positive-total raw vectors use the same strict Comparison result shape; the scoring formula is scale-invariant, so existing total-100 snapshots retain identical semantics.
6. **Evidence coverage remains a percentage.** Calculate it from normalized scoreable weight and retain full finite precision internally; presentation rounds only for display. The 50% suppression gate uses the unrounded normalized value.
7. **Card grouping stays accessible.** Keep `fieldset` grouping where useful, move visible titles into the card body, and use a screen-reader-only legend so the border no longer cuts through the visible heading.

## Test-first implementation order

1. Update/add Vitest cases for positive relative weights, invalid zero-total/non-finite inputs, normalization, scale invariance, asymmetric/equal vectors, coverage thresholds, and old total-100 compatibility.
2. Update/add Playwright assertions for native range controls, min/max/step/current values, keyboard operation, visible raw values, all-zero validation, in-card headings, qualification display labels with unchanged canonical values, and responsive Guide/Compare layouts.
3. Implement comparison contract/form normalization and scoring changes.
4. Implement Compare card/sliders and Guide layout/presentation fixes.
5. Generate the README supported catalog table from `lib/research/catalog/data.ts` and synchronize current behavior docs.
6. Run focused tests, then full unit/type/lint/build/release/audit/workspace/browser gates. Review the final diff, protected assets, generated residue, and publication boundary before commit/push.

## Exclusions

- No Phase 6C deployment, Vercel/WAF, hosted Supabase/Auth, provider smoke, release publication, or Devpost action.
- No provider/model/evidence-policy changes.
- No catalog data changes.
- No dependency changes.

## Implementation completion record — 2026-08-20

- Guide Applicant Profile now aligns the Intake/Academic year controls and the Amount/Currency/Scope row at desktop widths while stacking cleanly on narrow screens. Qualification presentation is title-cased, but canonical lowercase values remain unchanged across form state, contracts, assessment, and persistence.
- Compare retains accessible fieldset grouping with screen-reader legends while rendering visible section headings inside the card body. Priority controls are native keyboard-accessible integer range sliders from 0–100 with visible raw values and no drag-time rebalancing.
- Raw Comparison priority vectors may have any positive total. The all-zero vector fails validation before Research dispatch. `normalizeComparisonPriorityWeights()` is the single scoring normalization helper; scoring and weighted evidence coverage consume `raw_i / sum(raw_weights)` while UI state and version-1 saved snapshots retain raw values. Legacy exact-total-100 snapshots remain compatible without a schema-version bump or automatic rescore.
- Review found one accessibility defect introduced during implementation: passive `<output>` elements for the five displayed slider values created five implicit `status` roles. They were replaced with neutral text mirrors, preserving the native range input's accessible value and the existing single controlled live-status invariant.
- README now documents the exact checked-in bounded catalog: **30 universities, 45 computing programs, and 11 country codes**. No global-coverage claim was added.
- Final affected verification passed: Vitest **593/593**; TypeScript; ESLint; Windows-native Next.js 16.3.1 production build; release-config verifier; workspace verifier; `npm audit --omit=dev` with **0 vulnerabilities**; Windows-native `git diff --check`; development Compare **60/60** and Guide **54/54**; built-production Compare **60/60** and Guide **54/54**; three-repeat Compare lifecycle **51/51**; local Supabase Auth/Saved **21/21**, all with Playwright retries zero where configured. The direct Auth/Saved invocation that omitted the project Supabase environment wrapper was invalid harness usage; the canonical `scripts/run-playwright-local-supabase.mjs` run passed.
- Security/privacy documentation did not require semantic changes: this cleanup adds no new external origin, secret, applicant-to-provider data flow, persistence channel, or deployment behavior. The existing security boundaries remain unchanged.
- `ui-flow-screenshots/` remains protected, local, and untracked. Phase 6C remains unstarted.
