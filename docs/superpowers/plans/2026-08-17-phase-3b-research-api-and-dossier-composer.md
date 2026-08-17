# Phase 3B — Research API and Dossier Composer Implementation Plan

> **Execution policy:** Follow `AGENTS.md` model-specific delegation. GLM-5.3 Max executes this plan entirely in the main agent with no subagents. Native OpenAI GPT models retain the required final read-only review-agent step after local gates. Steps use checkbox (`- [ ]`) syntax for tracking.

**Implementation status:** complete and independently reviewed on 2026-08-17. The canonical completion ledger is `docs/planning/tasks.md`; the checkboxes below remain the reusable implementation recipe.

**Goal:** Add a bounded same-origin server endpoint that validates a supported Research request, invokes `runPhase2Research` exactly once with catalog identity resolution and cancellation, then projects the validated Phase 2 result into the strict client-safe dossier contract from Phase 3A.

**Architecture:** The Next.js route is a tiny Node-runtime adapter over an injectable server handler. The handler owns bounded HTTP parsing/origin/input checks and calls Phase 2. A separate deterministic composer owns server-only `ResearchResult -> ResearchDossier` projection. The full Phase 2 result never crosses into browser code.

**Tech Stack:** Next.js 16 App Router Route Handlers, Web `Request`/`Response`, Node runtime, TypeScript, Zod 4, Vitest. No new packages, no persistence, no background jobs.

## Global Constraints

- Phase 3A must be complete and its public contracts/catalog green before implementation begins.
- Read `LESSONS.md` first.
- Preserve `runPhase2Research` and Phase 2 evidence semantics.
- No provider API key may appear in the public handler contract, request schema, test seam, response, or log.
- Automated tests use injected Phase 2 results only; zero live Tavily/Brave/ROR/Gemini/Groq/OpenRouter calls.
- No Supabase writes, RLS, auth, durable cache, job queue, polling endpoint, deployment, or Comparison/Guide work.
- `ui-flow-screenshots/` remains protected.

---

## File map

Create:

```text
lib/research/mode/read-bounded-request.ts
lib/research/mode/compose-dossier.ts
lib/research/mode/handler.ts
app/api/research/route.ts
tests/phase3b-dossier-composer.test.ts
tests/phase3b-research-api.test.ts
```

Modify only if required by proven implementation behavior:

```text
lib/research/mode/public-contracts.ts  # only stricter compatible refinements found during TDD
docs/security.md                       # record actual endpoint boundary/control after implementation
docs/design.md                         # only if actual architecture differs from approved Phase 3 plan
docs/planning/tasks.md
AGENT_MEMORY.md
LESSONS.md
```

Do not modify Phase 2 contracts to paper over a presentation/HTTP problem.

---

## Task 1 — Build bounded JSON request-body parsing

### Files

- Create: `lib/research/mode/read-bounded-request.ts`
- Create/modify: `tests/phase3b-research-api.test.ts`

Use a hard Phase 3 HTTP request ceiling of **16 KiB**. A normal Research request is far smaller; the bound is for abuse/failure containment.

### Step 1: Write failing tests

Cover:

- [ ] `application/json` accepted;
- [ ] `application/json; charset=utf-8` accepted case-insensitively;
- [ ] missing/non-JSON content type rejected before parsing;
- [ ] declared `Content-Length > 16 KiB` rejected without reading body;
- [ ] invalid/non-integer/negative `Content-Length` treated conservatively as invalid input rather than trusted;
- [ ] absent Content-Length uses streaming byte count;
- [ ] dishonest Content-Length smaller than actual is caught by streaming bound;
- [ ] exactly-at-limit body accepted if otherwise valid;
- [ ] over-limit streaming body stops/cancels reader and returns `request-too-large`;
- [ ] invalid UTF-8 rejected as `invalid-json`/invalid body without replacement decoding;
- [ ] malformed JSON rejected;
- [ ] primitive/array JSON rejected later by strict object schema;
- [ ] pre-aborted request does not continue reading indefinitely.

### Step 2: Verify red

```text
cmd.exe /c npx.cmd vitest run tests/phase3b-research-api.test.ts
```

### Step 3: Implement a byte-bounded reader

Recommended contract:

```ts
export const RESEARCH_MODE_MAX_REQUEST_BYTES = 16 * 1024;

type BoundedJsonReadResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      code: "invalid-content-type" | "request-too-large" | "invalid-json";
    };

export async function readBoundedJsonRequest(
  request: Request,
): Promise<BoundedJsonReadResult>;
```

Implementation requirements:

- [ ] validate Content-Type before body read;
- [ ] parse Content-Length with `Number.isSafeInteger` and nonnegative checks;
- [ ] if `request.body === null`, decode empty body and return invalid JSON;
- [ ] use `ReadableStreamDefaultReader` and count actual `Uint8Array.byteLength`;
- [ ] stop once cumulative bytes exceed the ceiling;
- [ ] best-effort/nonblocking reader cancellation on reject, mirroring the Phase 2 failure-path lesson;
- [ ] decode with `new TextDecoder("utf-8", { fatal: true })` so invalid bytes do not become U+FFFD;
- [ ] never include body fragments in error messages/logs;
- [ ] check `request.signal.aborted` before/while reading and stop work.

Do not use unbounded `request.json()` as the first public-body operation.

### Step 4: Verify green

Run focused tests before continuing.

---

## Task 2 — Lock same-origin and sensitive-input guards

### Files

- Create/modify: `lib/research/mode/handler.ts`
- Modify: `tests/phase3b-research-api.test.ts`

### Step 1: Write failing guard tests

Cover:

- [ ] matching `Origin` accepted;
- [ ] mismatched Origin rejected with 403 envelope;
- [ ] malformed Origin rejected;
- [ ] missing Origin permitted for direct/server/test clients because JSON/content-type validation still applies;
- [ ] `Sec-Fetch-Site: cross-site` rejected when present;
- [ ] `same-origin`, `same-site`, `none`, or missing fetch-site do not alone reject;
- [ ] sensitive/private content in any caller-controlled free-text research field (`question`, `intake`, or `academicYear`) rejects before `runResearch` is invoked;
- [ ] harmless public research text is accepted;
- [ ] no raw rejected free-text value is echoed in the rejection response;
- [ ] no caller provider/API-key fields can survive strict request validation.

### Step 2: Implement origin guard

Recommended:

```ts
function isAllowedResearchOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (origin === null) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
```

Do not use `Referer` as the primary trust decision.

### Step 3: Reuse Phase 2 sensitive-input detection server-side

- [ ] Use the existing public-research sensitive-data detector from the discovery/query planning layer rather than introducing a looser second heuristic.
- [ ] Apply the detector independently to each present caller-controlled free-text field: `question`, `intake`, and `academicYear`; reject the request with public `sensitive-input` if any one is sensitive.
- [ ] Still keep the Phase 2 defensive exclusion in place; Phase 3 rejection is defense in depth, not a replacement.

### Step 4: Verify no dispatch on rejection

Every guard test must assert injected `runResearch` call count remains zero.

---

## Task 3 — Build the deterministic dossier composer

### Files

- Create: `lib/research/mode/compose-dossier.ts`
- Create: `tests/phase3b-dossier-composer.test.ts`

### Step 1: Build strict Phase 2 fixtures and write red tests

Use `researchResultSchema.parse()` to construct every positive fixture. Do not hand-wave invalid Phase 2 records as valid input.

Required fixtures:

1. succeeded one-category verified;
2. all seven categories ready;
3. ready + unknown + incomplete partial run;
4. failed run with all categories incomplete;
5. conflicting claims;
6. outdated claim;
7. each non-unknown evidence status;
8. one claim with multiple source IDs;
9. representative claim with `sourceId` explicitly set;
10. representative claim with `sourceId` omitted but candidate provenance resolves the exact supporting text;
11. long but contract-valid strings/Unicode;
12. boolean/number/string scalar values.

Tests must prove:

- [ ] composer re-validates the incoming Phase 2 result even if TypeScript says `ResearchResult`;
- [ ] target identity/official links come from the selected catalog record, not provider output;
- [ ] every final claim's application-owned university identity matches the selected catalog university; program-scoped runs require the selected program identity, while university-only dossiers reject program-scoped final claims;
- [ ] only requested categories appear;
- [ ] categories appear in canonical order;
- [ ] processed claim-bearing -> `ready`;
- [ ] processed zero-claim -> `unknown`;
- [ ] unprocessed -> `incomplete`;
- [ ] incomplete has zero claims and no explanation;
- [ ] unknown has fallback zero-reference explanation;
- [ ] ready explanation references same-category claims;
- [ ] `hasConflict`/`hasOutdated` exactly match final claim state;
- [ ] claim scalar value/type unchanged;
- [ ] claim sourceIds unchanged and deterministic;
- [ ] representative source resolved by exact candidate-backed supporting text;
- [ ] public source list includes only sources referenced by final public claims, not every discovered/retrieved source;
- [ ] public sources are unique and deterministic;
- [ ] no document/candidate/provider-attempt/raw-warning data appears in serialized dossier;
- [ ] failed/partial/succeeded terminal status preserved;
- [ ] user-facing category failure messages are stable/sanitized.

### Step 2: Implement representative-source resolution

Required algorithm:

```ts
function resolveRepresentativeSourceId(
  claim: VerifiedClaim,
  candidatesById: ReadonlyMap<string, ClaimCandidate>,
): string {
  const candidates = claim.candidateIds.map((id) => {
    const candidate = candidatesById.get(id);
    if (candidate === undefined) throw new DossierInvariantError();
    return candidate;
  });

  const representative = candidates.find((candidate) =>
    candidate.supportingText === claim.supportingText &&
    (claim.sourceId === undefined || candidate.sourceId === claim.sourceId)
  );

  if (representative === undefined) throw new DossierInvariantError();
  return representative.sourceId;
}
```

Do not choose the first `sourceIds[0]` unless it is actually the representative candidate source.

### Step 3: Implement failure selection/mapping

Although current Phase 2 finalization emits one terminal failure per unprocessed category, the composer should remain deterministic if a future valid result carries multiple category failures.

Recommended internal precedence:

```text
cancelled
> timeout
> provider-rate-limit
> source-limit
> normalization
> retrieval
> source-discovery
> provider-error
> unknown
```

Map to fixed public messages. Do not forward `failure.message` from Phase 2.

A global unexpected `validation` failure from a supposedly valid supported Phase 3 request is an internal invariant problem; do not present it as an ordinary category failure.

### Step 4: Minimal public source projection

For each final claim's `sourceIds` only:

```ts
{
  id,
  url,
  title,
  publisher,
  sourceType,
  retrievedAt,
  effectiveDate,
  academicYear,
}
```

Do not include:

- `discoveryProvider`;
- `discoveryQueryId`;
- documents;
- candidate metadata;
- provider/model information.

### Step 5: Validate outgoing dossier

- [ ] Finish composition with `researchDossierSchema.parse(composed)`.
- [ ] If projection violates the public schema, throw an internal invariant error rather than deleting/rewriting evidence to fit.

### Step 6: Bound serialized response

Use a final serialized public-response ceiling of **4 MiB** as a defensive HTTP envelope bound.

- [ ] Compose and validate first.
- [ ] Serialize once.
- [ ] measure UTF-8 bytes with `TextEncoder`/`Buffer.byteLength` server-side;
- [ ] if the validated dossier still exceeds 4 MiB, fail closed with sanitized internal error instead of truncating claims/evidence/source IDs.

Do not silently slice factual claims to satisfy an HTTP size limit.

---

## Task 4 — Build the injectable POST handler

### Files

- Modify: `lib/research/mode/handler.ts`
- Modify: `tests/phase3b-research-api.test.ts`

### Step 1: Define the testable dependency boundary

Recommended:

```ts
export type ResearchHandlerDependencies = {
  catalog: ResearchCatalog;
  targetResolver: ResearchTargetResolver;
  runResearch: (
    input: unknown,
    options: Phase2ResearchOptions,
  ) => Promise<ResearchResult>;
};

export function createResearchPostHandler(
  dependencies: ResearchHandlerDependencies,
): (request: Request) => Promise<Response>;
```

No provider keys or mutable server options appear here.

### Step 2: Write failing full-handler tests

Cover exact HTTP behavior:

| Case | Status | Body |
| --- | ---: | --- |
| valid Phase 2 succeeded/partial/failed result | 200 | `{ ok:true, dossier }` |
| wrong Content-Type | 415 | strict error envelope |
| oversized body | 413 | strict error envelope |
| malformed JSON/invalid public request | 400 | strict error envelope |
| unsupported university/program/mismatch | 404 or 400 by documented rule | strict `unsupported-target` envelope |
| cross-origin | 403 | `forbidden-origin` |
| sensitive question | 400 | `sensitive-input` |
| unexpected internal throw | 500 | `internal-error` |

Choose and freeze one status for program-university mismatch. Preferred: **400** because both IDs may exist but the submitted combination is invalid; use **404** only for unknown catalog IDs.

Tests must also assert:

- [ ] `runResearch` invoked exactly once for a valid request;
- [ ] `runResearch` never invoked for invalid request/target/origin/body/sensitive input;
- [ ] the Phase 2 input uses only structured target IDs + categories/question/intake/year;
- [ ] names and official URLs are supplied through the catalog resolver, not copied into the public request;
- [ ] `request.signal` is the exact signal passed to Phase 2 options;
- [ ] target resolver is provided through `options.discovery.targetResolver`;
- [ ] no API keys appear in the options object supplied by the handler;
- [ ] no retry loop wraps `runResearch`;
- [ ] no provider error text/stack appears in HTTP 500 body;
- [ ] every response uses `Cache-Control: no-store`;
- [ ] error responses also validate against public response schema.

### Step 3: Map the public request to Phase 2

Recommended transformation:

```ts
const phase2Request = {
  target: {
    university: { id: request.universityId },
    ...(request.programId === undefined
      ? {}
      : {
          program: {
            id: request.programId,
            universityId: request.universityId,
          },
        }),
  },
  categories: request.categories,
  question: request.question,
  intake: request.intake,
  academicYear: request.academicYear,
};
```

Then validate with `researchRequestSchema` server-side before dispatch. If this internal transformation does not parse, treat it as an implementation invariant error, not user fault after the public schema/catalog already passed.

### Step 4: Invoke Phase 2 once

```ts
const result = await dependencies.runResearch(phase2Request, {
  signal: request.signal,
  discovery: {
    targetResolver: dependencies.targetResolver,
  },
});
```

Do not pass provider keys. Production Phase 2 already owns server environment lookup and fallback policy.

### Step 5: Handle request cancellation truthfully

- [ ] Do not catch an abort and automatically start a second Phase 2 run.
- [ ] If Phase 2 returns a terminal cancelled result before the socket disappears, compose it normally as a failed/partial dossier.
- [ ] If the request body/read or runtime abort prevents producing a response, stop work; do not invent durable cancellation status.

Tests should primarily prove zero retry and exact signal propagation; do not depend on a nonstandard 499 response contract.

---

## Task 5 — Add the production Next.js Route Handler

### Files

- Create: `app/api/research/route.ts`
- Modify: `tests/phase3b-research-api.test.ts` only if a thin adapter smoke test is useful

Production route:

```ts
import { createCatalogTargetResolver } from "@/lib/research/catalog/resolver";
import { researchCatalog } from "@/lib/research/catalog/data";
import { createResearchPostHandler } from "@/lib/research/mode/handler";
import { runPhase2Research } from "@/lib/research/orchestration";

export const runtime = "nodejs";

const post = createResearchPostHandler({
  catalog: researchCatalog,
  targetResolver: createCatalogTargetResolver(researchCatalog),
  runResearch: runPhase2Research,
});

export async function POST(request: Request): Promise<Response> {
  return post(request);
}
```

Rules:

- [ ] export POST only; do not add mutation-looking server actions for this flow;
- [ ] no `NEXT_PUBLIC_*` provider keys;
- [ ] no request-body logging;
- [ ] no raw exception logging containing source URLs/questions/provider details;
- [ ] no route-level cache of results;
- [ ] no fake job/poll endpoints;
- [ ] no hard-coded hosting duration as a correctness assumption. Re-verify current platform duration controls during deployment work; add a route `maxDuration` only if deployment configuration requires it.

---

## Task 6 — Add negative leakage and invariant tests

### Files

- Modify both Phase 3B test files

- [ ] Serialize a maximal normal dossier and assert these strings/keys are absent:

```text
providerAttempts
documents
candidateSources
candidates
discoveryQueryId
discoveryProvider
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
TAVILY_API_KEY
BRAVE_SEARCH_API_KEY
```

- [ ] Assert an injected error such as:

```text
https://source.example/private-path?token=secret
```

never appears in 500 output.

- [ ] Assert unsupported IDs are not reflected unsafely into HTML/JSON beyond a generic message.
- [ ] Assert source/supporting text containing `<script>` remains JSON text and later React-renderable text; handler/composer never emits HTML.
- [ ] Assert prototype-pollution keys / unknown nested keys are rejected by strict Zod schemas.

---

## Task 7 — Phase 3B review and verification gates

Run focused tests after each task, then:

```text
cmd.exe /c npx.cmd vitest run tests/phase3b-dossier-composer.test.ts tests/phase3b-research-api.test.ts
cmd.exe /c npm.cmd test
cmd.exe /c npx.cmd tsc --noEmit
cmd.exe /c npm.cmd run lint
cmd.exe /c npm.cmd run build
cmd.exe /c npm.cmd audit --omit=dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:/Side Projects/UniProof/scripts/verify-workspace.ps1"
cmd.exe /c git diff --check
```

Security review checklist:

- [ ] Node runtime explicitly selected.
- [ ] 16 KiB actual-body ceiling enforced without trusting Content-Length.
- [ ] strict UTF-8/JSON parsing.
- [ ] same-origin defense present.
- [ ] sensitive question rejected before dispatch.
- [ ] supported catalog membership enforced.
- [ ] exactly one Phase 2 dispatch per valid request.
- [ ] exact caller signal propagated.
- [ ] no automatic retry/background job.
- [ ] no provider keys/internal Phase 2 arrays in response.
- [ ] no raw provider/source error message leakage.
- [ ] response validated and <=4 MiB or fails closed without factual truncation.
- [ ] all responses `no-store`.
- [ ] `.env.local` remains ignored/untracked.
- [ ] public deployment still documented as blocked until durable/deployment-layer rate limit is verified.

## Phase 3B exit criteria

Phase 3B is complete when `/api/research` has a deterministic offline-tested handler that accepts only bounded same-origin supported-target requests, calls Phase 2 exactly once with cancellation/catalog resolution, returns a strict minimal dossier for every valid terminal Phase 2 lifecycle state, fails closed on broken invariants, and exposes no provider secrets or unnecessary Phase 2 internal data.
