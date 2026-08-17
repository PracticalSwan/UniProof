# Phase 3D — Research Hardening and Browser QA Implementation Plan

> **Execution policy:** Follow `AGENTS.md` model-specific delegation. GLM-5.3 Max executes this plan entirely in the main agent with no subagents. Native OpenAI GPT models retain the required final read-only review-agent step after local gates. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete Phase 3 Research experience across lifecycle, evidence, concurrency, accessibility, responsive, security, and malformed-data edge cases using deterministic offline fixtures and browser automation, then fix only defects within the approved Phase 3 boundary.

**Architecture:** Keep server API correctness in Vitest and browser behavior in Playwright. Browser tests intercept `/api/research` and return responses validated by the Phase 3 public schema; they never call live providers. Use the real Next.js page/components and production client code. No production test mode, query flag, fake endpoint, or provider bypass is added.

**Tech Stack:** Playwright Test 1.62.x, Vitest 4, Next.js 16, React 19, TypeScript, current UI stack. The repository currently declares `playwright` but not the official `@playwright/test` runner; Phase 3D must align that dev dependency at the same version before adding E2E tests. No additional accessibility/testing library is required; use Playwright roles, keyboard input, DOM geometry, and native browser APIs.

## Global Constraints

- Phase 3A–3C must be implemented and green first.
- Read `LESSONS.md` first.
- Do not weaken strict schemas because a browser fixture is inconvenient.
- Do not make live provider calls in automated tests.
- Do not add production fixture modes, `?test=...`, secret bypasses, alternate unauthenticated endpoints, or environment switches that change evidence semantics.
- Do not change Phase 2 authority/conflict/freshness/unknown semantics during UX hardening.
- Do not implement persistence, auth, Comparison, Guide, deployment, or public rate-limit infrastructure here.
- Do not overwrite or use the protected user-owned `ui-flow-screenshots/` directory. Playwright artifacts stay in already ignored `test-results/`, `playwright-report/`, or `output/playwright/` paths.

---

## File map

Create:

```text
playwright.config.ts
tests/fixtures/research-dossiers.ts
tests/e2e/research-mode.spec.ts
```

Modify as defects are proven:

```text
components/research/*.tsx
lib/research/mode/client-state.ts
lib/research/mode/client-form.ts
lib/research/mode/client-transport.ts
lib/research/mode/format.ts
lib/research/mode/public-contracts.ts    # only if tests reveal a genuine contract hole
lib/research/mode/handler.ts             # only if route tests reveal a genuine boundary hole
app/research/page.tsx
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

## Task 0 — Align the E2E test-runner dependency before writing tests

### Files

- Modify: `package.json`
- Modify: `package-lock.json`

The current manifest has `playwright: ^1.62.1` but not the official Playwright Test runner package used by current Playwright configuration/test APIs. Official Playwright guidance uses `@playwright/test` for `defineConfig`, `test`, `expect`, fixtures, and browser-test execution.

- [ ] Confirm no existing source imports the direct `playwright` library for a separate purpose.
- [ ] Replace the direct `playwright` devDependency with `@playwright/test` at the same currently pinned compatible range (`^1.62.1`) rather than keeping two redundant top-level packages, unless inspection proves the direct library is used independently.
- [ ] Update the lockfile through npm; do not hand-edit dependency trees.
- [ ] Do not upgrade to a newer Playwright major/minor as unrelated modernization in this phase.
- [ ] Verify:

```text
cmd.exe /c npm.cmd install
cmd.exe /c npx.cmd playwright --version
cmd.exe /c npm.cmd audit --omit=dev
```

- [ ] Install the Chromium browser binary only when the implementation environment lacks it, using the official Playwright install command. Treat browser installation as local tooling state, not an application runtime dependency and not a reason to commit generated binaries.

If dependency inspection contradicts this plan because `@playwright/test` is already a direct usable dependency by Phase 3D implementation time, make no redundant dependency change; document the observed manifest state and proceed.

---

## Task 1 — Create strict deterministic browser fixtures

### Files

- Create: `tests/fixtures/research-dossiers.ts`

Every exported fixture must be parsed through `researchModeResponseSchema` before use so Playwright cannot accidentally normalize invalid application data into expected UI behavior.

### Required fixture family

- [ ] `succeededAllReadyResponse`
  - all seven categories processed;
  - mix of verified/corroborated/university-reported/anecdotal/inferred claims;
  - multiple sources;
  - exact supporting text.

- [ ] `succeededWithUnknownResponse`
  - at least one ready category;
  - at least one zero-claim unknown category with deterministic fallback explanation;
  - no incomplete categories.

- [ ] `partialResponse`
  - at least one ready category;
  - one unknown category;
  - at least one incomplete category with stable failure code;
  - run status `partial`.

- [ ] `failedResponse`
  - all requested categories incomplete;
  - run status `failed`;
  - zero claims.

- [ ] `conflictResponse`
  - same category contains >=2 final claims marked `conflicting` with distinct values and distinct evidence links;
  - no UI-preferred winner field.

- [ ] `outdatedResponse`
  - explicit outdated claim;
  - source retrieval timestamp differs from effective/academic period so tests can prove they are labeled separately.

- [ ] `longContentResponse`
  - max/near-max university/program names;
  - long property/value;
  - 2000-character supporting text;
  - long unbroken-but-valid source URL segment;
  - Unicode/astral characters.

- [ ] `xssLookingResponse`
  - source title/supporting text/property containing strings such as `<script>alert(1)</script>` and `<img src=x onerror=...>` as plain data.

- [ ] stable transport-error fixtures for each public error code.

### Fixture invariants

- [ ] no provider names/attempts/documents/candidates appear;
- [ ] no real credentials;
- [ ] no fake evidence state outside the public schema;
- [ ] source links use reserved/example domains where network navigation is not required;
- [ ] fixture IDs deterministic;
- [ ] timestamps fixed so screenshots/assertions do not change by wall clock.

---

## Task 2 — Configure deterministic Playwright execution

### Files

- Create: `playwright.config.ts`

Recommended baseline:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/phase3",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/research",
    reuseExistingServer: !process.env.CI,
  },
});
```

Rules:

- [ ] Use existing ignored `test-results/`; do not write to `ui-flow-screenshots/`.
- [ ] One worker prevents shared dev-server/route interception races during this small MVP suite.
- [ ] Do not add browser projects that multiply all tests unless a specific engine difference must be verified. Chromium is sufficient for the required hackathon acceptance; manually add another engine only if a reproduced browser-specific bug demands it.
- [ ] Do not install browsers/dependencies automatically in application runtime scripts.

Add a package script only if helpful and unambiguous:

```json
"test:e2e": "playwright test"
```

Do not change the existing `npm test` meaning unless explicitly intended; full release verification should run both unit/integration and E2E commands.

---

## Task 3 — Add reusable route interception helpers

### Files

- Create/modify: `tests/e2e/research-mode.spec.ts`

Use Playwright routing only in test code.

Recommended helper:

```ts
async function fulfillResearch(
  page: Page,
  response: ResearchModeResponse,
  options: { delayMs?: number; status?: number } = {},
) {
  const validated = researchModeResponseSchema.parse(response);
  await page.route("**/api/research", async (route) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      status: options.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(validated),
    });
  });
}
```

Also support:

- [ ] non-JSON 500 response and a nominally JSON response with wrong/missing `Content-Type`;
- [ ] malformed 200 response deliberately **not** parsed by fixture helper so client rejection can be tested;
- [ ] schema-valid 200 dossier for the wrong submitted university, wrong program scope, and wrong category set so Phase 3C's request/response binding is exercised independently of schema validation;
- [ ] HTTP/envelope disagreement: 200 + `{ok:false}` and non-2xx + `{ok:true}`;
- [ ] hanging/delayed request for Cancel flow plus a response/body completion race after Cancel;
- [ ] ordered response queue (first 500, second 200) for explicit retry;
- [ ] request counter/body capture for single-flight, blank-optional omission, immutable retry snapshot, and input snapshot assertions.

Never add a production code path to inject these fixtures.

---

## Task 4 — Test target search/filter/select behavior

### Browser flows

- [ ] `/research` starts with real catalog controls and no illustrative factual dossier.
- [ ] Catalog text search filters by university name.
- [ ] Search matches program name/subject.
- [ ] Case/punctuation-insensitive search works as planned.
- [ ] Country filter works.
- [ ] Degree filter works.
- [ ] Subject filter works.
- [ ] Combined filters use AND semantics.
- [ ] Empty result displays "No supported matches".
- [ ] Empty result does not expose arbitrary URL/name submit.
- [ ] Selecting university displays selected-target panel and explicitly clears any prior program scope, including a program owned by that same university.
- [ ] Selecting program sets the correct owning university.
- [ ] Explicit university-only/remove-program and clear-target actions are distinct and accessible.
- [ ] Filters changed after selection do not silently retarget or hide the selected-target panel.
- [ ] Enter in catalog search does not submit research; Enter in focused-question textarea inserts a newline.
- [ ] Reset restores all seven categories and clears target/options/form errors without API call or relabeling an existing dossier.

### Request body assertion

Intercept submit and inspect POST JSON:

- [ ] contains IDs/categories/question/intake/year only;
- [ ] no university/program names required from client;
- [ ] no URL/provider/model/key/budget fields;
- [ ] categories canonical even if UI interaction changed them in another order.

---

## Task 5 — Test client validation and single-flight behavior

- [ ] Submit with no target -> visible field error, zero API calls.
- [ ] Submit with zero categories -> visible category error, zero API calls.
- [ ] Blank/whitespace question/intake/academicYear controls are omitted from POST JSON rather than sent as empty strings.
- [ ] Exact max-length optional values submit; over-limit values fail with zero calls; include at least one astral-character UTF-16 boundary case in the Phase 3C unit suite and one representative browser boundary here if practical.
- [ ] Valid submit -> exactly one call.
- [ ] Double-click Research -> exactly one call.
- [ ] Enter-key form submit from an ordinary research control/button -> exactly one call; search/textarea Enter behavior follows Task 4 and produces zero accidental calls.
- [ ] While loading, Research/Reset/form fields are disabled and Cancel is enabled.
- [ ] Clicking/typing into disabled controls cannot mutate submitted request.
- [ ] Page indicates indeterminate loading without percentage/stage fiction.

Capture `request.postDataJSON()` and assert it contains only the public request fields, remains byte/semantic-equivalent to the immutable submission after loading starts, and excludes search/filter UI state.

---

## Task 6 — Test cancellation and stale-response races

### First-run cancellation

- [ ] Hold intercepted request open.
- [ ] Submit.
- [ ] Click Cancel.
- [ ] UI returns to idle with a concise cancellation notice.
- [ ] Inputs are re-enabled and preserved.
- [ ] No automatic retry is sent.

### Refresh cancellation with prior dossier

- [ ] First request returns succeeded dossier.
- [ ] Start a second delayed request.
- [ ] Previous dossier remains visible under an updating treatment.
- [ ] Cancel second request.
- [ ] Previous dossier remains unchanged.
- [ ] No new dossier/failed state replaces it.

### Cancellation/response race and stale response

Test both race classes:

1. the intercepted response headers resolve and Cancel occurs while body completion/validation is still delayed;
2. a delayed first request is cancelled, then a second request succeeds before the first handler eventually tries to fulfill.

- [ ] In the first case, Cancel wins: the just-arriving dossier/error is not rendered after the active signal becomes aborted.
- [ ] In the second case, the second dossier remains final state and the late first response/error/cancel cannot overwrite it.
- [ ] Cancel is idempotent and sends no automatic retry/replacement request.
- [ ] No React state/update warning appears.

### Navigation/unmount

- [ ] Start delayed research, navigate to another local page.
- [ ] No console/page error from late state update.
- [ ] Returning to Research starts fresh; no claim that prior run continued in background.

---

## Task 7 — Test succeeded, unknown, partial, and failed lifecycle semantics

### Succeeded all-ready

- [ ] run-level success/result summary visible;
- [ ] seven category headings in canonical order;
- [ ] total claims matches fixture;
- [ ] no incomplete banner.

### Succeeded with unknown

- [ ] run remains succeeded;
- [ ] unknown category displays category-level `Unknown` badge;
- [ ] zero claims/source action in unknown row;
- [ ] fallback explanation visible;
- [ ] unknown count comes from category state, not claim status count.

### Partial

- [ ] "Some research is incomplete" run banner visible;
- [ ] ready claims remain visible;
- [ ] unknown remains unknown;
- [ ] incomplete row uses "Research incomplete"/operational presentation, not `Unknown` evidence badge;
- [ ] stable reason visible;
- [ ] explicit Retry visible;
- [ ] no automatic request is made without click.

### Failed

- [ ] failed run renders a result-state failure banner, not a transport-error panel;
- [ ] incomplete category rows visible;
- [ ] no fabricated unknown/claims;
- [ ] Retry explicit.

---

## Task 8 — Test evidence statuses, conflict, and outdated behavior

### Evidence badges

Verify UI can render:

- [ ] Verified;
- [ ] Corroborated;
- [ ] University-reported;
- [ ] Conflicting;
- [ ] Anecdotal;
- [ ] Inferred;
- [ ] Outdated;
- [ ] Unknown only at category-level unknown state.

### Conflict fixture

- [ ] both/all competing final values are visible;
- [ ] no value is decorated as preferred/recommended/winner;
- [ ] each conflicting claim has its own evidence action;
- [ ] conflict alert visible at category level;
- [ ] opening each claim shows its corresponding source evidence.

### Outdated fixture

- [ ] Outdated badge visible;
- [ ] effective/academic period shown only when fixture explicitly contains it;
- [ ] "Retrieved" metadata separately labeled;
- [ ] UI never says retrieved date is effective date/freshness validity;
- [ ] canonical official target link remains available for manual confirmation.

### Anecdotal/inferred/university-reported copy

- [ ] no surrounding copy calls these "verified" or "confirmed" unless another explicit claim actually has that status;
- [ ] badge text is visible, not color-only.

---

## Task 9 — Test claim evidence Sheet/Dialog thoroughly

### Mouse flow

- [ ] Click View evidence.
- [ ] Sheet/dialog opens.
- [ ] claim property/value/status visible.
- [ ] exact supporting passage visible.
- [ ] representative source appears first.
- [ ] additional sources listed once each.
- [ ] source title/publisher/type/retrieved metadata visible.
- [ ] external link has expected complete href, `_blank`, `noopener noreferrer`, and `referrerPolicy="no-referrer"` while long visible URL/title text wraps safely.
- [ ] canonical official target link is separate and evidence-source UI never infers "Official" from source type alone.

### Keyboard flow

Using only Tab/Shift+Tab/Enter/Space/Escape:

- [ ] reach claim trigger;
- [ ] open evidence;
- [ ] focus moves inside modal;
- [ ] focus remains trapped;
- [ ] close via Escape;
- [ ] focus returns to exact trigger;
- [ ] close button reachable and named.

### XSS-looking fixture

- [ ] literal `<script>`/`<img onerror>` text is visible as text;
- [ ] no script/img element corresponding to payload exists;
- [ ] no `dialog`, page, or console error triggered by payload.

### Broken-reference defense

Public schema should reject broken source references before browser render. Add a malformed intercepted 200 response with missing source:

- [ ] workspace shows invalid-response/generic error state;
- [ ] no partial evidence sheet opens;
- [ ] prior valid dossier remains if this was a refresh.

---

## Task 10 — Test transport errors and explicit retry

For each public error envelope:

- [ ] correct safe message appears;
- [ ] form values remain;
- [ ] previous dossier remains if present;
- [ ] raw response internals do not appear.

Specific flows:

### 500 non-JSON

- [ ] generic service error;
- [ ] no JSON parser stack;
- [ ] Retry explicit.

### malformed 200 JSON shape

- [ ] client schema rejects;
- [ ] no dossier fields rendered from malformed body;
- [ ] generic invalid-response error.

### retry sequence and immutable historical request

- [ ] first route responds 500;
- [ ] no automatic second call;
- [ ] if the failed refresh is displayed over a prior partial/failed dossier, exactly one `Retry this research` control is visible and it belongs to the newer failed submission; the preserved dossier's older retry is suppressed while that error is active;
- [ ] edit one or more form controls after the failure without submitting;
- [ ] click `Retry this research`;
- [ ] second call occurs once and its POST body exactly matches the failed submission snapshot, not the edited current form;
- [ ] separately click normal `Research` after editing and prove that request uses the new current validated form;
- [ ] success dossier replaces error/previous only after full schema + submitted target/program/category binding;
- [ ] `Clear result` over a preserved dossier plus refresh error clears the displayed result/error rather than merely restoring the same previous dossier.

### request/response binding failures

- [ ] schema-valid wrong-university dossier -> `invalid-response`, no dossier relabeling/partial render;
- [ ] schema-valid wrong-program or unexpected program on university-only request -> `invalid-response`;
- [ ] schema-valid wrong category partition -> `invalid-response`;
- [ ] 200 + `{ok:false}`, non-2xx + `{ok:true}`, and wrong/missing JSON content type -> `invalid-response`;
- [ ] if a prior dossier exists, all of these preserve that prior dossier with its original target label.

### unsupported target

Mock server `unsupported-target` response:

- [ ] search/filters/question/categories/intake/year preserved;
- [ ] selected university and program IDs are both clearly invalidated because the public error does not identify which ID is stale;
- [ ] explicit reselection is required;
- [ ] no invisible retarget to first catalog entry and no mutation of bundled catalog data;
- [ ] prior dossier, if present, remains labeled with its own returned target.

### sensitive input

Exercise `sensitive-input` with the sensitive-looking value separately in `question`, `intake`, and `academicYear`:

- [ ] same safe free-text-group instruction appears in all three cases;
- [ ] populated free-text controls reference the form/group guidance accessibly and are marked invalid, while blank optional free-text controls are not falsely marked invalid;
- [ ] UI does not claim which field triggered detection and does not duplicate the sensitive detector client-side;
- [ ] raw submitted text is not echoed into generated error detail beyond the editable input value the user already controls;
- [ ] correction-required presentation does not blindly auto-retry the same rejected payload.

---

## Task 11 — Responsive and overflow stress matrix

Run the core success/partial/evidence flows at:

```text
320 x 740
375 x 812
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

- [ ] long university/program name wraps without pushing controls off-screen;
- [ ] 2000-character support text wraps/scrolls inside evidence surface without page horizontal overflow;
- [ ] long URL visually wraps or truncates accessibly while anchor href remains complete;
- [ ] claim property/value does not overlap badge/button;
- [ ] filters stack logically on mobile;
- [ ] category controls are tap-sized and readable;
- [ ] evidence sheet fits narrow height/width and content remains scrollable;
- [ ] desktop two-column layout does not create min-width overflow.

Do not solve overflow by globally hiding horizontal overflow; fix the offending component.

---

## Task 12 — Accessibility semantics and announcements

Without adding axe dependency, assert high-value semantics through Playwright roles/attributes.

- [ ] one page `main`.
- [ ] logical h1/h2/h3 progression.
- [ ] form controls have labels.
- [ ] validation errors are associated with controls via `aria-describedby` and/or equivalent.
- [ ] invalid fields expose `aria-invalid` where appropriate.
- [ ] loading region uses `aria-live="polite"` or status role and does not announce every skeleton row.
- [ ] transport/run error uses appropriate alert/status semantics without repeated duplicate announcements.
- [ ] evidence state always has visible text label.
- [ ] all interactive controls reachable by keyboard.
- [ ] no positive `tabindex` ordering hacks.
- [ ] focus indicator visibly present on buttons/links/inputs.
- [ ] reduced-motion media preference does not remove state meaning; test with Playwright `reducedMotion: "reduce"` for at least one flow.

Manual keyboard pass still required after automation because focus visibility is partly visual.

---

## Task 13 — Console/page-error and network discipline

For every major fixture scenario attach listeners:

```ts
const consoleErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
const pageErrors: string[] = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
```

At scenario end:

- [ ] zero unexpected console errors;
- [ ] zero page errors;
- [ ] only expected `/api/research` requests occurred;
- [ ] zero external source navigation/network required by automated tests;
- [ ] zero requests to provider endpoints from browser.

Check browser request URLs for accidental Gemini/Groq/OpenRouter/Tavily/Brave domains; browser must never call them directly.

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

- [ ] no `dangerouslySetInnerHTML` in Research components;
- [ ] no source/provider text inserted into className/style/event handler code;
- [ ] no dynamic external script/image execution from evidence content;
- [ ] no `window.open` without safe link policy when normal anchors suffice;
- [ ] no localStorage/sessionStorage persistence of research result or user question unless separately approved (not part of Phase 3);
- [ ] no query-string serialization of focused question/intake that could leak via URL/history;
- [ ] no service worker/background retry behavior.

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
| loading/partial/failure/retry | lifecycle tests |
| keyboard | keyboard E2E |
| responsive | viewport/overflow matrix |
| preserve input | transport/cancel/retry tests |
| no invented values | public schema + composer tests + UI no inference |

Do not mark a requirement complete from code inspection alone when the acceptance criterion is rendered/browser behavior.

---

## Task 16 — Full Phase 3 verification matrix

### Focused tests

```text
cmd.exe /c npx.cmd vitest run tests/phase3a-research-catalog.test.ts
cmd.exe /c npx.cmd vitest run tests/phase3b-dossier-composer.test.ts tests/phase3b-research-api.test.ts
cmd.exe /c npx.cmd vitest run tests/phase3c-research-state.test.ts tests/phase3c-research-format.test.ts
cmd.exe /c npx.cmd playwright test tests/e2e/research-mode.spec.ts
```

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

### Additional scans

- [ ] changed-file strict UTF-8 + control-character scan;
- [ ] provider secret-value scan;
- [ ] provider `NEXT_PUBLIC_*` scan;
- [ ] browser-client provider endpoint/reference scan;
- [ ] `.env.local` `git check-ignore` + no status entry;
- [ ] no test/playwright artifacts staged;
- [ ] no protected `ui-flow-screenshots/` modifications;
- [ ] placeholder scan (`TODO`, `TBD`, `FIXME`, illustrative claims, `Example University`) in production Phase 3 files;
- [ ] final `git diff --check` after docs/memory updates.

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

Apply the canonical model-specific delegation policy from `AGENTS.md`. When GLM-5.3 Max is the active main model, do not spawn any reviewer or other subagent; complete this entire review inline in the main agent after all local gates. When a native OpenAI GPT model is the active main model, keep the final read-only `code-reviewer` step after the main agent's own inline review and local gates; validate/fix reviewer findings in the main agent and rerun the affected/full gates. Reviewer liveness rules apply only when that native-GPT reviewer step is permitted. Never fabricate a reviewer result.

After any finding:

- [ ] write/add regression first where practical;
- [ ] fix smallest coherent scope;
- [ ] rerun affected focused tests;
- [ ] rerun full gates before declaring completion.

## Phase 3D / Phase 3 exit criteria

Phase 3 is complete only when:

- catalog/API/composer/unit suites are green;
- Playwright Research suite is green across required lifecycle and viewport scenarios;
- no console/page errors remain;
- no horizontal overflow remains at required widths;
- keyboard evidence inspection/focus return works;
- unknown/conflict/outdated/incomplete semantics are truthful;
- user input survives recoverable failure/cancel/retry paths;
- no browser/provider secret/internal-result leakage is present;
- Phase 2 tests remain green;
- build/lint/type/audit/workspace/diff/encoding/secret gates pass;
- docs/tasks/memory reflect observed implementation state;
- public deployment remains blocked until Phase 6 verifies distributed/deployment-layer rate limiting and current platform/provider behavior.
