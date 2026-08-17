# Phase 3C — Research Workspace and Evidence UI Implementation Plan

> **Execution policy:** Follow `AGENTS.md` model-specific delegation. GLM-5.3 Max executes this plan entirely in the main agent with no subagents. Native OpenAI GPT models retain the required final read-only review-agent step after local gates. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static illustrative Research preview with an interactive supported-target Research workspace that submits the Phase 3B request, preserves truthful lifecycle/evidence semantics, and lets users inspect final claim provenance on desktop and mobile.

**Architecture:** Keep `app/research/page.tsx` a server component that supplies public catalog data to one client workspace. The workspace uses a pure reducer/state helper and strict public contracts, starts at most one fetch at a time, validates every response, and renders dossier components. Evidence details use a focus-managed Sheet/Dialog built from the existing Radix/shadcn stack. No Phase 2 internal type crosses into client code.

**Tech Stack:** React 19, Next.js App Router, TypeScript, Tailwind CSS, existing shadcn/Radix primitives, Zod public schemas, Vitest pure-state tests. No new package unless the existing installed UI stack is proven insufficient and a dependency change is separately justified.

## Global Constraints

- Phase 3A and 3B must be complete and green first.
- Read `LESSONS.md` first.
- Do not alter Phase 2 evidence states or recompute authority/conflict/freshness in React.
- Do not expose full `ResearchResult`, candidates, documents, provider attempts, or secrets to client code.
- Do not add persistence, auth, saved history, Comparison/Guide behavior, background jobs, or deployment.
- Do not infer unknown from missing React data; invalid/malformed public dossier must fail validation before render.
- Never render retrieved supporting text as HTML.
- Preserve the existing Phase 1 visual system unless accessibility/responsive requirements require a narrow component change.
- `ui-flow-screenshots/` remains protected unless the user explicitly authorizes replacement/use.

---

## File map

Create:

```text
lib/research/mode/client-state.ts
lib/research/mode/format.ts
components/research/research-workspace.tsx
components/research/research-form.tsx
components/research/research-run-banner.tsx
components/research/research-dossier.tsx
components/research/research-category-section.tsx
components/research/research-claim-row.tsx
components/research/claim-evidence-sheet.tsx
components/ui/sheet.tsx                  # only if not already available and existing radix-ui supports it
tests/phase3c-research-state.test.ts
tests/phase3c-research-format.test.ts
```

Modify:

```text
app/research/page.tsx
```

Phase 3D owns Playwright/E2E and cross-viewport acceptance; Phase 3C still performs manual local render sanity checks before handoff.

---

## Task 1 — Define the pure client request/run state machine

### Files

- Create: `lib/research/mode/client-state.ts`
- Create: `tests/phase3c-research-state.test.ts`

### Step 1: Write red tests for the reducer

Use a pure reducer with no React imports so Vitest can exhaustively test transitions without adding React Testing Library.

Required client error/state types:

```ts
export type ResearchWorkspaceError =
  | PublicResearchTransportError
  | { code: "network-error"; message: string }
  | { code: "invalid-response"; message: string };

export type ResearchWorkspaceState =
  | { kind: "idle"; notice?: string }
  | {
      kind: "loading";
      requestSequence: number;
      submittedTargetLabel: string;
      previous?: ResearchDossier;
    }
  | { kind: "result"; dossier: ResearchDossier; notice?: string }
  | {
      kind: "error";
      error: ResearchWorkspaceError;
      previous?: ResearchDossier;
    };
```

`network-error` and `invalid-response` are client-only controller errors; the server MUST NOT emit them in the Phase 3B transport-error envelope. Cancellation is handled by the dedicated cancellation transition, not converted into an error code.

Tests:

- [ ] idle -> start loading;
- [ ] result -> refresh loading preserves previous dossier;
- [ ] loading -> result replaces previous only when sequence matches;
- [ ] stale sequence result ignored;
- [ ] loading -> transport error preserves previous dossier;
- [ ] loading -> cancel restores previous dossier if present;
- [ ] first-run cancel returns idle + cancellation notice;
- [ ] stale error/cancel action cannot overwrite newer request;
- [ ] reset affects run state only when explicitly requested; it does not implicitly clear form values;
- [ ] invalid reducer action ordering cannot produce two active sequence IDs.

### Step 2: Implement reducer/actions

Recommended actions:

```ts
type ResearchWorkspaceAction =
  | { type: "start"; sequence: number; submittedTargetLabel: string }
  | { type: "result"; sequence: number; dossier: ResearchDossier }
  | { type: "error"; sequence: number; error: ResearchWorkspaceError }
  | { type: "cancelled"; sequence: number }
  | { type: "dismiss-notice" };
```

- [ ] Sequence comparison occurs inside the reducer or one pure helper, not scattered across components.
- [ ] The dossier is always associated with its own server-returned target; never relabel an old dossier using current form selection.

### Step 3: Add a synchronous single-flight guard plan

React state alone is not a sufficient same-tick duplicate-submit lock. The workspace must also hold an `activeRequestRef`/controller ref.

```ts
if (activeRequestRef.current !== null) return;
```

Set the ref before the fetch begins and clear it in `finally` only if it still refers to that request sequence.

This prevents double-click/Enter races from starting duplicate expensive POSTs before React rerenders the disabled button.

---

## Task 2 — Implement deterministic presentation formatters

### Files

- Create: `lib/research/mode/format.ts`
- Create: `tests/phase3c-research-format.test.ts`

### Step 1: Write red tests

Cover:

- [ ] string remains string/verbatim text;
- [ ] number remains numeric meaning; no scientific surprise for normal bounded values;
- [ ] boolean -> `Yes`/`No` presentation only;
- [ ] numeric string `"10000"` is not parsed as number;
- [ ] currency code is explicit uppercase code, not inferred symbol conversion;
- [ ] unit appended only when present;
- [ ] currency+unit combination deterministic;
- [ ] missing metadata emits nothing, not `Unknown` factual placeholders;
- [ ] ISO effective date displays without local-time date shift;
- [ ] retrieved timestamp is labeled observation metadata;
- [ ] Unicode/astral values remain valid;
- [ ] malicious-looking `<script>` string remains ordinary text output.

### Step 2: Implement pure helpers

Recommended:

```ts
export function formatClaimValue(claim: PublicResearchClaim): string;
export function formatIsoDate(value: string): string;
export function formatRetrievedAt(value: string): string;
export function categoryLabel(category: ResearchModeCategory): string;
export function evidenceStatusLabel(status: PublicClaimEvidenceStatus): string;
```

Rules:

- [ ] do not convert currencies/units;
- [ ] do not infer dates from non-date strings;
- [ ] use a fixed English locale and UTC for explicit ISO date/timestamp formatting to avoid hydration/timezone shifts;
- [ ] output plain strings only.

---

## Task 3 — Replace the static page shell with a server-to-client catalog boundary

### Files

- Modify: `app/research/page.tsx`
- Create: `components/research/research-workspace.tsx`

Current page contains illustrative static sections and a disabled Research button. Remove that mock dossier when the real workspace is ready; do not leave live and illustrative claims mixed on one page.

### Step 1: Keep `app/research/page.tsx` server-rendered

Recommended structure: keep the existing `<main>` layout classes and `ModeShell` heading/description from the current Research page, remove the illustrative query/dossier markup, import `researchCatalog` from `@/lib/research/catalog/data`, import `ResearchWorkspace` from `@/components/research/research-workspace`, and render `<ResearchWorkspace catalog={researchCatalog} />` immediately after `ModeShell`.

- [ ] Only public catalog data is serialized to the client.
- [ ] No provider env lookup in page/client files.
- [ ] Remove "Live research is not connected" once the route is actually connected.
- [ ] Do not render example factual claims alongside real results.

### Step 2: Give the workspace clear regions

Recommended layout:

```text
Research target + filters
Research options/categories/question
Run controls + aria-live status
Result summary/banner
Dossier sections
Claim evidence sheet portal
```

Retain the existing max-width/padding visual foundation.

---

## Task 4 — Build supported target search/filter/select

### Files

- Create: `components/research/research-form.tsx`
- Modify: `components/research/research-workspace.tsx`

### Target selection model

Minimum form state:

```ts
type ResearchFormState = {
  search: string;
  countryCode?: "US" | "GB" | "TH";
  degreeLevel?: "bachelor" | "master";
  subjectArea?: string;
  universityId?: string;
  programId?: string;
  categories: ResearchModeCategory[];
  question: string;
  intake: string;
  academicYear: string;
};
```

Initialize all seven categories selected in canonical order. Users may deselect categories but cannot submit zero.

### Search/filter requirements

- [ ] Use `searchResearchCatalog()` from Phase 3A; do not reimplement fuzzy/search normalization in React.
- [ ] Text input matches supported university/program/aliases/subject.
- [ ] Country filter.
- [ ] Degree-level filter.
- [ ] Subject filter drawn from deterministic catalog subjects.
- [ ] Search results clearly distinguish university-level target and program target.
- [ ] Selecting a program sets its owning university.
- [ ] Selecting a different university clears an incompatible selected program immediately and announces the change in form help/error text.
- [ ] Filters narrow the **available search results** but never silently retarget an already selected university/program. Keep the selected target visible in a separate selected-target panel even if current filters no longer match it.
- [ ] "No supported matches" does not offer arbitrary/free-form target research.
- [ ] Reset form clears selection/filter/question/intake/year and restores all seven categories; it never fires an API call.

### Accessibility

- [ ] Every input/select has visible label.
- [ ] Filter controls have stable accessible names.
- [ ] Search result buttons expose university/program and degree/country context.
- [ ] Selected target panel has a clear remove/change action.
- [ ] Category selection uses actual checkboxes or equivalent accessible checked controls; status is not color-only.

Do not add a combobox dependency solely for search. The catalog is small enough for an accessible filtered list/select implementation using existing primitives.

---

## Task 5 — Build Research options/category validation

### Files

- Modify: `components/research/research-form.tsx`
- Modify: `components/research/research-workspace.tsx`

### Validation behavior

- [ ] University target required.
- [ ] Program optional.
- [ ] >=1 category required.
- [ ] Question max/public schema validated.
- [ ] Intake/year validated by public schema.
- [ ] Sensitive-input server rejection maps to the focused-question field with safe advice; client does not duplicate/pretend to fully detect sensitive data.
- [ ] Validate using `researchModeRequestSchema.safeParse()` immediately before fetch.
- [ ] Translate Zod issues to stable field-level messages; never render raw stack/parser internals.
- [ ] Invalid client form makes zero fetches.

Privacy helper text near question:

```text
Ask only about public university/program information. Do not include personal documents, IDs, account details, or other sensitive information.
```

### Loading interaction policy

While a Research request is active:

- [ ] disable target/filter/category/question/intake/year controls to avoid form/result target divergence;
- [ ] disable Research/Reset;
- [ ] enable only Cancel and safe navigation;
- [ ] restore controls after terminal result/error/cancel.

The submitted request is therefore a fixed snapshot and cannot be mutated mid-flight.

---

## Task 6 — Implement bounded fetch/cancel/error handling

### Files

- Modify: `components/research/research-workspace.tsx`
- Modify: `lib/research/mode/client-state.ts`

### Submit algorithm

```ts
const parsed = researchModeRequestSchema.safeParse(payload);
if (!parsed.success) { /* field errors, no fetch */ }
if (activeRequestRef.current !== null) return;

const sequence = nextSequenceRef.current++;
const controller = new AbortController();
activeRequestRef.current = { sequence, controller };
dispatch({ type: "start", sequence, submittedTargetLabel });

try {
  const response = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    signal: controller.signal,
  });
  // parse + strict public response validation
} finally {
  // clear only if this is still the active sequence
}
```

### Rules

- [ ] no automatic retries;
- [ ] one active fetch maximum;
- [ ] `AbortController` stored outside state for immediate cancellation;
- [ ] cancel button calls `.abort()` once and does not start replacement research;
- [ ] on unmount, abort active fetch;
- [ ] on `AbortError`, dispatch cancellation only if sequence is still current;
- [ ] non-2xx: attempt to parse strict error envelope; if body is non-JSON/invalid, use generic recoverable error;
- [ ] 2xx: require `{ ok:true }`; validate entire response schema before dossier render;
- [ ] a malformed 2xx response is a client error, not partially rendered data;
- [ ] stale sequence success/error ignored;
- [ ] previous dossier survives network/server error during refresh;
- [ ] valid server dossier with `run.status="failed"` renders as a result, not generic transport error.

Do not claim cancellation guarantees server work stopped; copy should say the request was cancelled from the user's session.

---

## Task 7 — Build run-level banners and summary

### Files

- Create: `components/research/research-run-banner.tsx`
- Create: `components/research/research-dossier.tsx`

Run summary should derive only from public dossier fields.

### Succeeded

- [ ] neutral/success summary;
- [ ] total final claims;
- [ ] verified/corroborated/etc claim counts when useful;
- [ ] count unknown **categories** from category rows, not `statusCounts.unknown` (claim-level unknown is always zero);
- [ ] show conflicts/outdated categories as separate warnings when present.

### Partial

- [ ] prominent "Some research is incomplete" message;
- [ ] list incomplete categories by label;
- [ ] keep ready/unknown evidence visible;
- [ ] retry button resubmits the same current form snapshot only when user explicitly chooses it.

Do not automatically research only failed categories in Phase 3; a retry is a new full selected request unless a later plan adds a tested category-only retry UX.

### Failed

- [ ] clear failure banner;
- [ ] no fake empty/unknown dossier;
- [ ] incomplete category cards remain visible with stable failure reasons;
- [ ] explicit Retry action.

### Loading

- [ ] use indeterminate skeleton/progress;
- [ ] no synthetic percentage/stage status;
- [ ] show Cancel;
- [ ] if refreshing, previous dossier stays visible under an "Updating" treatment and remains labeled with its original target.

Use a restrained `aria-live="polite"` region for run transitions; do not put entire changing dossier in a live region.

---

## Task 8 — Render canonical category sections without reinterpreting evidence

### Files

- Create: `components/research/research-category-section.tsx`
- Create: `components/research/research-claim-row.tsx`
- Modify: `components/research/research-dossier.tsx`

### Category rendering

Consume dossier rows in server-provided canonical order; do not sort by visual severity unless a later product requirement explicitly changes ordering.

#### Ready row

- [ ] category heading;
- [ ] claim count;
- [ ] unique evidence-status badges represented by claims;
- [ ] conflict warning if `hasConflict`;
- [ ] outdated warning if `hasOutdated`;
- [ ] explanation text labeled "Evidence summary";
- [ ] every final claim rendered once.

#### Unknown row

- [ ] use `EvidenceBadge status="unknown"` at **category** level;
- [ ] zero claims;
- [ ] deterministic fallback explanation text;
- [ ] wording: bounded research completed but did not establish a supported factual claim;
- [ ] no "View evidence" action;
- [ ] no placeholder numeric/text value.

#### Incomplete row

- [ ] use a separate neutral/warning `Badge` such as "Research incomplete"; do not use `EvidenceBadge status="unknown"`;
- [ ] stable failure message;
- [ ] zero claims;
- [ ] no explanation/source action;
- [ ] retry remains run-level, not one untested per-category hidden mutation.

### Claim row

Render:

- property;
- `formatClaimValue()` output;
- `EvidenceBadge` exact status;
- explicit academicYear/intake/effectiveDate chips/text only when present;
- "View evidence" button.

Rules:

- [ ] no confidence display (final Phase 2 has none);
- [ ] no inferred freshness from retrieval timestamp;
- [ ] do not select a winner among conflicting values;
- [ ] do not hide anecdotal/inferred claims behind a "verified" category summary;
- [ ] source count may be shown from `sourceIds.length`.

All text containers must use safe wrapping (`min-w-0`, `break-words`, and `overflow-wrap:anywhere` where URLs/unbroken content demand it).

---

## Task 9 — Implement claim evidence Sheet/Dialog

### Files

- Create: `components/research/claim-evidence-sheet.tsx`
- Create: `components/ui/sheet.tsx` only if required
- Modify: `components/research/research-dossier.tsx`

### UI primitive decision

- [ ] First inspect the existing installed `radix-ui` API and current shadcn conventions.
- [ ] If Dialog/Sheet primitives are already available through the installed dependency, add only the local shadcn-style component file.
- [ ] Do not add another dialog package.
- [ ] If existing dependency truly cannot support the required modal behavior, stop and document the dependency decision before changing `package.json`.

### Evidence sheet content

For selected `PublicResearchClaim`:

1. category/property;
2. formatted value;
3. exact evidence badge;
4. period/intake metadata when explicit;
5. exact `supportingText` in `<blockquote>`;
6. representative source first;
7. additional claim source links de-duplicated by source ID;
8. title, publisher, source type;
9. "Retrieved" observation timestamp;
10. source effective date/academic year when explicit;
11. external "Open source" link;
12. separate catalog "Official program page" or "Official university website" action.

### Source lookup invariants

Public DTO validation guarantees references, but component code still uses a deterministic source map:

```ts
const sourcesById = new Map(dossier.sources.map((source) => [source.id, source]));
```

- [ ] Representative source appears first.
- [ ] Remaining sources follow `claim.sourceIds` order excluding representative.
- [ ] Missing source after validated DTO is treated as component invariant error/fallback UI, not silently omitted in a way that misstates source count.

### Security/accessibility

- [ ] Supporting/source text rendered via React text nodes only.
- [ ] No `dangerouslySetInnerHTML`.
- [ ] External links: `target="_blank" rel="noopener noreferrer"`.
- [ ] Link text names the publisher/title context, not bare "click here".
- [ ] Dialog title/description IDs wired.
- [ ] Focus moves into sheet, traps, Escape closes, close returns focus.
- [ ] Close button has accessible name.
- [ ] Mobile sheet is usable without horizontal overflow.

Do not label an evidence source "Official" solely because `sourceType === "university"`; canonical official target links are separately catalog-owned.

---

## Task 10 — Preserve error/retry/input behavior

### Files

- Modify: `components/research/research-workspace.tsx`
- Modify: `components/research/research-form.tsx`

### Transport errors

Map public transport codes to stable user copy:

- `invalid-content-type`/`invalid-json`/`invalid-request`: request could not be submitted; preserve fields;
- `request-too-large`: shorten the focused question/options;
- `unsupported-target`: selected catalog target is no longer supported; ask user to reselect;
- `sensitive-input`: remove personal/sensitive content;
- `forbidden-origin`: generic request blocked; do not instruct bypass;
- `internal-error`: service could not complete request; retry later.

Do not show raw server body on parse failure.

### Retry

- [ ] Explicit only.
- [ ] Uses current validated form fields.
- [ ] If catalog target has changed after a prior result, the new result will be clearly labeled by its returned dossier target.
- [ ] Does not mutate/reuse hidden provider state or prior run IDs.
- [ ] Previous dossier remains until a new validated dossier replaces it.

### Unsupported target after catalog refresh

If the client somehow holds a stale ID that server no longer supports:

- [ ] show `unsupported-target`;
- [ ] clear only invalid selected target/program after user acknowledges or immediately with a clear message;
- [ ] preserve question/categories/intake/year for reselection.

---

## Task 11 — Phase 3C focused review and gates

### Pure tests

```text
cmd.exe /c npx.cmd vitest run tests/phase3c-research-state.test.ts tests/phase3c-research-format.test.ts
```

### Full static gates

```text
cmd.exe /c npm.cmd test
cmd.exe /c npx.cmd tsc --noEmit
cmd.exe /c npm.cmd run lint
cmd.exe /c npm.cmd run build
cmd.exe /c git diff --check
```

### Manual local sanity before Phase 3D

With `/api/research` intercepted or deterministic fixture wiring only in test tooling (never production code):

- [ ] Research page loads with no console error.
- [ ] Search/filter/select works.
- [ ] Form validation blocks zero target/category.
- [ ] Loading and Cancel visible.
- [ ] Succeeded/partial/failed fixture dossier renders.
- [ ] Unknown and incomplete visibly distinct.
- [ ] Evidence sheet opens/closes by mouse and keyboard.
- [ ] source links render safely.
- [ ] mobile narrow layout has no immediate overflow.

Do not add a production fixture/test query parameter to make manual QA easier.

## Phase 3C exit criteria

Phase 3C is complete when the static preview is fully replaced by a strict catalog-driven Research workspace, only one request can run at once, cancel/retry/stale-response behavior is deterministic, every public response is validated before rendering, all seven evidence/lifecycle states are represented truthfully, final claims/source provenance are inspectable through an accessible evidence sheet, and no client component imports Phase 2 server internals or provider secrets.
