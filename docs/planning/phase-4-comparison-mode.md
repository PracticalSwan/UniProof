# Phase 4 — Comparison Mode Architecture and Acceptance Specification

Status: locally implementation-complete and post-review acceptance-complete on 2026-08-18. The implementation baseline was Phase 3D commit `9d01a57c1df8f4aa471d5313811c70f2177a5415`; Phase 4 remains uncommitted/unpublished pending separate user authorization, and `ui-flow-screenshots/` remains protected, user-owned, and untracked.

Execution policy for this batch: the user explicitly made subagents/reviewer agents unavailable. Planning, TDD, implementation, browser QA, security/privacy review, documentation, and the final defect-first review must run inline in the main ChatGPT agent with zero subagents. This task-specific instruction overrides the normal native-GPT final reviewer step for Phase 4 only.

Detailed execution runbook: `docs/superpowers/plans/2026-08-18-phase-4-comparison-mode.md`.

Security threat model: `docs/security-threat-model.md`.

## 1. Goal

Deliver the complete MVP Comparison Mode in one implementation batch without weakening the Phase 2/3 evidence boundary. A user must be able to select two to four supported targets, choose research categories and explicit priority weights, run the existing evidence-first Research workflow for those targets, and receive a deterministic, explainable comparison whose fit score is visibly a user-priority compatibility score rather than an institutional ranking.

Phase 4 must remain honest when evidence is missing, operationally incomplete, conflicting, outdated, inferred, anecdotal, ranking-derived, typed incompatibly, or not comparable across currency/unit/period. Missing or unusable evidence reduces coverage or suppresses a score; it never silently becomes zero, a guessed value, or a model-created fact.

## 2. Non-goals

Phase 4 does not add:

- applicant-profile assessment or admissions-likelihood scoring; that belongs to Phase 5;
- authentication, saved comparisons, Supabase persistence, browser persistence, background jobs, queues, or cross-device state;
- a new public comparison API;
- a new AI call for scoring or trade-off explanation;
- currency conversion, unit conversion, fuzzy semantic property matching, model-selected conflict winners, or model-generated numeric scores;
- global university coverage beyond the checked-in supported catalog;
- public deployment, HSTS/preload enrollment, production rate-limit infrastructure, or a new live-provider smoke;
- third-party analytics, tag managers, advertising scripts, browser extensions, or service workers;
- changes to provider order, Phase 2 evidence-state policy, or the Phase 3 public dossier contract unless a failing regression proves a genuine prerequisite defect.

## 3. Baseline contracts that Phase 4 must preserve

Phase 4 consumes only the browser-safe `ResearchDossier` contract from `lib/research/mode/public-contracts.ts` and the checked-in public catalog. It must not import or expose full Phase 2 documents, candidates, provider attempts, discovery telemetry, raw warnings, provider/model identity, server-only target resolvers, provider credentials, or arbitrary retrieval internals.

The seven canonical Research categories remain:

1. `admissions`
2. `tuition`
3. `scholarships`
4. `program-structure`
5. `research`
6. `outcomes`
7. `support`

Claim-level user-facing evidence states remain:

- `verified`
- `corroborated`
- `university-reported`
- `conflicting`
- `anecdotal`
- `inferred`
- `outdated`

Category-level `unknown` remains distinct from operational `incomplete`.

Every Phase 4 dossier must still pass the Phase 3 public Zod schema and exact request-target/program/category binding before comparison logic sees it.

## 4. Architectural decision: reuse Research; do not add `/api/compare`

Phase 4 must reuse the existing hardened same-origin `POST /api/research` boundary. The browser submits one bounded Research request at a time for each selected target through `executeResearchRequest()`. The resulting validated public dossiers stay in React memory, and pure comparison modules derive normalized facts, scores, coverage, gaps, and trade-offs locally.

```text
Public catalog
    -> Compare form: 2–4 supported targets + categories + priorities
    -> immutable ComparisonSubmission snapshot
    -> sequential same-origin /api/research request for target 1
    -> validate ResearchDossier
    -> sequential same-origin /api/research request for target 2
    -> ... at most target 4
    -> validated dossiers kept in memory only
    -> deterministic comparison metric registry
    -> deterministic fact normalization and comparability gate
    -> deterministic metric/category scores + weighted coverage
    -> deterministic fit score or explicit score suppression
    -> deterministic evidence-bound trade-offs/gap reasons
    -> Compare UI + existing evidence/source inspection patterns
```

Reasons:

- no second endpoint accepts caller-submitted dossier payloads;
- no duplicate server projection/trust boundary is created;
- the existing body/response limits, sensitive-input guard, catalog binding, abort propagation, and browser validation remain authoritative;
- comparison weights never need to leave the browser;
- no additional provider or AI surface is introduced;
- sequential dispatch prevents 2–4 target comparison from multiplying provider load through client fan-out.

## 5. Comparison target invariants

### 5.1 Count and uniqueness

- A comparison requires exactly 2–4 unique targets.
- Duplicate university-only targets are rejected locally.
- Duplicate program targets are rejected locally.
- Multiple different programs from the same university are allowed.

### 5.2 Homogeneous scope

A comparison must be either:

- **university scope**: every selected target is university-only; or
- **program scope**: every selected target includes a program.

Mixed university-only and program targets are rejected locally because category semantics such as tuition and outcomes are not reliably comparable across those scopes.

### 5.3 Program-level comparability

Program-scope comparisons must use the same `degreeLevel` across all selected programs. Bachelor and master programs cannot be scored in one comparison. Subject areas may differ within the checked-in computing catalog; the UI must visibly show each subject/program name so the user understands that distinction.

### 5.4 Catalog ownership

Every selected program must resolve to its owning university in the public catalog. Filters/search must never silently retarget or clear an existing selected target. A selected target remains visible even when current search/filter criteria no longer match it.

### 5.5 Result identity

Rendered comparison results use the server-returned dossier target names/IDs, not the current editable form label. The immutable comparison submission snapshot owns the result. Editing the form after a completed comparison must not relabel the existing result.

## 6. Comparison input and privacy boundary

Phase 4 Compare collects only:

- 2–4 supported target IDs;
- canonical Research categories;
- five explicit priority weights;
- optional public `intake` and `academicYear` strings using the existing Research bounds;
- display-only evidence filters for ranking and student-opinion material.

Phase 4 intentionally does **not** collect a free-form Research `question`, applicant GPA, citizenship, budget amount, test scores, identity data, documents, account details, or any other personal field. Applicant-profile data belongs to Phase 5.

Priority weights and display filters remain browser-memory-only and are never sent to Research providers. Dossiers/results are not written to `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, cookies, URL query parameters, browser history state, or a service worker. Reload/navigation discards Phase 4 state by design.

## 7. Priority dimensions

Phase 4 has five score dimensions. They are application-owned semantics, not model-generated categories.

| Priority ID | UI label | Research category | Default weight | Direction |
| --- | --- | --- | ---: | --- |
| `affordability` | Affordability | `tuition` | 30 | lower compatible annual tuition is better |
| `research` | Research opportunities | `research` | 30 | explicit opportunity/presence is better |
| `scholarships` | Scholarships | `scholarships` | 20 | explicit availability/presence is better |
| `outcomes` | Outcomes | `outcomes` | 20 | higher compatible published rate is better |
| `support` | International-student support | `support` | 0 | explicit availability/presence is better |

Rules:

- Every weight is an integer from 0 through 100.
- The five weights must sum **exactly 100**. There is no hidden normalization of malformed weights.
- At least one weight must be positive; the exact-sum rule already guarantees this.
- A priority with weight 0 is display-only for fit calculation.
- If a positive-weight priority's backing Research category is excluded, the form is invalid. The application must not silently zero a weight or silently add a category.
- Admissions and program structure are display-only in Phase 4 because applicant-specific admissions fit belongs to Phase 5 and shorter/longer program structure is not universally better without a preference model.

## 8. Research-category inclusion and evidence display filters

The seven canonical Research categories are the authoritative data-request controls. The form may include/exclude them explicitly.

The older requirement wording that mentions rankings and student opinions is implemented through separate **evidence display filters**, because the current evidence model represents them as source/evidence classes rather than canonical Research categories:

- `showRankingEvidence`: controls display of claims whose supporting evidence is ranking-derived;
- `showAnecdotalEvidence`: controls display of student/community opinion (`anecdotal`).

Both default to **off** in the comparison summary. They may be shown on explicit user opt-in, with their evidence labels intact. Neither ranking-derived nor anecdotal evidence may contribute to a numeric fit score in Phase 4, regardless of display setting.

Conflict, outdated, incomplete, and unknown warnings that affect a selected/weighted dimension must never be hidden by these display filters.

## 9. Closed deterministic metric registry

Research claim `property` is a bounded but free-form string. Phase 4 therefore must not score by substring search, fuzzy matching, embeddings, an LLM, or arbitrary parsing. It uses one application-owned closed registry.

### 9.1 Property-key normalization

`normalizeComparisonPropertyKey()` may only:

1. trim leading/trailing whitespace;
2. convert to lowercase;
3. normalize Unicode to NFC;
4. collapse internal ASCII whitespace runs to one space;
5. remove only a small documented set of cosmetic ASCII punctuation separators (`:`, `-`, `_`) by replacing them with one space;
6. collapse whitespace again.

It must not stem, fuzzy-match, translate, infer synonyms dynamically, or strip digits/currency symbols from values.

### 9.2 Registry v1

The initial registry is deliberately small. Each alias below is explicit and testable.

#### `annual-tuition`

- dimension: `affordability`
- category: `tuition`
- aliases:
  - `annual tuition`
  - `annual tuition fee`
  - `annual tuition fees`
  - `tuition per year`
  - `yearly tuition`
- accepted value: finite JavaScript `number` only
- requires: three-letter claim `currency`
- unit: either absent because the alias explicitly states annual/yearly semantics, or one of exact normalized `per year`, `annual`, `year`
- direction: lower is better

Generic `tuition` / `tuition fee` without an explicit annual-compatible unit is display-only and unscorable.

#### `scholarship-availability`

- dimension: `scholarships`
- category: `scholarships`
- aliases:
  - `scholarship available`
  - `scholarships available`
  - `scholarship availability`
  - `funding available`
- accepted value: boolean only
- direction: `true = 100`, `false = 0`

#### `scholarship-presence`

- dimension: `scholarships`
- category: `scholarships`
- aliases:
  - `scholarship name`
  - `scholarship`
  - `funding opportunity`
- accepted value: non-empty string only
- semantics: the existence of an eligible published claim proves at least one named/published opportunity; score `100`. This metric does not estimate amount, probability, competitiveness, or applicant eligibility.

If availability and presence metrics both exist, explicit boolean availability takes precedence. They are never averaged as hidden subweights.

#### `research-opportunity-availability`

- dimension: `research`
- category: `research`
- aliases:
  - `research opportunity available`
  - `research opportunities available`
  - `thesis option available`
  - `research thesis available`
- accepted value: boolean only
- direction: `true = 100`, `false = 0`

No claim count, ranking, research-center count, publication metric, or inferred prestige is converted into a Research score.

#### `employment-rate`

- dimension: `outcomes`
- category: `outcomes`
- aliases:
  - `employment rate`
  - `graduate employment rate`
  - `graduate outcome rate`
  - `employment outcome rate`
- accepted value: finite JavaScript `number` only
- accepted unit: exact normalized `%`, `percent`, or `percentage`
- accepted numeric range: 0–100 inclusive
- direction: higher is better

No numeric-looking string such as `"95%"` is parsed.

#### `international-support-availability`

- dimension: `support`
- category: `support`
- aliases:
  - `international student support available`
  - `international students support available`
  - `international student services available`
  - `international office available`
- accepted value: boolean only
- direction: `true = 100`, `false = 0`

### 9.3 Registry expansion rule

Adding an alias or metric later is a behavior change. It requires:

- a real source/example motivating the mapping;
- explicit semantic justification;
- a failing regression first;
- no ambiguity with another metric;
- documentation update.

## 10. Claim eligibility for scoring

A claim can enter the comparison metric gate only if all of the following are true:

1. its category matches the registry metric category;
2. its normalized property key exactly equals a registered alias;
3. its scalar type and required unit/currency/range match the registry;
4. its `verificationStatus` is one of `verified`, `corroborated`, or `university-reported`;
5. it is not `conflicting`, `outdated`, `anecdotal`, or `inferred`;
6. every source ID resolves inside the validated dossier;
7. at least one supporting source is not `ranking` and not `anecdotal`;
8. its period/context is compatible with the comparison rules below.

Ranking and anecdotal source material is display-only and cannot rescue an otherwise ineligible score claim.

## 11. Duplicate and conflict defense in depth

Upstream evidence gates should already label genuine conflicts. Phase 4 must still fail closed if multiple eligible claims map to one metric.

For a target/metric:

- if eligible claims have the exact same typed value, unit, currency, and comparable period, they may collapse to one metric fact while retaining all contributing claim IDs;
- if values differ, the metric is `duplicate-inconsistent-values` and unscorable;
- if currency differs, the metric is `currency-mismatch` and unscorable;
- if unit differs, the metric is `unit-mismatch` and unscorable;
- no newest/majority/most-authoritative winner is selected in Phase 4.

## 12. Period and context comparability

Retrieval time is observation metadata, never an effective-period proxy.

When the user supplied `academicYear` or `intake` in the comparison submission, an eligible claim must match the relevant explicit claim metadata exactly after the same bounded trim/case normalization already documented for public context. A conflicting explicit period is unscorable.

When the user supplied no requested period:

- if all participating candidate facts for one metric share the same explicit `academicYear`, they are comparable;
- otherwise, if all share the same explicit `effectiveDate`, they are comparable;
- otherwise, if every participating fact has no period metadata and none is `outdated`, the metric may be compared only for boolean/presence metrics, not time-sensitive numeric tuition/outcomes;
- mixed, opaque, or incompatible period evidence makes the numeric metric `period-mismatch` and unscorable.

## 13. Cross-target metric comparability

Relative **numeric** metrics (`annual-tuition` and `employment-rate`) require at least two selected usable targets with eligible mutually comparable facts because their 0–100 normalization is defined within the selected set. If fewer than two compatible numeric facts exist, participating targets receive `insufficient-peers` rather than a fabricated relative score.

Absolute boolean/presence metrics may score an individual target without a second eligible peer because their semantics are application-owned (`true = 100`, `false = 0`, or explicit published presence = 100). Other targets with missing evidence remain unscored; they do not receive zero.

For numeric metrics, all participating facts must also have compatible unit/currency semantics:

- annual tuition requires the exact same currency across participating targets; no FX conversion;
- employment rate requires the exact compatible percentage unit;
- no unit/currency conversion is permitted.

A target that lacks an eligible fact receives no metric score; it does not receive zero.

## 14. Metric score formulas

All internal metric scores use finite numbers in `[0, 100]`. Do not round until the UI/public comparison result projection.

For a compatible numeric metric with values `v_i` across participating targets:

### Higher is better

```text
if max == min: score_i = 100 for every participating target
else:          score_i = ((v_i - min) / (max - min)) * 100
```

### Lower is better

```text
if max == min: score_i = 100 for every participating target
else:          score_i = ((max - v_i) / (max - min)) * 100
```

For boolean availability metrics:

```text
true  -> 100
false -> 0
```

For explicit presence metrics:

```text
eligible published presence -> 100
```

This is a within-set compatibility score. Adding/removing targets may legitimately change a relative numeric metric score; reordering the same targets must not.

## 15. Priority/category score

Phase 4 v1 exposes exactly one chosen metric result per priority dimension after the registry precedence rules above. It does not average multiple hidden submetrics.

A dimension is either:

- `scored` with a numeric score and exact supporting claim IDs;
- or `unscored` with a stable reason code.

Stable unscored reason vocabulary:

- `category-not-researched`
- `category-unknown`
- `category-incomplete`
- `no-eligible-metric`
- `unsupported-value-type`
- `conflicting`
- `outdated`
- `inferred-only`
- `anecdotal-only`
- `ranking-only`
- `duplicate-inconsistent-values`
- `currency-mismatch`
- `unit-mismatch`
- `period-mismatch`
- `insufficient-peers`

Do not infer a different reason from display text.

## 16. Weighted evidence coverage

Let the user's positive priority weights sum to 100.

For target `t`:

```text
availableWeight_t = sum(weight_d for every dimension d scored for target t)
coverage_t = availableWeight_t / 100 * 100
```

Because the denominator is explicitly 100, `coverage_t == availableWeight_t` numerically. The formula is still expressed this way so the semantic denominator remains visible.

Coverage is evidence/score availability for the selected priorities. It is **not** model confidence, admission chance, research completeness across all seven categories, or institutional quality.

## 17. Overall fit score

When target `t` has enough scoreable evidence:

```text
fit_t = sum(score_t,d * weight_d for scored dimensions d)
        / sum(weight_d for scored dimensions d)
```

Missing/unscored dimensions are omitted from the numerator and denominator; they reduce coverage instead of acting as zero.

To prevent false precision, the UI suppresses the overall numeric fit and displays `Insufficient comparable evidence` unless both conditions hold:

1. at least **two positive-weight priority dimensions** are scored for that target; and
2. weighted coverage is at least **50%**.

When shown, round only the final fit and displayed metric scores to the nearest integer. Internal calculation remains unrounded.

The UI must always place `Evidence coverage N%` beside the fit score and explain the suppression threshold. A high fit with low-but-allowed coverage is visibly caveated.

## 18. Comparison rank/order policy

The product must not present a numbered university ranking, winner badge, podium, or `best university` label.

Default result order is immutable submission/selection order. The user may visually inspect scores, but Phase 4 does not automatically reorder cards by overall fit. This avoids converting a personalized compatibility signal into an institutional league table.

## 19. Evidence-bounded trade-off explanation

Trade-offs are generated with deterministic application templates. No provider/LLM call is added.

Every factual trade-off sentence must carry exact supporting comparison fact/claim IDs so the UI can open evidence.

Allowed statements include:

- relative numeric fact when currency/unit/period are compatible;
- exact boolean/presence contrast;
- explicit tie;
- explicit gap/unscored reason;
- conflict/outdated/incomplete/unknown warning.

Examples of semantic form, not fixture values:

```text
Within Affordability, Program A has the lower comparable published annual tuition for the same currency and period.
Program B cannot receive an Outcomes score because its outcome evidence is from an incompatible period.
Programs A and C both have explicit published scholarship availability.
```

Disallowed statements include:

- `best university`, `top choice`, `better school`, prestige or quality claims;
- admission guarantees or probabilities;
- unstated applicant fit;
- inferred currency conversion;
- conflict winner selection;
- invented causal claims such as `higher employment is because the course is better`.

Trade-off ordering is deterministic:

1. positive weight descending;
2. canonical priority order `affordability`, `research`, `scholarships`, `outcomes`, `support` for ties;
3. selected target order for target references.

## 20. Research batch lifecycle

### 20.1 Immutable submission

On Compare submit, capture an immutable snapshot containing:

- selected target IDs and order;
- canonical research categories;
- all five weights;
- display filters;
- optional intake/year;
- comparison sequence number.

Later form edits do not mutate this snapshot or the rendered result identity.

### 20.2 Single flight

Use a synchronous `activeBatchRef` guard before asynchronous work begins. Double-click, Enter races, or React state batching must not create two comparison batches.

### 20.3 Sequential dispatch

Dispatch target research strictly one-at-a-time in selected order. Never `Promise.all` or browser fan-out Research requests for the comparison batch.

### 20.4 Cancellation

One batch-owned `AbortController` is authoritative. Cancel:

- aborts the current Research request exactly once;
- prevents any undispatched target from starting;
- does not automatically retry;
- preserves current editable form input;
- ignores any stale completion released after cancellation;
- restores any preserved previous comparison result unchanged.

Unmount/navigation performs the same abort/prevent-dispatch behavior.

### 20.5 Progress

Truthful progress may display `Researching option 2 of 4` and the immutable submitted target label. It must not invent percent-complete, provider stages, model names, or remaining time.

### 20.6 Per-target outcomes

- `succeeded` dossier: usable.
- `partial` dossier: usable; incomplete categories lower score availability and remain visibly retryable.
- valid `failed` dossier: not usable for scoring.
- transport/client validation error: not usable; retain sanitized error code/message only.
- cancellation: batch-level cancellation, not a failed comparison target.

Continue sequentially past isolated target transport/internal failures when safe. Shared correction-required form errors (`sensitive-input`, malformed shared request configuration) stop further dispatch. `unsupported-target` marks that target unusable and may continue for other valid selected targets, but the editable selection must require explicit correction before a new comparison.

### 20.7 Minimum usable result

After the batch:

- if at least two target dossiers are usable, render a `complete` or `partial` comparison;
- if fewer than two are usable, do not calculate a comparison fit; show an explicit insufficient-usable-targets error and preserve any prior result.

### 20.8 Explicit retry ownership

No UI-layer automatic retry.

`Retry incomplete/failed research` replays only retry-eligible targets using the immutable failed comparison submission snapshot and merges replacements by exact target identity. Current edited form values remain untouched.

A new `Compare` submission always uses the current form and creates a new immutable snapshot.

A newer error/result owns its visible action controls. Do not render duplicate identically named Retry/Clear controls that refer to different snapshots.

## 21. Pure client state model

The implementation should expose a reducer-owned state equivalent to:

```ts
export type ComparisonWorkspaceState =
  | { kind: "idle"; notice?: string }
  | {
      kind: "loading";
      requestSequence: number;
      submission: ComparisonSubmission;
      currentTargetIndex: number;
      completedTargets: readonly ComparisonResearchOutcome[];
      previous?: ComparisonResult;
    }
  | {
      kind: "result";
      result: ComparisonResult;
      notice?: string;
    }
  | {
      kind: "error";
      error: ComparisonWorkspaceError;
      submission: ComparisonSubmission;
      completedTargets: readonly ComparisonResearchOutcome[];
      previous?: ComparisonResult;
    };
```

Reducer rules:

- `start` accepts only a newer sequence;
- target completion applies only to the active sequence and exact target index/identity;
- stale result/error/cancel actions are ignored;
- cancellation is a dedicated transition, not a generic error code;
- `clear result` truly removes result/error state while preserving current editable form values;
- resetting the form does not erase or relabel a prior result;
- preserved result evidence remains usable during a new run;
- replacement closes evidence UI tied to the old result before the old trigger unmounts.

## 22. Compare page architecture

`app/compare/page.tsx` remains a Server Component. It passes only the public checked-in catalog to one client workspace. No server-only resolver/provider module may be imported into the client graph.

Planned components:

```text
app/compare/page.tsx
components/compare/compare-workspace.tsx
components/compare/compare-form.tsx
components/compare/compare-run-banner.tsx
components/compare/comparison-results.tsx
components/compare/comparison-target-card.tsx
components/compare/comparison-priority-row.tsx
components/compare/comparison-tradeoffs.tsx
```

Evidence details should reuse the existing Research evidence-sheet behavior when its interface fits. Extract a generic shared evidence component only if doing so reduces duplication without changing Phase 3 behavior; otherwise wrap/reuse the existing component narrowly.

## 23. UI requirements

The current desktop/mobile Compare screenshots are visual baselines for typography, spacing, card hierarchy, and overall direction, not factual data fixtures. Phase 4 removes the static `Example A/B/C` values entirely.

The live workspace must provide:

- catalog search/filter and 2–4 selected-target chips/cards;
- explicit university/program comparison scope and degree-level validation;
- seven Research category controls;
- five visible integer priority controls with a continuously visible total out of 100;
- ranking/student-opinion display toggles with scoring disclaimer;
- optional public intake/year;
- privacy guidance explaining that applicant/private information does not belong in Compare;
- Compare, Reset, Cancel, Retry incomplete/failed research, and Clear result actions with unambiguous ownership;
- per-target batch progress;
- result cards in selected order;
- visible fit + coverage or explicit fit suppression;
- each priority's score or stable human-readable unscored reason;
- category unknown/incomplete/conflict/outdated warnings;
- deterministic trade-offs and gaps;
- exact evidence/source inspection and official links.

## 24. Accessibility requirements

Phase 4 must preserve the global skip link and `#main-content` target added in Phase 3D.

The Compare flow must pass:

- one main landmark and coherent heading hierarchy;
- native labels/fieldset/legend for target, categories, filters, and priorities;
- stable `aria-describedby` IDs for every visible validation error;
- `aria-invalid` only on actually affected controls;
- keyboard-only target search/select/remove, weight editing, category/filter changes, submit/cancel/retry/clear, and evidence inspection;
- no positive `tabindex`;
- visible focus;
- practical target size at least 24x24 CSS pixels, with ordinary primary controls targeting approximately 44px where feasible;
- one controlled live status for batch lifecycle/progress without announcement spam;
- evidence Sheet/Dialog focus trap, Escape close, and exact mounted-trigger focus return;
- focus non-obscuration under the sticky header;
- reduced-motion meaning preserved without relying on animation;
- no meaning communicated by color alone.

## 25. Responsive and stress requirements

Browser acceptance viewports:

- 320x740
- 375x812
- 390x844
- 768x1024
- 1024x768
- 1440x900

No page-level horizontal overflow above 1 CSS pixel.

Stress fixtures must cover:

- four selected targets;
- long university/program names at public-contract bounds;
- long values/properties/trade-off reasons;
- 12 evidence sources;
- 2,000-character supporting text;
- several hundred valid claims in underlying dossiers while comparison indexes only the relevant closed metrics;
- Unicode including astral characters and combining marks;
- numeric-looking strings that must remain unscored strings;
- very long safe HTTPS URLs;
- all five priorities and all seven categories.

On narrow/mobile layouts, use stacked cards/sections. Do not solve overflow by making the whole page a horizontally scrolling desktop table.

## 26. Security and privacy baseline for Phase 4

Absolute prevention of every cyberattack or endpoint infostealer is not technically possible. Phase 4's security goal is defense in depth: minimize attack surface, prevent known application-layer classes, fail closed at trust boundaries, minimize retained/exposed data, and reduce the value/blast radius of a compromised browser or device.

The runtime security controls below must not restrict the local developing AI agent's repository/tool access.

### 26.1 No new untrusted code/data execution paths

- No `dangerouslySetInnerHTML`, raw HTML rendering, `eval`, `new Function`, dynamic script injection, or DOM event-handler strings in application code.
- Retrieved claim/property/value/supporting text is rendered as React text only.
- No third-party scripts/analytics/tag managers.
- No service worker.
- No arbitrary browser fetch; Compare calls only same-origin `/api/research`.

### 26.2 Strict CSP

Add a Next.js 16 `proxy.ts` nonce-based CSP for HTML documents using a fresh unpredictable nonce per request.

Production script policy must not contain `'unsafe-inline'` or `'unsafe-eval'` and should use nonce + `'strict-dynamic'` following the current official Next.js/OWASP strict-CSP guidance.

Development may add only the minimum compatibility exception required by Next/React dev tooling (`'unsafe-eval'`; and development-only inline style permission if verified necessary). Production exceptions require a browser-proved incompatibility and must be documented narrowly.

Target directives, subject to real dev/built-browser verification:

```text
default-src 'self'
script-src 'self' 'nonce-{nonce}' 'strict-dynamic' [dev-only 'unsafe-eval']
script-src-attr 'none'
style-src-elem 'self' 'nonce-{nonce}' [dev-only compatibility only]
style-src-attr 'none' unless a verified Radix/React runtime requirement forces the narrowest documented exception
img-src 'self' data: blob:
font-src 'self'
connect-src 'self' [dev-only exact same-host websocket origin]
object-src 'none'
base-uri 'none'
form-action 'self'
frame-ancestors 'none'
frame-src 'none'
media-src 'none'
manifest-src 'self'
```

Do not add broad third-party domains. Do not add `upgrade-insecure-requests` in local development; consider it only on an HTTPS deployment after Phase 6 verification. Next.js experimental SRI is out of scope because the current project uses Turbopack and current Next documentation limits the experimental SRI path to webpack.

Nonce CSP may force dynamic rendering. This security/performance trade-off is explicitly accepted for the user's maximum-security development target and must be verified rather than hidden.

### 26.3 Global security headers

Use `next.config.ts` and/or the nonce proxy as appropriate to add and test:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY` as legacy defense in depth beside CSP `frame-ancestors 'none'`
- `X-DNS-Prefetch-Control: off`
- restrictive `Permissions-Policy` denying unused camera, microphone, geolocation, payment, USB, and browsing-topics capabilities
- `Cross-Origin-Opener-Policy: same-origin` if real browser acceptance proves no required flow breaks
- `Cross-Origin-Resource-Policy: same-origin` if real browser acceptance proves no required static asset/evidence flow breaks
- `poweredByHeader: false`

HSTS is deliberately deferred until an authorized HTTPS deployment is live and verified. Long-lived HSTS/preload configuration is not a development-only control and must not break localhost or an unverified subdomain strategy.

### 26.4 External links

Every evidence/official external link must retain:

- `target="_blank"`
- `rel="noopener noreferrer"`
- `referrerPolicy="no-referrer"`
- validated HTTP(S) href from the public dossier/catalog contract.

No browser acceptance test should actually navigate to an external site.

### 26.5 Browser persistence / infostealer minimization

- No auth/session token exists in Phase 4.
- No Compare data or Research dossier is persisted in Web Storage, IndexedDB, Cache Storage, cookies, or URL state.
- No private applicant data is collected.
- No third-party script can read comparison state because no third-party script is loaded.
- A compromised OS/browser extension/infostealer can still read data visible in memory while the user is using the app; the application cannot guarantee protection from a compromised endpoint. The Phase 4 design minimizes what exists to steal.

Future authentication must use framework/server-managed sessions with `HttpOnly`, `Secure`, appropriate `SameSite` cookies and server-derived ownership; never put credentials/session/JWT/refresh tokens in Web Storage.

### 26.6 API/resource abuse

Comparison can create 2–4 expensive Research runs, so browser dispatch is strictly sequential and single-flight. Existing provider/research budgets remain unchanged.

This is not a distributed rate limit. Public deployment stays blocked until Phase 6 verifies platform duration/cancellation behavior and durable/deployment-layer abuse controls for `/api/research`.

Do not add local development gates, permission restrictions, or artificial agent-access constraints as a substitute for deployment-layer rate limiting.

## 27. Threat-model priorities

The detailed repository threat model is in `docs/security-threat-model.md`. Phase 4 implementation must specifically regression-test:

- XSS-shaped claim/property/supporting text under enforced CSP;
- malicious/credential-bearing external URL rejection at existing contracts;
- browser exfiltration attempts blocked by CSP/network guard;
- no Web Storage/IndexedDB/service-worker persistence;
- no provider/public-env/internal Phase 2 imports in Compare client bundles;
- no arbitrary cross-origin browser requests;
- malformed/mismatched dossier rejection before score calculation;
- score manipulation through numeric strings, NaN/Infinity, unsupported units/currencies, period mismatches, duplicate contradictory facts, conflicts, outdated evidence, inferred/anecdotal/ranking evidence;
- duplicate/mixed-scope/mixed-degree target manipulation;
- request fan-out/double-submit/cancel/stale-response races;
- oversize/long-content browser behavior;
- CSP/security-header presence in dev and built application modes.

## 28. Test architecture

### 28.1 Pure Vitest layers

Create focused tests for:

- contracts/form validation;
- target-scope/degree/duplicate rules;
- property normalization;
- registry exact aliases and non-alias rejection;
- value type/unit/currency/range eligibility;
- evidence-status/source eligibility;
- duplicate/conflict defense;
- period compatibility;
- numeric min-max scoring including ties and order invariance;
- boolean/presence scoring;
- weighted coverage and fit suppression;
- deterministic trade-off content/order/references;
- reducer sequence/cancel/retry/clear ownership;
- CSP builder and static security-header configuration.

Every production behavior begins with a failing regression and an observed expected RED before minimal implementation.

### 28.2 Playwright layers

Extend the current deterministic route-controller model. No live provider/university calls.

Split Compare specs by concern:

```text
tests/e2e/compare-form.spec.ts
tests/e2e/compare-lifecycle.spec.ts
tests/e2e/compare-scoring.spec.ts
tests/e2e/compare-evidence.spec.ts
tests/e2e/compare-accessibility.spec.ts
tests/e2e/compare-security.spec.ts
tests/e2e/compare-responsive.spec.ts
```

Use queued `/api/research` replies in exact target order. Existing strict queue-exhaustion and unexpected-request/network guards remain active.

### 28.3 Required browser cases

- choose exactly 2, 3, and 4 targets;
- reject 0/1/5 targets;
- duplicate target;
- mixed university/program scope;
- mixed bachelor/master program scope;
- filters never silently retarget selected items;
- weights 100 valid, 99/101 invalid, decimals/negative/>100 invalid;
- positive weight backed by excluded category invalid;
- same-tick double submit one batch only;
- strict sequential request order; prove no request 2 before request 1 completes;
- cancel current request prevents all later dispatch;
- stale completion cannot overwrite newer comparison;
- unmount abort;
- per-target transport failure with >=2 usable dossiers produces partial result;
- <2 usable dossiers suppresses comparison;
- retry only failed/incomplete immutable target snapshots;
- current form edits do not alter previous result/retry ownership;
- same numeric values tie at 100;
- target reorder leaves target-specific metric scores unchanged when set is unchanged;
- numeric strings not parsed;
- mixed currency/unit/period suppress affected metric;
- missing evidence not zero;
- conflicts/outdated/inferred/anecdotal/ranking evidence never scored;
- high fit below 50% coverage is suppressed;
- exact 50%/two-dimension threshold displays fit;
- deterministic trade-off evidence links open exact claim evidence;
- no winner/prestige/ranking language;
- ranking/student-opinion toggles change display only, not fit;
- CSP enforced and expected response headers present;
- XSS-shaped text remains inert under CSP;
- no unexpected external HTTP(S), popups, dialogs, page errors, app console errors;
- no storage/service-worker residue;
- all required viewport/stress cases.

## 29. Security verification baseline references

Phase 4 security planning is grounded in current primary references reviewed on 2026-08-18:

- Next.js official App Router CSP guide, current Next.js 16 `proxy.ts`/nonce guidance: `https://nextjs.org/docs/app/guides/content-security-policy`
- Next.js official `headers` configuration: `https://nextjs.org/docs/app/api-reference/config/next-config-js/headers`
- Next.js 16 Proxy naming/runtime guidance: `https://nextjs.org/docs/app/getting-started/proxy`
- OWASP Application Security Verification Standard 5.0.0: `https://owasp.org/www-project-application-security-verification-standard/`
- OWASP API Security Top 10 — 2023: `https://owasp.org/API-Security/editions/2023/en/0x11-t10/`
- OWASP Content Security Policy Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html`
- OWASP Session Management Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`
- OWASP HTML5 Security Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html`
- NIST SP 800-218 SSDF Version 1.1: `https://csrc.nist.gov/pubs/sp/800/218/final`
- NIST Privacy Framework Version 1.0: `https://www.nist.gov/privacy-framework/privacy-framework`
- CISA Secure by Design principles/resources: `https://www.cisa.gov/securebydesign`

These are used as engineering baselines, not claims of formal certification. ASVS mapping must reference version `5.0.0` when requirement IDs are recorded.

## 30. Planned file boundary

Expected creates:

```text
lib/comparison/contracts.ts
lib/comparison/metrics.ts
lib/comparison/normalize.ts
lib/comparison/score.ts
lib/comparison/tradeoffs.ts
lib/comparison/client-form.ts
lib/comparison/client-state.ts
lib/security/browser-policy.ts
components/compare/compare-workspace.tsx
components/compare/compare-form.tsx
components/compare/compare-run-banner.tsx
components/compare/comparison-results.tsx
components/compare/comparison-target-card.tsx
components/compare/comparison-priority-row.tsx
components/compare/comparison-tradeoffs.tsx
proxy.ts
tests/phase4-comparison-contracts.test.ts
tests/phase4-comparison-normalize.test.ts
tests/phase4-comparison-score.test.ts
tests/phase4-comparison-tradeoffs.test.ts
tests/phase4-comparison-state.test.ts
tests/phase4-security-headers.test.ts
tests/e2e/compare-form.spec.ts
tests/e2e/compare-lifecycle.spec.ts
tests/e2e/compare-scoring.spec.ts
tests/e2e/compare-evidence.spec.ts
tests/e2e/compare-accessibility.spec.ts
tests/e2e/compare-security.spec.ts
tests/e2e/compare-responsive.spec.ts
```

Expected modifies:

```text
app/compare/page.tsx
next.config.ts
playwright.config.ts                     # required: disposable dev snapshot must copy root proxy.ts
tests/playwright-config-safety.test.ts   # extend harness regression for required proxy copy/containment
tests/e2e/helpers/research-browser.ts    # only narrow reusable Compare fixture support
docs/requirements.md
docs/design.md
docs/security.md
SECURITY.md
docs/planning/tasks.md
AGENT_MEMORY.md
LESSONS.md                               # only if implementation reveals a reusable lesson
README.md                                # only after live Phase 4 behavior is verified
```

Implementation dependency note: strict production CSP required the existing Radix runtime style path to receive the request nonce through the `get-nonce` channel. Because application code now imports that module directly, `get-nonce@^1.0.1` is declared directly even though it was already present transitively through the UI stack. This is the only Phase 4 manifest/lockfile dependency addition; production build, browser CSP acceptance, and `npm audit --omit=dev` passed after the change.

## 31. Edge-case matrix

| Domain | Case | Required behavior |
| --- | --- | --- |
| Targets | 1 target | local validation error, zero request |
| Targets | 5 targets | local validation error, zero request |
| Targets | duplicate target | local validation error, zero request |
| Targets | mixed university/program | local validation error |
| Targets | bachelor + master | local validation error |
| Targets | same university, different programs | allowed if same degree level |
| Targets | selected target filtered out | remain selected; no silent retarget |
| Weights | sum 99/101 | error, zero request |
| Weights | decimal/NaN/Infinity | reject contract |
| Weights | category excluded while weight >0 | explicit error |
| Claim | numeric-looking string | visible as source fact if otherwise relevant; never numeric score |
| Claim | NaN/Infinity | rejected by existing/public or comparison contract |
| Claim | boolean metric as string `yes` | unscored; no type coercion |
| Claim | conflicting/outdated/inferred/anecdotal | unscored, warning preserved |
| Source | ranking/anecdotal only | display opt-in only; unscored |
| Metric | only one target has value | `insufficient-peers` |
| Metric | all numeric values equal | all participating scores 100 |
| Metric | currency mismatch | affected metric unscored; no conversion |
| Metric | unit mismatch | affected metric unscored |
| Metric | period mismatch | affected metric unscored |
| Metric | duplicate identical facts | collapse with all claim refs |
| Metric | duplicate differing facts | unscored conflict defense |
| Coverage | missing weighted dimension | coverage reduced, not score zero |
| Fit | <50% or <2 dimensions | suppress numeric fit |
| Fit | exactly 50% and 2 dimensions | numeric fit allowed |
| Lifecycle | one target transport fails, three succeed | partial comparison from three |
| Lifecycle | only one target usable | no comparison score |
| Lifecycle | partial dossier | usable; incomplete categories visible/retryable |
| Race | double click/Enter same tick | one batch |
| Race | cancel request 1 of 4 | requests 2–4 never dispatch |
| Race | stale release after cancel/new run | ignored |
| Retry | form edited after failure | retry old immutable failed snapshot; new Compare uses edited form |
| Security | XSS-shaped claim text | inert React text; CSP no execution |
| Security | third-party browser request | fail-closed Playwright guard/CSP |
| Privacy | refresh/navigation | comparison state disappears; no persistent residue |
| Accessibility | error | exact `aria-describedby` relationship and focus first invalid control |
| Responsive | 320px + long values | no page-level horizontal overflow |

## 32. Verification and exit gates

Phase 4 is complete only when all of the following are observed, not assumed:

1. current Phase 2/3 regressions remain green;
2. all new Phase 4 pure tests are green after recorded red-first cycles;
3. complete Vitest suite is green;
4. complete dev Playwright suite is green with retries zero;
5. critical Compare cancellation/stale/sequential-dispatch race specs pass at least five explicit repetitions without retry masking;
6. TypeScript passes;
7. ESLint passes;
8. production Next.js build passes under strict production CSP configuration;
9. complete built-application Playwright suite is green;
10. CSP/security headers are asserted in browser/network responses and no unexpected violations remain;
11. `npm audit --omit=dev` reports zero production dependency vulnerabilities, or any nonzero finding is treated as a blocker requiring explicit owner disposition;
12. no new dependency is present unless justified and reviewed;
13. workspace verifier passes;
14. `git diff --check` passes;
15. strict UTF-8/control-character scan passes;
16. configured real credential-value scan reports zero hits in intended source/docs and final client/server build artifacts;
17. Compare client/build scans show no provider keys, server-only modules, Phase 2 internals, executable HTML sink, Web Storage/IndexedDB/service-worker persistence, test backdoor, or third-party script/network origin;
18. `.env.local` remains ignored and never copied into the disposable Playwright dev snapshot/client bundle;
19. requirements traceability maps every Phase 4 requirement to code/tests;
20. protected `ui-flow-screenshots/` filename/size/SHA-256 manifest remains exactly unchanged;
21. disposable Playwright snapshots/results/traces/private scan scripts are removed after their purpose unless deliberately retained as sanitized regression evidence;
22. docs/tasks/memory reflect observed implementation state rather than intent;
23. the main agent performs a separate inline two-stage defect-first review (spec compliance, then code/security quality), fixes every verified finding with regression coverage where practical, and reruns affected/full gates;
24. zero subagents/reviewer agents are used for the entire Phase 4 batch;
25. no live provider/university call, deployment, commit, or push occurs without separate explicit authorization.

## 33. Implementation closure and requirements traceability

Phase 4 was implemented and re-reviewed locally in the main ChatGPT agent with zero subagents/reviewer agents. The final review found one substantive lifecycle defect: a server-rejected `unsupported-target` could remain selected and be submitted again. A browser regression first reproduced the extra batch, then the workspace was fixed to require explicit remove/replace correction and to exclude `unsupported-target` from retry eligibility. The complete post-review matrix passed afterward.

| Requirement | Implemented surface | Verification evidence |
| --- | --- | --- |
| Exactly 2–4 unique supported targets; homogeneous scope/degree | `lib/comparison/contracts.ts`, `lib/comparison/client-form.ts`, `components/compare/compare-form.tsx` | `tests/phase4-comparison-contracts.test.ts`, `tests/e2e/compare-form.spec.ts` |
| Seven category include/exclude controls; ranking/opinion display-only filters | comparison contracts/form/scoring/result presentation | comparison contract tests; `compare-form.spec.ts`; `compare-evidence.spec.ts` |
| Five visible integer weights totaling exactly 100 with category coupling | comparison contracts, form, `comparison-priority-row.tsx` | comparison contract tests; `compare-form.spec.ts` |
| Closed exact metric registry; strict type/unit/currency/period rules | `lib/comparison/metric-registry.ts`, `lib/comparison/scoring.ts` | `tests/phase4-comparison-scoring.test.ts`, `compare-scoring.spec.ts` |
| Eligible evidence only; missing/unscorable evidence is not poor fit | `lib/comparison/scoring.ts` | scoring unit tests; `compare-scoring.spec.ts`; `compare-evidence.spec.ts` |
| Weighted coverage and sparse-fit suppression | `lib/comparison/scoring.ts`, `comparison-target-card.tsx` | scoring unit tests; `compare-scoring.spec.ts` |
| Preserve immutable selection order; never auto-rank institutions | comparison contracts/state/results | `compare-lifecycle.spec.ts`, `compare-scoring.spec.ts` |
| Deterministic trade-offs/gaps with exact target-scoped claim references across independent dossiers | `lib/comparison/tradeoffs.ts`, `comparison-tradeoffs.tsx` | `tests/phase4-comparison-tradeoffs.test.ts`, `compare-evidence.spec.ts` including reused cross-dossier claim-ID regression |
| Sequential Research reuse, single-flight, cancel/stale/retry ownership, unsupported-target correction | `compare-workspace.tsx`, `lib/comparison/client-state.ts`, existing Research client transport | comparison state tests; `compare-lifecycle.spec.ts` including five-repeat lifecycle acceptance |
| Exact evidence drill-down, safe links, inert untrusted text, focus semantics | shared `components/research/claim-evidence-sheet.tsx`, comparison result/trade-off components | `compare-evidence.spec.ts`, `compare-accessibility.spec.ts`, `compare-security.spec.ts` |
| Keyboard/reduced-motion/responsive acceptance | comparison form/workspace/results | `compare-accessibility.spec.ts`, six-viewport `compare-responsive.spec.ts` |
| Fresh nonce CSP and restrictive browser headers | `lib/security/browser-policy.ts`, `proxy.ts`, `next.config.ts`, `app/layout.tsx`, `components/security/runtime-style-nonce.tsx` | `tests/phase4-security-headers.test.ts`, `compare-security.spec.ts` in dev and built application |
| No Compare persistence/private applicant data | Compare form/workspace pure client state only | `compare-security.spec.ts` plus final persistence/static scans |
| No `/api/compare` and no additional AI scoring/explanation call | existing `/api/research` transport plus pure `lib/comparison/*` | lifecycle/network guard, client-boundary scans, source review |
| Deployment/rate-limit/HSTS remain deferred | documentation/scope only | no deployment/live-provider/publication action occurred in Phase 4 |

Final post-review evidence on 2026-08-18:

- full Vitest: **344/344**;
- full development Playwright: **119/119**, configured retries zero;
- critical 14-test Comparison lifecycle suite repeated five times: **70/70 executions**;
- TypeScript: passed after removing 52 inactive task-created stale Playwright harness snapshots that were being included by root `tsc`;
- ESLint: passed;
- Next.js 16.3.1 production build: passed;
- production dependency audit: **0 vulnerabilities**;
- full built-application Playwright: **119/119**;
- workspace verifier and authoritative Windows `git diff --check`: passed;
- strict UTF-8/control scan: 209 source text files, zero findings;
- five configured real provider credential values: zero hits across 414 source/build files;
- provider/client, provider `NEXT_PUBLIC_*`, dangerous sink, browser persistence, and test-backdoor scans: zero findings;
- `.env.local`: ignored and untracked;
- protected `ui-flow-screenshots/`: exact 10/10 filename/size/SHA-256 equality with the pre-Phase-4 manifest;
- no live provider/university request, deployment, commit, push, PR, or branch operation occurred.

Public deployment remains blocked until Phase 6 verifies current hosting duration/cancellation behavior, durable distributed abuse/rate limits for expensive Research flows, production domain/TLS/HSTS policy, current provider terms/configuration, and an explicitly authorized bounded live smoke.

## 34. Independent post-implementation publication review

A fresh main-agent review was performed after the local Phase 4 closure and before Git publication. It found and fixed three additional defects with regression coverage:

1. **Simultaneous conflict/outdated presentation:** a ready category with both `hasConflict` and `hasOutdated` rendered only the conflict warning because the Compare card used mutually exclusive early returns. The card now renders the two independent evidence warnings independently. `compare-evidence.spec.ts` first reproduced the missing outdated warning and then passed after the fix.
2. **Cross-dossier trade-off provenance:** claim IDs are unique only within one validated Research dossier, not globally across separate target runs. The initial trade-off projection flattened claim IDs across dossiers, so two targets reusing the same claim ID could resolve evidence ambiguously. Trade-offs now carry exact `{ targetKey, claimId }` evidence references, and the UI exposes target/option-scoped evidence controls. Unit and browser regressions prove two dossiers may reuse a claim ID while each option still opens its own exact evidence.
3. **Generated Playwright snapshot compiler contamination:** cleanup alone did not prevent the previously observed root-TypeScript false failure because `tsconfig.json` still included ignored `output/playwright/**` source snapshots through broad `**/*.ts(x)` includes. Root TypeScript now explicitly excludes `output/playwright`, with a harness-safety regression. This prevents recurrence while retaining the existing validated containment/cleanup rules.

Fresh post-fix publication matrix on 2026-08-18:

- full Vitest: **346/346** across 23 files;
- full development Playwright: **121/121**, retries zero;
- critical 14-test Comparison lifecycle suite repeated five times: **70/70 executions**;
- TypeScript: passed;
- ESLint: passed;
- Next.js 16.3.1 production build: passed;
- `npm audit --omit=dev`: **0 vulnerabilities**;
- full built-application Playwright: **121/121**;
- workspace verifier: passed;
- authoritative Windows `git diff --check`: passed;
- strict UTF-8/control scan: 190 project text files, zero findings;
- all five configured real provider credential values: zero hits across 344 scanned source/build files;
- application source dangerous-sink/persistence/provider/internal scan: 44 files, zero findings;
- final `.next/static` provider/internal-token scan: 25 files, zero findings;
- provider `NEXT_PUBLIC_*` exposure scan: zero findings across 134 source/client-build files;
- `.env.local`: ignored and untracked;
- protected `ui-flow-screenshots/`: 10 PNGs retained with the same names, sizes, and SHA-256 values recorded by the completed Phase 4 verification; this publication review never writes to that directory;
- eight task-created isolated dev snapshots plus `test-results/phase3` were verified inactive/contained and removed after their verification purpose.

The independent review used zero subagents/reviewer agents. No live provider/university request or deployment was performed. Git commit/push is the separately authorized publication action that follows the final staged-diff/secret checks.
