# Phase 4 Comparison Mode Implementation Plan

> **For agentic workers:** Implement this plan inline in the main ChatGPT agent. The user explicitly made subagents/reviewer agents unavailable for this batch, so do not invoke `subagent-driven-development`, `code-reviewer`, `security-auditor`, or any child agent. Apply the equivalent planning, TDD, security, browser-QA, traceability, and final review work directly in the main agent.

**Goal:** Implement the entire Phase 4 Comparison Mode in one batch: two-to-four target research, deterministic evidence-gated fit scoring and coverage, evidence-bound trade-offs, hardened accessible responsive UI, and project-wide browser security/privacy hardening, without weakening Phase 2/3 evidence semantics.

**Architecture:** Reuse the existing hardened same-origin `POST /api/research` sequentially for each target; keep only validated `ResearchDossier` values in React memory; derive comparison metrics/scores/trade-offs in pure deterministic application modules. Do not create `/api/compare` or a new AI scoring call. Add a strict Next.js 16 nonce CSP and global security headers as runtime/browser hardening, while leaving local developing-agent repository/tool access unrestricted.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Zod 4.4.3, Tailwind/shadcn/Radix, Vitest 4.1.10, `@playwright/test` 1.62.1.

**Spec:** `docs/planning/phase-4-comparison-mode.md`

**Threat model:** `docs/security-threat-model.md`

> **2026-08-20 update:** This historical implementation runbook records the original exact-total-100 weight UX. Current Comparison behavior is governed by `docs/planning/phase-4-comparison-mode.md` and `docs/superpowers/plans/2026-08-20-pre-phase6c-ui-comparison-cleanup.md`: five raw 0–100 relative sliders, all-zero rejection, and deterministic `raw / sum(raw)` normalization. Do not reintroduce the older exact-total constraint from the historical steps below.

## Global constraints

- Baseline reviewed/pushed application commit: `9d01a57c1df8f4aa471d5313811c70f2177a5415`.
- `LESSONS.md` is always the first manual project file read at implementation-session start.
- Read `AGENT_MEMORY.md`, this plan, the Phase 4 spec, `docs/requirements.md`, `docs/design.md`, `docs/security.md`, `SECURITY.md`, and `AGENTS.md` before code edits.
- Phase 4 uses zero subagents/reviewer agents. The main agent performs all work, including the final separate defect-first review.
- `ui-flow-screenshots/` is protected user-owned untracked content. Never modify, delete, rename, move, stage, commit, or reuse those files as test output. Hash them before and after Phase 4.
- No live Tavily/Brave/ROR/university/Gemini/Groq/OpenRouter request without separate explicit authorization.
- No deployment, Devpost submission, commit, push, branch creation, or PR unless separately explicitly authorized.
- No authentication, persistence, Supabase migration/RLS implementation, saved comparison history, applicant-profile collection, Phase 5 Guide work, or Phase 6 deployment infrastructure in this batch.
- No new package unless the existing stack is proven insufficient. Implementation found one narrow exception: strict CSP required direct application use of the existing transitive `get-nonce` channel for Radix runtime style nonces, so `get-nonce@^1.0.1` is now declared directly and is the only Phase 4 manifest/lockfile dependency addition.
- No provider order/model/endpoint changes.
- Do not weaken Phase 2/3 evidence states, Research request/result contracts, response bounds, sensitive-input guard, SSRF protections, cancellation semantics, or browser validation to make Comparison easier.
- Comparison never parses numeric-looking strings, converts currency/units, chooses a conflict winner, infers freshness from retrieval time, fuzzy-matches claim properties, or uses an LLM for scoring/trade-offs.
- Runtime/browser security controls must not reduce the local developing AI agent's authorized filesystem/tool/test access.
- Production behavior changes follow RED -> observed expected failure -> minimal GREEN -> refactor while green.
- Generated IDs and all string bounds continue to use the existing project UTF-16 contract metric unless a source contract explicitly says otherwise.

---

## Task 0: Freeze the exact Phase 3D baseline and planning-only delta

**Files:**
- Read: `LESSONS.md`
- Read: `AGENT_MEMORY.md`
- Read: `AGENTS.md`
- Read: `docs/planning/phase-4-comparison-mode.md`
- Read: `docs/security-threat-model.md`
- Read: `docs/requirements.md`
- Read: `docs/design.md`
- Read: `docs/security.md`
- Read: `SECURITY.md`
- Read: `package.json`
- Read: `package-lock.json`
- Read: `app/compare/page.tsx`
- Read: `lib/research/mode/public-contracts.ts`
- Read: `lib/research/mode/client-transport.ts`
- Read: `tests/e2e/helpers/research-browser.ts`
- Read-only hash: `ui-flow-screenshots/*.png`

**Produces:** recorded implementation baseline, exact protected screenshot manifest, and confirmation that only approved planning docs plus protected screenshots are present before code work.

- [x] **Step 1: Resolve the actual Git root, branch, status, remotes, and HEAD**

Use CodexPro native Git/status tools where possible. Confirm the root is `D:\Side Projects\UniProof`, branch is `main`, and the committed baseline ancestry contains `9d01a57c1df8f4aa471d5313811c70f2177a5415`. Treat any unexpected code/config change as user-owned until resolved.

- [x] **Step 2: Record the protected screenshot manifest without modifying the files**

Record filename, byte length, and SHA-256 for all ten current `ui-flow-screenshots/*.png` files. The expected file count is ten. Preserve the manifest in task-local ignored output or the execution log; do not add the PNGs to Git.

- [x] **Step 3: Run the pre-Phase-4 regression baseline**

Run:

```text
npm test
npx playwright test
npx tsc --noEmit
npm run lint
npm run build
npm audit --omit=dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:/Side Projects/UniProof/scripts/verify-workspace.ps1"
git diff --check
```

The last published Phase 3D evidence was 306/306 Vitest and 66/66 Playwright. Do not require those exact counts if planning-only tests/docs legitimately changed later; require every discovered test to pass and explain any count change.

- [x] **Step 4: Stop on baseline failure**

If a baseline code/test/build gate fails before Phase 4 production changes, diagnose whether it is an existing defect or environment issue. Do not bury it inside Phase 4. Add a regression and fix only if it blocks the batch and is inside the authorized project scope.

---

## Task 1: Add strict browser security policy and headers first

**Files:**
- Create: `lib/security/browser-policy.ts`
- Create: `tests/phase4-security-headers.test.ts`
- Create: `proxy.ts`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: `playwright.config.ts`
- Modify: `tests/playwright-config-safety.test.ts`
- Test: `tests/e2e/compare-security.spec.ts` (initial header/CSP cases; more cases are added in Task 9)

**Interfaces:**

```ts
export type ContentSecurityPolicyInput = {
  nonce: string;
  isDevelopment: boolean;
  requestUrl: string;
};

export function buildContentSecurityPolicy(
  input: ContentSecurityPolicyInput,
): string;

export const staticSecurityHeaders: readonly {
  key: string;
  value: string;
}[];
```

`proxy.ts` consumes `buildContentSecurityPolicy()` and generates one fresh nonce per eligible HTML request. `next.config.ts` consumes `staticSecurityHeaders` and sets `poweredByHeader: false`.

- [x] **Step 1: Write RED unit tests for production CSP invariants**

Create tests asserting a production policy:

- contains the exact supplied nonce;
- contains `strict-dynamic`;
- contains `script-src-attr 'none'`;
- contains `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`;
- contains only self for production `connect-src`;
- does **not** contain script `unsafe-eval`;
- does **not** contain script `unsafe-inline`;
- contains no `http://`, `https://`, `ws://`, or `wss://` third-party origin;
- emits one normalized single-line value without CR/LF header injection.

Run:

```text
npx vitest run tests/phase4-security-headers.test.ts
```

Expected RED: module/function does not exist.

- [x] **Step 2: Write RED unit tests for development CSP invariants**

Assert development adds only the documented React/Next compatibility script exception `unsafe-eval` and an exact same-host WebSocket origin derived from `requestUrl`. Ensure an attacker-controlled URL fragment/query cannot enter the CSP. If style compatibility needs a development-only `unsafe-inline`, it must be asserted as development-only and production tests must prohibit it.

- [x] **Step 3: Write RED tests for static headers**

Assert exact presence/value:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
X-DNS-Prefetch-Control: off
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Do not add HSTS in development/Phase 4.

- [x] **Step 4: Implement `browser-policy.ts` minimally**

Generate policy from controlled tokens only. Derive the development WebSocket source by parsing `requestUrl`, preserving only scheme/hostname/port and mapping HTTP->WS / HTTPS->WSS. Reject/omit malformed request URL input rather than copying it into a header.

Recommended production directives:

```text
default-src 'self';
script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
script-src-attr 'none';
style-src-elem 'self' 'nonce-${nonce}';
style-src-attr 'none';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'none';
form-action 'self';
frame-ancestors 'none';
frame-src 'none';
media-src 'none';
manifest-src 'self';
```

Do not add `upgrade-insecure-requests` in development. Do not add third-party script/connect origins.

- [x] **Step 5: Implement Next.js 16 `proxy.ts` nonce injection**

Use the current `proxy` filename/export, not deprecated `middleware`. Generate an unpredictable per-request nonce using the platform cryptographic API. Put the CSP on the request header Next uses for nonce extraction and on the HTML response. Use a matcher that excludes API routes, `_next/static`, `_next/image`, icons/static assets, and prefetches that do not render HTML.

Do not echo the nonce as a separate public diagnostic header.

- [x] **Step 6: Force request-bound rendering for nonce support**

Convert `app/layout.tsx` to the minimal async request-bound form required by current Next.js nonce CSP. Prefer the official `connection()` mechanism from `next/server` to force dynamic rendering. Preserve the global skip link/header/footer behavior exactly.

- [x] **Step 7: Update the isolated dev Playwright snapshot to include `proxy.ts`**

Phase 3D's dev harness copies selected root files into `output/playwright/phase3d-dev-app-*`; it currently does not copy a future root `proxy.ts`. Extend the harness root-file list so every dev E2E run copies `proxy.ts` after it exists. Extend `tests/playwright-config-safety.test.ts` or extract a pure required-root-file helper so the CSP proxy cannot silently disappear from the disposable dev app while built-app tests still pass. Keep the existing harness-ID containment/deletion safety unchanged.

A focused dev `compare-security.spec.ts` must fail if the snapshot lacks the proxy/CSP; observe that RED before fixing the snapshot copier if the order of implementation exposes it.

- [x] **Step 8: Add static headers and remove framework disclosure**

Update `next.config.ts` with `poweredByHeader: false` and `headers()` returning `staticSecurityHeaders` for application routes. Do not override immutable Next static-asset cache headers or the Research API's `Cache-Control: no-store` semantics.

- [x] **Step 9: Run unit/type/build gates**

Run:

```text
npx vitest run tests/phase4-security-headers.test.ts
npx tsc --noEmit
npm run lint
npm run build
```

Expected GREEN.

- [x] **Step 10: Add and run a first real-browser CSP/header test**

In `compare-security.spec.ts`, navigate to `/compare`, inspect the document response headers, and assert CSP + static headers. Attach listeners for CSP violations/application console errors. Verify the existing page still renders, global navigation works, and the skip link remains keyboard-operable.

Run the focused spec against dev. If Radix/Next requires inline runtime styles in real flows later, do not broadly disable CSP. Add the narrowest `style-src-attr` or development-only exception and a regression that production script policy remains strict.

---

## Task 2: Define strict Comparison contracts and form invariants

**Files:**
- Create: `lib/comparison/contracts.ts`
- Create: `lib/comparison/client-form.ts`
- Create: `tests/phase4-comparison-contracts.test.ts`

**Interfaces:**

```ts
export const comparisonPriorityOrder = [
  "affordability",
  "research",
  "scholarships",
  "outcomes",
  "support",
] as const;

export type ComparisonPriority = typeof comparisonPriorityOrder[number];

export type ComparisonTarget = {
  universityId: string;
  programId?: string;
};

export type ComparisonPriorityWeights = Record<ComparisonPriority, number>;

export type ComparisonSubmission = {
  targets: readonly ComparisonTarget[];
  categories: readonly ResearchModeCategory[];
  weights: ComparisonPriorityWeights;
  showRankingEvidence: boolean;
  showAnecdotalEvidence: boolean;
  intake?: string;
  academicYear?: string;
};

export function comparisonTargetKey(target: ComparisonTarget): string;

export function validateComparisonForm(
  state: ComparisonFormState,
  catalog: ResearchCatalog,
): {
  submission?: ComparisonSubmission;
  fieldErrors: Partial<Record<ComparisonFormField, string>>;
};
```

- [x] **Step 1: Write RED contract tests for target count and uniqueness**

Exact cases:

- 2/3/4 unique targets valid;
- 0/1/5 invalid;
- duplicate university-only invalid;
- duplicate program invalid;
- different programs at same university valid when same degree level.

- [x] **Step 2: Write RED catalog semantic tests**

Exact cases:

- unknown university ID invalid;
- unknown program ID invalid;
- program/university ownership mismatch invalid;
- mixed university-only + program invalid;
- bachelor + master program comparison invalid;
- selected target remains valid even if search/filter no longer matches.

- [x] **Step 3: Write RED weight/category tests**

Exact cases:

- integers 30/30/20/20/0 sum 100 valid;
- sum 99 and 101 invalid;
- negative, >100, decimal, NaN, Infinity invalid;
- positive affordability with `tuition` excluded invalid;
- positive research with `research` excluded invalid;
- positive scholarships with `scholarships` excluded invalid;
- positive outcomes with `outcomes` excluded invalid;
- positive support with `support` excluded invalid;
- a weight 0 allows the backing category to be excluded.

- [x] **Step 4: Write RED input/privacy tests**

Assert the submission contract contains no `question`, applicant profile, GPA, citizenship, budget, email, document, provider, model, or arbitrary URL field. Assert `intake`/`academicYear` reuse existing bounded public-context semantics.

- [x] **Step 5: Implement the strict schemas and validator**

Use strict Zod objects for shape/type bounds, then catalog-aware pure validation for ownership/scope/degree/category-weight relationships. Canonicalize Research categories using the existing `canonicalizeResearchModeCategories` helper. Do not mutate user state silently during validation.

- [x] **Step 6: Implement deterministic target search/selection helpers**

Reuse Phase 3 catalog search semantics rather than reimplementing fuzzy search. Selected targets are a separate ordered list. Filters affect candidate results only.

- [x] **Step 7: Run focused tests**

```text
npx vitest run tests/phase4-comparison-contracts.test.ts
```

---

## Task 3: Build the closed comparison metric registry and normalization gate

**Files:**
- Create: `lib/comparison/metrics.ts`
- Create: `lib/comparison/normalize.ts`
- Create: `tests/phase4-comparison-normalize.test.ts`

**Interfaces:**

```ts
export type ComparisonMetricId =
  | "annual-tuition"
  | "scholarship-availability"
  | "scholarship-presence"
  | "research-opportunity-availability"
  | "employment-rate"
  | "international-support-availability";

export type ComparisonMetricValue =
  | { kind: "number"; value: number; currency?: string; unit?: string; periodKey?: string }
  | { kind: "boolean"; value: boolean; periodKey?: string }
  | { kind: "presence"; value: true; periodKey?: string };

export type ComparisonMetricFact = {
  targetKey: string;
  dimension: ComparisonPriority;
  metricId: ComparisonMetricId;
  value: ComparisonMetricValue;
  claimIds: readonly string[];
  sourceIds: readonly string[];
};

export type ComparisonUnscoredReason =
  | "category-not-researched"
  | "category-unknown"
  | "category-incomplete"
  | "no-eligible-metric"
  | "unsupported-value-type"
  | "conflicting"
  | "outdated"
  | "inferred-only"
  | "anecdotal-only"
  | "ranking-only"
  | "duplicate-inconsistent-values"
  | "currency-mismatch"
  | "unit-mismatch"
  | "period-mismatch"
  | "insufficient-peers";

export function normalizeComparisonPropertyKey(value: string): string;

export function deriveTargetMetricFacts(
  dossier: ResearchDossier,
  submission: ComparisonSubmission,
): TargetMetricDerivation;
```

- [x] **Step 1: Write RED property-key normalization tests**

Assert trim/lowercase/NFC/ASCII-whitespace collapse/cosmetic separator normalization only. Assert lookalike/fuzzy strings do not match, including extra semantic words, translated text, misspellings, and numeric suffixes.

- [x] **Step 2: Write RED registry alias tests**

For every alias listed in Phase 4 spec Section 9, assert it maps to exactly one metric. Assert near-miss aliases do not map.

- [x] **Step 3: Write RED type/range tests**

Exact cases:

- annual tuition finite number + currency valid;
- annual tuition string `"50000"` invalid for scoring;
- generic `tuition fee` with no explicit annual unit invalid;
- scholarship boolean valid; string `"yes"` invalid;
- scholarship name/presence string valid only for presence metric;
- employment 0 and 100 valid, -1/101 invalid;
- employment `"95%"` invalid;
- support/research booleans valid; strings invalid;
- NaN/Infinity invalid.

- [x] **Step 4: Write RED evidence/source eligibility tests**

Assert only `verified`, `corroborated`, `university-reported` can score. Assert `conflicting`, `outdated`, `anecdotal`, `inferred` cannot. Assert ranking-only/anecdotal-only supporting source sets cannot score. Assert a mixed claim with at least one eligible non-ranking/non-anecdotal source may remain eligible if its verification status is eligible.

- [x] **Step 5: Write RED period tests**

Cover explicit requested academic year/intake matches, explicit mismatch, shared explicit period, mixed period, no-period numeric tuition/outcomes, and no-period boolean/presence. Retrieval timestamp must never satisfy an effective-period requirement.

- [x] **Step 6: Write RED duplicate/conflict defense tests**

Exact duplicate facts collapse and retain all claim/source IDs. Different typed values/currency/unit/period for the same target metric become the appropriate stable unscored reason. No newest/majority winner.

- [x] **Step 7: Implement the registry as immutable application-owned data**

No generated aliases, regex fuzziness, AI, embeddings, or external configuration. Make precedence explicit: `scholarship-availability` before `scholarship-presence`.

- [x] **Step 8: Implement normalization with one scan per dossier**

Index source IDs once, index category rows once, normalize only candidate properties for the registry, and return bounded facts/reasons. Avoid nested full-dossier rescans for every UI render.

- [x] **Step 9: Run focused tests**

```text
npx vitest run tests/phase4-comparison-normalize.test.ts
```

---

## Task 4: Implement deterministic metric scoring, coverage, and fit suppression

**Files:**
- Create: `lib/comparison/score.ts`
- Create: `tests/phase4-comparison-score.test.ts`

**Interfaces:**

```ts
export type ComparisonDimensionOutcome =
  | {
      state: "scored";
      dimension: ComparisonPriority;
      score: number;
      metricId: ComparisonMetricId;
      claimIds: readonly string[];
    }
  | {
      state: "unscored";
      dimension: ComparisonPriority;
      reason: ComparisonUnscoredReason;
      claimIds: readonly string[];
    };

export type ComparisonTargetScore = {
  targetKey: string;
  dimensions: readonly ComparisonDimensionOutcome[];
  coverage: number;
  scoredPositiveDimensions: number;
  fitScore?: number;
  fitSuppressedReason?: "insufficient-comparable-evidence";
};

export function scoreComparison(
  dossiers: readonly ResearchDossier[],
  submission: ComparisonSubmission,
): ComparisonScoreResult;
```

- [x] **Step 1: Write RED numeric higher/lower tests**

Use exact deterministic fixture values to assert min-max math for annual tuition (lower) and employment rate (higher). Assert internal score precision before display rounding.

- [x] **Step 2: Write RED tie/order-invariance tests**

All equal participating numeric values score 100. Reordering the same target set changes no target-specific scores. Adding/removing a target may change relative numeric scores and must be documented by test name.

- [x] **Step 3: Write RED absolute boolean/presence tests**

True->100, false->0, explicit presence->100. A peer missing the fact remains unscored and does not prevent the absolute target from being scored.

- [x] **Step 4: Write RED relative numeric insufficient-peer tests**

Only one compatible annual tuition or employment fact -> `insufficient-peers`; no numeric relative score.

- [x] **Step 5: Write RED cross-target compatibility tests**

Mixed annual-tuition currencies, units, or incompatible periods must not be normalized together. No conversion. Compatible subset behavior must be deterministic: score only the mutually compatible cohort when at least two exist; other targets receive the exact mismatch/gap reason.

- [x] **Step 6: Write RED weighted coverage tests**

With weights summing to 100, assert coverage equals sum of weights whose dimensions are scored for each target. Missing dimensions never add score zero.

- [x] **Step 7: Write RED fit tests**

Assert:

- weighted average renormalizes only across available scored dimensions;
- 49% coverage suppresses fit;
- one scored positive dimension at >=50% suppresses fit;
- exactly 50% and two positive dimensions allows fit;
- 100% coverage works;
- zero-weight scored dimensions do not count toward coverage or the two-dimension threshold;
- display rounding happens only at projection/UI, not during intermediate math.

- [x] **Step 8: Implement score functions as pure finite-number math**

Reject/convert impossible internal non-finite values to unscored state rather than propagating NaN into React. Never sort result targets by fit; preserve submission order.

- [x] **Step 9: Run focused tests**

```text
npx vitest run tests/phase4-comparison-score.test.ts
```

---

## Task 5: Generate deterministic evidence-bound trade-offs and gap explanations

**Files:**
- Create: `lib/comparison/tradeoffs.ts`
- Create: `tests/phase4-comparison-tradeoffs.test.ts`

**Interfaces:**

```ts
export type ComparisonTradeoff = {
  id: string;
  dimension: ComparisonPriority;
  kind: "relative" | "tie" | "gap" | "warning";
  summary: string;
  targetKeys: readonly string[];
  evidenceRefs: readonly { targetKey: string; claimId: string }[];
};

export function buildComparisonTradeoffs(
  scoreResult: ComparisonScoreResult,
  dossiers: readonly ResearchDossier[],
  submission: ComparisonSubmission,
): readonly ComparisonTradeoff[];
```

- [x] **Step 1: Write RED exact-reference tests**

Every factual relative/tie trade-off must carry target-scoped evidence references that resolve inside the correct target dossier and priority category. Gap-only text may have zero evidence references when no evidence exists.

- [x] **Step 2: Write RED language-safety tests**

Generated summaries must not contain `best university`, `top university`, `prestige`, `admission chance`, `admission probability`, `guaranteed`, `recommended because`, or causal quality claims.

- [x] **Step 3: Write RED deterministic-order tests**

Weight descending -> canonical priority order -> selection order. Same input produces byte-identical summaries/order.

- [x] **Step 4: Write RED gap-reason tests**

Generate clear deterministic messages for unknown, incomplete, no eligible metric, conflict, outdated, inferred-only, anecdotal-only, ranking-only, currency/unit/period mismatch, duplicate inconsistent values, and insufficient peers.

- [x] **Step 5: Implement templates only from validated structured fields**

Do not interpolate raw HTML. Use server-returned target display names only as React text later. Avoid copying full supporting evidence into the trade-off summary; claim IDs provide evidence drill-down.

- [x] **Step 6: Run focused tests**

```text
npx vitest run tests/phase4-comparison-tradeoffs.test.ts
```

---

## Task 6: Implement pure Compare workspace state and sequential batch orchestration

**Files:**
- Create: `lib/comparison/client-state.ts`
- Create: `tests/phase4-comparison-state.test.ts`
- Modify later consumer: `components/compare/compare-workspace.tsx`

**Interfaces:**

Use the `ComparisonWorkspaceState` union in the spec. Define explicit actions:

```ts
export type ComparisonWorkspaceAction =
  | { type: "start"; sequence: number; submission: ComparisonSubmission }
  | { type: "target-complete"; sequence: number; index: number; outcome: ComparisonResearchOutcome }
  | { type: "complete"; sequence: number; result: ComparisonResult }
  | { type: "fail"; sequence: number; error: ComparisonWorkspaceError; completedTargets: readonly ComparisonResearchOutcome[] }
  | { type: "cancel"; sequence: number }
  | { type: "clear-result" };
```

- [x] **Step 1: Write RED reducer sequence tests**

Stale `target-complete`, `complete`, `fail`, and `cancel` actions do not alter a newer active sequence. Target completion for wrong index/identity fails closed or is ignored according to the reducer contract; never append it to a different target.

- [x] **Step 2: Write RED preserved-result ownership tests**

Start over a prior result preserves it, cancel restores it, error preserves it, clear-result removes both current error and prior result while form state remains outside reducer. Reset form is not a reducer result-clear operation.

- [x] **Step 3: Write RED partial/minimum-usable tests**

At least two succeeded/partial usable dossiers can complete comparison. Valid failed dossier and transport error are unusable. Fewer than two usable -> comparison error, no score result.

- [x] **Step 4: Write RED retry-set tests**

Derive retry-eligible exact target keys from failed transport/failed dossier and optional partial/incomplete dossier status. Replayed targets use the immutable prior submission categories/intake/year and are merged only by exact target key.

- [x] **Step 5: Implement pure reducer/helpers**

No fetch/DOM inside reducer. No persistence. No timers. Keep state bounded to max four target outcomes plus validated dossiers.

- [x] **Step 6: Run focused tests**

```text
npx vitest run tests/phase4-comparison-state.test.ts
```

---

## Task 7: Replace the illustrative Compare page with the live accessible workspace

**Files:**
- Modify: `app/compare/page.tsx`
- Create: `components/compare/compare-workspace.tsx`
- Create: `components/compare/compare-form.tsx`
- Create: `components/compare/compare-run-banner.tsx`
- Create: `components/compare/comparison-results.tsx`
- Create: `components/compare/comparison-target-card.tsx`
- Create: `components/compare/comparison-priority-row.tsx`
- Create: `components/compare/comparison-tradeoffs.tsx`
- Reuse: `components/research/claim-evidence-sheet.tsx` where compatible
- Test via Task 9 Playwright specs

**Interfaces:**

`app/compare/page.tsx` passes only the public `researchCatalog` to `<CompareWorkspace catalog={researchCatalog} />`.

`CompareWorkspace` owns editable form state separately from immutable run state. It owns:

```ts
const activeBatchRef = React.useRef<{
  sequence: number;
  controller: AbortController;
} | null>(null);
```

- [x] **Step 1: Remove all static Example A/B/C factual values**

The page must not show example fit/coverage scores next to a live form. Preserve the established typography, card borders, spacing, and “Compare fit, not prestige” visual direction.

- [x] **Step 2: Implement catalog-driven target selection**

Reuse deterministic Phase 3 search/filter helpers. Show selected targets independently. Add accessible remove buttons. Enforce 2–4 and homogeneous scope/degree rules through `validateComparisonForm()`.

- [x] **Step 3: Implement Research category and priority controls**

Use native inputs with explicit labels. Show weight total as `100 / 100`. Do not auto-normalize invalid totals. Keep all five priorities visible including Support=0 default. Show Admissions/Program structure as display-only Research categories, not hidden score dimensions.

- [x] **Step 4: Implement ranking/student-opinion display toggles**

Copy explains that these filters affect visible contextual evidence only and never increase/decrease numeric fit.

- [x] **Step 5: Implement optional public intake/year and privacy copy**

No free-form question. Copy explicitly tells users not to put applicant/private data into Compare.

- [x] **Step 6: Implement form validation focus/ARIA**

Stable error IDs. After submit validation failure, focus the first invalid control via requestAnimationFrame. Search/selected-target group handles target count/scope/degree errors; priority group handles sum/category-weight errors.

- [x] **Step 7: Implement synchronous single-flight and sequential research loop**

Before any `await`, check/set `activeBatchRef`. For each target in immutable selected order:

1. abort check;
2. build the existing `ResearchModeRequest` from target + categories + optional intake/year;
3. call `executeResearchRequest(request, controller.signal)`;
4. abort/stale active-ref check;
5. record exact target outcome;
6. only then continue to next target.

Never `Promise.all` the Research calls.

- [x] **Step 8: Implement cancellation/unmount**

Cancel calls `controller.abort()` only for the current active batch and immediately prevents later target dispatch. Component cleanup aborts the active batch. No UI auto retry.

- [x] **Step 9: Implement completion and scoring**

When sequence finishes, require >=2 usable dossiers, then call the pure comparison score/trade-off modules. Parse/validate any final local result schema if defined before dispatching `complete`.

- [x] **Step 10: Implement retry ownership**

Retry incomplete/failed research uses prior immutable submission and retry target set; merges exact replacements. New Compare uses current editable form. Expose at most one visible retry owner for the newest result/error context.

- [x] **Step 11: Render truthful progress**

Use one controlled `role="status"` region: `Researching option N of M: <immutable target label>`. No percentage, provider/model, or ETA.

- [x] **Step 12: Render result cards in immutable selection order**

Each card shows server-returned canonical target identity, fit or suppression, evidence coverage, all five priorities with score/unscored reason, and relevant lifecycle/evidence warnings. Never auto-sort by score or add a winner badge.

- [x] **Step 13: Render deterministic trade-offs**

Trade-off summaries are React text. Evidence action resolves exact claim ID -> target dossier -> existing evidence sheet. Gap text with no claim has no fake evidence button.

- [x] **Step 14: Preserve evidence focus semantics**

Opening evidence traps focus; Escape/close returns to exact trigger while mounted. When a new result replaces the old one, close old evidence before trigger unmount to avoid detached focus restoration.

---

## Task 8: Create deterministic Compare browser fixtures and helper support

**Files:**
- Modify: `tests/fixtures/research-dossiers.ts`
- Modify narrowly: `tests/e2e/helpers/research-browser.ts`
- Create or colocate Compare fixture helpers only if needed: `tests/e2e/helpers/compare-browser.ts`

**Produces:** schema-valid invented dossiers for scoring/edge cases and explicitly unvalidated malformed objects only in tests that prove rejection.

- [x] **Step 1: Add valid comparison target dossier family**

Create invented catalog-backed fixtures for four targets covering:

- same-currency annual tuition numeric facts;
- scholarship boolean/presence facts;
- research boolean facts;
- employment numeric percentages with explicit compatible period;
- support boolean facts;
- exact source/claim associations;
- all-ready and partial dossier variants.

All valid fixtures must parse through `researchModeResponseSchema` before use.

- [x] **Step 2: Add strict adversarial variants**

Create separate cases for:

- numeric-looking strings;
- mixed currency;
- mixed unit;
- mixed academic year/effective date;
- duplicate inconsistent metrics;
- conflict/outdated/inferred/anecdotal/ranking-only;
- category unknown;
- category incomplete;
- no canonical alias;
- very long contract-valid text/Unicode/URLs;
- XSS-shaped property/value/supporting text;
- failed/transport cases.

Do not weaken the public dossier schema to manufacture invalid fixtures. Use the existing explicitly unvalidated path only for malformed-response tests.

- [x] **Step 3: Extend route helper only where needed**

The current `ResearchRouteController` queue already proves exact ordered request consumption. Add only Compare conveniences that do not weaken its fail-closed unexpected/unconsumed request checks.

---

## Task 9: Build complete Phase 4 Playwright acceptance

**Files:**
- Create: `tests/e2e/compare-form.spec.ts`
- Create: `tests/e2e/compare-lifecycle.spec.ts`
- Create: `tests/e2e/compare-scoring.spec.ts`
- Create: `tests/e2e/compare-evidence.spec.ts`
- Create: `tests/e2e/compare-accessibility.spec.ts`
- Expand: `tests/e2e/compare-security.spec.ts`
- Create: `tests/e2e/compare-responsive.spec.ts`

### 9A. Form and request semantics

- [x] **Write RED `compare-form.spec.ts` cases**

Prove:

- initial page contains no Example A/B/C score cards;
- select exactly 2/3/4 targets;
- reject 0/1/5, duplicate, mixed scope, mixed degree with zero Research dispatch;
- filters/search do not silently retarget selected items;
- default weights are 30/30/20/20/0 and total 100;
- 99/101/negative/decimal invalid;
- positive weight with backing category excluded invalid;
- ranking/opinion toggles do not alter request body;
- request body contains only university/program IDs, canonical categories, optional intake/year;
- comparison weights never go to `/api/research`;
- same-tick double submit dispatches one first request only.

### 9B. Lifecycle/race semantics

- [x] **Write RED `compare-lifecycle.spec.ts` cases**

Prove:

- request 2 is not dispatched while deferred request 1 is pending;
- requests proceed 1->2->3->4 only after each prior reply;
- Cancel during request 1 means requests 2–4 never dispatch;
- Cancel during request 3 means request 4 never dispatches;
- stale released result cannot overwrite a newer batch;
- unmount/navigation aborts and later release cannot update old page;
- one target transport failure + >=2 usable results -> partial comparison;
- <2 usable -> explicit error/no fit;
- partial dossier remains usable with visible gaps;
- retry exact failed/incomplete target snapshots only;
- edited current form is not substituted into Retry;
- new Compare uses edited current form;
- Clear result clears result/error but preserves current form.

### 9C. Scoring semantics

- [x] **Write RED `compare-scoring.spec.ts` cases**

Prove in rendered UI:

- lower annual tuition scores higher within compatible set;
- higher employment percentage scores higher;
- equal numeric values tie;
- booleans/presence use absolute semantics;
- numeric string never becomes numeric score;
- mixed currency/unit/period shows explicit unscored reason;
- missing evidence is not displayed as score 0;
- conflict/outdated/inferred/anecdotal/ranking-only never contributes;
- 49%/one-dimension suppresses overall fit;
- exact 50% + two dimensions allows fit;
- coverage is displayed next to fit;
- card order stays selected order even if later card has higher fit;
- no winner/prestige/best-university language.

### 9D. Evidence and trade-offs

- [x] **Write RED `compare-evidence.spec.ts` cases**

Prove:

- deterministic trade-off order;
- each factual trade-off evidence trigger opens exact claim evidence;
- representative source first and all claim source links once;
- official target links remain catalog-owned;
- conflict/outdated/unknown/incomplete warnings retain exact semantics;
- ranking/opinion toggles affect contextual display only and do not alter score/coverage;
- safe anchor attributes remain `_blank`, `noopener noreferrer`, `no-referrer`;
- XSS-looking evidence remains inert text.

### 9E. Accessibility

- [x] **Write RED `compare-accessibility.spec.ts` cases**

Prove:

- global Skip to main content remains first-tab reachable and focuses `#main-content`;
- one main landmark and coherent visible heading levels;
- target/priority/category/filter/input controls have labels;
- exact errors are associated using stable IDs;
- keyboard can select/remove targets, edit weights/categories, submit, cancel, retry, clear, open/close evidence;
- no positive tabindex;
- visible focus;
- one controlled live lifecycle/progress status;
- evidence focus trap/Escape/exact focus return;
- sticky-header focus non-obscuration at 320/375/390;
- practical target geometry >=24px;
- reduced motion preserves loading/completion meaning.

### 9F. Security/privacy

- [x] **Expand RED/GREEN `compare-security.spec.ts` cases**

Prove on both dev and built application:

- CSP exists on `/`, `/research`, `/compare`, `/guide` HTML;
- production CSP has nonce + strict-dynamic and no script unsafe-inline/unsafe-eval;
- static security headers exact;
- `x-powered-by` absent;
- CSP violation event list remains empty through Compare and Research evidence flows;
- no unexpected external HTTP(S) request, popup, dialog, page error, app console error;
- XSS-shaped property/value/supporting text creates no script/img/event-handler DOM;
- `localStorage`, `sessionStorage`, IndexedDB databases, Cache Storage keys, service-worker registrations remain empty/unchanged by Compare;
- no third-party script element/source;
- no provider key names or Phase 2 provider-attempt/internal array fields appear in rendered DOM or public response bodies;
- no comparison query-string persistence after interactions.

### 9G. Responsive/stress

- [x] **Write RED `compare-responsive.spec.ts` matrix**

For 320x740, 375x812, 390x844, 768x1024, 1024x768, 1440x900:

- four-target long-content result;
- no page horizontal overflow >1px;
- all cards/controls reachable;
- weight controls usable;
- long names/values/reasons wrap;
- evidence dialog usable with 12 sources/2,000-char text;
- several-hundred-claim dossiers do not render all irrelevant claims in comparison cards or throw runtime errors.

- [x] **Run the complete dev suite after all Compare browser specs are green**

```text
npx playwright test
```

Configured retries remain zero.

- [x] **Repeat the critical race spec five times**

```text
npx playwright test tests/e2e/compare-lifecycle.spec.ts --repeat-each=5
```

Any flake is a defect. Do not enable retries to hide it.

---

## Task 10: Full regression, security/privacy audit, documentation, and inline final review

**Files:**
- Modify after verified behavior only: `docs/requirements.md`
- Modify after verified behavior only: `docs/design.md`
- Modify after verified behavior only: `docs/security.md`
- Modify after verified behavior only: `SECURITY.md`
- Modify after verified behavior only: `docs/planning/tasks.md`
- Modify after verified behavior only: `README.md`
- Append after meaningful implementation: `AGENT_MEMORY.md`
- Append only reusable discovered correction: `LESSONS.md`

### 10A. Full automated gates

- [x] **Run full Vitest**

```text
npm test
```

- [x] **Run TypeScript**

```text
npx tsc --noEmit
```

- [x] **Run ESLint**

```text
npm run lint
```

- [x] **Run production build**

```text
npm run build
```

Confirm strict nonce CSP/dynamic rendering does not produce build/runtime errors.

- [x] **Run production dependency audit**

```text
npm audit --omit=dev
```

Any production vulnerability is a blocker requiring investigation; do not claim zero vulnerabilities unless output says zero.

- [x] **Run complete built-application Playwright**

Use the existing Playwright-config production switch:

```text
cmd.exe /d /s /c "set UNIPROOF_E2E_PRODUCTION=1&& npx.cmd playwright test"
```

Do not attach to an arbitrary existing server. `reuseExistingServer` remains false.

- [x] **Run workspace/diff checks**

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:/Side Projects/UniProof/scripts/verify-workspace.ps1"
git diff --check
```

### 10B. Security/privacy residue gates

- [x] **Run strict UTF-8/control scan**

Scan intended project text files excluding dependencies/generated protected assets. Report file count and findings count.

- [x] **Run real credential-value scan privately**

Read configured values from ignored `.env.local` only inside a task-local ignored script/process; scan intended source/docs plus final `.next/server` and `.next/static`; print only key name + file path on a hit, never the credential/fingerprint. Required result: zero hits. Delete the temporary scanner afterward.

- [x] **Run client-boundary static scans**

Search Compare/Research client graph and final browser output for:

```text
TAVILY_API_KEY
BRAVE_SEARCH_API_KEY
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
NEXT_PUBLIC_
providerAttempts
discoveryAttempts
dangerouslySetInnerHTML
localStorage
sessionStorage
indexedDB
serviceWorker
eval(
new Function
```

Interpret findings; test files/docs may legitimately mention forbidden tokens. Production client/build hits require root-cause review.

- [x] **Verify `.env.local` isolation**

`git check-ignore -v .env.local` must succeed. Inspect disposable Playwright snapshot logic and final client build to ensure the env file is not copied into browser/test-source snapshots.

- [x] **Verify dependency boundary**

`npm ls --depth=0` and package diff must show no unexpected Phase 4 dependency addition.

- [x] **Re-hash the ten protected screenshots**

Compare filename/size/SHA-256 to Task 0 manifest. Require exact 10/10 equality.

- [x] **Remove only task-local reproducible residue**

Inspect exact `output/playwright/`, `test-results/`, trace/screenshot/temp scanner set. Delete only ignored task-created artifacts under the standing cleanup authorization. Never touch `ui-flow-screenshots/`.

### 10C. Requirements traceability

- [x] **Build an explicit traceability table in the Phase 4 spec or completion section**

Map each of these to code + unit/E2E evidence:

- 2–4 targets;
- homogeneous scope/degree;
- include/exclude categories;
- ranking/opinion display filters;
- visible exact weights;
- deterministic fit formula;
- missing evidence separate from fit;
- score suppression threshold;
- conflicts/outdated/inferred/anecdotal/ranking not scored;
- deterministic trade-offs;
- evidence drill-down;
- cancellation/retry/stale ownership;
- responsive/keyboard behavior;
- CSP/security headers;
- no persistence/private data;
- no new AI scoring call;
- no public deployment/rate-limit claim.

### 10D. Documentation synchronization

- [x] **Update requirements from observed implementation**

Do not weaken the approved Phase 4 semantics. If implementation differs, either fix code or explicitly amend the spec with justification before calling Phase 4 complete.

- [x] **Update technical design**

Document the implemented `ResearchDossier -> comparison registry -> score/coverage -> deterministic trade-offs` path and actual CSP/proxy/header architecture.

- [x] **Update security docs**

Record implemented versus deferred controls. Keep the threat model honest: do not claim endpoint-infostealer immunity or formal ASVS/NIST compliance.

- [x] **Update task ledger**

Check Phase 4 items only when supported by observed tests/build/browser evidence.

- [x] **Update README only from live behavior**

Replace “Comparison pending/illustrative” wording only after the complete built-app flow is verified. Do not claim deployment.

- [x] **Append AGENT_MEMORY.md**

Record actual files/architecture, score semantics, security controls, final test counts, review findings/fixes, screenshot integrity, and remaining Phase 5/6/deployment blockers.

- [x] **Append LESSONS.md only if implementation taught a reusable correction**

Do not log routine success. A likely durable lesson only if actually encountered is that free-form evidence properties require a closed application-owned comparison registry rather than fuzzy score normalization.

### 10E. Separate inline final review

- [x] **Review Stage 1 — spec compliance**

Freshly inspect every Phase 4 requirement/edge/security rule against actual changed code and tests. Record defects before style comments. Pay special attention to score integrity, target ownership, missing-evidence semantics, batch request order, retry snapshot ownership, CSP production/dev separation, storage absence, and protected screenshots.

- [x] **Fix every verified Stage 1 defect regression-first**

Add the nearest failing unit/browser regression, observe expected RED, implement minimal correction, rerun focused test.

- [x] **Review Stage 2 — code/security quality**

Inspect changed code for duplication, unnecessary abstractions, client bundle leakage, unbounded loops/arrays, repeated dossier rescans, React state/race hazards, unsafe URL/HTML handling, CSP/header injection, dev-only policy leakage, hidden persistence, stale effect cleanup, accessibility regressions, and test false positives/unconsumed queues.

- [x] **Fix every verified Stage 2 defect regression-first where practical**

Do not use a reviewer child. This review is performed by the main agent itself.

- [x] **Rerun affected gates and then the complete final matrix**

At minimum rerun full Vitest, full dev Playwright, repeated critical races, type, lint, build, audit, built Playwright, workspace/diff/security/integrity scans, screenshot hashes.

- [x] **Final handoff report**

Report:

- substantive defects found/fixed during implementation and final review;
- exact final test counts and commands actually run;
- dev and built CSP/header evidence;
- dependency audit result;
- secret/client-boundary scan results without exposing secrets;
- protected screenshot equality;
- files changed;
- remaining Phase 5/6/deployment blockers;
- explicit statement that zero subagents/reviewer agents were used;
- explicit statement whether any live provider/deployment/Git publication occurred.

Do not commit or push unless the user separately authorizes it after reviewing the completed Phase 4 implementation.

## Post-implementation publication review — 2026-08-18

The user subsequently authorized an independent review/fix pass plus Git commit/push. The main ChatGPT agent re-read the completed Phase 4 surfaces and ran the two review stages again with zero subagents/reviewer agents.

Three additional defects were found and fixed regression-first:

- a ready Compare category with both conflict and outdated evidence rendered only one warning; both independent warning flags now render;
- trade-off claim IDs were flattened across independent target dossiers even though claim-ID uniqueness is dossier-local; trade-offs now preserve target-scoped `{ targetKey, claimId }` evidence references and option-scoped evidence controls;
- generated `output/playwright/phase3d-dev-app-*` source trees remained eligible for the root TypeScript program after cleanup, so recurrence of the earlier stale-snapshot false failure was possible; `tsconfig.json` now excludes only `output/playwright`, protected by a harness-safety regression.

Fresh final publication gates after those fixes:

- Vitest **346/346**;
- development Playwright **121/121** with retries zero;
- Comparison lifecycle repeated five times **70/70**;
- TypeScript, ESLint, Next.js 16.3.1 production build: passed;
- `npm audit --omit=dev`: **0 vulnerabilities**;
- built-application Playwright **121/121**;
- workspace verifier and Windows `git diff --check`: passed;
- strict UTF-8/control scan: 190 project text files, 0 findings;
- five configured provider credential values: 0 hits across 344 source/build files;
- application source dangerous-sink/persistence/provider/internal scan: 44 files, 0 findings;
- final client static provider/internal scan: 25 files, 0 findings;
- provider public-env exposure scan: 0 hits across 134 source/client-build files;
- `.env.local` remained ignored/untracked;
- protected ten-file screenshot set remained untouched;
- eight task-local inactive Playwright dev snapshots and the final `test-results/phase3` marker were safely removed after verification.

This publication review performed no live provider/university request and no deployment. Git publication occurs only after the final staged-diff/secret audit authorized by the user.
