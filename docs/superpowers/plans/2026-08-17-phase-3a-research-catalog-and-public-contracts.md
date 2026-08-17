# Phase 3A — Research Catalog and Public Contracts Implementation Plan

> **Execution policy:** Follow `AGENTS.md` model-specific delegation. GLM-5.3 Max executes this plan entirely in the main agent with no subagents. Native OpenAI GPT models retain the required final read-only review-agent step after local gates. Steps use checkbox (`- [ ]`) syntax for tracking.

**Implementation status:** complete and independently reviewed on 2026-08-17. The canonical completion ledger is `docs/planning/tasks.md`; the checkboxes below remain the reusable implementation recipe.

**Goal:** Create the client-safe supported-university/program catalog and strict public Research request/response contracts that Phase 3B–3D can depend on without importing server-only Phase 2 internals into browser code.

**Architecture:** Keep catalog identity data public and deterministic under `lib/research/catalog/`. Keep browser/API DTO schemas under `lib/research/mode/public-contracts.ts` with no `server-only` dependency. Phase 2 remains the evidence source of truth; Phase 3A adds cross-contract tests so duplicated public enums/bounds cannot silently drift.

**Tech Stack:** TypeScript, Zod 4, existing Next.js/React project, Vitest. No new packages.

## Global Constraints

- Planning baseline: `0b78648` / completed Phase 2.
- Read `LESSONS.md` first and preserve all Phase 2 evidence semantics.
- Do not modify `lib/research/contracts/research.ts` merely to make it client-importable.
- Do not add persistence, Supabase writes, RLS, auth, live research API, UI behavior, provider calls, or deployment.
- Catalog data is public identity/navigation metadata only; it is not evidence for tuition, admissions, deadlines, outcomes, or other factual research claims.
- All catalog identities/official URLs must be verified from current official sources during implementation; do not guess program existence or URLs.
- Do not stage/modify `ui-flow-screenshots/`.
- No live provider calls are needed for this subphase.

---

## File map

Create:

```text
lib/research/mode/public-contracts.ts
lib/research/catalog/schema.ts
lib/research/catalog/data.ts
lib/research/catalog/search.ts
lib/research/catalog/resolver.ts
lib/research/catalog/index.ts
tests/phase3a-research-catalog.test.ts
```

Update only when implementation evidence exists:

```text
docs/data-sources.md             # catalog identity/official-link verification note
docs/planning/tasks.md           # mark Phase 3A items complete only after gates pass
AGENT_MEMORY.md                  # append verified implementation closure
LESSONS.md                       # only if a reusable lesson occurs
```

Responsibilities:

- `public-contracts.ts`: browser-safe schemas/types for categories, request, dossier, response, public errors.
- `schema.ts`: supported catalog schemas/invariants.
- `data.ts`: checked-in supported university/program identity records only.
- `search.ts`: pure deterministic search/filter functions.
- `resolver.ts`: maps stable catalog IDs to the Phase 2 `ResearchTargetResolver` shape.
- `index.ts`: intentional public exports; no accidental server/provider exports.
- `tests/phase3a-research-catalog.test.ts`: contract, catalog, search, cross-contract, and resolver coverage.

---

## Task 1 — Lock the client-safe category/evidence/request contract

### Files

- Create: `lib/research/mode/public-contracts.ts`
- Create: `tests/phase3a-research-catalog.test.ts`

### Step 1: Write failing contract tests

- [ ] Add tests proving the public category enum is exactly these seven values in this order:

```ts
[
  "admissions",
  "tuition",
  "scholarships",
  "program-structure",
  "research",
  "outcomes",
  "support",
]
```

- [ ] Add tests proving final public claim statuses allow:

```ts
[
  "verified",
  "corroborated",
  "university-reported",
  "conflicting",
  "anecdotal",
  "inferred",
  "outdated",
]
```

and reject claim-level `unknown`.

- [ ] Add request tests for:
  - university ID required;
  - optional program ID;
  - 1–7 unique categories;
  - category canonicalization;
  - question/intake/year trimmed;
  - blank-after-trim optional values rejected;
  - unknown keys rejected;
  - names/URLs/provider fields rejected;
  - maximum and over-limit public question;
  - Unicode/astral text remains well formed.

Use a public question ceiling smaller than or equal to Phase 2's current 600 characters. Preferred public ceiling: **500 UTF-16 units**. This leaves server headroom and avoids importing the server-only limit module.

Expected test example:

```ts
expect(researchModeRequestSchema.parse({
  universityId: "uni-example",
  categories: ["tuition", "admissions", "tuition"],
}).categories).toEqual(["admissions", "tuition"]);
```

### Step 2: Verify tests fail

- [ ] Run:

```text
cmd.exe /c npx.cmd vitest run tests/phase3a-research-catalog.test.ts
```

Expected: failure because the public contracts do not exist yet.

### Step 3: Implement the public enum/request schemas

- [ ] Implement a browser-safe module with no import from `lib/security/research-limits.ts` and no import from the full Phase 2 `research.ts` contract.

Required shape:

```ts
import { z } from "zod";

export const researchModeCategoryOrder = [
  "admissions",
  "tuition",
  "scholarships",
  "program-structure",
  "research",
  "outcomes",
  "support",
] as const;

export const researchModeCategorySchema = z.enum(researchModeCategoryOrder);
export type ResearchModeCategory = z.infer<typeof researchModeCategorySchema>;

export const publicClaimEvidenceStatusSchema = z.enum([
  "verified",
  "corroborated",
  "university-reported",
  "conflicting",
  "anecdotal",
  "inferred",
  "outdated",
]);

export const RESEARCH_MODE_MAX_QUESTION_UTF16 = 500;
```

- [ ] Implement `canonicalizeResearchModeCategories()` by fixed order, not request order.
- [ ] Implement `researchModeRequestSchema` as `.strict()` and return a canonicalized category array.
- [ ] Bound public IDs to <=120 UTF-16 units and optional intake/year to <=40, matching or narrowing Phase 2.
- [ ] Do not add locale, provider, URL, model, retry, or budget inputs.

### Step 4: Cross-contract compatibility tests

The test file is server-side Vitest, so it may import Phase 2 contracts through the existing `server-only` test shim.

- [ ] Assert `researchModeCategoryOrder` exactly equals `researchCategorySchema.options` and Phase 2 `researchCategoryOrder`.
- [ ] Assert every public claim status parses as a Phase 2 evidence status and `unknown` is intentionally excluded from final public claims.
- [ ] Construct maximum-valid public requests and prove the transformed Phase 2 request parses after catalog names are resolved.
- [ ] Prove public request bounds never exceed Phase 2 bounds; if Phase 2 later shrinks, this test must fail instead of allowing drift.

### Step 5: Verify green

- [ ] Run focused tests and typecheck.

---

## Task 2 — Define strict public dossier/response schemas

### Files

- Modify: `lib/research/mode/public-contracts.ts`
- Modify: `tests/phase3a-research-catalog.test.ts`

### Step 1: Add failing schema tests before implementation

Cover:

- [ ] source records require a validated public HTTP(S) URL, ID/title/publisher/sourceType/retrievedAt and bounded optional period metadata;
- [ ] final public claim requires representative source, sourceIds, exact supporting text, and non-unknown evidence status;
- [ ] unknown category row has zero claims and a zero-reference explanation;
- [ ] ready category has >=1 claim and one explanation;
- [ ] incomplete category has no claims and no explanation;
- [ ] category rows are unique and canonical;
- [ ] processed/unprocessed rows partition requested categories;
- [ ] every claim source ID resolves to a public source;
- [ ] every exposed public source is referenced by at least one final public claim;
- [ ] representative source is in the claim source list;
- [ ] terminal run status is coherent with processed/incomplete category rows and run timestamps are monotonic;
- [ ] total public claims <=500 across all category rows;
- [ ] total sources <=12;
- [ ] all source IDs unique;
- [ ] explanation refs resolve to same-category public claim IDs;
- [ ] `hasConflict` requires a conflicting claim;
- [ ] `hasOutdated` requires an outdated claim;
- [ ] unknown/incomplete cannot report conflict/outdated flags;
- [ ] raw Phase 2-only keys (`documents`, `candidates`, `candidateSources`, `providerAttempts`, `warnings`) are rejected by strict DTO schemas;
- [ ] response envelope distinguishes `{ ok: true, dossier }` from `{ ok: false, error }`.

### Step 2: Implement bounded public DTOs

Use explicit bounds derived from Phase 2 contracts, not arbitrary unbounded strings. `publicHttpUrlSchema` must mirror the Phase 2 public-source transport shape relevant to display: valid `http:` or `https:` URL, no embedded username/password. Do not narrow evidence sources to HTTPS because Phase 2 can validly return a public HTTP source; the **catalog's canonical official university/program URLs remain HTTPS-only**. Reuse the browser-safe `sourceTypeSchema` from `@/lib/validation/evidence` rather than duplicating source-type strings.

Implement `publicHttpUrlSchema` explicitly as `z.url().refine(...)`: parse with `new URL(value)`, require protocol `http:` or `https:`, `username === ""`, and `password === ""`; return false on parse/refinement failure and do not perform DNS/network checks in the browser-safe schema.

Required public source shape:

```ts
export const publicResearchSourceSchema = z.object({
  id: publicIdSchema,
  url: publicHttpUrlSchema,
  title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(200),
  sourceType: sourceTypeSchema,
  retrievedAt: z.iso.datetime(),
  effectiveDate: z.iso.date().optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
}).strict();
```

Required claim shape:

```ts
export const publicResearchClaimSchema = z.object({
  id: publicIdSchema,
  category: researchModeCategorySchema,
  property: z.string().trim().min(1).max(200),
  value: z.union([
    z.string().trim().min(1).max(500),
    z.number().finite(),
    z.boolean(),
  ]),
  unit: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().length(3).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
  effectiveDate: z.iso.date().optional(),
  intake: z.string().trim().min(1).max(40).optional(),
  verificationStatus: publicClaimEvidenceStatusSchema,
  representativeSourceId: publicIdSchema,
  sourceIds: z.array(publicIdSchema).min(1).max(12),
  supportingText: z.string().trim().min(1).max(2_000),
}).strict();
```

- [ ] Preserve claim scalar type. Do not transform numeric strings to numbers.
- [ ] Currency may uppercase for presentation consistency but must not infer currency when absent.
- [ ] Explanation max: 600 UTF-16 units.
- [ ] `publicEvidenceStatusCountsSchema` is a strict object with exactly seven nonnegative integer fields: `verified`, `corroborated`, `university-reported`, `conflicting`, `anecdotal`, `inferred`, `outdated`. It has no `unknown` field because unknown is category lifecycle, not a final-claim status.
- [ ] Public error messages max: 300 UTF-16 units.

### Step 3: Implement cross-record dossier refinement

- [ ] Enforce:
  - unique source IDs;
  - unique category rows;
  - exact canonical row order;
  - exact processed/unprocessed partition;
  - claim category equals row category;
  - every claim source resolves;
  - explanation IDs resolve to same-category claims;
  - status-count totals equal claim totals;
  - no public unknown claim count;
  - ready/unknown/incomplete row semantics.

### Step 4: Implement stable public transport errors

Recommended codes:

```ts
export const publicResearchTransportErrorCodeSchema = z.enum([
  "invalid-content-type",
  "request-too-large",
  "invalid-json",
  "invalid-request",
  "unsupported-target",
  "sensitive-input",
  "forbidden-origin",
  "internal-error",
]);

export const publicResearchTransportErrorSchema = z.object({
  code: publicResearchTransportErrorCodeSchema,
  message: z.string().trim().min(1).max(300),
}).strict();

export const researchModeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), dossier: researchDossierSchema }).strict(),
  z.object({ ok: z.literal(false), error: publicResearchTransportErrorSchema }).strict(),
]);

export type PublicResearchTransportError = z.infer<typeof publicResearchTransportErrorSchema>;
export type ResearchModeResponse = z.infer<typeof researchModeResponseSchema>;
```

Do not include provider names or raw upstream failures in transport errors. `network-error` and `invalid-response` are **client controller states added in Phase 3C**, not valid server response codes. Cancellation also remains a controller/run-lifecycle transition rather than a transport-error code.

### Step 5: Verify focused tests

- [ ] Focused suite passes before catalog data work starts.

---

## Task 3 — Define supported catalog schemas and invariants

### Files

- Create: `lib/research/catalog/schema.ts`
- Modify: `tests/phase3a-research-catalog.test.ts`

### Step 1: Write failing catalog-schema tests

Cover:

- [ ] university IDs/names/country/HTTPS website required;
- [ ] country limited to `US | GB | TH` for the MVP catalog;
- [ ] optional ROR URL is HTTPS and under `ror.org`;
- [ ] program ID/universityId/name/degree/subject/official HTTPS URL required;
- [ ] bachelor/master only;
- [ ] aliases are trimmed, unique after normalized comparison, bounded, and optional;
- [ ] no unknown keys;
- [ ] arrays enforce 10–15 universities after actual data is present;
- [ ] university IDs globally unique;
- [ ] program IDs globally unique;
- [ ] every program universityId exists;
- [ ] duplicate normalized university name+country rejected;
- [ ] duplicate normalized program name+degree under same university rejected.

### Step 2: Implement schemas

Implement these exact exports with no generated or placeholder records:

- [ ] `researchCatalogUniversitySchema`: strict object with `id` (trimmed 1–120), `name` (trimmed 1–200), `countryCode` (`US | GB | TH`), canonical HTTPS `websiteUrl` with no embedded credentials, optional canonical HTTPS `rorId` whose hostname is exactly `ror.org`, and optional unique normalized aliases (each trimmed 1–120, max 12).
- [ ] `researchCatalogProgramSchema`: strict object with `id` (trimmed 1–120), `universityId` (trimmed 1–120), `name` (trimmed 1–200), `degreeLevel` (`bachelor | master`), `subjectArea` (trimmed 1–120), canonical HTTPS `officialUrl` with no embedded credentials, and optional unique normalized aliases (each trimmed 1–120, max 12).
- [ ] `researchCatalogSchema`: strict object with `universities` (10–15) and `programs` (minimum 10; bounded to a deliberate ceiling of 60 for the MVP), followed by cross-record refinement for global ID uniqueness, program ownership, duplicate normalized university identity, and duplicate normalized program identity under one university.
- [ ] `ResearchCatalogUniversity`, `ResearchCatalogProgram`, and `ResearchCatalog` inferred types.
- [ ] `normalizeResearchCatalogText(value: string)`: NFKC, locale-stable lowercasing (`toLocaleLowerCase("en-US")`), collapse non-letter/non-number runs to one space, trim, collapse whitespace. This helper is used for alias uniqueness, duplicate identity checks, and search.
- [ ] `isCanonicalHttpsUrl(value: string)`: parses via `URL`, requires `https:`, no username/password, non-empty hostname, and returns only a boolean; schema transformations must not silently rewrite a catalog URL supplied in source data.

Keep the module browser-safe: no `server-only`, Node built-ins, provider adapters, environment variables, or imports from Phase 2 server-owned limit modules.

---

## Task 4 — Populate the verified MVP catalog

### Files

- Create: `lib/research/catalog/data.ts`
- Modify: `docs/data-sources.md`
- Modify: `tests/phase3a-research-catalog.test.ts`

This task requires current official-source research because university/program URLs and program availability can change.

### Step 1: Select 10–15 supported universities under fixed coverage rules

The final checked-in set must:

- [ ] contain 10–15 universities total;
- [ ] include all three MVP countries: United States, United Kingdom, Thailand;
- [ ] avoid making the catalog dominated by one country;
- [ ] include CS/AI/Data Science or directly related computing programs;
- [ ] include bachelor programs and taught-master programs where official offerings are available;
- [ ] prefer institutions with clear public official pages that Phase 2 can research without authentication/paywalls;
- [ ] avoid catalog entries whose relevant program identity cannot be verified from an official page.

Do not invent exact program names to hit a quota. If one selected institution lacks a verified relevant program, replace it with another institution rather than guessing.

### Step 2: Verify every identity from official sources

For each university:

- [ ] canonical official name;
- [ ] country code;
- [ ] canonical university website URL;
- [ ] ROR ID/URL when confidently verified.

For each program:

- [ ] exact official program name;
- [ ] owning university;
- [ ] degree level;
- [ ] subject area label used only for catalog filtering;
- [ ] canonical official program page URL.

No tuition/deadline/admissions/outcome facts belong in this file.

### Step 3: Check in one parsed constant

- [ ] In `data.ts`, declare one literal `rawCatalog` object whose `universities` and `programs` arrays contain the complete explicitly verified records selected in Steps 1–2. Do not generate records, synthesize IDs from array indexes, leave stub records, or use environment-dependent data.
- [ ] Export only the parsed value:

```ts
export const researchCatalog = researchCatalogSchema.parse(rawCatalog);
```

Parsing at module load makes invalid checked-in catalog data fail fast in development/build. The source arrays themselves must be reviewable record-by-record in the diff.

### Step 4: Document verification provenance at catalog level

Update `docs/data-sources.md` with:

- [ ] supported catalog purpose;
- [ ] implementation verification date;
- [ ] statement that URLs/identities were checked against official pages;
- [ ] explicit statement that catalog verification date is not factual claim freshness;
- [ ] requirement to re-check broken/redirected official links before release.

Do not copy long official-source text into docs.

### Step 5: Add deterministic catalog-data tests

- [ ] Parse the production catalog.
- [ ] Assert country and degree coverage.
- [ ] Assert every program resolves to an existing university.
- [ ] Assert every official URL uses HTTPS.
- [ ] Assert no duplicate normalized identities.
- [ ] Assert catalog order is deterministic; choose one documented order (preferred: university country -> normalized university name -> stable ID, programs by university -> degree -> normalized name -> ID).

---

## Task 5 — Implement deterministic client-side catalog search/filter

### Files

- Create: `lib/research/catalog/search.ts`
- Modify: `tests/phase3a-research-catalog.test.ts`

### Step 1: Write failing search tests

Cover:

- [ ] empty query returns deterministic catalog order;
- [ ] case-insensitive match;
- [ ] NFKC Unicode normalization;
- [ ] punctuation/whitespace collapse;
- [ ] alias match;
- [ ] university name match returns its programs;
- [ ] program name/subject match returns the matching program(s) and their owning university record(s) in the same result;
- [ ] country filter;
- [ ] degree filter;
- [ ] subject filter;
- [ ] combined filters are ANDed;
- [ ] unsupported query returns empty results;
- [ ] no fuzzy typo correction silently retargets another institution;
- [ ] equivalent input permutations return identical result order;
- [ ] empty/whitespace query does not throw.

### Step 2: Implement pure helpers

Recommended API:

```ts
export type ResearchCatalogFilters = {
  query?: string;
  countryCode?: "US" | "GB" | "TH";
  degreeLevel?: "bachelor" | "master";
  subjectArea?: string;
};

export type ResearchCatalogSearchResult = {
  universities: readonly ResearchCatalogUniversity[];
  programs: readonly ResearchCatalogProgram[];
};

export function searchResearchCatalog(
  catalog: ResearchCatalog,
  filters: ResearchCatalogFilters,
): ResearchCatalogSearchResult;
```

- [ ] Do not use locale-dependent fuzzy libraries.
- [ ] Do not mutate production catalog arrays.
- [ ] Return stable sorting with ID tie-breakers.

---

## Task 6 — Implement the catalog-backed Phase 2 target resolver

### Files

- Create: `lib/research/catalog/resolver.ts`
- Create: `lib/research/catalog/index.ts`
- Modify: `tests/phase3a-research-catalog.test.ts`

### Step 1: Write failing resolver tests

Cover:

- [ ] known university ID -> exact `ResearchIdentityRecord.university`;
- [ ] known program ID -> exact `ResearchIdentityRecord.program`;
- [ ] unknown ID -> `undefined`;
- [ ] program university ID is preserved;
- [ ] official URLs are preserved exactly;
- [ ] ROR ID is preserved when present;
- [ ] resolver performs no network call;
- [ ] resolver result is stable across calls;
- [ ] resolver does not accept names as IDs.

### Step 2: Implement resolver as an explicit server-only module

`lib/research/catalog/resolver.ts` MUST start with `import "server-only";`. The client does not need a Phase 2 resolver; only the server route does.

Use this complete mapping behavior:

```ts
import "server-only";

import type { ResearchTargetResolver } from "@/lib/research/discovery/types";
import { researchCatalog } from "./data";
import type { ResearchCatalog } from "./schema";

export function createCatalogTargetResolver(
  catalog: ResearchCatalog = researchCatalog,
): ResearchTargetResolver {
  const universities = new Map(catalog.universities.map((item) => [item.id, item]));
  const programs = new Map(catalog.programs.map((item) => [item.id, item]));

  return {
    resolveUniversity: (id) => {
      const item = universities.get(id);
      if (item === undefined) return undefined;
      return {
        id: item.id,
        name: item.name,
        countryCode: item.countryCode,
        websiteUrl: item.websiteUrl,
        rorId: item.rorId,
      };
    },
    resolveProgram: (id) => {
      const item = programs.get(id);
      if (item === undefined) return undefined;
      return {
        id: item.id,
        universityId: item.universityId,
        name: item.name,
        degreeLevel: item.degreeLevel,
        subjectArea: item.subjectArea,
        officialUrl: item.officialUrl,
      };
    },
  };
}
```

No resolver call performs network I/O or fuzzy matching.

### Step 3: Define client-safe exports deliberately

`lib/research/catalog/index.ts` is browser-safe and MUST NOT re-export `resolver.ts`:

```ts
export { researchCatalog } from "./data";
export { searchResearchCatalog } from "./search";
export {
  researchCatalogProgramSchema,
  researchCatalogSchema,
  researchCatalogUniversitySchema,
} from "./schema";
export type {
  ResearchCatalog,
  ResearchCatalogProgram,
  ResearchCatalogUniversity,
} from "./schema";
```

The Phase 3B server route imports `createCatalogTargetResolver` directly from `@/lib/research/catalog/resolver`. This creates a hard client/server boundary instead of relying on bundler tree-shaking to protect server-only Phase 2 coupling.

---

## Task 7 — Phase 3A defensive review and gates

- [ ] Search changed files for `TODO`, `TBD`, `FIXME`, placeholder university/program records, example.invalid URLs, and illustrative identity values. Production catalog must contain none.
- [ ] Search client-importable modules for `process.env`, provider key names, `server-only`, Phase 2 provider adapters, and Supabase service-role usage. Expect zero.
- [ ] Verify `public-contracts.ts` does not import `lib/security/research-limits.ts` or full Phase 2 `research.ts`.
- [ ] Verify every catalog data URL is public identity/navigation metadata only.
- [ ] Re-run all Phase 2 tests to ensure no accidental contract regression.
- [ ] Run:

```text
cmd.exe /c npx.cmd vitest run tests/phase3a-research-catalog.test.ts
cmd.exe /c npm.cmd test
cmd.exe /c npx.cmd tsc --noEmit
cmd.exe /c npm.cmd run lint
cmd.exe /c npm.cmd run build
cmd.exe /c git diff --check
```

- [ ] Run workspace verifier.
- [ ] Run UTF-8/control and secret/public-env scans.
- [ ] Review final diff for planning scope + Phase 3A implementation only.
- [ ] Mark Phase 3A tasks complete only after observed gate output.

## Phase 3A exit criteria

Phase 3A is complete when the repository has a verified, deterministic, public supported-program catalog; strict browser-safe Research request/dossier/response schemas; deterministic search/filter behavior; a no-network catalog target resolver; cross-contract tests proving compatibility with Phase 2; and no server/provider secret dependency in client-importable code.
