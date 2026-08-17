# Phase 3D — Research Hardening and Browser QA Implementation Plan

> **Execution policy — explicit user override for this batch:** Execute Phase 3D entirely in the **main ChatGPT agent with zero subagents and zero reviewer-agent/subagent calls**, regardless of the active model. Subagents are unavailable for this task. This task-specific user instruction overrides the native-GPT reviewer delegation described in `AGENTS.md`. Perform planning, implementation, TDD, browser QA, security/accessibility review, documentation, and the final defect-first review inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete Phase 3 Research experience across lifecycle, evidence, concurrency, accessibility, responsive behavior, security, malformed-data handling, and browser/network edge cases using deterministic offline fixtures and browser automation, fix only defects within the approved Phase 3 boundary, and close Phase 3 without live provider calls or deployment.

**Architecture:** Keep Phase 2/3 server-contract correctness and transport races that require synthetic streams in Vitest; keep real browser interaction, accessibility, focus, responsive, and network discipline in Playwright Test. Browser tests intercept `/api/research`, use schema-validated valid fixtures plus explicitly raw malformed responses, and fail closed on any unexpected external browser network. Use the real Next.js page/components and production client code. No production test mode, query flag, fake endpoint, provider bypass, persistence seam, or browser-side evidence engine is added.

**Tech Stack:** Exact current baseline: Next.js 16.3.1, React 19.2.8, Zod 4.4.3, Vitest 4.1.10, TypeScript 5.x, `radix-ui` 1.6.7, and direct `playwright` 1.62.1. Phase 3D replaces that redundant direct dev dependency with exact `@playwright/test` **1.62.1** after confirming no independent imports. No additional accessibility/testing/form/network library is required; use Playwright roles/keyboard/DOM APIs, the existing public schemas, and small project-owned helpers.

## Global Constraints

- Phase 3A–3C must be implemented and green first.
- Read `LESSONS.md` first.
- Do not weaken strict schemas because a browser fixture is inconvenient.
- Do not make live provider calls in automated tests.
- Do not add production fixture modes, `?test=...`, secret bypasses, alternate unauthenticated endpoints, or environment switches that change evidence semantics.
- Do not change Phase 2 authority/conflict/freshness/unknown semantics during UX hardening.
- Do not implement persistence, auth, Comparison, Guide, deployment, or public rate-limit infrastructure here.
- Do not overwrite, delete, rename, stage, or use the protected `ui-flow-screenshots/` directory as test output. It now contains **10 user-requested current-state screenshots** and remains untracked reference material. Playwright artifacts stay in already ignored `test-results/`, `playwright-report/`, or `output/playwright/` paths.
- Do not use subagents/reviewer agents anywhere in this batch. The main agent performs the final independent-style defect review inline.
- Do not commit, push, deploy, or make live provider/university requests unless separately authorized after implementation.

## Reconciled live baseline — 2026-08-18

Phase 3D starts from reviewed commit:

```text
d71c1628500c5ae71e14113ae8144cf4c1f14e99
feat: complete reviewed Phase 3C research workspace
```

Observed live facts that the implementation must preserve:

- Phase 3C focused suites are 65/65 and the repository Vitest baseline is 296/296 before Phase 3D changes.
- `tests/phase3c-research-ui.test.ts` already locks the independent-review fixes for field-error ARIA association, populated-only sensitive-input invalid state, server-returned canonical target labels, retry ownership, and evidence navigation during refresh.
- `client-state.ts` now gives `clear-result` literal clear semantics; a preserved dossier plus newer refresh error must not restore itself when the user chooses `Clear result`.
- A newer refresh error is the sole retry owner; the older preserved partial/failed dossier retry is suppressed while that transport error is active.
- Result headings use the validated **server-returned** university/program names, not the client snapshot label.
- Previously validated evidence remains inspectable during refresh, but accepting a replacement dossier clears stale claim/sheet state.
- `client-transport.ts` already checks JSON content type, declared `Content-Length`, strict envelope/schema shape, HTTP/envelope agreement, request target/program/category binding, and signal-authoritative cancellation. Phase 3D adds a missing defense-in-depth check for the **actual streamed response byte count when Content-Length is absent or dishonest**.
- Current manifest has direct `playwright@1.62.1` only; `npm ls playwright @playwright/test --depth=0` confirms `@playwright/test` is not a direct dependency. No checked-in source currently imports `playwright`.
- `vitest.config.mts` includes only `tests/**/*.test.ts`, so new Playwright `*.spec.ts` files under `tests/e2e/` are not collected by `npm test`. `tsconfig.json` includes all `*.ts`/`*.tsx`, so E2E helpers/specs are still covered by `tsc --noEmit`.
- `output/playwright/` is ignored and currently empty. Use it for disposable visual/manual QA evidence only.
- `ui-flow-screenshots/` currently contains exactly `01`–`10` PNG files. Because the whole directory is untracked, ordinary Git status cannot detect accidental overwrites; Phase 3D must hash its names/sizes/SHA-256 before work and compare them again at the end.

## Phase 3D acceptance invariants

1. **Offline browser acceptance:** no automated test requires Tavily, Brave, ROR, Gemini, Groq, OpenRouter, university websites, or any other external network. Unexpected external browser requests fail the test rather than merely being logged.
2. **One request, one owner:** single-flight, immutable retry snapshots, cancel ownership, preserved-result ownership, and stale-sequence protection stay exact under mouse, keyboard, same-tick, navigation, and failure races.
3. **Schema before UI:** no malformed, oversized, invalid-UTF-8, HTTP/envelope-mismatched, wrong-target/program/category response reaches dossier rendering.
4. **Truthful evidence:** browser code never invents authority, conflict winners, freshness, dates, currency/unit conversions, missing facts, confidence, or provider state.
5. **Unknown is not incomplete:** lifecycle/state wording, badges, source actions, and retry behavior keep these states operationally distinct.
6. **Safe evidence rendering:** retrieved/model text remains inert text; no payload creates DOM script/image/event behavior, alert/dialog execution, or external network.
7. **Accessible interaction:** keyboard-only target selection, validation recovery, cancellation, retry, evidence inspection, modal focus trap/return, visible focus, controlled announcements, and reduced-motion behavior are verified in a real browser.
8. **Responsive contract:** required viewports have no page-level horizontal overflow; long names/URLs/supporting text and the evidence sheet remain usable without globally hiding overflow.
9. **No test backdoors:** fixture routing and server-mode selection live only in Playwright/test configuration and test code. Production components/routes do not gain test flags or bypasses.
10. **Protected artifacts stay immutable:** `ui-flow-screenshots/` names, byte sizes, and hashes are identical before/after Phase 3D unless the user separately asks to refresh them.
11. **No flaky acceptance masking:** retries remain zero. Timing-sensitive tests use deterministic route barriers/deferred promises instead of arbitrary sleeps; critical race specs are repeated explicitly during final verification.
12. **No subagents:** all implementation, review, and verification evidence is produced by the main ChatGPT agent in this batch.

---

## File map

Create:

```text
playwright.config.ts
tests/fixtures/research-dossiers.ts
tests/e2e/helpers/research-browser.ts
tests/e2e/research-form.spec.ts
tests/e2e/research-lifecycle.spec.ts
tests/e2e/research-races.spec.ts
tests/e2e/research-evidence.spec.ts
tests/e2e/research-errors.spec.ts
tests/e2e/research-accessibility.spec.ts
tests/e2e/research-responsive.spec.ts
```

Keep responsibilities narrow:

- `research-dossiers.ts`: schema-validated **valid** public response fixtures/builders plus clearly named raw invalid-response builders that are never typed/paraded as valid DTOs.
- `research-browser.ts`: reusable catalog-selection helpers, deterministic route controller/deferred barriers, request capture, console/page/dialog/network guards, and overflow/focus helpers. No product behavior lives here.
- form/lifecycle/races/evidence/errors/accessibility/responsive specs: one concern per file so failures localize cleanly and a small/fast implementer does not have to edit one giant browser suite.

Modify as defects are proven by a failing regression:

```text
components/research/*.tsx
lib/research/mode/client-state.ts
lib/research/mode/client-form.ts
lib/research/mode/client-transport.ts
lib/research/mode/format.ts
lib/research/mode/public-contracts.ts    # only for a demonstrated public-contract hole
lib/research/mode/handler.ts             # only for a demonstrated server-boundary hole
app/research/page.tsx
```

Expected test/config/dependency modifications:

```text
package.json
package-lock.json
tests/phase3c-research-transport.test.ts  # streamed byte-bound/UTF-8/cancel regressions
vitest.config.mts                         # inspect only; no change expected because it already includes only tests/**/*.test.ts
```

Update completion docs only after all gates pass:

```text
docs/planning/tasks.md
README.md
docs/design.md                # only if actual architecture changed
docs/security.md              # actual Research endpoint/browser controls
AGENT_MEMORY.md
LESSONS.md                    # reusable lesson only
```

---

## Task 0A — Freeze the reviewed baseline and protected screenshot hashes

Before changing dependencies, tests, or product code:

- [x] Confirm `HEAD` is the reviewed Phase 3C commit `d71c1628500c5ae71e14113ae8144cf4c1f14e99` or, if it legitimately advanced, reconcile the new commits against this plan before proceeding.
- [x] Inspect branch/status/diff and treat any non-Phase-3D user changes as protected/unrelated.
- [x] Enumerate `ui-flow-screenshots/`; expected planning-time set is exactly ten PNGs, `01-...` through `10-...`.
- [x] Compute a task-local manifest of each protected screenshot's relative filename, byte size, and SHA-256 into ignored `output/playwright/phase3d-protected-screenshots.json`. This file is verification residue only; do not modify the PNGs.
- [x] Confirm `output/playwright/` contains no stale artifact that could be mistaken for current evidence; remove only clearly disposable task-local residue under the standing cleanup authorization.
- [x] Establish the pre-Phase-3D test baseline:

```text
cmd.exe /c npx.cmd vitest run tests/phase3c-research-state.test.ts tests/phase3c-research-form.test.ts tests/phase3c-research-transport.test.ts tests/phase3c-research-format.test.ts tests/phase3c-research-ui.test.ts
cmd.exe /c npm.cmd test
```

Planning-time expected counts are **65/65 focused** and **296/296 full**. If the implementation-time repository has legitimately added tests, compare failures rather than blindly requiring those exact counts. Do not begin browser hardening on a pre-existing red baseline.

---

## Task 0B — Align the E2E test-runner dependency before writing tests

### Files

- Modify: `package.json`
- Modify: `package-lock.json`

Planning-time observation: `npm ls playwright @playwright/test --depth=0` returns only direct `playwright@1.62.1`, no checked-in source imports `playwright`, and the lockfile's `@playwright/test` mention is only Next.js's optional peer declaration—not an installed direct runner.

- [x] Reconfirm those observations at implementation time.
- [x] Replace the direct `playwright` devDependency with exact `@playwright/test` **`1.62.1`**. Do not use a caret/range that can silently move the test runner during this phase.
- [x] Let npm update `package-lock.json`; do not hand-edit dependency trees. The runner may still depend transitively on the `playwright` package, but `playwright` should no longer be a redundant top-level direct dependency unless a real independent import is discovered.
- [x] Do not upgrade Playwright beyond 1.62.1 as unrelated modernization.
- [x] Verify the direct dependency graph and version:

```text
cmd.exe /c npm.cmd ls playwright @playwright/test --depth=0
cmd.exe /c npx.cmd playwright --version
cmd.exe /c npm.cmd audit --omit=dev
```

Expected direct graph after alignment: `@playwright/test@1.62.1` is direct; plain `playwright` is not a separate direct entry.

- [x] Confirm `vitest.config.mts` still includes only `tests/**/*.test.ts`; do not broaden it to collect Playwright `*.spec.ts` files.
- [x] Confirm `tsconfig.json` still typechecks the new E2E files.
- [x] Attempt a minimal local Chromium launch through the installed runner. If the browser executable is missing, run the official local tooling command `npx playwright install chromium`. Browser binaries are local machine state and must not be staged or committed.

If implementation-time dependency inspection contradicts this baseline, stop and reconcile the actual manifest/lock before changing packages rather than forcing the planned mutation.

---

## Task 1 — Create strict deterministic browser fixtures

### Files

- Create: `tests/fixtures/research-dossiers.ts`

Every **valid** exported fixture must be parsed through `researchModeResponseSchema` at construction/module load so Playwright cannot accidentally normalize invalid application data into expected UI behavior. Intentionally malformed payloads must live behind clearly named `rawInvalid...` builders/objects typed as `unknown` or raw body text and must never be passed through the valid-fixture helper.

Prefer one small deterministic builder that consumes an actual supported catalog target and explicit category rows, then derive named fixtures from it. Do not duplicate 500-line literal DTOs across tests.

### Required valid fixture family

- [x] `succeededAllReadyResponse`
  - all seven categories processed in canonical order;
  - covers verified/corroborated/university-reported/anecdotal/inferred claims;
  - multiple sources including one claim with multiple source IDs whose representative source is intentionally not first in `sourceIds` so UI ordering is proven;
  - exact supporting text;
  - number, boolean, and numeric-looking string values remain distinguishable.

- [x] `succeededWithUnknownResponse`
  - at least one ready category;
  - at least one zero-claim unknown category with deterministic fallback explanation;
  - no incomplete categories.

- [x] `partialResponse`
  - at least one ready category;
  - one unknown category;
  - at least one incomplete category with a stable operational failure such as `provider-rate-limit`;
  - run status `partial`.

- [x] `failedResponse`
  - all requested categories incomplete;
  - run status `failed`;
  - zero claims and zero sources.

- [x] `conflictResponse`
  - same category contains >=2 final claims marked `conflicting` with distinct values and distinct evidence links;
  - no preferred/winner field or ordering implication.

- [x] `outdatedResponse`
  - explicit outdated claim;
  - claim/source effective or academic period is present;
  - retrieval timestamp is intentionally different so tests can prove retrieval metadata is not freshness validity.

- [x] `longContentResponse`
  - near-contract-max university/program names (<=200 UTF-16 units), source title (<=300), publisher (<=200), property (<=200), claim string value (<=500), explanation (<=600), and supporting text exactly/near 2,000 UTF-16 units;
  - long unbroken but valid `.example` source URL;
  - Unicode/astral/combining text;
  - up to 12 referenced sources to stress evidence-sheet scrolling and dedup/order.

- [x] `maxClaimCountResponse`
  - exactly 500 final claims (the public dossier/summary maximum) in a schema-valid ready category or canonical category distribution;
  - source reuse remains within the 12-source cap;
  - explanation references remain within their 500-ID cap;
  - browser test asserts renderability/no crash/overflow but does **not** introduce a brittle wall-clock performance threshold.

- [x] `xssLookingResponse`
  - property/value/source title/publisher/supporting/explanation strings contain inert payload-shaped text such as `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, quotes, ampersands, and `javascript:` **as text values only**;
  - source URLs themselves remain schema-valid safe HTTP(S) `.example` URLs.

- [x] stable `{ok:false}` transport-error fixture builders for every public error code, using the actual handler status mapping: 415 invalid-content-type; 413 request-too-large; 400 invalid-json/invalid-request/sensitive-input; 404 unsupported-target; 403 forbidden-origin; 500 internal-error. The program/university mismatch variant of unsupported-target may use the handler's observed 400 only in server-route tests, not generic browser copy tests.

### Required explicitly invalid/raw response family

These are negative-test inputs and **must not** pass the valid fixture parser:

- [x] non-JSON text and empty body;
- [x] malformed JSON;
- [x] JSON with unknown top-level/dossier keys;
- [x] broken source reference / unused source / duplicate source or claim ID;
- [x] non-monotonic lifecycle timestamps or contradictory run/category lifecycle;
- [x] schema-valid dossier for wrong university ID;
- [x] schema-valid wrong program ID;
- [x] schema-valid unexpected program on a university-only request;
- [x] schema-valid wrong canonical category set;
- [x] 2xx `{ok:false}` and non-2xx `{ok:true}` HTTP/envelope disagreement;
- [x] wrong/missing JSON content type;
- [x] redirect response for client `redirect:"error"` handling where practical at the transport seam.

### Fixture invariants

- [x] supported university/program IDs come from `researchCatalog`; tests never invent a target ID unless the case intentionally tests response binding failure;
- [x] valid fixture official target links are catalog-owned values when the test is asserting official-link behavior;
- [x] no provider names/attempts/documents/candidates/internal warnings appear in valid public DTOs;
- [x] no real credentials or real applicant data; any profile-like/test strings are invented;
- [x] no fake evidence state outside the public schema;
- [x] non-official evidence source links use reserved `.example` domains and are never actually navigated during automated tests;
- [x] fixture IDs deterministic and unique where required;
- [x] timestamps fixed and monotonic so assertions do not change by wall clock;
- [x] fixture builders recompute total/status counts rather than hard-coding contradictory aggregates;
- [x] category rows, processed/unprocessed partitions, explanations, sources, and source references remain self-consistent by construction.

---

## Task 2 — Configure deterministic Playwright execution

### Files

- Create: `playwright.config.ts`

Use a dedicated loopback port and never reuse an arbitrary pre-existing server. A stale server can make a browser suite falsely pass against the wrong build.

Planning-time baseline (the dev command is superseded by the observed isolated-harness correction below):

```ts
import { defineConfig } from "@playwright/test";

const port = 3102;
const productionServer = process.env.UNIPROOF_E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  outputDir: "test-results/phase3",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: productionServer
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/research`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

Implementation-time evidence showed that a developer `next dev` process can hold the workspace `.next/dev` lock even when Phase 3D selects another port. The checked-in config therefore creates one process-unique ignored source snapshot under `output/playwright/` in the parent Playwright process, propagates its harness ID to worker config imports so they do not create duplicate snapshots, and runs `npx next dev <snapshot>` there. This preserves `reuseExistingServer:false` without attaching to or terminating an unrelated developer server. Built-app mode still runs the actual workspace with `next start`.

`UNIPROOF_E2E_PRODUCTION` is a **Playwright-config-only harness switch** selecting dev versus already-built `next start`; it must never be read by production application code and must never alter evidence/provider behavior. `UNIPROOF_E2E_DEV_HARNESS_ID` is likewise Playwright-config-only and exists solely to keep worker config imports on the same disposable dev snapshot.

Rules:

- [x] Use ignored `test-results/`, `playwright-report/`, and `output/playwright/` only; never write to `ui-flow-screenshots/`.
- [x] One worker prevents route-controller/shared-server races and keeps request ordering deterministic.
- [x] `retries: 0`; do not hide flakiness with retries. Race stability is checked by explicit `--repeat-each` final commands.
- [x] `reuseExistingServer: false` so the suite cannot attach to a stale user's dev server.
- [x] Block service workers for deterministic browser/network behavior; Phase 3 does not rely on background service-worker semantics.
- [x] Chromium is the required automated engine for this MVP. Do not multiply every test across browser projects unless a reproduced engine-specific defect requires it.
- [x] Do not install browsers/dependencies automatically in application runtime scripts.
- [x] Dev-server E2E is used during TDD for fast feedback; after `npm run build`, rerun the full suite once with `UNIPROOF_E2E_PRODUCTION=1` to exercise the built application.

Add one package script:

```json
"test:e2e": "playwright test"
```

Do not change the existing `npm test` meaning. Full verification runs Vitest and Playwright separately.

---

## Task 3 — Add deterministic route/browser guard helpers

### Files

- Create: `tests/e2e/helpers/research-browser.ts`

Use Playwright routing only in test code. Do **not** use arbitrary `waitForTimeout()` delays for race correctness; synchronize on observed requests and explicit deferred barriers.

Recommended primitives:

```ts
export type Deferred<T = void> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export function createDeferred<T = void>(): Deferred<T>;

export type CapturedResearchRequest = {
  sequence: number;
  method: string;
  url: string;
  body: unknown;
};

export type QueuedResearchReply =
  | { kind: "json"; status: number; body: unknown; contentType?: string }
  | { kind: "text"; status: number; body: string; contentType?: string }
  | { kind: "abort"; errorCode?: string }
  | { kind: "barrier"; entered: Deferred<void>; release: Deferred<void>; then: QueuedResearchReply };

export function installResearchRouteController(page: Page): {
  enqueue: (...replies: QueuedResearchReply[]) => void;
  requests: readonly CapturedResearchRequest[];
  waitForRequestCount: (count: number) => Promise<void>;
  dispose: () => Promise<void>;
};
```

The helper may use a simpler equivalent API, but it must provide deterministic request capture/queueing and explicit barriers.

### Global browser guards

Install before navigation in every test (directly or through one shared helper):

- [x] **External-network fail closed:** allow same-origin `http://127.0.0.1:3102` requests plus browser-internal `data:`/`blob:` URLs only. Record and abort any other HTTP(S) request. At test end, `externalRequests` must be empty. Register the `/api/research` page route so it still fulfills before/above the broad context network guard.
- [x] **Page error guard:** any `pageerror` fails the scenario.
- [x] **Dialog guard:** any unexpected JS `alert`/`confirm`/`prompt` fails immediately; this is required for XSS-looking fixtures.
- [x] **Popup guard:** no popup/new window may appear unless the test explicitly exercises a safe external-link control; normal automated evidence tests assert link attributes without navigating external destinations.
- [x] **Console guard:** fail all application console errors. For intentionally non-2xx `/api/research` scenarios, allow only the exact browser-generated failed-resource console entry whose `ConsoleMessage.location().url` is the same-origin `/api/research`; consume/count it per scenario. Do not blanket-ignore all `Failed to load resource` messages because that would hide broken JS/CSS/assets.

### Route-controller behaviors

Support:

- [x] valid schema-parsed responses;
- [x] raw malformed/non-JSON/empty bodies without passing them through the valid fixture parser;
- [x] wrong/missing content type;
- [x] schema-valid wrong target/program/category responses;
- [x] HTTP/envelope disagreement;
- [x] `route.abort()` for browser network-error handling;
- [x] deterministic pending request barrier for first-run cancel/refresh cancel/unmount;
- [x] ordered response queue for error -> exact retry -> new-form submission;
- [x] request count + parsed body capture for single-flight, blank omission, canonical categories, immutable retry, and current-form new request assertions;
- [x] exact disposal/unroute so one test's handler cannot leak into the next.

### Important seam boundary

Do **not** attempt to emulate "headers arrived but body bytes are still streaming" with `route.fulfill()` plus sleeps. Playwright fulfillment does not give reliable chunk-level control for this acceptance requirement. The abort-during-body-read and actual streamed byte-bound cases belong in the injectable `client-transport` Vitest seam (Task 3A below). Browser tests cover cancellation while the HTTP request is still pending and stale/later request ownership.

Never add a production code path to inject these fixtures.

---

## Task 3A — Close the remaining client-response byte/UTF-8 hardening gap with TDD

### Files

- Modify: `tests/phase3c-research-transport.test.ts`
- Modify: `lib/research/mode/client-transport.ts` only after the new regressions fail for the expected reason

The current client rejects a response that **declares** `Content-Length > 4 MiB`, but if the header is absent or dishonest it still calls `response.text()` without bounding the actual decoded body. Phase 3B's server is already bounded, but Phase 3D should make the browser trust boundary independently fail closed against a malformed proxy/server response and compressed/chunked expansion.

### Red tests first

- [x] A real/synthetic `Response` with no `Content-Length` and actual body bytes > `RESEARCH_CLIENT_MAX_RESPONSE_BYTES` becomes sanitized `invalid-response`.
- [x] A response whose declared length is within the limit but actual streamed bytes exceed it also becomes `invalid-response`.
- [x] A body exactly at the 4 MiB byte limit is not rejected **for size alone**. Use trailing JSON whitespace or a dedicated bounded-reader test so the assertion does not require a 4 MiB semantic dossier.
- [x] Invalid UTF-8 byte sequences in an `application/json` response become `invalid-response`; do not allow replacement-character decoding to turn malformed transport bytes into trusted public text.
- [x] Abort while the response stream is awaiting its next chunk returns `cancelled`, not `invalid-response` or `network-error`.
- [x] Oversize rejection performs reader cancellation/cleanup best-effort and never awaits untrusted cancellation indefinitely.
- [x] Existing declared-oversize, network sanitization, target/category binding, HTTP/envelope agreement, and no-auto-retry tests remain green.

Observe each new regression fail before editing production transport code.

### Expected implementation shape

Prefer one small internal bounded reader rather than spreading byte logic through `executeResearchRequest`:

```ts
async function readBoundedResearchResponseText(
  response: Response,
  signal: AbortSignal,
): Promise<
  | { ok: true; text: string }
  | { ok: false; kind: "cancelled" | "invalid-response" | "network-error" }
>;
```

Implementation requirements:

- consume `response.body` with a reader when available;
- count actual post-fetch stream bytes and stop at `RESEARCH_CLIENT_MAX_RESPONSE_BYTES`;
- decode UTF-8 with `TextDecoder("utf-8", { fatal: true })` so invalid bytes fail closed;
- re-check the exact signal before/after every awaited `reader.read()` and immediately before returning trusted text;
- on oversize/invalid/cancel failure, call reader cancellation best-effort/non-blocking; do not await an untrusted cleanup promise;
- do not log raw response bytes/text;
- keep the existing declared `Content-Length` precheck as an early rejection optimization, but never rely on it as the only bound;
- if a synthetic test double has no readable body, either make the tests use real `Response` objects or keep a bounded fallback that still checks actual UTF-8 byte length after `text()`; production fetch responses must take the streamed path.

Run the focused transport suite until green before proceeding to browser E2E.

---

## Task 4 — Test target search/filter/select behavior

### Browser flows

- [x] `/research` starts with real catalog controls and no illustrative factual dossier.
- [x] Catalog text search filters by university name.
- [x] Search matches program name/subject.
- [x] Case/punctuation-insensitive search works as planned.
- [x] Country filter works.
- [x] Degree filter works.
- [x] Subject filter works.
- [x] Combined filters use AND semantics.
- [x] Empty result displays "No supported matches".
- [x] Empty result does not expose arbitrary URL/name submit.
- [x] Selecting university displays selected-target panel and explicitly clears any prior program scope, including a program owned by that same university.
- [x] Selecting program sets the correct owning university.
- [x] Explicit university-only/remove-program and clear-target actions are distinct and accessible.
- [x] Filters changed after selection do not silently retarget or hide the selected-target panel.
- [x] Enter in catalog search does not submit research; Enter in focused-question textarea inserts a newline.
- [x] Reset restores all seven categories and clears target/options/form errors without API call or relabeling an existing dossier.

### Request body assertion

Intercept submit and inspect POST JSON:

- [x] contains IDs/categories/question/intake/year only;
- [x] no university/program names required from client;
- [x] no URL/provider/model/key/budget fields;
- [x] categories canonical even if UI interaction changed them in another order.

---

## Task 5 — Test client validation and single-flight behavior

- [x] Submit with no target -> visible field error, zero API calls.
- [x] Submit with zero categories -> visible category error, zero API calls.
- [x] Blank/whitespace question/intake/academicYear controls are omitted from POST JSON rather than sent as empty strings.
- [x] Exact max-length optional values submit; over-limit values fail with zero calls; include at least one astral-character UTF-16 boundary case in the Phase 3C unit suite and one representative browser boundary here if practical.
- [x] Valid submit -> exactly one call.
- [x] Double-click Research -> exactly one call.
- [x] Enter-key form submit from an ordinary research control/button -> exactly one call; search/textarea Enter behavior follows Task 4 and produces zero accidental calls.
- [x] While loading, Research/Reset/form fields are disabled and Cancel is enabled.
- [x] Clicking/typing into disabled controls cannot mutate submitted request.
- [x] Page indicates indeterminate loading without percentage/stage fiction.

Capture `request.postDataJSON()` and assert it contains only the public request fields, remains byte/semantic-equivalent to the immutable submission after loading starts, and excludes search/filter UI state.

---

## Task 6 — Test cancellation and stale-response races

### First-run cancellation

- [x] Enqueue a barrier/pending route and wait until the first POST is captured before clicking anything else.
- [x] Submit.
- [x] Click the exact role/name `Cancel` button; do not use a loose text locator that can match status copy.
- [x] Immediately attempt a second Cancel activation (mouse/programmatic click) and prove cancellation is idempotent: one request total, no retry/replacement request.
- [x] UI returns to idle with a concise cancellation notice after the aborted fetch settles.
- [x] Target/categories/question/intake/year are re-enabled and preserved.
- [x] No percentage/stage fiction or background-continuation claim appears.

### Refresh cancellation with prior dossier

- [x] First request returns a succeeded or partial dossier.
- [x] Edit the form to create a distinct second submission and start a second barrier-held request.
- [x] Previous dossier remains visible with the **server-returned canonical target label** and updating treatment.
- [x] `View evidence` for the previous dossier remains enabled during refresh; open and close it while the request is pending.
- [x] Run-level Retry/Clear controls that could create conflicting run ownership remain unavailable while busy.
- [x] Cancel second request.
- [x] Previous dossier remains byte/semantically unchanged and its evidence remains usable.
- [x] No new dossier/failed state replaces it and no automatic request is sent.

### Browser stale-request ownership

The stream-body cancellation race is covered in Task 3A. In the browser, cover ownership around a genuinely pending HTTP route:

1. hold first request at a barrier;
2. cancel it and wait until the UI has completed its cancellation transition / active request is released;
3. start a second request and fulfill it successfully;
4. then release/attempt to fulfill the old first test route if Playwright still allows it.

- [x] Second dossier remains final state.
- [x] Any late first-route completion/error cannot overwrite the second result.
- [x] No React state-update warning/page error appears.
- [x] Race spec uses explicit barriers/request-count waits rather than sleep-based timing.

### Replacement while previous evidence is open

This locks the Phase 3C independent-review fix:

- [x] Establish a prior valid dossier.
- [x] Start a refresh and open evidence from the preserved dossier while the refresh is pending.
- [x] Fulfill the refresh with a new validated dossier.
- [x] New dossier replaces the previous one and the old evidence sheet closes automatically.
- [x] No stale supporting text/source from the old dossier remains in the DOM as an open modal.
- [x] If the old trigger disappears before close autofocus, no focus exception/page error occurs; focus lands on a sensible connected element or document flow rather than a detached node.

### Navigation/unmount

- [x] Start barrier-held research, navigate to `/compare` or `/guide` locally.
- [x] No console/page error from late state update.
- [x] Releasing the stale route after navigation cannot mutate the unmounted Research workspace.
- [x] Returning to Research starts fresh; no claim that prior run continued in background and no old result/form run-state is resurrected.

---

## Task 7 — Test succeeded, unknown, partial, and failed lifecycle semantics

### Succeeded all-ready

- [x] run-level success/result summary visible;
- [x] heading uses the validated **server-returned canonical university/program names**, even if the stored client snapshot label in the test fixture differs;
- [x] seven category headings in canonical order;
- [x] total claims and each visible evidence-status count match the fixture;
- [x] no incomplete banner;
- [x] Reset changes the editable form only and does not relabel/erase the already returned dossier;
- [x] Clear target changes the form target only and does not relabel the returned dossier;
- [x] `Clear result` removes the dossier/result state while preserving current editable form values.

### Succeeded with unknown

- [x] run remains succeeded;
- [x] unknown category displays category-level `Unknown` badge;
- [x] zero claims/source action in unknown row;
- [x] fallback explanation visible;
- [x] unknown count comes from category state, not claim status count.

### Partial

- [x] "Some research is incomplete" run banner visible;
- [x] ready claims remain visible;
- [x] unknown remains unknown;
- [x] incomplete row uses "Research incomplete"/operational presentation, not `Unknown` evidence badge;
- [x] stable reason visible;
- [x] explicit Retry visible;
- [x] no automatic request is made without click.

### Failed

- [x] failed run renders a result-state failure banner, not a transport-error panel;
- [x] incomplete category rows visible;
- [x] no fabricated unknown/claims;
- [x] Retry explicit.

---

## Task 8 — Test evidence statuses, conflict, and outdated behavior

### Evidence badges

Verify UI can render:

- [x] Verified;
- [x] Corroborated;
- [x] University-reported;
- [x] Conflicting;
- [x] Anecdotal;
- [x] Inferred;
- [x] Outdated;
- [x] Unknown only at category-level unknown state.

### Conflict fixture

- [x] both/all competing final values are visible;
- [x] no value is decorated as preferred/recommended/winner;
- [x] each conflicting claim has its own evidence action;
- [x] conflict alert visible at category level;
- [x] opening each claim shows its corresponding source evidence.

### Outdated fixture

- [x] Outdated badge visible;
- [x] effective/academic period shown only when fixture explicitly contains it;
- [x] "Retrieved" metadata separately labeled;
- [x] UI never says retrieved date is effective date/freshness validity;
- [x] canonical official target link remains available for manual confirmation.

### Anecdotal/inferred/university-reported copy

- [x] no surrounding copy calls these "verified" or "confirmed" unless another explicit claim actually has that status;
- [x] badge text is visible, not color-only.

---

## Task 9 — Test claim evidence Sheet/Dialog thoroughly

### Mouse flow

- [x] Click View evidence.
- [x] Sheet/dialog opens.
- [x] claim property/value/status visible.
- [x] exact supporting passage visible.
- [x] representative source appears first.
- [x] additional sources listed once each.
- [x] source title/publisher/type/retrieved metadata visible.
- [x] external link has expected complete href, `_blank`, `noopener noreferrer`, and `referrerPolicy="no-referrer"` while long visible URL/title text wraps safely.
- [x] canonical official target link is separate and evidence-source UI never infers "Official" from source type alone.

### Keyboard flow

Using only Tab/Shift+Tab/Enter/Space/Escape:

- [x] reach claim trigger;
- [x] open evidence;
- [x] focus moves inside modal;
- [x] focus remains trapped;
- [x] close via Escape;
- [x] focus returns to exact trigger;
- [x] close button reachable and named.

### XSS-looking fixture

- [x] literal `<script>`/`<img onerror>`/`javascript:` payload-shaped strings are visible as ordinary text where expected;
- [x] no script/img/event-bearing DOM element corresponding to payload exists;
- [x] the global unexpected-JS-dialog guard records zero alerts/confirms/prompts;
- [x] no popup is created by payload text;
- [x] no external request is made because of payload content;
- [x] no page/application console error is triggered by payload;
- [x] evidence/source/official links still come only from schema-valid URL fields, never from text parsing.

### Broken-reference defense

Public schema should reject broken source references before browser render. Add a malformed intercepted 200 response with missing source:

- [x] workspace shows invalid-response/generic error state;
- [x] no partial evidence sheet opens;
- [x] prior valid dossier remains if this was a refresh.

---

## Task 10 — Test transport errors and explicit retry

For each public error envelope (`invalid-content-type`, `request-too-large`, `invalid-json`, `invalid-request`, `unsupported-target`, `sensitive-input`, `forbidden-origin`, `internal-error`):

- [x] use the handler's real HTTP status mapping unless the case intentionally tests HTTP/envelope disagreement;
- [x] correct stable safe message appears;
- [x] form values remain unless the error contract explicitly invalidates target IDs (`unsupported-target`);
- [x] previous dossier remains if present and keeps its server-returned target identity;
- [x] raw response body, parser/schema detail, URL, stack, provider state, and exception text do not appear;
- [x] correction-required errors do not expose blind Retry when the same payload is expected to fail again;
- [x] `forbidden-origin` copy does not instruct the user to disable browser/origin protections;
- [x] `request-too-large` asks to shorten public research context without falsely blaming only the question field.

Also test client-only errors:

- [x] `route.abort()` -> sanitized `network-error`, current form preserved, previous dossier preserved, explicit exact-submission retry available;
- [x] malformed/mismatched response -> sanitized `invalid-response` with no partial dossier render;
- [x] redirect response is rejected by the transport `redirect:"error"` behavior at the deterministic transport/browser seam where supported; no redirect target is followed.

Specific flows:

### 500 non-JSON

- [x] generic service error;
- [x] no JSON parser stack;
- [x] Retry explicit.

### malformed 200 JSON shape

- [x] client schema rejects;
- [x] no dossier fields rendered from malformed body;
- [x] generic invalid-response error.

### retry sequence and immutable historical request

- [x] first route responds 500;
- [x] no automatic second call;
- [x] if the failed refresh is displayed over a prior partial/failed dossier, exactly one `Retry this research` control is visible and it belongs to the newer failed submission; the preserved dossier's older retry is suppressed while that error is active;
- [x] error-area copy explicitly states that Retry repeats the exact failed request while Research starts a new request from the current form;
- [x] edit one or more form controls after the failure without submitting and confirm the explanatory copy remains truthful;
- [x] click `Retry this research`;
- [x] second call occurs once and its POST body exactly matches the failed submission snapshot, not the edited current form;
- [x] separately click normal `Research` after editing and prove that request uses the new current validated form;
- [x] success dossier replaces error/previous only after full schema + submitted target/program/category binding;
- [x] `Clear result` over a preserved dossier plus refresh error clears the displayed result/error rather than merely restoring the same previous dossier.

### request/response binding failures

- [x] schema-valid wrong-university dossier -> `invalid-response`, no dossier relabeling/partial render;
- [x] schema-valid wrong-program or unexpected program on university-only request -> `invalid-response`;
- [x] schema-valid wrong category partition -> `invalid-response`;
- [x] 200 + `{ok:false}`, non-2xx + `{ok:true}`, and wrong/missing JSON content type -> `invalid-response`;
- [x] if a prior dossier exists, all of these preserve that prior dossier with its original target label.

### unsupported target

Mock server `unsupported-target` response:

- [x] search/filters/question/categories/intake/year preserved;
- [x] selected university and program IDs are both clearly invalidated because the public error does not identify which ID is stale;
- [x] explicit reselection is required;
- [x] no invisible retarget to first catalog entry and no mutation of bundled catalog data;
- [x] prior dossier, if present, remains labeled with its own returned target.

### sensitive input

Exercise `sensitive-input` with the sensitive-looking value separately in `question`, `intake`, and `academicYear`:

- [x] same safe free-text-group instruction appears in all three cases;
- [x] populated free-text controls reference the form/group guidance accessibly and are marked invalid, while blank optional free-text controls are not falsely marked invalid;
- [x] UI does not claim which field triggered detection and does not duplicate the sensitive detector client-side;
- [x] raw submitted text is not echoed into generated error detail beyond the editable input value the user already controls;
- [x] correction-required presentation does not blindly auto-retry the same rejected payload.

---

## Task 11 — Responsive and overflow stress matrix

Run the core success/partial/evidence flows at:

```text
320 x 740
375 x 812
390 x 844
768 x 1024
1024 x 768
1440 x 900
```

At each relevant viewport assert:

```ts
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth
);
expect(overflow).toBeLessThanOrEqual(1);
```

### Long-content fixture checks

- [x] near-max university/program names wrap without pushing controls off-screen;
- [x] 2,000-character supporting text wraps/scrolls inside evidence surface without page horizontal overflow;
- [x] long `.example` URL visually wraps or truncates accessibly while the anchor `href` remains complete;
- [x] long property/value/explanation/source title/publisher does not overlap badges/buttons or escape its container;
- [x] 12-source evidence list remains vertically scrollable and Close remains reachable;
- [x] filters stack logically on mobile;
- [x] category controls and major action buttons remain practically tap-sized/readable;
- [x] evidence sheet fits narrow height/width and content remains scrollable;
- [x] desktop layout does not create min-width overflow.

### Maximum-claim stress

Using `maxClaimCountResponse`:

- [x] 500 schema-valid claims render without page crash, React error, duplicate-key warning, or horizontal overflow;
- [x] first and last claim rows are reachable;
- [x] opening evidence for a claim near the end resolves the correct supporting text/source rather than another row's data;
- [x] no brittle elapsed-time threshold is asserted; record pathological hangs/crashes as defects instead of inventing a performance SLA.

### Sticky-header/full-page nuance

For automated screenshots or manual visual evidence, prefer viewport screenshots for sticky-header checks. If a full-page screenshot is used, explicitly scroll to top before capture so Playwright's full-page stitching does not create a false mid-page sticky-header artifact. This is a QA-tooling concern, not a product workaround.

Do not solve overflow by globally hiding horizontal overflow; fix the offending component.

---

## Task 12 — Accessibility semantics, focus geometry, and announcements

Without adding axe dependency, assert high-value semantics through Playwright roles/attributes/DOM geometry and perform a final visual keyboard pass. Treat this as a WCAG-2.2-AA-oriented practical audit, not a claim of formal certification.

### Structure and naming

- [x] exactly one page `main` for `/research`.
- [x] logical h1/h2/h3 progression; no heading-level jumps introduced by dynamic lifecycle content.
- [x] form controls have visible labels and stable accessible names.
- [x] native checkboxes/buttons/links/selects/textarea remain native controls; no unnecessary custom role/key handling.
- [x] active Research navigation exposes `aria-current="page"` on desktop and mobile nav.
- [x] evidence state always has visible text, not color-only meaning.

### Validation semantics

- [x] missing target: search control has `aria-invalid="true"` and `aria-describedby` references the exact rendered target error ID.
- [x] zero categories: relevant category control(s) expose invalid state and reference the category error.
- [x] question/intake/year field errors each reference their exact field-error ID plus the shared privacy guidance.
- [x] `sensitive-input` with only one populated free-text field marks that populated field invalid while blank optional fields stay `aria-invalid="false"`/neutral.
- [x] choosing a new supported target clears stale target validation semantics rather than leaving hidden/obsolete errors attached.

### Keyboard/focus

Using only Tab/Shift+Tab/Enter/Space/Escape for the primary flow:

- [x] reach global Research navigation, target search, supported-match buttons, filters, selected-target actions, all category checkboxes, free-text inputs, Research/Reset, Cancel, retry/clear controls, claim evidence triggers, evidence links, and Close.
- [x] no positive `tabindex` ordering hacks.
- [x] focus indicator is visibly present on every interactive control inspected.
- [x] on 320/375/390 mobile widths, keyboard focus is not fully obscured by the sticky header when browser scrolling brings a control into view; compare the focused element bounding box with the sticky header bottom edge.
- [x] modal focus remains trapped while open; Escape closes; focus returns to the exact still-connected claim trigger.
- [x] if dossier replacement removes the trigger before modal closure, no focus error occurs and focus is not restored to a detached element.
- [x] interactive controls used by the Research flow have practical target geometry; fail obvious sub-24x24 CSS-pixel targets unless a browser/native inline-link exception clearly applies.

### Announcements

- [x] loading uses one controlled polite status/live region and does not announce every skeleton row.
- [x] cancellation, transport error, result completion, and retry transition each produce one understandable state message without duplicate competing live announcements.
- [x] transport/run error presentation is programmatically discoverable without turning every repeated error copy into a second alert.
- [x] changing search filters/empty result status does not spam announcements while typing.

### Reduced motion

- [x] run at least one loading -> cancel/result flow with `reducedMotion: "reduce"`.
- [x] state meaning remains available in text even if pulse/transition animation is suppressed or altered.

Manual main-agent keyboard/visual pass is still required after automation because focus-ring visibility/obscuration is partly visual. Capture temporary viewport screenshots under `output/playwright/` only when useful; inspect them and delete disposable review captures afterward.

---

## Task 13 — Console/page-error/dialog/popup and fail-closed network discipline

Use the shared guards from Task 3 for every browser spec rather than re-implementing ad hoc listeners.

At scenario end require:

- [x] zero page errors;
- [x] zero unexpected application console errors;
- [x] any allowed browser-generated non-2xx resource console message is tied specifically to the intentional same-origin `/api/research` failure in that test; no blanket string filtering;
- [x] zero unexpected JavaScript dialogs;
- [x] zero unexpected popups/windows;
- [x] only the expected count/order of `/api/research` requests occurred;
- [x] zero external HTTP(S) browser requests of **any kind**. This is stronger than checking only known provider domains and catches accidental source/university/font/analytics/navigation traffic too;
- [x] no service-worker registration/network behavior participates in the flow.

For diagnostics, record attempted external URLs only in test output and never include credential-bearing headers/bodies. The browser allowlist is loopback origin plus `data:`/`blob:` internals only.

Provider-domain names (Gemini/Groq/OpenRouter/Tavily/Brave/ROR) should still appear in static negative scans, but the runtime network guard must not depend on maintaining a provider-domain blacklist.

---

## Task 14 — Security/client-boundary static review

Search changed client/browser files.

Expect zero occurrences of:

```text
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
TAVILY_API_KEY
BRAVE_SEARCH_API_KEY
process.env.<provider key>
providerAttempts
documents
candidateSources
candidates
```

Context-sensitive exception: fixture/test files may mention forbidden-key names in **negative assertions only**. Production client files must contain none.

Also verify:

- [x] no `dangerouslySetInnerHTML` or dynamic HTML parser in Research components;
- [x] no source/provider text inserted into className/style/event-handler code;
- [x] no dynamic external script/image/embed execution from evidence content;
- [x] no `window.open` when a normal safe anchor suffices;
- [x] evidence/source/catalog external anchors retain `_blank`, `noopener noreferrer`, and `referrerPolicy="no-referrer"` where they open a new context;
- [x] no localStorage/sessionStorage/IndexedDB persistence of research result or caller free text unless separately approved (not part of Phase 3);
- [x] no query-string/hash serialization of focused question/intake/academic year that could leak via URL/history;
- [x] no service worker/background retry/keepalive research behavior;
- [x] no `NEXT_PUBLIC_*` provider/API credential declaration or client bundle reference;
- [x] the test-only `UNIPROOF_E2E_PRODUCTION` harness variable appears only in Playwright/test configuration and is never imported/read by production app/server modules;
- [x] fixture/test code contains no real secret values and no real applicant data;
- [x] `.env.local` remains ignored/untracked and its real credential **values** are scanned against changed tracked files plus `.next/server`/`.next/static` after the final build without printing the values themselves;
- [x] production browser code still imports no Phase 2 provider adapters, raw documents, candidates, candidateSources, providerAttempts, or environment/provider configuration.

Do not weaken the public schema or sanitize away a test failure merely to make malformed fixtures easier to render.

---

## Task 15 — Requirements traceability review

Create a final review table in the implementation PR/notes or Phase 3 completion memory, not a new product feature.

Verify every requirement against evidence:

| Requirement | Required evidence |
| --- | --- |
| search/select supported university/program | browser search/filter/select tests |
| admissions/tuition/scholarship/program/research/outcomes/support | canonical seven-section fixture/render tests |
| source links/metadata | evidence sheet tests |
| missing/unknown | unknown fixture |
| conflicting | conflict fixture |
| outdated | outdated fixture |
| anecdotal/inferred | badge fixture |
| official links | catalog target links |
| loading/partial/failure/retry | lifecycle + exact immutable retry ownership tests |
| clear result / preserved refresh result | independent-review regression + browser error-over-prior-dossier flow |
| server canonical result identity | browser result heading test against intentionally stale client snapshot label |
| evidence usable during refresh / stale sheet closes on replacement | race/evidence browser flow |
| keyboard | keyboard-only form/evidence E2E + modal focus return |
| validation accessibility | exact `aria-describedby`/`aria-invalid` browser assertions, including populated-only sensitive fields |
| responsive | viewport/overflow/long-content/max-claim matrix |
| preserve input | client validation + transport/cancel/retry/unsupported/sensitive tests |
| bounded client response | Phase 3C transport streamed byte-limit + fatal UTF-8 + cancellation regressions |
| zero external browser network | context fail-closed network guard across every E2E scenario |
| no invented values | public schema + composer tests + UI no inference/conversion/winner logic |
| protected current-state screenshots | before/after filename+size+SHA-256 manifest equality |

Do not mark a requirement complete from code inspection alone when the acceptance criterion is rendered/browser behavior.

---

## Task 16 — Full Phase 3 verification matrix

All commands must be freshly run on the final implementation; do not cite the Phase 3C baseline as proof that Phase 3D still passes.

### Focused Vitest gates

```text
cmd.exe /c npx.cmd vitest run tests/phase3a-research-catalog.test.ts
cmd.exe /c npx.cmd vitest run tests/phase3b-dossier-composer.test.ts tests/phase3b-research-api.test.ts
cmd.exe /c npx.cmd vitest run tests/phase3c-research-state.test.ts tests/phase3c-research-form.test.ts tests/phase3c-research-transport.test.ts tests/phase3c-research-format.test.ts tests/phase3c-research-ui.test.ts
```

The focused Phase 3C command must include the new streamed byte/UTF-8/cancellation regressions from Task 3A.

### Playwright development-server acceptance

```text
cmd.exe /c npx.cmd playwright test
cmd.exe /c npx.cmd playwright test tests/e2e/research-races.spec.ts --repeat-each=5
```

- [x] Full suite passes with retries still configured to zero.
- [x] Race suite passes five explicit repetitions without retry masking.
- [x] No external request guard, console/page/dialog/popup guard, or request-count assertion is disabled to get green.

### Full repository/static gates

```text
cmd.exe /c npm.cmd test
cmd.exe /c npx.cmd tsc --noEmit
cmd.exe /c npm.cmd run lint
cmd.exe /c npm.cmd run build
cmd.exe /c npm.cmd audit --omit=dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:/Side Projects/UniProof/scripts/verify-workspace.ps1"
cmd.exe /c git diff --check
```

### Built-application Playwright acceptance

After the successful production build, run the same browser suite against `next start` through the Playwright-config-only harness switch:

```text
cmd.exe /d /s /c "set UNIPROOF_E2E_PRODUCTION=1&& npx.cmd playwright test"
```

This must start its own dedicated loopback server through `webServer`; do not manually point the suite at a long-running/stale process. The production-mode E2E run makes zero live provider/external calls just like the dev-mode suite.

### Manual rendered/keyboard inspection by the main agent

After automated E2E is green:

- [x] inspect at least desktop 1440x900, mobile 390x844, narrow 320x740, partial/error state, and evidence-sheet viewport captures or a headed browser session;
- [x] use keyboard-only interaction for one full target -> submit -> evidence -> close flow and one validation/error recovery flow;
- [x] visually verify focus rings, sticky-header non-obscuration, no clipped controls, no accidental capture artifact, and truthful unknown/incomplete/conflict/outdated copy;
- [x] write any disposable screenshots/traces to ignored Playwright output only, inspect them, then remove task-local review residue once no longer needed.

### Additional static/security/integrity scans

- [x] strict UTF-8 + unexpected control-character scan over every changed text file;
- [x] real provider credential **value** scan over changed tracked files and final `.next/server`/`.next/static` without printing credential values;
- [x] provider `NEXT_PUBLIC_*` declaration/reference scan;
- [x] production browser-client provider/internal-Phase-2 import/reference scan;
- [x] production `dangerouslySetInnerHTML` / dynamic executable evidence / persistence / query-string / background retry scan;
- [x] test-only `UNIPROOF_E2E_PRODUCTION` appears nowhere in production modules;
- [x] `.env.local` remains ignored/untracked (`git check-ignore`) and unchanged;
- [x] package/lock diff contains only the intended runner substitution and any exact transitive lock consequence; no unrelated package upgrades;
- [x] `npm ls playwright @playwright/test --depth=0` shows exact direct `@playwright/test@1.62.1` and no redundant direct plain `playwright`;
- [x] no `test-results/`, `playwright-report/`, `output/playwright/`, browser binaries, traces, screenshots, or videos are staged;
- [x] recompute the 10 protected `ui-flow-screenshots/` filename+size+SHA-256 manifest and compare it byte-for-byte with Task 0A's baseline; no addition/deletion/overwrite is allowed in Phase 3D;
- [x] after successful screenshot comparison, remove only the ignored temporary hash-manifest file, leaving all protected PNGs untouched;
- [x] placeholder/residue scan (`TODO`, `TBD`, `FIXME`, `HACK`, debug logs, production fixture switches, illustrative Research claims, `Example University`) over Phase 3 production files;
- [x] inspect final Git diff/status and prove every changed file belongs to Phase 3D; preserve unrelated/untracked user work;
- [x] final `git diff --check` after documentation/memory updates.

### Live calls

No live provider call is part of automated Phase 3 acceptance.

A live end-to-end research smoke may be performed only after all deterministic gates pass and only with explicit user authorization. If authorized, use one bounded supported target/request, do not expose keys/raw responses, and record exact date/result in project memory.

---

## Task 17 — Final defect-first review before Phase 3 completion

Review the actual diff, not only tests.

Prioritize:

1. evidence semantics accidentally reimplemented in UI/composer;
2. unknown vs incomplete confusion;
3. stale/conflict mislabeling;
4. source/supporting-text misassociation;
5. client/server schema drift;
6. duplicate request/race/cancel bugs;
7. response/error leakage;
8. browser provider-key/provider-call leakage;
9. accessibility/focus traps;
10. mobile overflow/long content;
11. unsupported-target silent retargeting;
12. production test-mode residue;
13. hidden persistence/background-job behavior;
14. deployment assumptions represented as guaranteed behavior.

For this batch, **do not invoke any subagent, review agent, code-reviewer, specialist agent, or delegated child**, even if the active model normally permits it. The user's task-specific instruction is zero subagents. The main ChatGPT agent performs a separate final inline review pass after all automated/manual gates and records its findings/fixes directly.

The final inline review must explicitly falsify the reviewed Phase 3C defects as well as generic risks:

1. evidence semantics accidentally reimplemented in UI/composer;
2. unknown vs incomplete confusion;
3. stale/conflict/outdated mislabeling or winner selection;
4. source/supporting-text/representative-source misassociation;
5. client/server schema drift or malformed response partial render;
6. actual response-byte/UTF-8 bound bypass;
7. duplicate request, same-tick submit, retry-owner, cancel, stale-sequence, or unmount races;
8. preserved dossier relabeling, duplicate Retry controls, or false `Clear result` semantics;
9. evidence disabled during refresh or stale sheet/source state surviving replacement;
10. response/error/credential/internal-result leakage;
11. unexpected external browser network, popup, dialog, service-worker, or test-backdoor behavior;
12. validation `aria-describedby`/`aria-invalid` regressions, focus trap/return, sticky-header focus obscuration, or inaccessible target sizes;
13. mobile/tablet/desktop overflow and near-contract-max content;
14. unsupported-target silent retargeting or sensitive-input misattribution;
15. persistence/query/hash/background retry behavior introduced accidentally;
16. production/dev Playwright divergence or stale-server false positives;
17. test flakiness hidden by sleeps/retries instead of deterministic synchronization;
18. protected `ui-flow-screenshots/` mutation;
19. unrelated dependency/lockfile changes;
20. deployment assumptions represented as guarantees.

After any finding:

- [x] prove the root cause;
- [x] write/add the nearest failing regression first where practical and observe the expected failure;
- [x] fix the smallest coherent scope;
- [x] rerun the affected focused tests/specs;
- [x] rerun the full required gates before declaring completion.

If the inline review finds no substantive defect, state that explicitly; do not fabricate an independent reviewer result.

## Observed Phase 3D completion — 2026-08-18

- Baseline was frozen at reviewed Phase 3C commit `d71c1628500c5ae71e14113ae8144cf4c1f14e99`: focused Phase 3C 65/65 and full Vitest 296/296 were green before implementation, and the ten protected PNGs were hashed by filename/size/SHA-256.
- The direct E2E dependency is exact `@playwright/test@1.62.1`; `playwright` remains transitive only. The package lock contains no unrelated version upgrade.
- Stream hardening was regression-first. The new tests failed against the previous unbounded `response.text()` path, then passed after actual-byte counting, fatal UTF-8 decoding, signal-aware stream reads, and best-effort/non-blocking cancellation were implemented.
- One substantive product defect was found by browser acceptance: a program-scoped `unsupported-target` response cleared both target IDs but exposed only the university error association. A failing rendered regression was added first; the workspace now records and renders both stable target errors after the IDs are cleared.
- The separate final main-agent defect-first review found two additional acceptance-harness defects and no further product-semantics defect. The console guard had been suppressing any same-origin `/api/research` non-2xx resource error instead of consuming only intentionally queued failures; it now budgets actual fulfilled non-2xx/network/redirect events and requires exact consumption at teardown. Playwright config imports also used each process PID independently, multiplying disposable dev snapshots; a parent-set Playwright-only harness ID now keeps worker imports on one snapshot per invocation.
- A separate infrastructure issue was also proved: another developer `next dev` process can hold the workspace `.next/dev` lock even on a different port. Dev E2E therefore uses a process-unique ignored source snapshot and `reuseExistingServer:false`; built-app E2E uses the actual workspace `next start`. Generated output paths are explicitly ignored by ESLint so disposable harness copies do not make root lint traversal pathological.
- Fresh automated evidence after the final review fixes: Phase 3A 16/16, Phase 3B 32/32, Phase 3C 72/72, full Vitest 303/303, dev Playwright 65/65, repeated races 35/35, TypeScript pass, ESLint pass, Next.js production build pass, production dependency audit 0 vulnerabilities, workspace verifier pass, Windows `git diff --check` pass, and built-application Playwright 65/65.
- Manual main-agent production QA additionally covered a 1440x900 keyboard target -> submit -> evidence -> Escape/focus-return flow, a 390x844 partial dossier, and 320x740 unsupported-target validation/recovery; disposable captures and dev snapshots were removed afterward from ignored `output/playwright/`.
- Browser acceptance recorded zero unexpected external HTTP(S) requests, page errors, application console errors, dialogs, or popups. The final security scan found zero real provider credential-value hits across 27 intended changed/new text files and 218 final build files; Research client modules had zero provider-secret/internal-Phase-2/executable-HTML/persistence/URL-leak/background-retry/test-switch hits.
- The final protected screenshot comparison was exact 10/10 before the temporary manifest was deleted. No protected PNG was modified, staged, renamed, or used as Playwright output.
- No live Tavily, Brave, ROR, Gemini, Groq, OpenRouter, or university request was made. No persistence/auth/Comparison/Guide/deployment/public-rate-limit work, commit, or push was performed. All Phase 3D work and review remained in the main agent with zero subagents.

## Post-implementation publication review — 2026-08-18

The user subsequently authorized an additional main-agent review/fix/publication pass. That review treated the completion report as a claim to verify and found three additional acceptance issues before Git publication:

1. **Playwright dev-harness cleanup path traversal.** `UNIPROOF_E2E_DEV_HARNESS_ID` was interpolated into a path later passed to recursive `rmSync`; a crafted inherited value such as `x/../../../../outside-root` resolved outside the repository. A pure resolver/regression now restricts harness IDs, re-resolves the target under `output/playwright`, and fails closed before cleanup if containment is violated.
2. **Missing repeated-navigation bypass.** The practical WCAG-oriented browser audit covered focus order/traps but omitted WCAG 2.4.1-style bypass of the repeated sticky header. A keyboard-visible `Skip to main content` link and focusable `main-content` target were added to the shared layout/current pages, with a red-then-green Playwright regression.
3. **Unconsumed expected E2E replies.** The Research route controller rejected unexpected requests but did not fail when a queued expected reply was never consumed, allowing a false-positive test to leave an intended request unproved. Teardown now requires an empty expected-reply queue; a retained Vitest regression proves the fail-closed behavior. Valid fixture replies are also typed as `ResearchModeResponse`, while deliberately malformed JSON objects use an explicitly unvalidated helper.

Fresh review evidence after these fixes: full Vitest **306/306**, dev Playwright **66/66**, repeated race suite **35/35**, TypeScript pass, ESLint pass, Next.js 16.3.1 production build pass, production dependency audit 0 vulnerabilities, and built-application Playwright **66/66**. The final workspace/security/integrity checks and authorized Git publication are performed after documentation freeze rather than inferred from the earlier completion evidence.

## Phase 3D / Phase 3 exit criteria

Phase 3 is complete only when:

- catalog/API/composer and complete Phase 2/3 Vitest suites are green;
- direct dev dependency is exact `@playwright/test@1.62.1` with no unrelated dependency modernization;
- client transport enforces the actual <=4 MiB response-byte limit plus fatal UTF-8 decoding and cancellation semantics independently of `Content-Length`;
- Playwright Research suite is green against both the dedicated dev server and the built `next start` application, with configured retries at zero;
- the critical race spec passes five explicit repetitions without retry masking;
- zero unexpected external browser HTTP(S) requests, dialogs, popups, page errors, or application console errors remain;
- no horizontal page overflow remains at 320/375/390/768/1024/1440 widths and long/max-claim fixtures remain usable;
- keyboard form/evidence/error-recovery flows, focus trap/return, sticky-header non-obscuration, labels/errors, announcements, and reduced-motion behavior pass automated plus manual main-agent inspection;
- server-returned canonical result identity, exact immutable retry ownership, literal clear-result semantics, preserved evidence during refresh, and stale-sheet closure on replacement remain correct;
- unknown/conflict/outdated/incomplete and every claim-level evidence status remain truthful with no UI inference/conversion/winner behavior;
- user input survives recoverable failure/cancel/retry paths exactly as specified;
- no browser/provider secret/internal-result leakage, persistence, test backdoor, or background retry behavior is present;
- Phase 2 tests remain green and no Phase 2 evidence contract was weakened for UI tests;
- build/lint/type/audit/workspace/diff/encoding/credential-value/client-boundary gates pass freshly;
- the protected ten-file `ui-flow-screenshots/` filename+size+SHA-256 manifest is identical before/after the batch;
- docs/tasks/memory reflect observed implementation state and the final inline defect-first review result;
- all implementation/review work was performed by the main ChatGPT agent with **zero subagents**;
- public deployment remains blocked until Phase 6 verifies distributed/deployment-layer rate limiting, current platform duration/cancellation behavior, provider configuration/terms, and an explicitly authorized bounded live smoke.
