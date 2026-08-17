# Phase 3 — Research Mode Architecture and Execution Plan

Status: Phase 3A–3D Research Mode is implemented and locally acceptance-complete as of 2026-08-18, based on reviewed Phase 3C commit `d71c1628500c5ae71e14113ae8144cf4c1f14e99` plus the reviewed Phase 3D change set. A post-implementation main-agent review found and fixed three additional acceptance issues before publication: Playwright dev-harness path traversal could move recursive cleanup outside `output/playwright`, the site lacked a keyboard bypass for the repeated sticky navigation, and the E2E route controller did not fail teardown when an expected reply remained unconsumed. Those fixes are regression-covered and preserve the Phase 2/3 evidence boundary. Fresh final evidence now includes 16/16 Phase 3A, 32/32 Phase 3B, 72/72 Phase 3C focused Vitest, 306/306 full Vitest, 66/66 dev Playwright, 35/35 repeated race executions, 66/66 built-application Playwright, successful TypeScript/lint/build checks, 0 production dependency vulnerabilities, and the final security/workspace/integrity gates described below. Phase 3 preserves Phase 2 evidence semantics and remains in-memory; persistence, authentication, Comparison/Guide implementation, public deployment, durable endpoint rate limiting, and any new live-provider smoke remain deferred.

Detailed implementation runbooks:

- Phase 3A — supported catalog + public contracts: `docs/superpowers/plans/2026-08-17-phase-3a-research-catalog-and-public-contracts.md`
- Phase 3B — server API + dossier composer: `docs/superpowers/plans/2026-08-17-phase-3b-research-api-and-dossier-composer.md`
- Phase 3C — interactive Research workspace + evidence UX: `docs/superpowers/plans/2026-08-17-phase-3c-research-workspace-and-evidence-ui.md`
- Phase 3D — failure-state hardening + accessibility + browser acceptance: `docs/superpowers/plans/2026-08-17-phase-3d-research-hardening-and-browser-qa.md`

Execution policy normally follows `AGENTS.md`, but **Phase 3D has an explicit task-specific user override: zero subagents/reviewer agents for every model**. The main ChatGPT agent must perform Phase 3D planning, implementation, TDD, browser/accessibility/security review, documentation, and final defect-first review inline. Do not invoke the native-GPT `code-reviewer` or any specialist child for this batch.

## 1. Goal

Deliver the complete MVP Research mode over the already-validated Phase 2 pipeline:

1. search/filter and select a project-supported university or program;
2. optionally add a focused public research question, intake, and academic year;
3. select one or more of the seven canonical research categories;
4. execute exactly one bounded Phase 2 research run through a same-origin server endpoint;
5. display a structured dossier with traceable final claims, source metadata, exact supporting text, evidence-state badges, category explanations, official target links, and explicit partial/unknown/conflict/outdated/failure states;
6. make evidence inspectable with keyboard and narrow/mobile layouts;
7. keep automated verification offline and deterministic.

The Research UI is a presentation/controller layer over Phase 2. It must not become a second evidence engine.

## 2. Non-goals and protected boundaries

Phase 3 MUST NOT:

- modify Phase 2 extraction, reconciliation, authority, independence, period, scope, conflict, or category-unknown semantics merely to make UI rendering easier;
- send applicant-profile/private-document data through the research providers;
- accept caller-supplied provider names, models, API keys, source URLs, official URLs, retry counts, budgets, or authority metadata;
- expose normalized source documents, candidate claims, semantic questions/relationships, provider request/response bodies, API keys, or full provider-attempt telemetry to the browser;
- introduce Supabase persistence, migrations, Row Level Security, authentication, saved research history, background jobs, queues, polling workers, or durable caching;
- implement Comparison or Guide logic;
- perform automatic live-provider smoke tests;
- deploy, publish, commit, or push without separate authorization.

The protected untracked `ui-flow-screenshots/` directory currently contains ten user-requested current-state PNGs (`01`–`10`). Phase 3D treats them as read-only reference material: do not use them as Playwright output or modify/stage/delete them. Because the directory is untracked, Phase 3D records filename+size+SHA-256 before work and proves the manifest is identical at completion.

## 3. Architectural boundary

```text
public supported catalog
        -> Research form/search/filter
        -> strict client-safe ResearchModeRequest
        -> POST /api/research (same origin, Node runtime)
        -> server validation + catalog identity resolution
        -> Phase 2 ResearchRequest
        -> runPhase2Research(phase2Request, { signal: request.signal, discovery: { targetResolver } })
        -> validated ResearchResult (server only)
        -> deterministic dossier composer
        -> strict client-safe ResearchModeResponse
        -> Research workspace state machine
        -> dossier sections / evidence sheet / official links
```

### 3.1 Why the full `ResearchResult` stays server-side

`ResearchResult` contains internal material that the Research UI does not need: normalized documents, extraction candidates, discovery/provider telemetry, and internal warnings. Returning it wholesale would increase response size, expose unnecessary implementation details, and couple the browser to Phase 2 internals.

The public dossier instead carries only:

- selected project-owned target identity and canonical official links;
- terminal run status/timestamps needed by the UI;
- seven-category lifecycle state;
- final gated claims and their evidence statuses;
- one exact representative supporting passage per final claim;
- all claim-referenced public source links/metadata;
- validated/fallback category explanation text;
- sanitized category-level operational failure notices;
- deterministic summary counts/flags needed by the UI.

No public DTO field may let the browser reinterpret evidence authority or manufacture a claim.

## 4. Phase decomposition and dependency order

### Phase 3A — Supported catalog and public contracts

Build the public identity/catalog surface first. It supplies stable application-owned university/program IDs and the strict browser/API schemas used by every later Phase 3 task.

Acceptance gate before 3B:

- catalog schema and data invariants pass;
- 10–15 supported universities are represented across the United States, United Kingdom, and Thailand;
- supported programs are limited to Computer Science, Artificial Intelligence, Data Science, and closely related subjects, with bachelor/taught-master coverage where verified official program pages exist;
- every checked-in university/program identity and canonical official URL is verified against current official sources during implementation;
- program IDs resolve to exactly one catalog university;
- no program may point to another university ID;
- search/filter behavior is deterministic and client-safe;
- public request/response schemas contain no server secrets or Phase 2 internal types.

### Phase 3B — Research endpoint and dossier composer

Create a same-origin `POST /api/research` boundary, use the catalog as the Phase 2 target resolver, invoke `runPhase2Research` once, and compose a minimal validated public dossier.

Acceptance gate before 3C:

- no live network calls occur in automated route/composer tests;
- invalid/oversized/cross-origin/sensitive/unsupported input is rejected before Phase 2 dispatch;
- catalog target resolution is deterministic;
- `request.signal` reaches Phase 2;
- a valid Phase 2 `failed`/`partial`/`succeeded` result is returned as a valid dossier outcome rather than collapsed into generic HTTP failure;
- internal unexpected failures are sanitized;
- public DTO cannot contain documents, candidates, raw warnings, API keys, or provider-attempt arrays;
- all successful public responses re-validate against the strict public response schema.

### Phase 3C — Interactive Research workspace and evidence UI

Replace the static illustrative `app/research/page.tsx` preview with an interactive catalog-driven workspace and actual dossier renderer.

Acceptance gate before 3D:

- supported university/program search/filter/select works;
- at least one category is required;
- form input survives recoverable errors;
- duplicate submits do not start concurrent client requests;
- user cancellation uses `AbortController` and never triggers automatic retry;
- stale responses cannot overwrite a newer request;
- all seven categories render in canonical order;
- evidence `unknown` and operational `incomplete` are visually and semantically distinct;
- claim evidence opens with exact supporting text + all referenced sources;
- official target links come from the catalog, not from inferred source ownership;
- conflicting/outdated/anecdotal/inferred/university-reported claims retain their exact Phase 2 badges.

### Phase 3D — Hardening, accessibility, browser acceptance

Exercise every UX lifecycle and stress edge case with deterministic API interception and offline fixtures; fix only Phase 3 presentation/controller defects.

Implemented result: the direct runner is exact `@playwright/test@1.62.1`; browser specs are split by concern and use one worker, zero retries, blocked service workers, deterministic route barriers, and fail-closed external-network/page/console/dialog/popup guards. Because an unrelated developer `next dev` process can hold the workspace `.next/dev` lock, dev-mode Playwright creates a process-unique ignored source snapshot under `output/playwright/` and starts a fresh `next dev` there rather than attaching to or terminating the developer server. Production-mode acceptance runs the actual built workspace with `next start`. The only Phase 3D product defect found during browser acceptance was unsupported-target accessibility after a program-scoped target was invalidated; both cleared target IDs now retain exact error associations.

Phase 3 completed when the full acceptance matrix and repository gates passed; public deployment remains a separate Phase 6 decision.

## 5. Public supported catalog model

The catalog is project-owned public identity metadata, not research evidence. It exists to constrain the MVP to supported targets and give Phase 2 a deterministic ID resolver.

Recommended client-safe records:

```ts
export type ResearchCatalogUniversity = {
  id: string;
  name: string;
  countryCode: "US" | "GB" | "TH";
  websiteUrl: string;
  rorId?: string;
  aliases?: readonly string[];
};

export type ResearchCatalogProgram = {
  id: string;
  universityId: string;
  name: string;
  degreeLevel: "bachelor" | "master";
  subjectArea: string;
  officialUrl: string;
  aliases?: readonly string[];
};
```

Rules:

- use stable application-owned IDs; changing display labels must not change IDs;
- aliases are search metadata only and must never become evidence claims;
- catalog canonical university/program URLs must be HTTPS; if a target lacks a stable verified HTTPS official page, exclude/replace it rather than weakening the catalog schema;
- `program.universityId` must resolve exactly once;
- no duplicate IDs, duplicate normalized university names within the same country, or duplicate normalized program identity under one university;
- catalog search normalization must be deterministic (NFKC, locale-stable lowercase, punctuation/whitespace collapse) and must not fuzzy-autocorrect an unsupported target into a supported one;
- country/degree/subject filters narrow visible options only; they do not alter Phase 2 evidence semantics;
- catalog data is bundled public data and contains no credentials or private user data;
- implementation must record a catalog verification date in documentation, not use that date as evidence freshness for research claims.

The catalog is not a substitute for Phase 2 discovery. It supplies target identity and official navigation links; Phase 2 still researches current facts from sources.

## 6. Browser/API request contract

Use a dedicated client-safe schema rather than importing `lib/research/contracts/research.ts` into client code, because the Phase 2 contract currently imports server-owned research-limit modules.

Recommended request shape:

```ts
export type ResearchModeRequest = {
  universityId: string;
  programId?: string;
  categories: ResearchModeCategory[];
  question?: string;
  intake?: string;
  academicYear?: string;
};
```

Hard rules:

- `universityId` must exist in the supported catalog;
- if `programId` is present, it must exist and belong to that exact university;
- categories: 1–7, unique, canonicalized to admissions -> tuition -> scholarships -> program-structure -> research -> outcomes -> support;
- public `question` maximum is intentionally <= the Phase 2 600-character server limit; implementation must cross-test the public bound against Phase 2 rather than assuming they match forever;
- trim question/intake/year and reject blank-after-trim values;
- reject unknown object keys;
- do not accept locale from the browser in the MVP; Phase 3 is English and the server owns `en`/`en-US` behavior where needed;
- do not accept university/program names together with IDs; names come from catalog resolution;
- do not accept URLs or provider configuration;
- reject likely sensitive/private-data content in any caller-controlled free-text research field (`question`, `intake`, or `academicYear`) at the endpoint instead of silently sending it into a research run; the UI also warns users to enter public research context only.

Client validation improves UX, but server validation is authoritative.

## 7. HTTP boundary and execution semantics

### 7.1 Route form

Use a Next.js App Router Route Handler:

```ts
// app/api/research/route.ts
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleResearchPost(request, productionResearchDependencies);
}
```

Why Node runtime: Phase 2 retrieval uses Node DNS/HTTP(S) transport and must not be silently moved to an Edge runtime.

### 7.2 Request-body safety

The handler must:

1. allow JSON only;
2. reject a declared body larger than the Phase 3 request-body ceiling before reading;
3. stream/read with a hard byte ceiling even when `Content-Length` is absent or dishonest;
4. decode UTF-8 strictly;
5. parse JSON once;
6. validate the strict public request schema;
7. validate catalog membership and program/university ownership;
8. reject sensitive/private content in any present `question`, `intake`, or `academicYear` field;
9. only then call the Phase 2 runner.

Do not call unbounded `request.json()` as the first operation on arbitrary public input.

### 7.3 Same-origin/abuse boundary

This endpoint is read-only but expensive. Phase 3 should:

- reject a mismatched `Origin` header when present;
- reject `Sec-Fetch-Site: cross-site` when present;
- require JSON so cross-site HTML form POSTs cannot invoke the endpoint as a simple request;
- keep provider/source/model/request budgets owned by Phase 2;
- prevent accidental duplicate browser submits with single-flight UI state.

Do **not** claim an in-memory serverless token bucket is a reliable distributed rate limiter. Before any public deployment, Phase 6 must configure/verify a deployment-layer or durable rate limit for `/api/research`. Public deployment is blocked until that gate passes.

### 7.4 No background-job fiction

Phase 3 is one request -> one in-memory Phase 2 run -> one response.

Do not create a fake job ID, polling endpoint, or reconnectable run unless durable job state/persistence is explicitly added in a later phase. Serverless process memory cannot be treated as durable run storage.

### 7.5 Cancellation and infrastructure timeout

- pass `request.signal` directly into `runPhase2Research`;
- client cancellation stops waiting and propagates where the runtime supports request abort;
- never assume browser abort is a durable cancellation receipt;
- do not auto-retry an aborted run;
- infrastructure/function termination is surfaced as a recoverable network/server error to the client;
- do not hard-code correctness around a mutable hosting-plan duration. During deployment work, re-check current Next.js/Vercel duration/cancellation documentation and set route/project duration only if needed; the application must remain correct when the platform terminates a long request.

## 8. Public dossier DTO

The dossier is a deterministic projection of one validated Phase 2 result plus catalog identity.

Recommended shape:

`PublicEvidenceStatusCounts` counts **final claims only** and therefore has no `unknown` field:

```ts
export type PublicEvidenceStatusCounts = {
  verified: number;
  corroborated: number;
  "university-reported": number;
  conflicting: number;
  anecdotal: number;
  inferred: number;
  outdated: number;
};
```

Category-level unknown is derived from `ResearchDossierCategory.state === "unknown"`, never from a claim-status counter.

```ts
export type ResearchDossier = {
  target: {
    university: {
      id: string;
      name: string;
      countryCode: string;
      websiteUrl: string;
    };
    program?: {
      id: string;
      name: string;
      degreeLevel: "bachelor" | "master";
      subjectArea: string;
      officialUrl: string;
    };
  };
  run: {
    id: string;
    status: "succeeded" | "partial" | "failed";
    createdAt: string;
    startedAt: string;
    updatedAt: string;
    completedAt: string;
  };
  summary: {
    totalClaims: number;
    statusCounts: PublicEvidenceStatusCounts;
    processedCategories: ResearchModeCategory[];
    unprocessedCategories: ResearchModeCategory[];
  };
  categories: ResearchDossierCategory[];
  sources: PublicResearchSource[];
};
```

Each category must be exactly one of:

```ts
type ResearchDossierCategory =
  | {
      category: ResearchModeCategory;
      state: "ready";
      claims: PublicResearchClaim[];
      explanation: PublicEvidenceExplanation;
      hasConflict: boolean;
      hasOutdated: boolean;
    }
  | {
      category: ResearchModeCategory;
      state: "unknown";
      claims: [];
      explanation: PublicEvidenceExplanation & { referencedClaimIds: [] };
      hasConflict: false;
      hasOutdated: false;
    }
  | {
      category: ResearchModeCategory;
      state: "incomplete";
      claims: [];
      explanation?: never;
      failure: PublicResearchFailure;
      hasConflict: false;
      hasOutdated: false;
    };
```

Important: `unknown` means completed research found no eligible factual claim. `incomplete` means operational work did not complete. Never map `categoriesFailed` or `categoriesUnprocessed` to an `unknown` badge.

### 8.1 Public claim projection

Expose only final gated claim fields needed by the UI:

```ts
export type PublicResearchClaim = {
  id: string;
  category: ResearchModeCategory;
  property: string;
  value: string | number | boolean;
  unit?: string;
  currency?: string;
  academicYear?: string;
  effectiveDate?: string;
  intake?: string;
  verificationStatus: PublicEvidenceStatus; // never claim-level unknown
  representativeSourceId: string;
  sourceIds: string[];
  supportingText: string;
};
```

The composer resolves `representativeSourceId` server-side from the claim's validated candidate provenance and exact `supportingText`. If the supposedly validated result cannot produce a representative source, composition fails closed as an internal invariant violation; it does not choose an arbitrary source.

Do not expose `candidateIds`, `documentIds`, extraction model/provider, semantic relationships, or confidence.

### 8.2 Public source projection

Expose:

- source ID;
- URL;
- title;
- publisher;
- source type;
- retrieval timestamp;
- explicit effective date/academic year when present.

Do not expose discovery query IDs or provider telemetry.

Never infer factual freshness from `retrievedAt`. `outdated` comes from the final claim status; `retrievedAt` is displayed only as observation metadata.

### 8.3 Official links

The canonical "Official university" / "Official program" links come from the supported catalog identity. Evidence source links are labeled "Open source", not automatically "official", because source ownership/authority is claim-specific.

## 9. Dossier composition invariants

The server composer MUST:

- accept only `researchResultSchema`-validated input;
- preserve canonical category order;
- preserve final claim values/types exactly; presentation may format labels but must not convert currency, units, dates, or numeric-string types;
- include claims only in processed `ready` categories;
- include zero claims in `unknown` categories;
- include no claims/explanations in `incomplete` categories;
- include every processed category exactly once;
- include every unprocessed category exactly once;
- make the seven requested categories a complete partition of category rows;
- expose conflict/outdated flags only when final evidence summary reports that category and matching final claims exist;
- include one explanation for every processed category and none for unprocessed categories;
- ensure every public claim source ID resolves to a public source row;
- ensure representative source belongs to `sourceIds`;
- preserve source ordering deterministically;
- convert raw Phase 2 operational failures to a small stable user-facing failure vocabulary without forwarding provider error text;
- not forward Phase 2 `warnings` verbatim;
- validate the composed public dossier before returning it.

## 10. Research UI state, form, and transport boundaries

Phase 3C uses four small client-safe seams rather than scattering correctness across React event handlers:

1. `client-form.ts` owns catalog-aware target/program ownership, canonical category toggles, blank optional omission, target labels, and final `researchModeRequestSchema` validation.
2. `client-state.ts` owns the pure reducer plus an immutable `ResearchSubmissionSnapshot` containing the exact validated public request and catalog-derived target label.
3. `client-transport.ts` owns the single `/api/research` fetch, strict JSON/content-type/envelope validation, submitted target/program/category binding, sanitized network/invalid-response outcomes, and signal-authoritative cancellation. Phase 3D hardens this seam further with an **actual <=4 MiB streamed response-byte bound and fatal UTF-8 decoding**, so missing/dishonest `Content-Length` cannot bypass the browser trust boundary.
4. `format.ts` owns deterministic presentation-only formatting.

Recommended run states keep form state separate and retain the submission that produced a dossier/error:

```ts
type ResearchWorkspaceState =
  | { kind: "idle"; notice?: string }
  | { kind: "loading"; requestSequence: number; submission: ResearchSubmissionSnapshot; previous?: ResearchDossier }
  | { kind: "result"; dossier: ResearchDossier; submission: ResearchSubmissionSnapshot; notice?: string }
  | { kind: "error"; error: ResearchWorkspaceError; submission: ResearchSubmissionSnapshot; previous?: ResearchDossier };
```

Rules:

- form fields live separately and are not erased by run-state transitions;
- blank/whitespace-only optional question/intake/year UI values are omitted from the request rather than serialized as empty strings that fail the public schema;
- target/program selection is resolved only against the public catalog; selecting a program selects its owner and explicitly selecting university-only research clears program scope;
- first submit -> loading skeleton/status;
- a synchronous active-request/controller ref is set before any async boundary so double-click/Enter in the same tick cannot start a second fetch before React disables controls;
- the submitted request snapshot is immutable while active; mutable controls are disabled;
- explicit Cancel aborts the exact active controller; the signal is authoritative even if a provider/server abort rejects without a DOM `AbortError`; cancellation wins any same-sequence response/parser race and starts no retry;
- a later request gets a monotonically increasing client sequence; stale success/error/cancel outcomes cannot overwrite the current run;
- when refreshing an existing dossier, keep the previous dossier visible and labeled with its original returned target until a newer fully validated dossier replaces it;
- a response is renderable only after `researchModeResponseSchema` validation **and** exact binding to the submitted university ID, optional program ID/absence, and canonical category set; a schema-valid dossier for another submitted target/scope is `invalid-response`;
- valid `run.status="failed"` dossiers remain result data, not transport errors;
- HTTP status/envelope disagreement, missing/non-JSON content type, malformed JSON, or malformed dossier become sanitized client `invalid-response` without partial render or raw response text;
- server `sensitive-input` is a free-text group/form error because Phase 3B checks question, intake, and academic year together; the client does not duplicate that detector;
- `Retry this research` reuses the exact stored submission; normal Research uses current validated form values as a new request;
- no automatic POST retry, local/session storage persistence, URL/query-string persistence, or background continuation is added.

## 11. Category/evidence presentation semantics

### Ready

A processed category with >=1 final claim.

Render:

- category title;
- evidence status badges present in its claims;
- claim count;
- evidence-bounded explanation;
- conflict/outdated alerts when applicable;
- claim list.

### Unknown

A processed zero-claim category.

Render:

- `Unknown` evidence badge/state;
- deterministic fallback explanation from Phase 2;
- text explaining that completed bounded research did not establish a supported factual claim;
- no fabricated placeholder value;
- no source drawer action.

### Incomplete

An unprocessed category.

Render a separate operational state, e.g. "Research incomplete", not `Unknown`.

User-facing failure messages are stable mappings such as:

- cancelled -> Research was cancelled before this category completed.
- timeout -> Research did not finish within the available time.
- source-discovery -> Sources could not be discovered completely.
- retrieval/normalization/source-limit -> Available sources could not be processed completely.
- provider-rate-limit -> Research provider limits prevented completion.
- provider-error/unknown -> Research could not complete this category.

Do not mention raw providers, secrets, HTTP bodies, stack traces, or internal prompt/model details in end-user messages.

### Conflicting

- never pick a winner in the UI;
- show all final conflicting claims returned by Phase 2;
- label the section clearly;
- keep each claim's source evidence inspectable;
- do not average/majority-vote values.

### Outdated

- show the `Outdated` badge from the claim state;
- display explicit academic year/effective date when present;
- display retrieval date separately and never call retrieval date the effective date;
- provide the official target link for manual confirmation.

### Anecdotal / inferred / university-reported

Preserve exact badges and avoid UI copy that implies verified authority.

## 12. Claim and source evidence sheet

A claim detail surface should use the existing visual foundation and a Radix/shadcn Sheet/Dialog-style primitive without introducing a new dependency if the installed `radix-ui` package is sufficient.

It shows:

1. property + rendered value;
2. evidence badge;
3. academic year/intake/effective date if explicitly present;
4. exact supporting text in a `<blockquote>`;
5. representative source metadata;
6. all additional source references for that final claim;
7. retrieval timestamp as "Retrieved" metadata;
8. safe external "Open source" links;
9. separate canonical "Official program/university page" link from catalog when useful.

Accessibility requirements:

- claim-row/button is keyboard reachable;
- opening moves focus into the sheet/dialog;
- focus is trapped while modal is open;
- Escape closes;
- closing returns focus to the trigger;
- title/description are programmatically associated;
- external links have descriptive accessible names;
- never render retrieved text with `dangerouslySetInnerHTML`.

## 13. Search/filter/selection behavior

Minimum MVP controls:

- catalog text search over university/program/aliases/subject;
- country filter;
- degree-level filter;
- subject filter;
- university selection;
- optional program selection;
- seven category checkboxes;
- optional focused question;
- optional intake;
- optional academic year.

Deterministic behavior:

- selecting a program selects its owning university through the shared catalog helper;
- selecting a university result explicitly switches to university-level research and clears any selected program, even when that program belongs to the same university; provide a distinct university-only/remove-program action so scope is never invisible;
- changing country/degree/subject/search filters affects available matches only and must not silently retarget/hide the active selected-target panel;
- render filtered matches as a semantic list of native buttons rather than claiming unsupported combobox/listbox keyboard semantics; no new combobox dependency is required for the small catalog;
- use native category checkboxes and a textarea for focused question; Enter in the search filter must not submit expensive research and Enter in the textarea inserts a newline;
- empty search result says "No supported matches" and does not offer arbitrary web research;
- unsupported text never becomes a free-form target;
- reset clears filters/form input/errors and restores all categories but does not fire research or relabel a previously returned dossier;
- categories always remain in canonical order;
- optional free-text controls may hold blank strings in UI state, but submit construction trims them and omits blank values before public-schema validation.

## 14. Formatting rules

Create pure deterministic presentation helpers and test them.

- string claim values render verbatim after safe React escaping;
- booleans render `Yes` / `No` while retaining boolean type in DTO;
- numbers render without changing semantic value; no currency conversion or unit conversion;
- currency is displayed as the explicit three-letter code, not inferred symbol-only localization;
- unit is appended only when present;
- do not parse strings such as `"10000"` into numbers;
- do not infer dates from arbitrary strings;
- long URLs/titles/properties/supporting passages must wrap without horizontal page overflow;
- Unicode/astral characters must remain well-formed.

## 15. Loading/progress behavior

Phase 2 does not expose a durable streamed progress protocol. Do not invent percentage completion.

Use truthful indeterminate progress copy, for example:

- "Researching sources and evidence…"
- "This may take a while; you can cancel this request."

Do not show synthetic stage percentages or claim a background run will continue after navigation.

The UI may rotate static explanatory messages for perception, but those messages must not imply server progress state unless the server actually reports it.

## 16. Edge-case and bug-prevention matrix

The implementation and tests must cover at least the following.

### Input/catalog

- empty catalog search;
- Unicode/diacritics/case/punctuation search;
- duplicate catalog IDs;
- duplicate normalized program identity;
- unsupported university/program ID;
- program belongs to different university;
- university-only research;
- program-specific research;
- zero categories;
- duplicate/shuffled categories;
- blank-after-trim optional inputs;
- maximum-length and over-limit question/intake/year;
- unknown JSON keys;
- invalid UTF-8/JSON;
- missing/lying `Content-Length`;
- oversized request stream;
- cross-origin request;
- sensitive/private patterns in `question`, `intake`, and `academicYear`.

### Server execution

- pre-aborted request;
- abort during target resolution/provider work;
- no configured provider keys;
- Phase 2 succeeded;
- Phase 2 partial;
- Phase 2 failed;
- unexpected Phase 2 throw;
- malformed injected Phase 2 result at test seam;
- function/infrastructure timeout observed as network/5xx path;
- no automatic POST retry;
- no internal provider/request data in response.

### Composer

- all seven categories ready;
- mix of ready/unknown/incomplete;
- zero-claim unknown;
- multiple conflicting final claims;
- outdated claims;
- anecdotal/inferred/university-reported/corroborated/verified;
- one claim with multiple source IDs;
- representative supporting source resolution;
- missing source invariant -> fail closed;
- missing explanation invariant -> fail closed;
- source ordering and category ordering deterministic;
- extremely long but contract-valid claim/source/support text;
- boolean/number/string values stay type-correct;
- no raw document/candidate/provider telemetry serialized.

### Client form/concurrency/transport

- blank/whitespace optional question/intake/year omitted from request versus max/over-limit UTF-16 values, including astral boundary cases;
- selected program ownership, explicit program -> university-only scope switch, unknown/mismatched target IDs, and filters that no longer match the selected target;
- double-click submit and Enter-key submit from ordinary research controls produce exactly one active request;
- Enter in catalog search does not submit; Enter/newline in focused-question textarea does not submit;
- cancel first run;
- cancel refresh with previous dossier;
- cancellation after fetch resolves but before/during body decode/validation still wins for the exact signal/sequence;
- retry after network/internal/invalid-response uses exact stored submission, while normal Research uses current form values;
- old response/error/cancel arrives after newer response;
- component unmount abort;
- missing/non-JSON response content type, empty/malformed JSON, schema-invalid body, 2xx error envelope, non-2xx success envelope;
- schema-valid dossier for the wrong submitted university/program/category set is rejected;
- sensitive-input may originate from question, intake, or academic year and is presented as a free-text-group error without browser-side detector duplication;
- unsupported-target invalidates selected target/program without fuzzy/first-result retargeting and preserves other form input;
- form controls are disabled while a run is active, so the submitted request snapshot cannot be mutated mid-flight; keyboard/mouse attempts to change controls do not alter the captured request;
- result remains associated with the submitted target from the server dossier and stored submission, never reconstructed from mutable client labels;
- when a prior dossier exists and the user starts a later run for a different target, the previous dossier remains visibly labeled with its original target during the update so old/new target context cannot be confused;
- starting/replacing/clearing a dossier closes any stale evidence sheet before the referenced claim disappears.

### Evidence UX

- no claims shown for incomplete category;
- unknown never labeled as provider failure;
- incomplete never uses evidence badge `Unknown`;
- conflict does not hide competing values;
- outdated does not use retrieval date as validity;
- source link list de-duplicates repeated source IDs;
- source link opens safely;
- supporting passage rendered as text only;
- sheet closes/reopens with correct focus;
- missing optional academic year/intake/effective date leaves no misleading placeholder fact.

### Layout/accessibility

- 320px/narrow viewport without horizontal page overflow;
- common mobile widths, tablet, desktop, wide desktop;
- long university/program names;
- long unbroken source URLs;
- 2000-character supporting passage;
- keyboard-only form/filter/category selection;
- keyboard-only evidence inspection;
- visible focus indicators;
- logical heading hierarchy;
- labels/error descriptions bound to inputs;
- loading/error/result announcements use controlled `aria-live` regions without repeated spam;
- reduced-motion users are not dependent on animation for state meaning;
- evidence status is never color-only.

## 17. Testing architecture

Use the existing Vitest stack plus Playwright Test for browser acceptance. At the reviewed Phase 3C baseline the manifest has direct `playwright@1.62.1` only and no independent checked-in import; Phase 3D replaces that top-level dependency with exact `@playwright/test@1.62.1`. This is a runner alignment only, not a general dependency upgrade.

Use:

- Vitest for catalog schemas, request validation, state/form/format logic, server handler/composer/public DTO invariants, lightweight server-rendered UI regressions, and client-transport stream/UTF-8/cancellation cases that require synthetic `ReadableStream` control;
- `@playwright/test` for real rendered Research workspace interaction, lifecycle ownership, accessibility/focus, responsive/long-content, malformed-response presentation, and network discipline;
- deterministic Playwright `/api/research` interception with schema-validated valid fixtures plus clearly separated raw invalid responses;
- a fail-closed browser network guard that permits loopback application traffic and browser-internal `data:`/`blob:` only; no automated E2E depends on external providers, evidence sources, universities, fonts, or analytics;
- dedicated Playwright dev and production-server runs with `reuseExistingServer:false`, one worker, zero retries, and explicit repeat-each stability checks for race specs;
- existing Phase 2 tests as non-regression coverage.

Phase 3D browser files are intentionally split by concern:

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

Existing Phase 3C test files remain part of the focused acceptance set, especially `tests/phase3c-research-transport.test.ts` and `tests/phase3c-research-ui.test.ts` because Phase 3D must retain reviewed retry/clear/accessibility/refresh behavior and add the actual response-byte/fatal-UTF-8 transport regressions.

`vitest.config.mts` continues to include `tests/**/*.test.ts`, so Playwright `*.spec.ts` files are not accidentally run by `npm test`; `tsconfig.json` still typechecks them. Do not make browser tests depend on live Tavily/Brave/ROR/Gemini/Groq/OpenRouter availability.

## 18. Test seam requirements

The production route should be a tiny adapter over an injectable pure-ish handler:

```ts
export type ResearchHandlerDependencies = {
  runResearch: (
    request: ResearchRequest,
    options: Phase2ResearchOptions,
  ) => Promise<ResearchResult>;
  targetResolver: ResearchTargetResolver;
};

export function createResearchPostHandler(
  dependencies: ResearchHandlerDependencies,
): (request: Request) => Promise<Response>;
```

The injected seam must not receive provider API keys or a mutable encompassing production options object. Production binds `runPhase2Research` and catalog resolver; tests bind deterministic stubs.

Browser E2E should mock `/api/research` at the network layer rather than add a production "test mode" query parameter or environment bypass.

## 19. Verification gates

During TDD, run the smallest affected Vitest/Playwright spec first and observe red -> green for every proved defect. Do not rely on retries or arbitrary sleeps to make race tests pass.

At final Phase 3 completion, freshly run:

```text
cmd.exe /c npx.cmd vitest run tests/phase3a-research-catalog.test.ts
cmd.exe /c npx.cmd vitest run tests/phase3b-dossier-composer.test.ts tests/phase3b-research-api.test.ts
cmd.exe /c npx.cmd vitest run tests/phase3c-research-state.test.ts tests/phase3c-research-form.test.ts tests/phase3c-research-transport.test.ts tests/phase3c-research-format.test.ts tests/phase3c-research-ui.test.ts
cmd.exe /c npx.cmd playwright test
cmd.exe /c npx.cmd playwright test tests/e2e/research-races.spec.ts --repeat-each=5
cmd.exe /c npm.cmd test
cmd.exe /c npx.cmd tsc --noEmit
cmd.exe /c npm.cmd run lint
cmd.exe /c npm.cmd run build
cmd.exe /c npm.cmd audit --omit=dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:/Side Projects/UniProof/scripts/verify-workspace.ps1"
cmd.exe /c git diff --check
```

After the successful build, run the complete Playwright suite once against the built `next start` application using the Playwright-config-only `UNIPROOF_E2E_PRODUCTION=1` switch. The browser suite must use a dedicated loopback server, `reuseExistingServer:false`, one worker, zero configured retries, deterministic route barriers, and a fail-closed external-network guard.

Also require:

- manual main-agent desktop/mobile/narrow + keyboard/focus inspection;
- no page errors, unexpected app console errors, JS dialogs, popups, service-worker behavior, or external HTTP(S) browser requests;
- required viewport horizontal-overflow checks plus near-contract-max content and 500-claim stress;
- actual <=4 MiB streamed client response bound, fatal UTF-8 decoding, and stream-cancellation tests;
- strict UTF-8/control scan of changed text files;
- real provider credential-value scan against changed tracked files and final `.next` output without printing secrets;
- provider `NEXT_PUBLIC_*`, production client/Phase-2-internal, executable-evidence, persistence/query/background-retry scans;
- `.env.local` ignored/untracked verification;
- exact `@playwright/test@1.62.1` dependency/lock verification with no unrelated package upgrades;
- before/after filename+size+SHA-256 equality for all ten protected `ui-flow-screenshots/` files;
- no Playwright/test artifacts staged;
- final diff/status review against Phase 3D scope;
- requirements traceability for `docs/requirements.md` Research Mode and quality/safety requirements;
- one final defect-first review performed **inline by the main ChatGPT agent only, with zero subagents/reviewer agents**.

No live provider call is required for automated acceptance. A live end-to-end research smoke requires separate explicit user authorization after deterministic gates pass; Phase 3D itself does not deploy or publish.

## 20. Public deployment blocker

Phase 3 implementation can run locally and in non-public verification environments. Before public deployment, Phase 6 must verify:

- current deployment-function duration/runtime behavior;
- deployment-layer/durable rate limiting for `/api/research`;
- provider environment configuration;
- no secret exposure in client bundles/logs;
- live route behavior with one explicitly authorized bounded smoke;
- current source/provider terms and privacy behavior;
- browser/server error behavior under real platform timeout/cancellation.

Do not mark a publicly deployed Research endpoint safe merely because local single-flight and Phase 2 call budgets exist.

## 21. Documentation and completion state

During implementation:

- update `docs/design.md` only when actual architecture differs from this approved boundary;
- update `docs/security.md` if the implemented browser/API trust boundary introduces a new security control;
- keep `docs/planning/tasks.md` checkboxes synchronized with completed evidence, not intent;
- append verified Phase 3 decisions/results to `AGENT_MEMORY.md`;
- update `LESSONS.md` only for reusable mistakes/corrections;
- do not mark persistence/RLS/Comparison/Guide tasks complete.

Phase 3 is complete when a judge can locally use the Research mode to select a supported target, run or deterministically simulate the real Research workflow, inspect final evidence/source provenance, observe unknown/conflict/outdated/partial/failure states truthfully, use the interface by keyboard on desktop/mobile layouts, and all deterministic gates pass without weakening Phase 2 evidence contracts.

## 22. Phase 3D observed requirements traceability

| Requirement / acceptance concern | Observed evidence |
| --- | --- |
| Target search/select | `research-form.spec.ts` covers university/program search, aliases/subjects, case/punctuation normalization, AND filters, supported-only selection, owner-university binding, university-only scope, clear target, and no silent retargeting. |
| Seven Research categories | Form and lifecycle browser specs verify all seven initially selected, zero-category rejection, canonical request ordering, canonical dossier ordering, and category-state rendering. |
| Source provenance + exact supporting evidence | `research-evidence.spec.ts` verifies exact supporting text, all claim sources, representative-source-first ordering, publisher/type/retrieved metadata, and safe source links. |
| Unknown | `research-lifecycle.spec.ts` proves `succeeded` runs can contain category-level Unknown with zero claims/evidence actions and no operational-failure styling. |
| Incomplete / partial | Partial lifecycle and race specs preserve ready/unknown rows, render operational incomplete reasons, expose explicit Retry only, and make no automatic request. |
| Conflicts | `research-evidence.spec.ts` displays every competing value/evidence association and asserts no preferred/winner treatment. |
| Outdated | Evidence specs keep Outdated explicit and separate effective/academic metadata from Retrieved timestamps. |
| Anecdotal / inferred | All-ready fixtures render exact Anecdotal and Inferred claim badges; no promotion or confidence invention is performed in the UI. |
| Official links | Evidence specs assert catalog-owned official program/university hrefs plus `_blank`, `noopener noreferrer`, and `no-referrer` without navigating externally. |
| Loading | Form/accessibility specs verify one indeterminate controlled loading status, disabled mutable controls, reachable Cancel, and no fake percentage/provider stage. |
| Failed dossier | Lifecycle specs prove a valid `run.status === "failed"` remains dossier data with failed-run/incomplete-row presentation rather than a generic transport error. |
| Retry | Race/error specs prove sole retry ownership after a newer refresh error, exact immutable failed-body replay, and no blind Retry for correction-required errors. |
| Clear result | Race specs prove `Clear result` removes the preserved dossier and refresh error while preserving current editable form state. |
| Cancellation | Barrier-based race specs prove idempotent Cancel, no automatic retry, preserved inputs, stale completion immunity, and unmount abort behavior. |
| Immutable request ownership | Form/race specs prove same-tick single-flight, captured-body immutability, stale-sequence protection, exact Retry snapshot ownership, and current-form new Research ownership. |
| Keyboard / accessibility | Accessibility/evidence specs verify a keyboard-visible skip link that bypasses repeated sticky navigation into the focusable `main-content` target, one main landmark, labels, `aria-current`, exact error associations, no positive tabindex, visible focus, full desktop/mobile keyboard reachability, modal trap/Escape/return, controlled announcements, practical target geometry, reduced motion, and sticky-header non-obscuration at 320/375/390 px. |
| Responsive layout | `research-responsive.spec.ts` verifies <=1 px horizontal overflow at 320x740, 375x812, 390x844, 768x1024, 1024x768, and 1440x900 with near-contract-max content, 12 sources, and 500 claims. |
| Preserved input | Form/error/race specs verify editable input survives recoverable server errors, cancellation, Retry/new-request divergence, and Clear result. |
| No invented values | Evidence specs preserve string/number/boolean scalar meaning, including numeric-looking string `007`, and assert no winner, conversion, inferred date, or confidence presentation. |
| Client response bound | Phase 3C transport regressions verify actual streamed >4 MiB rejection with missing/dishonest length, exact 4 MiB size acceptance, fatal invalid-UTF-8 rejection, abort-during-read cancellation, and non-blocking reader cleanup. |
| No external browser network | Every Playwright test installs a fail-closed loopback/data/blob-only guard plus page/console/dialog/popup guards; both 66-test dev and 66-test built-app suites completed with zero unexpected external HTTP(S) requests. |
| Acceptance-harness safety | `tests/playwright-config-safety.test.ts` proves inherited dev-harness IDs cannot traverse outside `output/playwright`; `tests/playwright-route-controller.test.ts` plus E2E teardown require every queued expected Research reply to be consumed, while malformed JSON objects use an explicitly unvalidated fixture path. |
| Protected screenshot integrity | Ten `ui-flow-screenshots/` files were hashed by filename/size/SHA-256 before the publication review and are rechecked after code/docs freeze; the implementation-time comparison was already exactly equal 10/10. |
