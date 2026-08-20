# Side Phase UCE University Catalog Expansion Implementation Plan

> **Execution model:** Implement the entire side phase in one continuous batch. Do not stop after Batch 1/2/3/4. The four batches are source-review/traceability groups only; the final code change exposes one complete 30-university catalog. Follow the current model-specific agent policy in `AGENTS.md`/`LESSONS.md`: GLM-5.3 Max uses zero subagents; native OpenAI GPT models use the currently permitted final read-only reviewer path when available. Never invent reviewer evidence if the host cannot dispatch one.

**Goal:** Add all 20 approved Canada/US/EU universities and their source-frozen computing programs to UniProof while preserving every current Research evidence, Compare scoring, Guide privacy/assessment, Phase 6A persistence, and any newer Phase 6B hardening invariant present when implementation begins.

**Architecture:** Keep the checked-in catalog as the only application-owned support boundary. Introduce one browser-safe closed country vocabulary, expand the bounded catalog, eliminate semantic fixture dependence on catalog array positions, source-freeze every new identity/navigation record from primary sources, and harden only the narrow trusted-host normalization needed for official departmental subdomains. No arbitrary university ingestion, fuzzy retargeting, evidence-policy weakening, provider redesign, or persistence migration.

**Tech stack:** Current repository versions at execution time; planning baseline is Next.js 16.3.1, React 19.2.8, TypeScript 5, Zod 4.4.3, Vitest 4.1.10, Playwright 1.62.1, Supabase SSR/Postgres/RLS from Phase 6A, and the existing Tavily/Brave/ROR + Gemini/Groq/OpenRouter Research pipeline.

**Canonical specification:** `docs/planning/side-phase-university-catalog-expansion.md`

**Research ledger:** create/update `docs/research/2026-08-19-university-catalog-expansion-sources.md` during source freeze. The date in the filename records this planning/source-review cycle; each row must also record its actual implementation verification date.

## Implementation status — complete locally (2026-08-20)

The runbook below is retained as the historical execution checklist. The implemented candidate now contains exactly **30 universities, 45 computing programs, and 11 closed country codes**; all original IDs/ownership remain intact; the source ledger is frozen to the final reviewed primary-source state; Phase 6B production-hardening behavior was preserved; and the final local review found no additional verified catalog/security defect requiring source changes. Full development and built-production Research/Compare/Guide matrices each passed **180/180**, with the recorded high-risk lifecycle, local Supabase, static/build/audit, privacy, and persistence gates also passing. Hosted deployment, live providers, WAF, hosted Supabase, and Devpost remain Phase 6C external work.

---

## Global constraints

- Canonical workspace: `D:\Side Projects\UniProof`.
- Work on the live current branch/worktree selected by the repository owner. Do not reset to the Phase 6A baseline or any historical phase commit.
- Preserve all user/current-session changes. At plan-writing time, Phase 6B/6C documentation and `AGENT_MEMORY.md` are already modified; future execution must inspect the then-current diff rather than assuming this exact state.
- Never touch, delete, overwrite, or repurpose the protected `ui-flow-screenshots/` PNGs.
- Do not create a branch, commit, push, PR, deployment, Vercel/WAF change, hosted Supabase mutation, GitHub action, or Devpost action unless separately authorized.
- Do not make live Tavily/Brave/Gemini/Groq/OpenRouter requests for this side phase. University/program identity research uses current public primary webpages/ROR only.
- Do not read/echo provider credentials, `.env.local` values, Supabase `.temp` secrets, browser private data, or other unrelated credentials.
- Do not add dependencies unless a failing implementation requirement cannot be satisfied by the current stack. No new package is expected.
- Use regression-first TDD for behavior/bug fixes. Data source-freeze can precede test writing, but no catalog data is accepted until tests independently express the required manifest/invariants.
- Keep existing university and program IDs/ownership immutable. This expansion is additive.
- Keep batch priority out of production catalog metadata and UI. The catalog's existing deterministic sort order remains authoritative.
- Keep catalog data identity/navigation-only. Admissions, tuition, deadlines, scholarships, ranking, outcomes, research metrics, visa rules, and other decision facts belong to live Research evidence, never `data.ts`.
- Preserve current Research AI provider order/privacy, Compare deterministic scoring, Guide deterministic assessment/profile separation, and Phase 6A saved-artifact version 1.
- If Phase 6B implementation has landed before this side phase starts, its then-current code/tests/docs become required baseline invariants. If it has not landed, do not implement 6B incidentally.

---

## Canonical file responsibilities

### Create

- `lib/research/catalog/countries.ts` — closed browser-safe country tuple, Zod schema/type, and UI labels.
- `lib/research/official-host.ts` — narrow pure hostname normalization/matching helper **only if the RED trusted-host regression proves the current duplicate logic inconsistent as expected**.
- `tests/helpers/catalog-targets.ts` — explicit stable test fixtures by ID if centralizing them reduces existing order-coupled tests without adding production test seams.
- `tests/side-phase-university-catalog-expansion.test.ts` — independent release-manifest/invariant tests for the final 30-university catalog.
### Update during source freeze

- `docs/research/2026-08-19-university-catalog-expansion-sources.md` — planning-time primary-source ledger already created by this planning task; reopen/revalidate every row, resolve blockers, record final chosen canonical routes/actual verification dates, and mark rows frozen only from current primary evidence.

### Modify — production/catalog

- `lib/research/catalog/schema.ts`
- `lib/research/catalog/data.ts`
- `lib/research/catalog/index.ts`
- `lib/research/catalog/search.ts`
- `lib/research/mode/public-contracts.ts`
- `lib/research/mode/client-form.ts`
- `lib/comparison/client-form.ts`
- `components/research/research-form.tsx`
- `components/compare/compare-form.tsx`

### Modify — trusted source ownership only if regression-backed

- `lib/research/discovery/resolve-target.ts`
- `lib/research/discovery/dedupe.ts`
- `lib/research/verification/evidence-policy.ts`
- `tests/phase2b-discovery.test.ts`
- the existing Phase 2E evidence-policy/review regression file that currently owns official-university source tests.

### Modify — tests/fixtures likely affected by catalog ordering/country scope

- `tests/phase3a-research-catalog.test.ts`
- `tests/phase3b-dossier-composer.test.ts`
- `tests/phase3b-research-api.test.ts` when representative new-country binding needs server-path coverage
- `tests/phase3c-research-form.test.ts`
- `tests/phase4-comparison-contracts.test.ts`
- `tests/phase5-guide-contracts.test.ts`
- `tests/phase5-guide-state.test.ts`
- `tests/phase6a-catalog-presentation.test.ts`
- `tests/phase6a-persistence-contracts.test.ts`
- any other test discovered by targeted search for `researchCatalog.universities[` / `programs[` that uses array index as institution identity.

### Modify — browser acceptance as needed

- `tests/e2e/research-form.spec.ts`
- `tests/e2e/compare-form.spec.ts`
- `tests/e2e/guide-form.spec.ts`
- current Research/Compare/Guide accessibility/responsive suites when long/new labels expose a real issue
- `tests/e2e/auth-saved.spec.ts` for representative new-country save/restore if the current local Auth harness can exercise it without unrelated setup changes.

### Modify after implementation verification only

- `README.md`
- `docs/requirements.md`
- `docs/design.md`
- `docs/data-sources.md`
- `docs/security.md` if the host-ownership invariant changes materially
- `docs/security-threat-model.md` if threat/ownership wording changes materially
- `docs/planning/tasks.md`
- `CHANGELOG.md`
- append-only `AGENT_MEMORY.md`
- `LESSONS.md` only if a reusable implementation mistake/root cause is actually found.

Historical Phase 3/4/5 execution plans are evidence of what existed then. Do not rewrite them merely to replace old country/count examples.

---

## Task 0 — Freeze the live baseline and concurrent Phase 6 state

- [ ] Read `LESSONS.md` first, then `AGENT_MEMORY.md`, `AGENTS.md`, `docs/planning/tasks.md`, `docs/requirements.md`, `docs/design.md`, `docs/security.md`, `docs/security-threat-model.md`, `docs/planning/phase-6-hardening-submission-readiness.md`, and current Phase 6B/6C runbooks.
- [ ] Inspect Git root/branch/status/diff with repository-approved read-only Git tools. Classify every pre-existing modified/untracked file as user/current-session work. Do not clean or overwrite it.
- [ ] Confirm whether Phase 6B is still documentation-only or has current source/config/CI implementation. Record the result in the execution notes and treat any landed fixes as baseline.
- [ ] Confirm the current checked-in catalog count, exact existing 10 university IDs, exact existing 14 program IDs, and owner mapping. Save that mapping in the new release-manifest test so additive expansion cannot accidentally mutate it.
- [ ] Record current `ui-flow-screenshots/` file names/sizes/SHA-256 with the existing project-safe method if the current acceptance workflow still uses the protected hash gate. Never open/write them unless visual inspection is separately necessary; hashing is sufficient for integrity.
- [ ] Run the current focused catalog test and at least the current full unit/static baseline before source changes if the worktree is in a runnable state. If a concurrent unrelated failing change prevents a clean baseline, stop changing source and identify the exact external blocker rather than masking it.

**Acceptance:** The executor can state exactly what is pre-existing, what Phase 6 semantics are current, and which original catalog IDs/owners must remain stable.

---

## Task 1 — Perform the primary-source freeze for all 20 universities before catalog edits

Open the existing planning-time `docs/research/2026-08-19-university-catalog-expansion-sources.md` and turn it into the final implementation evidence ledger by reopening every source, resolving every `scope-review`/`blocker`, and recording the actual implementation verification date. For each university/program record, ensure it contains:

```text
Batch
Proposed stable ID
Canonical university name
Country code
Canonical homepage candidate
Useful aliases
ROR identity/status
Program ID
Exact program display name
Degree level
Subject area
Canonical program/application URL candidate
Campus/college/track/admission-stage scope
Primary source(s)
Redirect/final-route observation
Verified on YYYY-MM-DD
Status: frozen | blocker
Notes
```

- [ ] Research **all 20** university identities from official university webpages and ROR where useful. Search-result snippets are discovery only; open the underlying official page.
- [ ] Verify the institution is the intended legal/operating university and not a system/campus/school with a confusingly similar name.
- [ ] Resolve a stable canonical HTTPS homepage. Prefer current canonical institution routes, not marketing redirectors or archived pages.
- [ ] Verify current program identity from the owning university/department/admissions/catalog page. Do not infer program existence from course listings alone when a current applicant-facing program page exists.
- [ ] Prefer stable non-year-specific program routes. If only a year-specific page proves current existence, keep searching for a stable applicant-facing navigation route; document the limitation if none exists.
- [ ] Verify bachelor/master scope under the **existing** enum. Do not create `advanced-master`, `professional-master`, `integrated-master`, `major`, or `concentration` degree-level values.
- [ ] For nested structures, decide the truthful catalog label/official URL that preserves the owning degree hierarchy. Examples: Toronto St. George admission/program distinction, Aalto study option within the owning master's, Cornell college-specific CS degree.
- [ ] Verify aliases against all existing/new canonical names and aliases after project NFKC normalization. Omit ambiguous shorthand; specifically prohibit bare `UW`.
- [ ] Resolve ROR only when current v2.1 identity can be established confidently. Do not select first result/highest score blindly. `rorId` remains optional.
- [ ] Resolve every source-freeze blocker before `data.ts` edits. Known planning-time blockers are TU Delft applicant-facing canonical MSc CS navigation and University of Alberta main-campus applicant-facing Computing Science navigation. OpenCourseWare/course catalog/archive-only evidence is insufficient for those rows.
- [ ] If a provisional program target is not currently a truthful direct/meaningful application target, revise **that program selection only** to another current computing program at the same agreed university, record why, and keep within bachelor/master + computing scope. Do not silently drop an approved university.

### Required batch coverage

- [ ] Batch 1: Toronto, Waterloo, CMU, TUM, KTH.
- [ ] Batch 2: UBC, McGill, UIUC, TU Delft, Aalto.
- [ ] Batch 3: Alberta, Cornell, UC San Diego, KU Leuven, University of Amsterdam.
- [ ] Batch 4: Michigan–Ann Arbor, Washington Seattle, DTU, Politecnico di Milano, RWTH Aachen.

**Acceptance:** 20/20 universities are `frozen`; every new university has at least one frozen applicant-meaningful computing program; no row depends on a third-party/ranking/source snippet; unresolved rows block source editing rather than becoming guesses.

---

## Task 2 — Add RED tests for the shared closed country vocabulary

Before production changes:

- [ ] Add failing tests expecting exact supported codes in lexical canonical order:

```ts
["BE", "CA", "DE", "DK", "FI", "GB", "IT", "NL", "SE", "TH", "US"]
```

- [ ] Expect the catalog university schema to accept every supported code and reject `CH`, `ZZ`, lowercase variants, whitespace-padded arbitrary codes, and unknown two-character strings unless the schema intentionally trims before enum validation (match existing normalization semantics exactly).
- [ ] Expect the public Research dossier target country schema to accept the same tuple and reject unsupported codes.
- [ ] Add a compile/runtime test proving Research/Compare search filters consume the shared type/schema rather than copied unions where practical.
- [ ] Preserve the existing browser-safe/client import boundary: `countries.ts` must not import `server-only`, Phase 2 server contracts, credentials, or Node-only APIs.

**Expected RED:** current `US/GB/TH` enums/unions fail new-country cases.

---

## Task 3 — Implement one browser-safe country source of truth

Create `lib/research/catalog/countries.ts` with an explicit immutable tuple, derived `ResearchCatalogCountryCode` type, Zod enum/schema, and label mapping used by UI.

Recommended shape (adapt to exact local style, do not duplicate strings elsewhere):

```ts
export const researchCatalogCountryCodes = [
  "BE", "CA", "DE", "DK", "FI", "GB", "IT", "NL", "SE", "TH", "US",
] as const;

export type ResearchCatalogCountryCode = typeof researchCatalogCountryCodes[number];
export const researchCatalogCountryCodeSchema = z.enum(researchCatalogCountryCodes);

export const researchCatalogCountryLabels: Readonly<Record<ResearchCatalogCountryCode, string>> = {
  BE: "Belgium",
  CA: "Canada",
  DE: "Germany",
  DK: "Denmark",
  FI: "Finland",
  GB: "United Kingdom",
  IT: "Italy",
  NL: "Netherlands",
  SE: "Sweden",
  TH: "Thailand",
  US: "United States",
};
```

- [ ] Replace `z.enum(["US", "GB", "TH"])` in `lib/research/catalog/schema.ts`.
- [ ] Replace the duplicated public dossier enum in `lib/research/mode/public-contracts.ts`.
- [ ] Replace copied country union types in `lib/research/catalog/search.ts`, `lib/research/mode/client-form.ts`, and `lib/comparison/client-form.ts`.
- [ ] Replace hard-coded country `<option>` rows/casts in Research and Compare forms with deterministic iteration over the shared tuple/labels.
- [ ] Export only what client code needs from `lib/research/catalog/index.ts`; keep resolver/server-only separation intact.
- [ ] Do not add arbitrary ISO-code acceptance. The 11-code tuple is the product support boundary.
- [ ] Run focused RED→GREEN tests.

---

## Task 4 — Add RED catalog-bound and global-alias collision tests

- [ ] Update the generic expected university bound: schema should accept the final 30 and remain bounded at max 40.
- [ ] Keep program max 60. Add a regression showing 61 remains rejected; do not enlarge it merely because university count grew.
- [ ] Add failing collision cases:
  - new university alias equals another university canonical name after NFKC/case/punctuation normalization;
  - aliases on two universities normalize to the same value;
  - exact canonical names collide after normalization;
  - ambiguous bare `UW` must not appear in the shipped manifest.
- [ ] Preserve existing uniqueness checks for IDs, owner IDs, program identities, canonical HTTPS, aliases within a row, and deterministic sort.
- [ ] Keep program alias semantics owner-scoped unless a failing cross-owner case reveals a product ambiguity not handled by owner projection.

**Expected RED:** current schema permits cross-university alias collisions and maxes universities at 15.

---

## Task 5 — Implement catalog schema hardening without broadening trust

Modify `lib/research/catalog/schema.ts`:

- [ ] `universities` min 10, max 40.
- [ ] `programs` min 10, max 60 unchanged.
- [ ] Use the shared country code schema.
- [ ] Build one normalized identity namespace across each university's canonical name + aliases. Reject any value owned by more than one university.
- [ ] Error paths/messages remain bounded/non-secret and identify catalog structure, not external source content.
- [ ] Keep deterministic ordering exactly as current code specifies. Do not sort by batch priority or prestige.
- [ ] Add/adjust tests so sort validation still catches deliberately reordered university/program records.

Run focused schema tests GREEN before editing the data manifest.

---

## Task 6 — Add RED trusted-official-host regressions before changing host logic

The implementation plan expects a real current inconsistency: discovery matching retains leading `www`, while evidence-policy host normalization removes it.

In `tests/phase2b-discovery.test.ts` (and the evidence-policy regression suite where appropriate), add cases with a resolved homepage such as `https://www.example.edu/`:

- [ ] `example.edu` accepted as same normalized official root;
- [ ] `cs.example.edu` accepted as a true subdomain;
- [ ] uppercase/trailing-dot forms normalize safely;
- [ ] `evil-example.edu` rejected;
- [ ] `example.edu.evil.test` rejected;
- [ ] `notexample.edu` rejected;
- [ ] unrelated sibling domains rejected;
- [ ] IP literals and unrelated public domains do not become trusted through normalization;
- [ ] source publisher ownership behavior remains unchanged except for the same narrow host normalization.

Also add one regression using a real-shape new catalog target fixture whose current homepage contains `www` and a departmental subdomain is expected to remain in the same institutional tree. Keep network calls mocked/offline.

**Do not implement a generic eTLD+1/public-suffix trust rule.** The RED should prove only the leading-`www` inconsistency.

---

## Task 7 — Implement the narrow shared host normalization only if Task 6 is RED for the expected reason

Create `lib/research/official-host.ts` or the nearest narrow pure module if no better existing owner exists:

```ts
export function normalizeOfficialHost(hostname: string): string;
export function hostMatchesOfficialRoot(candidateHost: string, officialHost: string): boolean;
```

Required semantics:

- [ ] lowercase;
- [ ] remove surrounding IPv6 brackets only if current callers need it without changing IP safety policy;
- [ ] trim terminal dots;
- [ ] strip exactly one leading `www.` from DNS hostnames;
- [ ] match exact normalized host or `candidate.endsWith("." + official)`;
- [ ] no registrable-domain guessing;
- [ ] no URL-path/query influence;
- [ ] no DNS/network lookup;
- [ ] no public-suffix dependency.

Use the helper consistently in:

- [ ] `resolve-target.ts` official host normalization / `targetHostMatches`;
- [ ] `dedupe.ts` `trustedOfficialHost` promotion logic;
- [ ] `evidence-policy.ts` host-side official-owner logic, without changing publisher-based ownership rules.

Run focused discovery/evidence regressions GREEN. Then rerun Phase 2B/2E focused suites to prove no authority/corroboration widening.

If Task 6 unexpectedly passes without source changes because newer concurrent work already fixed the inconsistency, **do not create a duplicate helper**. Reuse the live implementation and only extend tests if needed.

---

## Task 8 — Add the independent final release-manifest test

Create `tests/side-phase-university-catalog-expansion.test.ts` before adding rows.

Use explicit requirements independent from production ordering, including the 20 new university IDs agreed/frozen during Task 1. Proposed IDs to verify/freeze before use:

```text
university-toronto
university-waterloo
university-carnegie-mellon
university-tum
university-kth
university-ubc
university-mcgill
university-uiuc
university-tu-delft
university-aalto
university-alberta
university-cornell
university-ucsd
university-ku-leuven
university-amsterdam
university-michigan
university-washington
university-dtu
university-polimi
university-rwth-aachen
```

- [ ] Freeze these exact IDs in the source ledger before production data. If a collision/current project convention requires a different ID, change it **before implementation**, document why, and make the release test authoritative; never rename an ID after it is shipped.
- [ ] Capture the original 10 university IDs + 14 program IDs/owners and assert they are unchanged.
- [ ] Assert exactly 30 university IDs total.
- [ ] Assert each new university owns >=1 program.
- [ ] Assert the source-frozen program ID/owner manifest exactly, without simply reading it from `data.ts` and treating that as expected output.
- [ ] Assert exact geographic counts: US 10, CA 5, EU-country set 9 institutions, GB 3, TH 3.
- [ ] Assert supported country code set exactly matches the shared tuple.
- [ ] Assert global university name/alias collision-free state and explicit absence of bare `UW`.
- [ ] Assert every intended canonical/alias query returns its owning university and that program matches project owners into result universities.
- [ ] Assert representative punctuation/case/NFKC normalization for `TU Delft`, `KTH`, `UCSD`, `KU Leuven`, `RWTH`, `Polimi`, and a long official name.
- [ ] Assert `CH` remains unsupported in this release.

This test should be RED because the 20 IDs/data do not yet exist.

---

## Task 9 — Add all 20 universities and all frozen programs in one deterministic data edit

Modify `lib/research/catalog/data.ts` only from the Task 1 frozen ledger.

### Data rules for every university

- [ ] stable application ID from the release manifest;
- [ ] exact source-frozen canonical name;
- [ ] shared supported country code;
- [ ] canonical HTTPS institutional homepage;
- [ ] verified ROR ID only when confidently resolved;
- [ ] only useful collision-safe aliases;
- [ ] no decision facts.

### Data rules for every program

- [ ] stable program ID;
- [ ] exact owner ID;
- [ ] source-frozen applicant-meaningful display name;
- [ ] `bachelor` or `master`;
- [ ] narrow computing subject area;
- [ ] stable official HTTPS program/application route;
- [ ] only useful aliases;
- [ ] no fee/admission/deadline/scholarship/freshness facts.

### Ordering

- [ ] Reorder the entire final university list to satisfy the existing deterministic schema ordering by country code/name/ID.
- [ ] Reorder the final programs according to the current schema's owner-rank/degree/name/ID rule.
- [ ] Do not preserve batch priority as array order.

### Existing catalog hygiene

- [ ] Do not rename/remove/re-ID existing 10 universities or 14 programs merely for style consistency.
- [ ] Recheck the concrete MIT host case before final data: current `university-mit.websiteUrl` is `https://web.mit.edu/`, current MIT institutional homepage is `https://www.mit.edu/`, and supported program links use `catalog.mit.edu`. If those primary facts remain current, regression-test then change only MIT's `websiteUrl` to `https://www.mit.edu/`; keep all MIT IDs/owners/evidence URLs unchanged. This lets the narrow leading-`www` host normalization produce the institutional root `mit.edu` instead of inventing registrable-domain trust.
- [ ] If primary-source review finds another currently broken/superseded **navigation URL** on an existing row, fix only that URL with an explicit regression/source-ledger entry; preserve identity and ownership. Do not bundle unrelated curriculum modernization.

Run `tests/side-phase-university-catalog-expansion.test.ts` + Phase 3A catalog suite until GREEN.

---

## Task 10 — Remove semantic dependence on catalog array position from tests/fixtures

Targeted-search the live repo for at least:

```text
researchCatalog.universities[
researchCatalog.programs[
.universities[0]
.universities[1]
```

Distinguish generic ordering tests from semantic fixtures.

- [ ] Keep tests that intentionally validate sorted array behavior.
- [ ] Replace tests that mean “MIT”, “a Guide target”, “two comparison targets”, etc. via numeric index with explicit IDs or a test helper under `tests/helpers/catalog-targets.ts`.
- [ ] Update Phase 5 Guide tests/helpers currently using `researchCatalog.universities[0]` so changing country sort order cannot silently change what scenario is being tested.
- [ ] Update `tests/phase6a-catalog-presentation.test.ts` to explicit stable IDs.
- [ ] Update `tests/phase6a-persistence-contracts.test.ts` targets currently using `[0]`, `[1]`, `[4]`, `[5]` to named explicit stable targets.
- [ ] Update browser helpers only when they rely on catalog position; keep existing fixture target IDs where already explicit.
- [ ] Do not introduce test-only branches/methods in production code.

Add a regression/helper assertion that each named test target actually exists and owns the expected program so future catalog edits fail loudly.

---

## Task 11 — Extend Research/public-contract/server binding tests for new countries

### Public contract

- [ ] A valid `CA` dossier parses.
- [ ] At least one EU code (for example `DE` or `NL`) parses.
- [ ] `CH`/`ZZ` reject.
- [ ] The public country schema and catalog country schema have identical option sets.

### Catalog search/resolver

- [ ] Exact canonical name and intended alias for every new university are searchable.
- [ ] Country + degree + subject + query retains AND semantics.
- [ ] A program match always carries its owning university.
- [ ] An unsupported/ambiguous query is never silently retargeted.
- [ ] Resolver returns exact frozen university/program identity for representative Canada/EU/new-US targets.
- [ ] Program owner mismatch remains rejected.

### Server/dossier

Use representative invented dossier evidence; do not make live provider calls.

- [ ] `CA` target request binds through handler/composer/client transport.
- [ ] EU target request binds through the same path.
- [ ] Existing US/GB/TH path stays green.
- [ ] Final claim IDs/owner/program scope still must match selected catalog identity.
- [ ] Application-owned navigation URLs are rebound from the current catalog; evidence/source URLs remain untouched.
- [ ] New country support does not expose provider history/documents/candidates/raw warnings/model identity to browser DTOs.

---

## Task 12 — Extend Compare and Guide catalog UX without redesigning algorithms

### Research UI

- [ ] Generate Country options from shared labels.
- [ ] Browser test Canada, Germany/Netherlands/other EU, US, GB, TH filters.
- [ ] Remove the current `countryLabels[owner?.countryCode ?? "US"]` presentation fallback. Every returned program must have a catalog owner by contract; malformed ownerless results must fail closed/not render as a falsely US-owned program. Add regression coverage for the owner-projection invariant rather than inventing a country default.
- [ ] Verify selected target remains visible/owned even when later filters exclude it according to current Research behavior.
- [ ] Long names such as King Mongkut's, University of Illinois Urbana-Champaign, Technical University of Munich, and Politecnico di Milano do not clip or overflow at existing responsive widths.

### Compare UI

- [ ] Generate Country options from shared labels/type.
- [ ] Keep current 8-university/12-program visible-result cap initially.
- [ ] Prove each new target is reachable by exact name/alias search even when not present in an unfiltered first-8 view.
- [ ] Prove country filtering plus exact query can surface every new university.
- [ ] Prove selected targets are not silently replaced when query/filter state changes.
- [ ] Preserve homogeneous university/program target scope, same program degree level, unique targets, exactly 2–4 targets, weight total 100, scoring eligibility, coverage suppression, and immutable selection order.
- [ ] Only change result-cap UX if a real browser test proves discoverability inaccessible/ambiguous. If changed, preserve accessibility and do not add pagination/virtualization infrastructure without evidence it is needed.

### Guide UI

- [ ] Every new frozen program is reachable by exact program/university query.
- [ ] A selected program continues to display its owning university and degree level correctly.
- [ ] Program labels with college/campus/track scope are readable and non-ambiguous.
- [ ] No applicant profile field enters Research request/provider marker tests.
- [ ] Closed requirement registry/evidence gates remain untouched unless a new program's **published evidence** later reveals a separate semantic-registry gap; catalog expansion itself is not permission to broaden fuzzy mapping.

---

## Task 13 — Prove Phase 6A saved-artifact backward compatibility and new-target support

No migration should be required because IDs are additive/stable. Prove that claim rather than assuming it.

- [ ] Construct/retain an original-catalog Research snapshot using one of the pre-expansion stable IDs and validate it against the expanded catalog.
- [ ] Original snapshot navigation rebinds to current catalog URLs while evidence/source URLs remain byte-for-byte/structurally preserved.
- [ ] Original Guide and Comparison snapshots still validate under schema version 1 when their targets remain present.
- [ ] Add one new Canada and one new EU saved Research/Guide/Comparison target path as appropriate to existing pure persistence tests.
- [ ] Keep removed-target and reassigned-program failure tests GREEN.
- [ ] Loading/restoring a historical snapshot still performs zero automatic Research/provider request, zero automatic re-score/reassess, and does not make evidence current.
- [ ] No Supabase schema migration, UPDATE route, service-role path, or saved-artifact version bump is added.
- [ ] If local Supabase/browser Auth tests are touched, use invented local accounts only and preserve current cleanup/security policy.

---

## Task 14 — Browser accessibility, responsive, and content-stress acceptance

Run current deterministic fixtures/intercepts only; no live providers.

- [ ] `tests/e2e/research-form.spec.ts`: exact search/alias/country/degree/subject for representative CA/EU/US new targets; unsupported empty state; no silent retarget.
- [ ] `tests/e2e/compare-form.spec.ts`: discoverability through current result cap; selected-target ownership; country filters; same-degree validation.
- [ ] `tests/e2e/guide-form.spec.ts`: representative new program selection and long labels.
- [ ] Relevant accessibility suites: keyboard-only search/select/clear/submit flow, labels, live regions, errors, sticky-header focus visibility, no duplicate control names introduced by long institutions.
- [ ] Relevant responsive suites at the project's existing 320/375/390/768/1024/1440 matrix: no page-level horizontal overflow and no unusable native select/result list caused by longer names.
- [ ] Existing XSS-shaped catalog/evidence safety remains React-text-only; new official URLs use existing safe anchor treatment.
- [ ] Browser network guard sees no unexpected provider/university external request merely from opening/searching forms. Do not click official links in automated acceptance unless explicitly intercepting/validating anchor attributes.
- [ ] Console/application errors remain zero where current suite expects zero.
- [ ] If state/lifecycle production code was not changed, do not add artificial lifecycle logic; still run the existing full/repeated race suites required by current release gate to detect regressions from fixture/target changes.

Use the existing Playwright config exactly: one worker, retries zero, service workers blocked, isolated copied dev harness, `reuseExistingServer:false`. Never “fix” a test by attaching to an arbitrary existing dev server or editing generated `output/playwright` snapshots.

---

## Task 15 — Full current verification matrix

Use commands/current scripts verified from the live repository at execution time. Minimum expected sequence:

### Focused unit/integration

- [ ] `npx.cmd vitest run tests/side-phase-university-catalog-expansion.test.ts tests/phase3a-research-catalog.test.ts tests/phase2b-discovery.test.ts tests/phase6a-catalog-presentation.test.ts tests/phase6a-persistence-contracts.test.ts`
- [ ] Add the exact current Phase 2E evidence-policy regression file if `official-host.ts`/`evidence-policy.ts` changed.
- [ ] Run affected Phase 3B/3C, Phase 4, and Phase 5 test files if their source or fixtures changed.

### Full local static/unit

- [ ] `npm.cmd test -- --run`
- [ ] `npx.cmd tsc --noEmit`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd audit --omit=dev`
- [ ] `scripts/verify-workspace.ps1`

### Browser

- [ ] focused dev Playwright for Research/Compare/Guide/Auth-Saved files touched by this phase;
- [ ] current complete dev Research/Compare/Guide browser matrix;
- [ ] current required repeated lifecycle/race suites with retries zero;
- [ ] fresh production build followed by current built-production anonymous/core browser matrix using `UNIPROOF_E2E_PRODUCTION=1` and the existing Playwright harness;
- [ ] authenticated built-mode remains subject to the current Phase 6A/6C Supabase HTTPS boundary; do not weaken CSP or mislabel local HTTP Auth as production evidence.

### Phase 6 compatibility

- [ ] If Phase 6B has landed, run its exact current focused deadline/platform-transport/provider/config/CI verifier tests and any release configuration static checks required by its live plan.
- [ ] If Phase 6B is still planning-only, state that explicitly; do not claim a 6B implementation gate.

### Security/integrity

- [ ] current UTF-8/control/mojibake/trailing-whitespace checks for changed files;
- [ ] provider/server secret scans required by current security plan;
- [ ] no new `NEXT_PUBLIC_*` credentials/provider endpoints;
- [ ] no `.env.local` or Supabase `.temp` content in output/change set;
- [ ] no Web Storage/IndexedDB/Cache/service-worker persistence introduced by catalog work;
- [ ] no test-only production bypass;
- [ ] `git diff --check` through approved repository tooling;
- [ ] protected `ui-flow-screenshots/` before/after hashes unchanged;
- [ ] generated `output/playwright` snapshots remain disposable/untracked and excluded from source/static analysis; clean only verified task-local inactive residue under the project's approved cleanup rule.

Record exact observed counts/results; do not say “all tests passed” unless the complete claimed set actually ran and was observed.

---

## Task 16 — Two-pass defect-first final review

Perform this after all implementation and initial gates, before documentation status is marked complete.

### Pass A — specification/data/source review

- [ ] Reconcile every one of the 20 universities against the source ledger and final `data.ts`.
- [ ] Reconcile every frozen program's exact name/owner/degree/subject/URL/scope.
- [ ] Confirm final exactly 30 universities and actual final program count <=60.
- [ ] Confirm all 11 country codes flow from the single source.
- [ ] Confirm original IDs/owners unchanged.
- [ ] Confirm no source-freeze blocker was waived/guessed.
- [ ] Confirm batch priority did not leak into UI ranking/order metadata.
- [ ] Confirm no admissions/tuition/deadline/ranking factual value entered catalog data.

### Pass B — code/security/privacy/lifecycle review

- [ ] Search for remaining active `"US" | "GB" | "TH"`, `z.enum(["US", "GB", "TH"])`, and hard-coded Research/Compare country options outside historical docs/generated output.
- [ ] Search for semantic `researchCatalog.universities[index]` / `programs[index]` dependencies in active tests/production; justify any remaining ordering-only case.
- [ ] Re-review host normalization for suffix confusion, public-suffix overreach, IP/URL confusion, and evidence-authority widening.
- [ ] Re-review saved-artifact binder for original/new target behavior and provenance preservation.
- [ ] Re-review Compare result cap/discoverability and Guide scoped labels.
- [ ] Re-review current Phase 6A/6B changes for accidental overwrite/reversion.
- [ ] Re-review final diff for secrets, generated residue, unrelated cleanup, dependency changes, or protected-file changes.

Fix verified findings regression-first and rerun affected + full gates. A reviewer/subagent may be used only if the live model/host policy permits it; GLM-5.3 Max remains main-agent-only.

---

## Task 17 — Synchronize current-state documentation from observed implementation

Only after final code/data/test review is green:

- [ ] `README.md`: replace 10 universities/14 programs/US-UK-TH current statement with actual 30-university/actual-program/11-country supported catalog. Replace the now-false “global coverage deferred” wording with the truthful bounded supported-catalog scope; do not imply arbitrary global coverage.
- [ ] `docs/requirements.md`: update current MVP scope from approximately 10–15 US/UK/Thailand to the implemented 30-university Canada/US/EU+UK+Thailand catalog while preserving all Phase 6 requirements including any newer 6B fixes.
- [ ] `docs/design.md`: document shared country SSOT, bounded max40/exact release30, actual program count, and narrow host normalization if implemented; preserve provider/evidence/6B details verbatim unless this side phase materially changes them.
- [ ] `docs/data-sources.md`: record exact final counts/countries/programs and the actual source-freeze verification date; retain “catalog identity/navigation verification != evidence freshness”.
- [ ] `docs/security.md`/`docs/security-threat-model.md`: update only active catalog/host-ownership boundary text actually changed.
- [ ] `docs/planning/tasks.md`: add/mark Side Phase UCE tasks complete with actual results; remove the current Scope Control statement that “global university coverage” is deferred or narrow it to **arbitrary/global catalog coverage beyond the checked-in 30**. Do not rewrite completed Phase 3A history.
- [ ] `CHANGELOG.md`: add current release entry.
- [ ] Append `AGENT_MEMORY.md` with final observed changes, counts, tests, source-freeze date, and deferred blockers/non-goals.
- [ ] Add `LESSONS.md` only for reusable mistakes actually discovered.

Run documentation consistency searches for stale current-state phrases:

```text
10 universities
14 computing programs
10–15
US/UK/Thailand
United States, United Kingdom, and Thailand
Global university coverage is intentionally deferred
```

Historical plans/memory may legitimately contain these terms; only current-state docs should change.

---

## Task 18 — Final completion evidence and handoff

- [ ] Re-run the strongest final gates after documentation-only changes that can affect build/lint/static checks.
- [ ] Re-run `show_changes`/approved Git status and inspect exact final diff.
- [ ] Verify no external mutation occurred.
- [ ] Report:
  - exact final university count;
  - exact final program count;
  - exact country-code set;
  - all 20 added university names;
  - any provisional program target revised during source freeze and why;
  - source-freeze date;
  - exact verification commands/results;
  - browser matrix/results;
  - whether Phase 6B was plan-only or implemented baseline during execution;
  - skipped/unavailable checks and residual risk;
  - no commit/push/deploy unless separately authorized.

Do not declare the side phase complete if TU Delft/Alberta or any other final row still depends on an unresolved source/campus/program identity ambiguity.

---

## Acceptance matrix summary

| Boundary | Required result |
| --- | --- |
| Universities | Exactly 30; original 10 IDs unchanged; all 20 approved additions present |
| Countries | Exactly `BE CA DE DK FI GB IT NL SE TH US`, one client-safe SSOT |
| Programs | All original 14 IDs/owners unchanged; >=1 frozen computing program/new university; final <=60 |
| Catalog facts | Identity/navigation only; no decision facts |
| Aliases | NFKC-safe, global university collision-free, no ambiguous bare `UW` |
| Ordering | Existing deterministic catalog order; no batch/ranking metadata |
| Trust | Narrow official-host normalization only; no registrable-domain trust broadening |
| Research | New-country targets bind; unsupported targets still fail closed; provenance/public DTO unchanged |
| Compare | New targets discoverable; score/coverage/order semantics unchanged; no AI call |
| Guide | New scoped programs selectable; applicant/provider separation and deterministic gates unchanged |
| Persistence | Existing v1 snapshots still bind; new targets bind; no migration/version bump/auto-refresh |
| UI | Keyboard/responsive/long-name acceptance; no page overflow; no silent retarget |
| Security | No secret/public-env/storage/test-backdoor regression; protected screenshots unchanged |
| Phase 6 | Preserve every live 6A/6B invariant; no unauthorized 6C action |
| Verification | Focused + full current unit/static/browser/security matrices observed green before completion |
