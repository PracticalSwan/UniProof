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

## Reconciled live baseline — 2026-08-17

This plan has been reconciled against the released Phase 3A/3B implementation and its independent review fixes. Treat the following as implementation inputs, not assumptions to rediscover or weaken:

- `lib/research/mode/public-contracts.ts` is the browser contract source of truth. Public final claims support exactly seven claim-level evidence statuses (`verified`, `corroborated`, `university-reported`, `conflicting`, `anecdotal`, `inferred`, `outdated`); `unknown` exists only as a processed zero-claim **category** state.
- `researchDossierSchema` already rejects duplicate/unresolved claim/source references, unreferenced public sources, contradictory run/category lifecycle, non-canonical category order, bad explanation references, and non-monotonic run timestamps. Phase 3C must parse the complete response before rendering any dossier content rather than trying to repair malformed DTOs in React.
- The Phase 3B composer fails closed unless final claim university/program identity matches the catalog-selected target. Phase 3C adds a second request/response binding check so even a schema-valid dossier for a different submitted target or category set becomes `invalid-response` instead of being displayed.
- Phase 3B sensitive-data rejection covers **all caller-controlled free-text fields together**: `question`, `intake`, and `academicYear`. A `sensitive-input` response is therefore a form-level free-text error; the client must not pretend it knows which individual field triggered the server detector.
- Optional `question`, `intake`, and `academicYear` fields are rejected when present but blank after trim. The client request builder must trim them and **omit empty values** rather than serialize `""` from the initial form state.
- Public evidence source URLs may be HTTP or HTTPS; catalog-owned official university/program links remain credential-free HTTPS. Never relabel a source as official from `sourceType` alone.
- The server response envelope is `Cache-Control: no-store`, bounded to 4 MiB, and strict JSON. Browser code still treats transport output as untrusted: require JSON content type, parse once, validate the entire envelope, reject HTTP/envelope mismatches, and never show raw response text.
- An aborted server request may terminate the browser fetch without a JSON response. Client cancellation is determined from the exact active `AbortController.signal`, not from receiving a server `cancelled` envelope and not solely from an exception class/name.
- The bundled catalog search fix guarantees that every returned program has its owning university in the same search result. Reuse `searchResearchCatalog()` and do not rebuild ownership/search normalization in React.
- Current manifest is Next.js 16.3.1 / React 19.2.8 / Zod 4.4.3 / `radix-ui` 1.6.7. `radix-ui` already resolves the Radix Dialog dependency transitively; Phase 3C must not add another dialog package. Phase 3D, not 3C, owns migration from the direct `playwright` package to `@playwright/test`.

## Phase 3C acceptance invariants

The implementation is not acceptable unless all of these remain true:

1. One user action can create at most one active `/api/research` POST. Duplicate same-tick click/Enter paths are stopped synchronously before `fetch`.
2. The exact validated request snapshot is immutable after dispatch. Form edits cannot mutate an in-flight or retry payload.
3. Cancel wins for the active sequence: after `.abort()` no later response/parser completion from that sequence may become a result, even if the network promise races with cancellation.
4. A response is renderable only after strict public-schema validation **and** exact submitted university/program/category binding.
5. A stale sequence can never overwrite a newer result/error/cancellation state.
6. Recoverable errors and cancellation preserve user-entered form values; refreshing preserves the previous validated dossier until a newer validated dossier replaces it.
7. `unknown` and `incomplete` remain different concepts in state, copy, badge type, available actions, and accessibility semantics.
8. Claim values, evidence status, periods, source provenance, and explanation text are presentation-only inputs. React never recomputes evidence authority, freshness, conflict winners, currency/unit conversions, or missing facts.
9. Retrieved evidence text is rendered only as text nodes. External evidence/catalog links use safe anchors and never execute provider/source content.
10. No browser code imports server-only Phase 2 modules, provider adapters, environment variables, provider telemetry, raw documents, or candidates.
11. Default/focused automated tests remain offline and deterministic. No live research/provider call is part of Phase 3C acceptance.
12. `ui-flow-screenshots/` remains completely untouched.

---

## File map

Create:

```text
lib/research/mode/client-state.ts
lib/research/mode/client-form.ts
lib/research/mode/client-transport.ts
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
tests/phase3c-research-form.test.ts
tests/phase3c-research-transport.test.ts
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

export type ResearchSubmissionSnapshot = {
  request: ResearchModeRequest;
  targetLabel: string;
};

export type ResearchWorkspaceState =
  | { kind: "idle"; notice?: string }
  | {
      kind: "loading";
      requestSequence: number;
      submission: ResearchSubmissionSnapshot;
      previous?: ResearchDossier;
    }
  | {
      kind: "result";
      dossier: ResearchDossier;
      submission: ResearchSubmissionSnapshot;
      notice?: string;
    }
  | {
      kind: "error";
      error: ResearchWorkspaceError;
      submission: ResearchSubmissionSnapshot;
      previous?: ResearchDossier;
    };
```

`network-error` and `invalid-response` are client-only controller errors; the server MUST NOT emit them in the Phase 3B transport-error envelope. Cancellation is handled by the dedicated cancellation transition, not converted into an error code. The snapshot contains only the already validated public request and target label and exists only in component memory; do not log it or persist it to URL/localStorage/sessionStorage.

Tests:

- [ ] idle -> start loading with the exact immutable `ResearchSubmissionSnapshot`;
- [ ] result -> refresh loading preserves the previous dossier and stores the new submission separately;
- [ ] loading -> result replaces previous only when sequence matches;
- [ ] result retains the submission that actually produced that dossier so "Retry this research" cannot be reconstructed from mutable form state;
- [ ] stale sequence result ignored;
- [ ] loading -> transport error preserves previous dossier and failed submission snapshot;
- [ ] loading -> cancel restores previous dossier if present;
- [ ] first-run cancel returns idle + cancellation notice;
- [ ] stale error/cancel action cannot overwrite newer request;
- [ ] cancellation/result ordering is sequence-safe; reducer never accepts a terminal action for a non-current loading sequence;
- [ ] reset/clear-result affects run state only when explicitly requested; it does not implicitly clear form values;
- [ ] invalid reducer action ordering cannot produce two active sequence IDs.

### Step 2: Implement reducer/actions

Recommended actions:

```ts
type ResearchWorkspaceAction =
  | { type: "start"; sequence: number; submission: ResearchSubmissionSnapshot }
  | { type: "result"; sequence: number; dossier: ResearchDossier }
  | { type: "error"; sequence: number; error: ResearchWorkspaceError }
  | { type: "cancelled"; sequence: number }
  | { type: "clear-result" }
  | { type: "dismiss-notice" };
```

- [ ] Sequence comparison occurs inside the reducer or one pure helper, not scattered across components.
- [ ] `result`/`error` carry forward the submission from the matching loading state; callers never inject or recompute a different retry snapshot at terminal transition time.
- [ ] The dossier is always associated with its own server-returned target; never relabel an old dossier using current form selection.
- [ ] Form state is owned separately from run state. `clear-result` may clear the displayed run result only; it must not silently reset user-entered form fields.

### Step 3: Add a synchronous single-flight guard plan

React state alone is not a sufficient same-tick duplicate-submit lock. The workspace must also hold an `activeRequestRef`/controller ref.

```ts
if (activeRequestRef.current !== null) return;
```

Set the ref before the fetch begins and clear it in `finally` only if it still refers to that request sequence.

This prevents double-click/Enter races from starting duplicate expensive POSTs before React rerenders the disabled button.

---

## Task 1A — Build a pure catalog-aware form/request boundary before React UI

### Files

- Create: `lib/research/mode/client-form.ts`
- Create: `tests/phase3c-research-form.test.ts`

Keep target ownership, empty-field omission, category canonicalization, and request construction out of JSX event handlers. The component should manipulate form state through these pure helpers and submit only a validated `ResearchSubmissionSnapshot`.

### Required form model

```ts
export type ResearchFormState = {
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

export type ResearchFormField =
  | "universityId"
  | "programId"
  | "categories"
  | "question"
  | "intake"
  | "academicYear"
  | "freeText";
```

Recommended pure functions:

```ts
export function createInitialResearchFormState(): ResearchFormState;
export function selectResearchUniversity(
  state: ResearchFormState,
  universityId: string,
  catalog: ResearchCatalog,
): ResearchFormState;
export function selectResearchProgram(
  state: ResearchFormState,
  programId: string,
  catalog: ResearchCatalog,
): ResearchFormState;
export function toggleResearchCategory(
  categories: readonly ResearchModeCategory[],
  category: ResearchModeCategory,
): ResearchModeCategory[];
export function listResearchSubjectFilters(catalog: ResearchCatalog): readonly string[];
export function buildResearchSubmission(
  state: ResearchFormState,
  catalog: ResearchCatalog,
):
  | { ok: true; submission: ResearchSubmissionSnapshot }
  | { ok: false; fieldErrors: Partial<Record<ResearchFormField, string>> };
```

### Red tests first

- [ ] Initial state contains all seven categories exactly once in canonical order and blank UI strings for the three optional free-text fields.
- [ ] Blank/whitespace-only `question`, `intake`, and `academicYear` are trimmed and **omitted** from the request; the initial valid form does not fail merely because optional UI controls contain `""`.
- [ ] Nonblank optional fields are trimmed exactly once and survive request construction.
- [ ] Missing/unknown university ID fails client validation without choosing a fallback university.
- [ ] Unknown program ID fails; program ownership mismatch fails; neither case silently retargets.
- [ ] Selecting a program sets its owning university deterministically.
- [ ] Selecting a university-level target always clears `programId`, including when that university previously owned the selected program; this is the explicit way to switch from program-scoped to university-scoped research.
- [ ] Toggling categories always returns canonical order regardless of click order; zero selected categories is representable in form state but rejected on submit.
- [ ] Duplicate categories cannot survive request construction.
- [ ] Exact max-length question/intake/year values pass and over-limit values fail using the same JavaScript UTF-16 length semantics as Zod, including astral-character boundary cases.
- [ ] Subject filter options are unique after catalog normalization and deterministic; deriving/changing filters never mutates the selected target.
- [ ] `targetLabel` comes from the resolved catalog records, e.g. `University • Program`, and never from free-form search text.
- [ ] Built output passes `researchModeRequestSchema.parse()` and contains only `universityId`, optional `programId`, canonical `categories`, and nonblank optional public fields.
- [ ] The helper performs no sensitive-data detection and does not log input. Server `sensitive-input` remains authoritative.

### Implementation rules

- Use `researchModeRequestSchema.safeParse()` as the final request validator after project-owned catalog/ownership checks and empty-string omission.
- Map Zod issues to stable field keys/messages; never return raw Zod issue objects or user values for rendering.
- Use `searchResearchCatalog()` for filtering; the helper may derive deterministic subject options but must not duplicate the catalog normalization/search algorithm.
- Do not persist form/submission state outside component memory.

Run the focused test file after the red test is added, observe the expected failure, implement the smallest helper behavior, then rerun until green before wiring React.

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

Use `ResearchFormState` and the pure selection/request helpers from Task 1A. Do not recreate a second form-state type in the component.

Initialize all seven categories selected in canonical order. Users may deselect categories but cannot submit zero.

### Search/filter requirements

- [ ] Use `searchResearchCatalog()` from Phase 3A; do not reimplement fuzzy/search normalization in React.
- [ ] Text input matches supported university/program/aliases/subject.
- [ ] Country filter.
- [ ] Degree-level filter.
- [ ] Subject filter drawn from `listResearchSubjectFilters()`.
- [ ] Search results clearly distinguish university-level targets from program targets and include the owning university for every program result.
- [ ] Selecting a program uses `selectResearchProgram()` and therefore sets its owning university.
- [ ] Selecting any university result uses `selectResearchUniversity()` and explicitly switches to university-level research by clearing `programId`; never leave an invisible program scope selected.
- [ ] Provide an explicit `Research university only`/remove-program action when a program is selected; provide a separate clear-target action when the user wants no selected university.
- [ ] Filters narrow the **available search results** but never silently retarget an already selected university/program. Keep the selected target visible in a separate selected-target panel even if current filters no longer match it.
- [ ] "No supported matches" does not offer arbitrary/free-form target research.
- [ ] Reset form clears selection/filter/question/intake/year, field/form errors, and restores all seven categories; it never fires an API call. It does not silently relabel or erase a previously returned dossier; use the reducer's explicit clear-result action if the UI exposes a separate clear-result control.
- [ ] Search/filter inputs are not serialized into the request.

### Accessibility and control choice

- [ ] Every input/select has a visible label and stable `id`/`htmlFor` association.
- [ ] Filter controls have stable accessible names.
- [ ] Render search matches as a semantic list of native `type="button"` controls rather than inventing `listbox`/combobox keyboard semantics the implementation does not support.
- [ ] Search result buttons expose university/program and degree/country context in their accessible name or description.
- [ ] Selected target panel has clearly named university-only/program/clear actions.
- [ ] Use native `<input type="checkbox">` controls for categories; no checkbox dependency is needed.
- [ ] Use a native `<textarea>` for the optional focused question unless an already-installed local primitive provides equivalent semantics; Enter in the textarea inserts a newline and never submits research.
- [ ] Prevent Enter in the **catalog search filter** from implicitly submitting an expensive research request. Enter-based form submission is tested from ordinary research form controls/submit button, not from the target-search filter.
- [ ] Validation/help text IDs are stable so `aria-describedby` and `aria-invalid` can be applied deterministically.

Do not add a combobox, checkbox, textarea, or form-library dependency solely for Phase 3C. The catalog is small enough for a filtered semantic list plus existing/native controls.

---

## Task 5 — Build Research options/category validation

### Files

- Modify: `components/research/research-form.tsx`
- Modify: `components/research/research-workspace.tsx`

### Validation behavior

- [ ] `buildResearchSubmission()` is the only submit-time request builder. JSX must not hand-build a second payload.
- [ ] University target required; program optional but, when present, must exist in the client catalog and belong to the selected university.
- [ ] >=1 category required; request categories come back canonical and deduplicated.
- [ ] Blank optional question/intake/year values are omitted rather than sent as empty strings.
- [ ] Question/intake/year maximums use the public schema's UTF-16 semantics; HTML `maxLength` may improve UX but never replaces schema validation.
- [ ] A client-invalid form makes zero fetches and focuses/announces the first actionable validation problem without echoing raw parser internals.
- [ ] A server `sensitive-input` rejection becomes one stable **free-text group/form error** because the authoritative detector checks `question`, `intake`, and `academicYear` together. Associate that guidance with all populated free-text controls; do not claim one specific field was the cause.
- [ ] The client intentionally does not duplicate the server's sensitive-data detector or attempt to pre-classify passports/GPA/etc. with a weaker browser regex.
- [ ] `unsupported-target` never triggers fuzzy/first-result fallback. Invalidate the selected target deterministically and require explicit reselection while preserving categories/question/intake/year.

Privacy helper text belongs to the free-text group, not only the question control:

```text
Use these fields only for public university/program research context. Do not include personal documents, IDs, account details, academic records, or other sensitive information.
```

### Loading interaction policy

While a Research request is active:

- [ ] disable target/filter/category/question/intake/year controls and Research/Reset so the mutable form cannot diverge from the submitted snapshot;
- [ ] keep Cancel reachable and enabled until cancellation has been requested;
- [ ] previous dossier content may remain readable during refresh, including safe source/evidence navigation, but it must stay labeled with its original server-returned target and must not expose a second research submit path;
- [ ] close any open claim-evidence sheet before starting a new request so stale modal context cannot cover the current Cancel/status controls;
- [ ] restore form controls after terminal result/error/cancel.

The submitted request is therefore a fixed snapshot and cannot be mutated mid-flight.

---

## Task 5A — Build and unit-test the client transport boundary before wiring fetch into React

### Files

- Create: `lib/research/mode/client-transport.ts`
- Create: `tests/phase3c-research-transport.test.ts`

Keep HTTP/envelope validation out of `research-workspace.tsx`. The transport helper receives an already validated `ResearchModeRequest`, the exact `AbortSignal`, and an injectable `fetchImpl` for deterministic tests.

Recommended result contract:

```ts
export type ResearchClientTransportResult =
  | { kind: "dossier"; dossier: ResearchDossier }
  | { kind: "server-error"; error: PublicResearchTransportError }
  | { kind: "network-error"; error: { code: "network-error"; message: string } }
  | { kind: "invalid-response"; error: { code: "invalid-response"; message: string } }
  | { kind: "cancelled" };

export async function executeResearchRequest(
  request: ResearchModeRequest,
  signal: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ResearchClientTransportResult>;
```

### Required request wire shape

Exactly one call to `/api/research` with:

```ts
{
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
  signal,
  cache: "no-store",
  redirect: "error",
}
```

Do not add provider headers, credentials, query strings, retries, keepalive/background semantics, or caller-controlled endpoint/model data.

### Red tests first

- [ ] Success makes exactly one fetch and uses the exact validated body/headers/signal plus `cache:"no-store"` and `redirect:"error"`.
- [ ] A valid `{ok:true}` 2xx response returns the **parsed/validated** dossier, including a valid `run.status="failed"` dossier; run-level failure is data, not transport failure.
- [ ] A valid non-2xx `{ok:false}` public error returns `server-error` and does not expose raw response text.
- [ ] A 2xx `{ok:false}` envelope is rejected as `invalid-response`; a non-2xx `{ok:true}` envelope is also rejected. HTTP status and envelope kind must agree.
- [ ] Missing/non-JSON response `Content-Type`, malformed JSON, empty body, schema-invalid JSON, unreferenced source, lifecycle-invalid dossier, and unknown response keys all become one sanitized `invalid-response` result.
- [ ] A schema-valid dossier whose `target.university.id` differs from the submitted `universityId` becomes `invalid-response`.
- [ ] For program-scoped requests, dossier program ID must exactly equal submitted `programId`; for university-only requests, dossier `target.program` must be absent. Mismatch becomes `invalid-response`.
- [ ] Dossier category rows must exactly equal the already canonical submitted request categories. A schema-valid dossier for a different category set becomes `invalid-response`.
- [ ] Network/redirect rejection becomes sanitized `network-error` unless `signal.aborted` is true.
- [ ] If the exact signal is already aborted or becomes aborted at any await boundary, return `cancelled` even when the caught exception is not a DOM `AbortError`; signal state is authoritative.
- [ ] Cancellation is re-checked after `fetch`, after body read/JSON decode, and immediately before returning a dossier/server error so a response racing with `.abort()` cannot win.
- [ ] No branch calls `fetchImpl` a second time. Retry remains an explicit higher-level user action.
- [ ] Provider/source/body error content passed through a thrown fetch error is not copied into returned messages.

### Response-size note

Phase 3B already guarantees <=4 MiB server envelopes. Do not import the server-only handler into the client merely to reuse its constant. The browser helper should reject an obviously oversized declared `Content-Length` when available and may use a small project-owned streamed/text byte guard if implemented without adding complexity; Phase 3D will stress malformed/long responses. The mandatory security property for Phase 3C is strict complete-schema validation before rendering, not duplicating the server's streaming implementation.

Run this focused test red -> green before adding the workspace network wiring.

---

## Task 6 — Wire single-flight fetch/cancel/error handling into the workspace

### Files

- Modify: `components/research/research-workspace.tsx`
- Modify: `lib/research/mode/client-state.ts`

### Submit algorithm

The workspace has two explicit submission entrypoints:

1. **Run research** builds a fresh validated submission from current form state through `buildResearchSubmission()`.
2. **Retry this research** reuses the exact stored immutable `ResearchSubmissionSnapshot` from the failed/partial/result state. It does not reconstruct a historical retry from whatever the user has since typed into the form.

Both entrypoints call one internal `startSubmission(submission)` function:

```ts
if (activeRequestRef.current !== null) return;

const sequence = nextSequenceRef.current++;
const controller = new AbortController();
const active = { sequence, controller };
activeRequestRef.current = active; // synchronous same-tick lock before dispatch/fetch
closeEvidenceSheet();
dispatch({ type: "start", sequence, submission });

try {
  const outcome = await executeResearchRequest(
    submission.request,
    controller.signal,
  );

  if (activeRequestRef.current !== active) return;
  if (controller.signal.aborted || outcome.kind === "cancelled") {
    dispatch({ type: "cancelled", sequence });
  } else if (outcome.kind === "dossier") {
    dispatch({ type: "result", sequence, dossier: outcome.dossier });
  } else {
    dispatch({ type: "error", sequence, error: outcome.error });
  }
} finally {
  if (activeRequestRef.current === active) {
    activeRequestRef.current = null;
  }
}
```

### Rules and race invariants

- [ ] No automatic retries and no provider-specific client retry behavior.
- [ ] `activeRequestRef.current` is the synchronous authority for single-flight. Set it before any state dispatch or async boundary; clear it only by object identity for that exact request.
- [ ] `AbortController` lives outside reducer state for immediate cancellation. Cancel disables itself after the signal becomes aborted and calls `.abort()` at most once.
- [ ] Cancellation does not start replacement research, mutate form fields, or clear a previous dossier.
- [ ] The transport helper already treats the exact signal as authoritative; the workspace additionally checks `controller.signal.aborted` before terminal dispatch so cancellation wins a response race.
- [ ] A terminal reducer action is dispatched only while the matching active object/sequence is still current. Stale success/error/cancel outcomes are ignored.
- [ ] On unmount, mark the component inactive and abort the exact active controller. Do not dispatch cancellation/error after unmount merely to update state that will never render.
- [ ] Closing/replacing a dossier clears the selected claim/evidence-sheet state so an old claim cannot remain open against a newer dossier.
- [ ] Previous dossier survives cancellation, network error, server error, and invalid response during refresh. It is replaced only by a fully validated/bound newer dossier.
- [ ] A valid dossier whose `run.status="failed"` is dispatched as `result`, not converted to a transport error.
- [ ] Field/form errors from a new Run Research attempt do not erase the previous dossier or last completed submission.
- [ ] Never place request content, source content, provider details, response bodies, or exception text into console logs.

Do not claim cancellation guarantees server work stopped. User copy should say the request was cancelled **in this session** and that a new request is not started automatically.

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
- [ ] `Retry this research` resubmits the exact immutable submission that produced the displayed partial dossier, even if the editable form has since changed;
- [ ] if the form currently differs from that displayed dossier's submission, label the normal submit action clearly as a **new** research request rather than implying it retries the old result.

Do not automatically research only failed categories in Phase 3. A retry repeats the complete prior selected request; a new Run Research action uses current validated form values. Category-only retry remains out of scope.

### Failed

- [ ] clear failure banner;
- [ ] no fake empty/unknown dossier;
- [ ] incomplete category cards remain visible with stable failure reasons;
- [ ] explicit `Retry this research` action uses the exact submission associated with the failed dossier, not current mutable form values.

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

- [ ] Use the already-installed `radix-ui` Dialog primitive through the same local shadcn-style convention used by existing UI primitives; package-lock inspection confirms the Dialog dependency is already present transitively.
- [ ] Add only the local `components/ui/sheet.tsx` wrapper if needed. Do not add another dialog package and do not change `package.json`/lockfile for this Phase 3C sheet.
- [ ] Use one controlled claim-evidence surface owned by `ResearchDossier`, not one independent modal state per claim row. The selected claim ID/source map is application state; the claim trigger remains a native button.
- [ ] If the observed installed API unexpectedly cannot provide modal focus trapping/portal/Escape/return-focus semantics, treat that as a verified plan blocker and document it before any dependency change rather than silently adding a package.

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

- [ ] Supporting/source text is rendered via React text nodes only. No `dangerouslySetInnerHTML`, dynamic HTML parser, external image/script embed, or source-controlled style/event-handler interpolation.
- [ ] Evidence and catalog links use ordinary anchors with `target="_blank"`, `rel="noopener noreferrer"`, and `referrerPolicy="no-referrer"`; do not use `window.open` when an anchor suffices.
- [ ] Preserve the complete safe `href` while wrapping/truncating only its visible text. Long URLs/source titles use `min-w-0` plus safe word/anywhere wrapping without globally hiding horizontal overflow.
- [ ] Link text names the publisher/title context, not bare "click here".
- [ ] Dialog title/description IDs are wired and useful; the close button has an accessible name.
- [ ] Opening records the exact trigger element/claim ID. Focus moves into the modal, remains trapped, Escape/Close closes, and `onCloseAutoFocus` (or the equivalent supported primitive hook) restores focus to the exact still-mounted claim trigger rather than an arbitrary first row.
- [ ] Starting a new research request, clearing/replacing the displayed dossier, or invalidating the selected claim closes the evidence sheet before the underlying claim disappears. Do not leave a modal bound to stale result state.
- [ ] Source-map invariant failure after a previously validated DTO renders one bounded internal presentation error for the sheet and closes/blocks evidence interaction; do not silently reduce the source count or choose another source.
- [ ] Mobile sheet has bounded viewport height, internal vertical scrolling, no horizontal page overflow, and a reachable close control.

Do not label an evidence source "Official" solely because `sourceType === "university"`; canonical official target links are separately catalog-owned. Source `retrievedAt` is observation metadata and never becomes freshness/effective-date copy.

---

## Task 10 — Preserve error/retry/input behavior

### Files

- Modify: `components/research/research-workspace.tsx`
- Modify: `components/research/research-form.tsx`

### Transport/error presentation

Map only validated public transport codes to stable user copy; client-only `network-error` and `invalid-response` have separate fixed messages. Never show raw response text, exception messages, stack traces, URLs from failures, or Zod details.

- `invalid-content-type` / `invalid-json` / `invalid-request`: request could not be accepted; preserve form fields and offer a normal new submission after correction.
- `request-too-large`: ask the user to shorten public research context; do not claim only the question caused it because the server bounds the complete request body.
- `unsupported-target`: selected catalog target is no longer supported; require explicit reselection and never choose a replacement automatically.
- `sensitive-input`: show the free-text group guidance across populated question/intake/year controls; preserve text for user correction but never repeat the sensitive value in generated error copy.
- `forbidden-origin`: generic request-blocked copy; do not instruct users to weaken origin/browser controls.
- `internal-error`: generic service failure; the exact prior submission may be retried explicitly.
- `network-error`: connection/request failed in the browser; the exact prior submission may be retried explicitly unless it was cancellation.
- `invalid-response`: the server response could not be safely validated; preserve prior dossier/form and allow an explicit exact-submission retry.

### Retry versus new submission

- [ ] All retry is explicit. No `useEffect`, timer, service worker, route handler, or catch block automatically resends research.
- [ ] `Retry this research` uses the stored immutable `ResearchSubmissionSnapshot` associated with the relevant partial/failed dossier or recoverable error.
- [ ] The ordinary `Research` submit uses **current** form state through `buildResearchSubmission()` and is a new request. Do not call it Retry when current fields differ from the stored submission.
- [ ] Correction-required errors (`sensitive-input`, `unsupported-target`, `request-too-large`, client validation) emphasize editing/reselection rather than offering a blind retry that is likely to repeat the same rejection.
- [ ] Retrying does not reuse a run ID, provider state, source list, controller, sequence number, or any hidden server data. It creates a fresh client sequence/controller and sends only the stored public request fields.
- [ ] Previous dossier remains until a new fully validated/bound dossier replaces it.

### Unsupported target after catalog refresh

If a server returns `unsupported-target` for a client-catalog ID:

- [ ] show the stable unsupported-target message;
- [ ] invalidate **both** selected program and university IDs when the server does not reveal which ID is stale; require explicit reselection instead of guessing;
- [ ] preserve filters/search, categories, question, intake, and academic year for correction;
- [ ] do not rewrite or relabel any previously returned dossier, which remains associated with its own server-returned target;
- [ ] do not mutate the bundled catalog in memory to remove the target; a future catalog build/reload owns catalog membership.

---

## Task 11 — Phase 3C focused review and gates

### TDD and focused tests

For every defect discovered during implementation, add/adjust the nearest failing regression first when the behavior is practical to isolate. Observe the focused failure before the fix, make the smallest coherent correction, then rerun that focused test.

Run all Phase 3C focused boundaries together:

```text
cmd.exe /c npx.cmd vitest run tests/phase3c-research-state.test.ts tests/phase3c-research-form.test.ts tests/phase3c-research-transport.test.ts tests/phase3c-research-format.test.ts tests/phase3c-research-ui.test.ts
```

These focused suites must include the UTF-16/astral input boundary, blank optional omission, catalog program ownership/scope switching, exact target/category response binding, cancellation races, HTTP/envelope mismatch, malformed/non-JSON responses, immutable retry snapshots, stale reducer transitions, formatting/XSS-looking strings, rendered field-error associations, populated-only sensitive-input invalid state, server-returned target labeling, retry ownership when a newer refresh fails over a prior partial dossier, and safe prior-evidence navigation during refresh.

### Full repository gates

```text
cmd.exe /c npm.cmd test
cmd.exe /c npx.cmd tsc --noEmit
cmd.exe /c npm.cmd run lint
cmd.exe /c npm.cmd run build
cmd.exe /c npm.cmd audit --omit=dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:/Side Projects/UniProof/scripts/verify-workspace.ps1"
cmd.exe /c git diff --check
```

Do **not** install/replace the Playwright Test runner in Phase 3C. The existing direct `playwright` package may be used only for a disposable local sanity script if browser inspection needs automation; Phase 3D owns the checked-in `@playwright/test` dependency/configuration/E2E suite.

### Required static/security hygiene

After implementation and docs are frozen, inspect the intended diff and run targeted scans/checks that prove:

- [ ] strict UTF-8/control scan over every changed text file: no replacement characters, unexpected C0 controls, or mojibake;
- [ ] no real provider/database secret value appears in changed/tracked/client/build output;
- [ ] no provider credential is introduced under `NEXT_PUBLIC_*`;
- [ ] production Research client/components contain no provider adapters, `process.env` provider reads, `providerAttempts`, documents, candidateSources, candidates, or other Phase 2 server internals;
- [ ] no `dangerouslySetInnerHTML`, source-controlled executable markup/style/event code, research query-string serialization, localStorage/sessionStorage research persistence, automatic background retry, or production test-mode/fixture switch exists;
- [ ] `.env.local` remains ignored/untracked and unchanged by this batch;
- [ ] production TODO/FIXME/HACK/debug logging/residue scan finds no Phase 3C implementation residue;
- [ ] `ui-flow-screenshots/` remains exactly user-owned/untracked and untouched;
- [ ] no dependency or lockfile change occurred unless a verified blocker forced a separately justified change (none is currently expected).

### Local rendered sanity before Phase 3D

Use the real `/research` page and real production client code with `/api/research` intercepted only by temporary task-local browser tooling or an external test harness. Never add a production fixture mode/query parameter. Make zero live Tavily/Brave/Gemini/Groq/OpenRouter/ROR/university calls.

At minimum verify one desktop and one narrow/mobile viewport:

- [ ] Research page loads with no illustrative factual dossier and no console/page error.
- [ ] Search/filter/select works; selecting a program sets its owner; switching to university-only clears program scope; filters do not retarget the selected target.
- [ ] Blank optional fields are omitted; zero target/category is blocked client-side; catalog-search Enter does not submit; focused-question textarea Enter inserts a newline.
- [ ] One valid submit produces exactly one intercepted POST; double-click/Enter same-tick paths do not duplicate it.
- [ ] Loading is indeterminate and Cancel remains reachable; cancellation preserves fields/prior dossier and sends no automatic retry.
- [ ] Succeeded, partial, failed, unknown, and incomplete presentations are visually distinguishable; a schema-valid wrong-target/wrong-category fixture is rejected rather than rendered.
- [ ] Evidence sheet opens/closes by mouse and keyboard, Escape closes, focus returns to the exact trigger, source/supporting text is literal text, and official/evidence links are distinct.
- [ ] Long labels/supporting text and the evidence sheet do not create immediate page horizontal overflow.

Delete only disposable task-local browser scripts/output created for this sanity pass after their evidence is no longer needed; do not touch `ui-flow-screenshots/`.

### Final defect-first review and documentation

After all local gates and rendered sanity pass:

1. Review the complete intended diff against this runbook, `docs/planning/phase-3-research-mode.md`, `docs/requirements.md`, `docs/security.md`, and current Phase 3A/3B public contracts.
2. Check specifically for duplicate submit routes, mutable-snapshot retry, cancellation/result races, stale modal/source state, target/category relabeling, blank optional serialization, evidence-status reinterpretation, accessibility-name/focus defects, unsafe external-link/text rendering, client/server import leakage, and responsive min-width overflow.
3. Apply the canonical `AGENTS.md` model-specific review rule: GLM-5.3 Max performs this final review inline with zero subagents; a native OpenAI GPT main agent performs its own inline review and then uses the required final read-only `code-reviewer` after local gates. Validate/fix real findings in the main agent and rerun affected/full gates.
4. Update `docs/planning/tasks.md`, `docs/planning/phase-3-research-mode.md`, README/design/security only where implementation truth changed; append the completed batch to `AGENT_MEMORY.md`; update `LESSONS.md` only for a genuinely reusable mistake/correction.
5. Inspect final Git status/diff. Do not stage, commit, push, deploy, or make live provider calls unless separately authorized.

## Phase 3C exit criteria

Phase 3C is complete only when the static preview is fully replaced by the strict catalog-driven Research workspace; pure form/state/transport/format seams are covered; optional blank fields are omitted; program ownership/scope changes are deterministic; only one exact request snapshot can run at once; cancellation wins all same-sequence races; retry versus new submission is explicit; every response passes full schema plus submitted target/program/category binding before render; prior dossiers survive recoverable refresh failures without relabeling; all public evidence/lifecycle states remain truthful; final provenance is inspectable through an accessible focus-safe evidence sheet; rendered desktop/mobile sanity passes; all repository/security gates pass; no client code imports Phase 2 internals/provider secrets; no live provider call or Phase 3D dependency work occurred; and `ui-flow-screenshots/` remains untouched.
