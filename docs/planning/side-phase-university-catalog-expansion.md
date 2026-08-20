# Side Phase UCE — University Catalog Expansion

## Status

Implementation is complete locally and was final-reviewed on **2026-08-20** from the live stabilized workspace. The checked-in release candidate contains exactly **30 universities, 45 computing programs, and 11 closed country codes**. All original university/program IDs and ownership remain preserved, Phase 6B production-hardening invariants remain intact, and the source ledger records the final primary-source verification state. Hosted deployment, live-provider, WAF, hosted Supabase, and Devpost actions remain Phase 6C work.

The implementation started from the **live stabilized workspace**, not from an older commit named in a historical phase plan. The execution preserved every newer Phase 6A/6B fix already present and treated the remainder of this document as the authoritative design/specification for the completed side phase.

## Goal

Expand UniProof from 10 supported universities to **30 supported universities** in one implementation batch, adding all 20 previously selected Canada/United States/EU institutions while preserving the evidence-first trust model and all current Research/Compare/Guide/Auth/Saved semantics.

The side phase must leave UniProof with:

- exactly **30 supported universities**;
- exactly **11 closed, application-owned country codes**: `BE`, `CA`, `DE`, `DK`, `FI`, `GB`, `IT`, `NL`, `SE`, `TH`, `US`;
- all existing 10 university IDs and 14 program IDs unchanged;
- at least one current, applicant-meaningful computing program for every newly supported university;
- a final computing-program manifest that remains within the existing 60-program contract ceiling;
- current official university/program navigation metadata verified from primary sources;
- no admission threshold, tuition amount, deadline, scholarship value, ranking, outcome, or other decision fact added to catalog data;
- no arbitrary/free-form university support and no caller-supplied official URL trust boundary;
- no new AI/provider behavior, no AI scoring, and no applicant data entering the Research/provider chain.

## Why this is a side phase rather than a Phase 7

The expansion changes **application-owned identity/navigation scope**, not the evidence/reasoning model. Research continues to resolve a checked-in target, discover/retrieve evidence, run structured AI extraction/reconciliation, and apply deterministic evidence gates. Compare continues to consume validated Research dossiers deterministically. Guide continues to assess one supported program through deterministic profile/evidence logic without sending applicant values to Research providers.

The work nevertheless crosses multiple trust boundaries because the current three-country catalog vocabulary is duplicated in browser/public contracts and UI state, saved artifacts are rebound against the current catalog, and multiple tests accidentally use catalog array positions as semantic fixtures. The implementation therefore requires a full cross-mode regression rather than a data-only patch.

## Existing architecture that must remain authoritative

### Current catalog boundary

`lib/research/catalog/` supplies public identity/navigation metadata only. Catalog data is strict, deterministic, NFKC-normalized, canonical-HTTPS-only, program-owner-bound, and sorted by application-owned rules.

### Research boundary

`POST /api/research` accepts supported catalog IDs only. The server resolves catalog identity before Phase 2 work; the dossier composer proves final claim identity against the selected catalog target; the browser revalidates the public dossier and exact request binding before rendering.

### Evidence authority boundary

AI may extract and semantically reconcile public evidence, but deterministic application code owns source authority, independence, scope, period/freshness, conflict, and final evidence status. Expanding the catalog must not weaken that policy.

### Compare boundary

Compare reuses the existing Research route/dossier and adds no model call. It retains exact closed metric/property registries, typed compatibility, coverage rules, immutable selection order, and evidence-linked trade-offs.

### Guide boundary

Guide remains a one-program deterministic consumer of Research evidence. GPA, citizenship/current country, qualification, English test, budget, and scholarship need remain outside `/api/research` and all search/AI providers.

### Phase 6A saved-artifact boundary

Current catalog data owns university/program **navigation** on live and restored dossiers. Saved evidence/source URLs remain provenance-owned. A removed or reassigned target fails restore. Because this expansion is additive and keeps every existing ID/owner stable, existing saved snapshots require **no content or database migration**.

### Phase 6B/6C boundary

This side phase must neither implement nor revert unrelated production-hardening/release work. If Phase 6B has landed before execution, preserve and rerun its current deadline/cancellation, raw platform 429/504, Gemini v1, release-verifier, WAF-contract, CI, and HSTS-ownership regressions. If Phase 6B is still planning-only, do not claim those features were implemented by the catalog side phase.

## Final university manifest

The batch labels below preserve the agreed implementation priority for research/source-freeze review only. They are **not rankings** and must not become catalog sort order, UI rank, score, or recommendation metadata.

### Batch 1 manifest

1. University of Toronto — Canada (`CA`)
2. University of Waterloo — Canada (`CA`)
3. Carnegie Mellon University — United States (`US`)
4. Technical University of Munich — Germany (`DE`)
5. KTH Royal Institute of Technology — Sweden (`SE`)

### Batch 2 manifest

6. University of British Columbia — Canada (`CA`)
7. McGill University — Canada (`CA`)
8. University of Illinois Urbana-Champaign — United States (`US`)
9. Delft University of Technology / TU Delft — Netherlands (`NL`)
10. Aalto University — Finland (`FI`)

### Batch 3 manifest

11. University of Alberta — Canada (`CA`)
12. Cornell University — United States (`US`)
13. University of California San Diego — United States (`US`)
14. KU Leuven — Belgium (`BE`)
15. University of Amsterdam — Netherlands (`NL`)

### Batch 4 manifest

16. University of Michigan–Ann Arbor — United States (`US`)
17. University of Washington, Seattle — United States (`US`)
18. Technical University of Denmark — Denmark (`DK`)
19. Politecnico di Milano — Italy (`IT`)
20. RWTH Aachen University — Germany (`DE`)

### Required final geographic distribution

| Region | Current | Add | Final |
| --- | ---: | ---: | ---: |
| United States | 4 | 6 | 10 |
| Canada | 0 | 5 | 5 |
| EU member states | 0 | 9 | 9 |
| United Kingdom | 3 | 0 | 3 |
| Thailand | 3 | 0 | 3 |
| **Total** | **10** | **20** | **30** |

Switzerland remains out of this side phase. ETH Zürich and EPFL may be high-value future targets, but Switzerland is not an EU member state and the agreed expansion is Canada/US/EU-focused.

## Provisional computing-program manifest

The following is the **source-freeze target list**, not permission to guess a catalog row. Exact official names, direct-applicant scope, degree level, campus/college/track, and stable canonical HTTPS routes must be verified from current primary sources before a row is admitted. When the official structure is nested (admission category, college, major, study option, concentration, specialization), the catalog label must be scoped narrowly enough that Research/Guide cannot imply requirements from a different route.

### Batch 1 program targets

- University of Toronto:
  - Computer Science, St. George undergraduate scope (`bachelor`), with the source-freeze explicitly distinguishing university admission category from later program-of-study enrollment;
  - MScAC Artificial Intelligence / the current exact MScAC AI study option (`master`), using the owning graduate program's official naming.
- University of Waterloo:
  - Bachelor of Computer Science (`bachelor`), not the distinct BMath Computer Science route;
  - MMath Computer Science (`master`).
- Carnegie Mellon University:
  - B.S. in Computer Science (`bachelor`);
  - B.S. in Artificial Intelligence (`bachelor`), while preserving the current School of Computer Science first-year/major-declaration semantics in Research rather than encoding them as catalog facts.
- Technical University of Munich:
  - M.Sc. Informatics (`master`).
- KTH Royal Institute of Technology:
  - MSc Computer Science (`master`).

### Batch 2 program targets

- University of British Columbia:
  - BSc Computer Science Major (`bachelor`), not the BA or second-degree BCS;
  - MSc Computer Science (`master`).
- McGill University:
  - BSc Major Computer Science (`bachelor`);
  - MSc Computer Science (`master`) only after source-freeze resolves the current thesis/non-thesis application semantics. Do not label a post-enrollment switch as a directly selectable application route.
- University of Illinois Urbana-Champaign:
  - BS Computer Science (`bachelor`), not CS+X;
  - on-campus Master of Computer Science (`master`), not the combined BS-MCS.
- TU Delft:
  - MSc Computer Science (`master`), **blocked until a current applicant-facing canonical TU Delft program route is verified**; OpenCourseWare alone is insufficient as the navigation source.
- Aalto University:
  - Machine Learning, Data Science and Artificial Intelligence study option/major within its exact current Master of Science (Technology) owning program (`master`); the final label must preserve the official hierarchy rather than pretending the study option is an unrelated standalone degree.

### Batch 3 program targets

- University of Alberta:
  - BSc Computing Science/Computing Science major (`bachelor`), **blocked until a current main-campus applicant-facing program route is verified**; archived Calendar pages are insufficient.
- Cornell University:
  - BS Computer Science through Engineering (`bachelor`), preserving the college scope;
  - MEng Computer Science (`master`); do not substitute Cornell's small research MS as a generic externally targeted taught/professional master's.
- University of California San Diego:
  - BS Computer Science (`bachelor`);
  - BS Artificial Intelligence (`bachelor`) only if its current applicant/major rules remain published and the catalog can label the route truthfully at source-freeze time;
  - MS Computer Science and Engineering / current exact CSE master's name (`master`).
- KU Leuven:
  - Master of Artificial Intelligence (`master`), preserving its advanced/specialized-master prerequisites in Research rather than inventing a new catalog degree-level enum.
- University of Amsterdam:
  - MSc Artificial Intelligence (`master`).

### Batch 4 program targets

- University of Michigan–Ann Arbor:
  - one explicitly scoped undergraduate Computer Science route (`bachelor`), preferably Engineering if that is the frozen target; do not merge Engineering and LSA admissions structures into one ambiguous row;
  - Master's in Computer Science and Engineering / current exact CSE master's (`master`).
- University of Washington, Seattle:
  - BS Computer Science (`bachelor`) at the Seattle campus; do not use bare `UW` as an alias and do not imply one admission pathway covers all pathways/campuses.
- Technical University of Denmark:
  - MSc Computer Science and Engineering (`master`).
- Politecnico di Milano:
  - MSc Computer Science and Engineering (`master`).
- RWTH Aachen University:
  - MSc Data Science (`master`);
  - Human-Centered Intelligent Systems / current exact official master's name (`master`). Do not silently substitute the main Computer Science master's if its current language/application requirements make it a materially different target.

If the provisional list above freezes as expected, the catalog will contain approximately **45 programs** (14 existing + 31 new), safely inside the existing maximum of 60. The implementation must assert the actual frozen manifest rather than relying on this estimate.

## Source-freeze gate

No new catalog row may be written from a recommendation report, ranking page, search snippet, cached third-party description, or model memory.

For every new university, record and verify:

1. exact current official English/display name;
2. ISO 3166-1 alpha-2 country code from the closed side-phase allowlist;
3. stable application ID chosen once and treated as immutable after merge;
4. current canonical institutional HTTPS homepage without credentials;
5. useful collision-safe aliases only;
6. current ROR identity when present/usable, with no first-result or score-based guess;
7. any campus/college identity needed to avoid cross-scope research.

For every new program, record and verify:

1. exact current applicant-meaningful program/degree name;
2. owning university ID;
3. `bachelor` or `master` only;
4. specific subject label in the existing computing-focused vocabulary;
5. current stable official HTTPS program/application route;
6. any college/campus/track/admission-stage distinction needed for truthful Research/Guide use;
7. useful collision-safe aliases only.

Prefer stable non-year-specific routes when the institution publishes them. A year-specific page may establish that a program currently exists but should not become the catalog navigation URL when a stable canonical route is available. Record the source-freeze date separately from Research evidence freshness.

A source-freeze blocker is **not** permission to guess. Resolve it from current primary sources or revise the provisional program choice explicitly while keeping the agreed university manifest.

## Catalog schema changes

### 1. One browser-safe country source of truth

Create `lib/research/catalog/countries.ts` with a closed tuple/type/schema/label mapping for exactly:

```text
BE, CA, DE, DK, FI, GB, IT, NL, SE, TH, US
```

This module must be safe for client import and must become the single active source for:

- `researchCatalogUniversitySchema.countryCode`;
- `researchDossierSchema.target.university.countryCode`;
- catalog search filter types;
- Research form state;
- Compare form state;
- Research country `<select>` options;
- Compare country `<select>` options;
- active tests that currently duplicate `"US" | "GB" | "TH"`.

Do not replace the enum with `z.string().length(2)` or arbitrary two-character acceptance. The catalog remains fail-closed.

### 2. University bound

Change the generic university array maximum from 15 to **40**, keeping the minimum at 10. A separate side-phase release-manifest test must assert the actual shipped catalog has exactly 30 universities.

The 40-row schema ceiling is intentionally not an exact-release count: it leaves bounded headroom without making future data additions silently valid. Any future expansion still requires the release-manifest/test/doc update.

### 3. Program bound

Keep the existing program maximum of **60** unless the source-frozen manifest actually exceeds it. Do not increase it preemptively.

### 4. Global university identity/alias collisions

Extend catalog refinement so, after existing NFKC normalization:

- no university canonical name collides with another university canonical name in the same supported catalog;
- no university alias collides with another university's canonical name or alias;
- aliases remain unique within a row;
- ambiguous shorthand is omitted rather than accepted and silently returning multiple institutions.

Examples of unsafe aliases include bare `UW` when both Washington and Waterloo are present. Search remains deterministic substring matching; do not add fuzzy matching, embeddings, edit-distance retargeting, or model-assisted catalog selection.

Program aliases remain owner-scoped unless a real failing case proves a broader invariant is necessary; a program result already carries its owning university.

## Deterministic ordering

Keep the existing catalog ordering contract: country code, normalized university name, stable ID; programs remain grouped by owning university rank then degree level/name/ID according to the current schema.

Do **not** store batch priority/rank in catalog rows. Adding `BE`/`CA`/etc. will change array positions. Production logic and test fixtures must therefore never rely on `researchCatalog.universities[0]`, `[1]`, `[4]`, etc. to mean a particular institution.

Create/reuse explicit stable test target helpers by ID. Keep a generic sort-order test, but remove semantic fixture dependence on array position from Phase 5/6 and browser helpers.

## Official-host ownership hardening required by the expanded catalog

The current code has a narrow but inconsistent leading-`www` treatment:

- discovery target/dedupe matching compares the resolved homepage host literally plus subdomains;
- evidence-policy ownership normalizes away leading `www.`.

That can make a canonical homepage such as `www.example.edu` fail to recognize an official departmental host such as `cs.example.edu` during discovery while later policy code normalizes differently.

Fix this only through a narrow TDD-backed normalization shared by the relevant trusted-host comparisons:

- lowercase hostname;
- trim trailing dot;
- remove only one leading `www.` where appropriate;
- accept exact normalized host or a real dot-delimited subdomain;
- reject lookalikes such as `evil-example.edu`, `example.edu.evil.test`, or unrelated sibling domains.

**Do not** implement naive registrable/base-domain trust, `endsWith("example.edu")` without dot-boundary checks, last-two-label logic, or public-suffix guessing. Departmental/sibling ownership that does not fit the narrow normalized host boundary must be established through current application-owned publisher/ROR/source evidence, or modeled later through a separately reviewed explicit ownership allowlist if a concrete institution proves it necessary.

Audit the existing 10 catalog homepages under the same rule. Do not opportunistically rename/re-ID existing entries. One concrete planning-time case must be rechecked explicitly: the current MIT catalog row uses `https://web.mit.edu/`, while MIT's current institutional homepage is `https://www.mit.edu/` and the supported MIT program links live under `catalog.mit.edu`. If primary-source revalidation still confirms that shape, change only MIT's application-owned `websiteUrl` to the stable institutional homepage so the same narrow leading-`www` normalization can recognize legitimate MIT subdomains; preserve `university-mit`, all MIT program IDs, owners, and evidence URLs. A current canonical homepage change may otherwise be made only when primary evidence and regression coverage show it is necessary; saved IDs and program ownership remain immutable.

## Cross-mode requirements

### Research

- New-country target dossiers must validate through the public schema.
- Catalog resolver must bind every new university/program ID exactly once and reject owner mismatches.
- Program-name/subject search must continue projecting the owning university into the same result set.
- Country/degree/subject/query filters retain AND semantics and never alter an already selected target silently.
- Program-result rendering must not use the current defensive `owner?.countryCode ?? "US"` fallback. The search invariant requires every returned program owner to resolve; if that invariant is violated, fail closed/omit the malformed result rather than falsely labeling an unknown owner as United States.
- Unsupported names/IDs remain unsupported; no arbitrary URL or fuzzy retargeting.
- Dossier composer/public transport must preserve current target-binding, provenance, byte, UTF-8, cancellation, and no-internal-data boundaries.

### Compare

- Country filtering must expose all 11 supported codes from the shared source.
- The current visible-result cap (8 universities, 12 programs) is not automatically redesigned. Browser acceptance must prove every new target is practically reachable through exact canonical name/alias/country/degree/subject search. Increase/rework the cap only if a failing usability test demonstrates a real inaccessible/ambiguous path.
- Preserve exactly 2–4 targets, homogeneous university/program scope, same program degree level, immutable selection order, deterministic score/coverage semantics, and no new model call.

### Guide

- Every new Guide program must be searchable by a truthful scoped label.
- College/campus/admission-stage distinctions must prevent Research evidence for a sibling route from being treated as the selected program's requirement.
- Preserve deterministic assessment, exact evidence/applicability registries, same-scale/same-test/same-currency rules, profile-provider separation, and no admission probability.

### Saved artifacts

- Existing saved snapshots for the original 10 universities/14 programs must still validate and rebind current navigation URLs after expansion.
- New CA/EU/US Research/Comparison/Guide snapshots must validate/rebind using the same version-1 contract.
- No database migration is required merely to add catalog rows.
- Catalog expansion must not auto-refresh/research, re-score, reassess, or make old evidence current.
- Removed/reassigned target tests must remain fail-closed.

## Institution-specific edge cases that must be tested or explicitly source-frozen

- **Toronto:** St. George undergraduate admission-category vs later CS program-of-study enrollment; do not imply UTM/UTSC share the same target.
- **Waterloo:** BCS vs BMath Computer Science.
- **CMU:** School of Computer Science first-year admission/major-declaration semantics; BS CS and BS AI remain distinct degrees.
- **UBC:** BSc vs BA vs second-degree BCS.
- **McGill:** BSc vs BA; resolve thesis/non-thesis MSc application semantics before cataloging.
- **UIUC:** BS CS vs CS+X vs combined BS-MCS vs standalone MCS.
- **Aalto:** named AI/ML/Data Science study option nested in a broader master's structure.
- **Cornell:** Engineering BS vs Arts & Sciences BA; MEng vs research MS.
- **UCSD:** BS CS vs BS AI; if the AI route carries provisional/current-year policy, catalog identity remains navigation-only and Research must carry freshness/effective-period meaning.
- **KU Leuven:** advanced/specialized AI master's semantics stay in evidence/requirements; do not add a new degree-level enum just for nomenclature.
- **Michigan:** Engineering vs LSA Computer Science must not be merged into one ambiguous undergraduate target.
- **Washington:** Seattle campus and multiple admissions pathways; avoid bare `UW` alias.
- **RWTH:** English Data Science/HCIS targets vs materially different main Computer Science language/application requirements.
- **TU Delft:** current applicant-facing canonical MSc CS route must be found before row creation.
- **Alberta:** current main-campus applicant-facing Computing Science program route must be found before row creation; archived Calendar pages do not satisfy source freeze.

## Test strategy

### New focused release-manifest test

Create `tests/side-phase-university-catalog-expansion.test.ts` and table-drive at least:

- exact final set of 30 university IDs;
- exact 20 newly required university IDs;
- exact supported country tuple and 10/5/9/3/3 regional distribution;
- every new university owns at least one supported program;
- frozen expected program IDs and owner IDs;
- all official university/program URLs satisfy canonical HTTPS contract;
- ROR IDs, when present, are HTTPS `ror.org` identities and unique;
- normalized university canonical names/aliases are globally collision-free;
- no bare ambiguous `UW` alias;
- deterministic catalog ordering;
- exact-name and intended-alias search resolves the intended institution and no unrelated target after meaningful filters;
- every program search result includes its owning university;
- unsupported country code and unsupported target still fail closed.

Do not write a test that simply re-serializes the production object and compares it to itself. The required ID/source manifest should independently express the release requirement.

### Existing unit/integration suites to extend

At minimum:

- `tests/phase3a-research-catalog.test.ts` — country/bounds/public-dossier cross-contract/search/resolver expectations;
- `tests/phase2b-discovery.test.ts` — leading-`www` trusted-host normalization and malicious lookalike negatives;
- relevant evidence-policy tests — normalized official-owner agreement without broadening ownership;
- Phase 3 dossier composer/handler/client transport tests — representative `CA`, EU, and additional US target binding;
- Phase 4 form/contracts tests — shared country type, new target search, no silent retarget;
- Phase 5 contracts/state tests — explicit stable target fixtures, representative new program finalization;
- `tests/phase6a-catalog-presentation.test.ts` — explicit IDs, existing snapshot compatibility, new-country binder;
- `tests/phase6a-persistence-contracts.test.ts` — explicit IDs rather than array offsets and old/new saved-artifact binding.

### Browser acceptance

Extend deterministic Playwright without live providers:

- `tests/e2e/research-form.spec.ts` — representative Canada/EU/new-US exact search, alias, country filter, degree/subject intersection, unsupported empty state;
- `tests/e2e/compare-form.spec.ts` — representative new targets discoverable despite result caps, 2–4 selection, country filter, same-degree program rules;
- `tests/e2e/guide-form.spec.ts` — representative new scoped program selectable/searchable;
- current accessibility/responsive suites for Research/Compare/Guide — long institution/program names, Unicode/punctuation, keyboard navigation, focus, no page-level overflow;
- `tests/e2e/auth-saved.spec.ts` where current catalog binding is exercised — new target save/restore plus original target compatibility if appropriate.

Reuse the existing isolated Playwright harness, one worker, retries zero, service workers blocked, and `reuseExistingServer:false`. Never attach acceptance to an arbitrary active dev server. Never edit generated `output/playwright` snapshots as source.

## Verification matrix for implementation

Run the strongest current repository gates that exist **at execution time**, not a stale copied command list. The expected minimum is:

1. focused catalog/public-contract/discovery/Phase6A compatibility Vitest;
2. full `npm.cmd test -- --run`;
3. `npx.cmd tsc --noEmit`;
4. `npm.cmd run lint`;
5. `npm.cmd run build`;
6. `npm.cmd audit --omit=dev`;
7. focused Research/Compare/Guide/Auth-Saved Playwright in the existing dev harness;
8. current full/repeated lifecycle suites required by any touched state path;
9. built-production anonymous/core browser matrix using the existing `UNIPROOF_E2E_PRODUCTION=1` harness after a fresh production build;
10. local Supabase catalog/persistence/Auth tests only if current Phase 6A gates require them; no hosted mutation;
11. `scripts/verify-workspace.ps1`;
12. `git diff --check` through the repository's approved Git inspection path;
13. UTF-8/control/mojibake scan on changed text;
14. provider-secret/public-env/client-boundary/storage/test-backdoor scans required by current security plans;
15. confirm `.env.local` and Supabase secret-bearing temporary state were not read into output or modified by this side phase;
16. confirm the protected `ui-flow-screenshots/` set is unchanged;
17. exact final diff/status review proving no generated Playwright snapshots, unrelated Phase 6 work, secrets, or temporary research artifacts entered the intended change set.

If Phase 6B source/config/CI has landed by then, rerun its currently authoritative focused tests and release-config verification too. Do not describe older lower-level gates as equivalent to current Phase 6B evidence.

## Documentation synchronization after implementation

Only after source/data/code/tests are green, update current-state docs from observed behavior:

- `README.md` — 30 universities, 11 supported country codes/regions, actual frozen program count; remove the now-false statement that global expansion is deferred while retaining the supported-catalog boundary;
- `docs/requirements.md` — replace the old 10–15 US/UK/Thailand current MVP scope with the implemented 30-university coverage while preserving Research/Compare/Guide/Phase6 semantics;
- `docs/design.md` — shared country source, final catalog bound/count, no provider/evidence redesign;
- `docs/data-sources.md` — exact frozen catalog count/program count/country coverage and source verification date; keep the statement that catalog verification is not evidence freshness;
- `docs/security.md` and `docs/security-threat-model.md` only where the supported-identity/trust boundary or new host-normalization invariant materially changes them;
- `docs/planning/tasks.md` — mark side-phase tasks complete only from observed evidence;
- `CHANGELOG.md` — shipped catalog expansion and cross-mode compatibility;
- append `AGENT_MEMORY.md` with actual changes/verification;
- add `LESSONS.md` only if implementation discovers a reusable mistake/root cause.

Historical Phase 3 planning documents and append-only memory entries remain historical. Do not rewrite them merely because current catalog scope has grown.

## Non-goals / prohibited shortcuts

- no arbitrary university import/search outside the checked-in catalog;
- no paid-provider escalation or provider/model change;
- no live Tavily/Brave/Gemini/Groq/OpenRouter smoke just to validate catalog identity;
- no caller-supplied university/program URL trust;
- no fuzzy/AI/embedding catalog matching;
- no automatic requirements scraping into catalog rows;
- no schema field for rankings/prestige/priority batch;
- no AI admission probability or university winner/ranking;
- no new `degreeLevel` solely to represent European naming;
- no currency/GPA/test/unit conversion;
- no database migration for additive catalog rows;
- no branch/commit/push/deploy/WAF/hosted-Supabase/GitHub/Devpost action unless separately authorized;
- no deletion/overwrite of `ui-flow-screenshots/`;
- no generated `output/playwright` source edits;
- no resetting or overwriting concurrent Phase 6 working-tree changes.

## Completion criteria

Side Phase UCE is complete only when all of the following are true:

- all 20 required universities pass current primary-source freeze and are present with stable IDs;
- the final catalog has exactly 30 universities and the frozen computing program manifest, all within bounded schemas;
- the single shared country vocabulary drives catalog schema, public dossier, search/form types, and both country selectors;
- no normalized university alias/name collision exists;
- no semantic test/fixture depends on catalog array position;
- trusted-host normalization is consistent and remains narrow/fail-closed;
- original 10 IDs/14 program IDs and ownership are unchanged;
- original saved snapshots remain valid/rebindable and new-country snapshots work under schema version 1;
- Research/Compare/Guide behavior and evidence/privacy boundaries remain unchanged except for expanded supported targets;
- every new target is practically discoverable/selectable in the appropriate UI;
- all applicable focused/full unit, type, lint, build, audit, browser, local persistence, security/privacy, artifact-integrity, and current Phase6 gates pass on the final source;
- documentation reports the actual final counts and verification date without treating catalog verification as evidence freshness;
- final review finds no secrets, generated residue, unrelated work, or unauthorized external side effect.
