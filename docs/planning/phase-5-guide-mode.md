# Phase 5 — Guide Mode Architecture and Acceptance Specification

Status: implemented and locally/browser-verified on 2026-08-19 against the current Phase 0–4 working-tree baseline, including the post-Phase-4 audit fixes: required `ComparisonResult.score`, target-scoped-only comparison provenance, independent conflict/outdated rendering, `output/playwright` exclusion from root TypeScript, and `shadcn` as a development-only dependency. Guide runtime behavior described here is implemented; authentication, persistence, public deployment, and any new Guide provider/model call remain outside Phase 5.

Detailed execution runbook: `docs/superpowers/plans/2026-08-18-phase-5-guide-mode.md`.

Security threat model: `docs/security-threat-model.md`.

## 1. Goal

Deliver the MVP Guide Mode as an evidence-bound applicant-to-program assessment that turns one supported program's published requirements into clear requirement states, risks, a checklist, a deadline-aware timeline, and official next steps.

Guide must help an applicant understand what published evidence establishes and what still needs confirmation. It must never turn incomplete, incompatible, stale, conflicting, or ambiguous evidence into an admission guarantee, fabricated probability, guessed equivalency, invented deadline, or unsupported task.

## 2. Phase 5 architectural decision

Phase 5 remains a client-memory feature over the existing hardened Research boundary.

It does **not** add `/api/guide`, a new model call, a profile-aware provider prompt, authentication, or persistence.

```text
Checked-in supported program catalog
        -> Guide target + bounded applicant profile form
        -> strict GuideApplicantProfile validation in browser memory
        -> immutable GuideSubmission snapshot
        -> derive public-only ResearchModeRequest
             program target + fixed categories + optional intake/year
             NO GPA/citizenship/country/budget/test/profile payload
        -> existing executeResearchRequest()
        -> existing same-origin POST /api/research
        -> existing validated ResearchDossier
        -> closed Guide requirement registry
        -> deterministic evidence/applicability gates
        -> deterministic requirement assessments
        -> deterministic risks + checklist + timeline
        -> Guide UI + existing ClaimEvidenceSheet
```

Reasons:

- applicant profile values never enter Tavily, Brave, Gemini, Groq, OpenRouter, public retrieval, server logs, or a new API contract;
- no duplicate Research projection or browser trust boundary is created;
- Phase 3 response byte/UTF-8/schema/target binding and cancellation semantics remain authoritative;
- requirement classification stays auditable and deterministic;
- no account/database architecture is introduced before Phase 6 hardening;
- a profile edit can reuse the most recent compatible dossier in memory without another provider request;
- the feature remains small enough for hackathon scope while preserving the product's evidence-first thesis.

## 3. Non-goals

Phase 5 does not add:

- admission probability, acceptance likelihood, confidence percentage, chance labels, or admission guarantees;
- a global ranking or recommendation winner;
- fuzzy/embedding/LLM matching of requirement property names;
- applicant profile transmission to AI/search/retrieval providers;
- transcript, passport, national ID, bank statement, visa document, recommendation-letter, portfolio-file, or other document upload;
- applicant name, date of birth, email, phone number, address, account identifier, or free-form personal notes;
- automatic qualification equivalency across countries or grading systems;
- GPA conversion between scales;
- currency conversion, annual/total budget conversion, or inferred living-cost calculation;
- automatic English-test conversion or waiver eligibility inference;
- visa/legal/immigration eligibility advice;
- automatic application submission, email sending, calendar writes, or university contact;
- browser Web Storage, IndexedDB, Cache Storage, cookies, URL/query state, service workers, database persistence, or saved Guide history;
- a general profile-management account page despite the existing `My profile` navigation label;
- a new provider, dependency, background worker, queue, scheduled job, analytics script, or third-party runtime script;
- changes to Phase 2 evidence policy or Phase 3 `ResearchDossier` unless a prerequisite defect is independently proven by a regression.

## 4. Baseline contracts Phase 5 must preserve

Guide consumes only:

- the checked-in public research catalog;
- `ResearchModeRequest` and `ResearchDossier` from `lib/research/mode/public-contracts.ts`;
- `executeResearchRequest()` from `lib/research/mode/client-transport.ts`;
- the existing `ClaimEvidenceSheet` evidence/source presentation pattern.

Current Phase 4 lessons are mandatory Phase 5 design inputs:

- public dossier claim IDs are unique only inside one dossier, so every Guide factual reference is `{ targetKey, claimId }`; never reintroduce a second flat cross-result claim-ID provenance field;
- conflict and outdated are orthogonal evidence conditions and must render independently when both apply;
- result/action ownership belongs to immutable submissions, and a newer error owns its retry without duplicating a preserved result's action;
- catalog-owned official URLs are rebound from application identity before evidence display; server-returned canonical target URLs are not authoritative navigation metadata;
- field errors use stable IDs, exact `aria-describedby` relationships, and `aria-invalid` only on affected controls;
- generated Playwright source snapshots under `output/playwright` are already excluded from the canonical TypeScript program; cleanup is hygiene, not static-analysis correctness;
- `shadcn` remains a pinned development dependency and Phase 5 must not move it back into the runtime dependency graph.

Guide must not import or expose:

- Phase 2 source documents or claim candidates;
- provider history, provider/model names, raw warnings, prompt text, or discovery telemetry;
- server-only catalog resolver internals;
- API keys or provider configuration;
- arbitrary caller-supplied dossier objects.

The canonical Research categories remain unchanged. Phase 5 requests exactly:

1. `admissions`
2. `tuition`
3. `scholarships`

These categories are fixed and application-owned for Guide. The user does not toggle them, and Guide does not send a free-form Research `question`.

`support`, `research`, `outcomes`, and `program-structure` remain available in Research/Compare but are outside the minimum Guide assessment data request. This prevents Guide from multiplying provider work for facts it does not evaluate.

## 5. Target contract

Guide assesses exactly one supported **program** target.

Rules:

- university-only targets are invalid for Guide because admissions requirements are program/degree-specific;
- `programId` must resolve to its checked-in owning university in the public catalog;
- bachelor/master degree level and subject area come from the selected catalog program and are not separately free-typed by the applicant;
- filters/search must never silently retarget an already selected program;
- a completed result is owned by the immutable submission target and the validated server-returned dossier target, not by the currently edited form;
- `unsupported-target` from the server is correction-required and cannot be blindly retried until the target is explicitly reselected/replaced.

## 6. Applicant profile privacy contract

### 6.1 Data minimization

Guide collects only fields that affect a visible assessment, risk, or manual-check action.

Planned profile shape:

```ts
type GuideApplicantProfile = Readonly<{
  citizenship: string;
  currentCountry: string;
  qualification: Readonly<{
    level: "secondary" | "diploma" | "bachelor" | "master" | "doctorate" | "other";
    title: string;
    subject: string;
    gpa?: Readonly<{ value: number; scale: number }>;
  }>;
  englishTest:
    | Readonly<{ kind: "not-provided" }>
    | Readonly<{
        kind: "ielts";
        overall: number;
        components?: Readonly<{ listening: number; reading: number; writing: number; speaking: number }>;
      }>
    | Readonly<{
        kind: "toefl-ibt";
        overall: number;
        components?: Readonly<{ listening: number; reading: number; writing: number; speaking: number }>;
      }>
    | Readonly<{ kind: "pte-academic"; overall: number }>
    | Readonly<{ kind: "other"; name: string; score: string }>;
  budget?: Readonly<{
    amount: number;
    currency: string;
    scope: "annual" | "total";
  }>;
  scholarshipNeed: boolean;
}>;
```

Public Research context remains outside the profile:

```ts
type GuidePublicContext = Readonly<{
  intake?: string;
  academicYear?: string;
}>;
```

The selected catalog program supplies target degree/subject. Preferred destinations are represented by the explicit target selection. Phase 5 does not collect separate comparison-style priority weights because Guide assesses one program rather than ranking options.

### 6.2 Bounds and validation

All profile objects are strict; unknown keys are rejected by the schema used at submission time.

Text limits use JavaScript/Zod UTF-16 length semantics to match the rest of the browser contracts:

- `citizenship`: trimmed, 1–80 UTF-16 code units;
- `currentCountry`: trimmed, 1–80;
- qualification `title`: trimmed, 1–160;
- qualification `subject`: trimmed, 1–120;
- `other` English-test name: trimmed, 1–80;
- `other` score display: trimmed, 1–40;
- `intake`: existing Research bound, 1–40;
- `academicYear`: existing Research bound, 1–40.

Numeric rules:

- every number must be finite;
- GPA `scale` must be greater than 0 and at most 100;
- GPA `value` must be at least 0 and at most `scale`;
- no GPA is valid unless both `value` and `scale` are present;
- IELTS overall/components: 0–9 inclusive in 0.5 increments;
- TOEFL iBT overall: integer 0–120;
- TOEFL iBT components: integer 0–30;
- IELTS/TOEFL component scores are all-or-none so partially entered component sets cannot be misinterpreted;
- PTE Academic overall: integer 10–90;
- budget amount must be finite, greater than 0, and at most 1,000,000,000;
- budget currency must be exactly three ASCII letters and canonicalized to uppercase;
- no `NaN`, Infinity, exponent-text coercion, locale-number parsing, comma stripping, or numeric-string parsing is allowed by assessment modules.

HTML number inputs are convenience controls, not the trust boundary. Submission values must cross the Zod schema after explicit string-to-number form parsing, and blank strings must remain absence rather than becoming zero.

### 6.3 Local-only invariant

Profile values remain in React memory only. The Guide form requests no browser form-history/autofill persistence: set `autoComplete="off"` on the form and on profile controls where supported. This is defense in depth rather than a guarantee against browser/OS password managers, extensions, or privileged endpoint software.

Guide must prove in browser tests that GPA, citizenship, country, qualification text, English scores, budget, scholarship need, profile key names, and other applicant values do not appear in:

- `/api/research` request bodies;
- request URLs/query parameters;
- external HTTP(S) requests;
- cookies;
- `localStorage` or `sessionStorage`;
- IndexedDB or Cache Storage;
- service workers;
- browser history state/URL state;
- server/public error bodies;
- third-party analytics or scripts, which remain absent.

Full reload intentionally discards the profile/result. Leaving Guide through application navigation and returning must construct a fresh Guide workspace rather than restoring profile/result from application persistence. Browser back/forward behavior must be tested because browser form-history/BFCache behavior is not equivalent to application storage; the application must not deliberately serialize or restore Guide state, and controlled fields should return to the fresh initial state when the route remounts.

## 7. Immutable Guide submission

A submitted assessment freezes all values used to produce it:

```ts
type GuideSubmission = Readonly<{
  target: Readonly<{ universityId: string; programId: string }>;
  publicContext: GuidePublicContext;
  profile: GuideApplicantProfile;
  assessmentDate: string; // strict local calendar YYYY-MM-DD captured once at submit
}>;
```

Rules:

- `assessmentDate` is captured once when submission is accepted and never recomputed while rendering that result;
- tests inject/fix `assessmentDate` rather than relying on wall-clock time;
- editing the form after submission never mutates or relabels an existing result;
- Retry uses the exact immutable failed submission/public Research request;
- a new Assess action validates and snapshots the current draft;
- Clear result clears result/error/run presentation but preserves the editable draft;
- Reset profile, if provided, resets only the editable draft and dispatches no network request.

## 8. Public Research request derivation

Guide derives one public request mechanically:

```ts
{
  universityId: submission.target.universityId,
  programId: submission.target.programId,
  categories: ["admissions", "tuition", "scholarships"],
  ...(submission.publicContext.intake ? { intake: ... } : {}),
  ...(submission.publicContext.academicYear ? { academicYear: ... } : {})
}
```

Forbidden request properties include applicant profile keys and values, a free-form `question`, provider/model settings, arbitrary URLs, weights, UI state, and derived assessment values.

The derived request must pass `researchModeRequestSchema` before transport.

## 9. One-dossier in-memory reuse

Guide may keep only the most recent validated dossier in memory with its exact public research key:

```text
universityId + programId + canonical intake + canonical academicYear + fixed categories
```

Behavior:

- changing GPA, qualification, English score, country/citizenship, budget, or scholarship need while the public research key is unchanged recomputes Guide locally with zero Research request;
- changing target, intake, or academic year changes the research key and requires a new Research request;
- `Refresh requirements` explicitly refetches even if the research key is unchanged;
- a succeeded dossier may be reused;
- a partial dossier may be reused while preserving its incomplete categories and explicit retry/refresh affordance;
- a failed dossier is not considered reusable evidence;
- reuse is memory-only and never becomes a persistent cache;
- a later `unsupported-target` for a program target invalidates any previously reusable dossier for that program across intake/year contexts so stale local reuse cannot bypass the server's correction requirement;
- a refresh `network-error`/`invalid-response` preserves the prior reusable dossier and prior result, but the failed refresh owns the visible Retry; a later explicit profile-only Assess may reuse that preserved dossier locally and supersede the transient refresh error without claiming the refresh succeeded.

The reuse key must be collision-safe; prefer `JSON.stringify([universityId, programId, canonicalIntake ?? "", canonicalAcademicYear ?? "", fixedCategories])` over delimiter concatenation.

This is a single-entry reuse optimization, not a general caching subsystem.

## 10. Closed Guide requirement registry

Research claim `property` remains bounded free-form text. Guide therefore uses one application-owned exact registry. Nothing outside the registry is silently interpreted as a machine-assessable requirement.

### 10.1 Property normalization

`normalizeGuidePropertyKey()` may only:

1. trim leading/trailing whitespace;
2. lowercase with deterministic English casing;
3. normalize Unicode to NFC;
4. collapse ASCII whitespace runs;
5. replace only `:`, `-`, and `_` separators with one space;
6. collapse whitespace again.

It must not perform substring matching, stemming, edit-distance matching, embeddings, model calls, regex guessing over arbitrary sentences, or synonym expansion outside checked-in aliases.

### 10.2 Planned semantic keys

The registry initially supports the following machine-readable semantics when exact aliases and compatible values exist:

| Semantic key | Research category | Purpose |
| --- | --- | --- |
| `minimum-qualification-level` | admissions | compare applicant qualification level |
| `required-subject-background` | admissions | conservative subject-family assessment |
| `minimum-gpa` | admissions | same-scale GPA threshold only |
| `ielts-overall-minimum` | admissions | exact IELTS overall threshold |
| `ielts-component-minimum` | admissions | exact IELTS all-component threshold |
| `toefl-ibt-overall-minimum` | admissions | exact TOEFL iBT threshold |
| `toefl-ibt-component-minimum` | admissions | exact TOEFL component threshold |
| `pte-academic-overall-minimum` | admissions | exact PTE threshold |
| `application-deadline` | admissions | strict ISO date timeline/risk |
| `application-fee` | admissions | fee freshness/manual-budget context |
| `required-document` | admissions | manual checklist only; no upload/readiness claim |
| `annual-tuition` | tuition | exact currency + annual budget constraint |
| `total-tuition` | tuition | exact currency + total budget constraint |
| `scholarship-availability` | scholarships | scholarship-need risk/checklist |
| `scholarship-deadline` | scholarships | strict ISO date timeline/risk |

### 10.3 Initial exact property aliases

Phase 5 implementation must begin with the following checked-in aliases. Adding/removing an alias is a product-semantics change and requires table-driven regression coverage. Generic/ambiguous properties remain manual evidence unless explicitly listed.

- `minimum-qualification-level`: `minimum qualification level`, `minimum degree level`, `required qualification level`, `required degree level`;
- `required-subject-background`: `required subject background`, `required academic background`, `required field of study`, `required degree subject`, `subject background`;
- `minimum-gpa`: `minimum gpa`, `gpa requirement`, `minimum grade point average`, `minimum cumulative gpa`;
- `ielts-overall-minimum`: `minimum ielts overall`, `ielts overall minimum`, `minimum ielts score`, `ielts minimum score`;
- `ielts-component-minimum`: `minimum ielts component`, `ielts component minimum`, `minimum ielts band`, `ielts band minimum`;
- `toefl-ibt-overall-minimum`: `minimum toefl ibt overall`, `toefl ibt overall minimum`, `minimum toefl ibt score`, `toefl ibt minimum score`;
- `toefl-ibt-component-minimum`: `minimum toefl ibt component`, `toefl ibt component minimum`, `toefl component minimum`;
- `pte-academic-overall-minimum`: `minimum pte academic score`, `pte academic minimum`, `pte academic overall minimum`;
- `application-deadline`: `application deadline`, `admissions deadline`, `deadline`;
- `application-fee`: `application fee`, `admission application fee`, `application charge`;
- `required-document`: `required document`, `required documents`, `application document`, `application documents`, `supporting document`, `supporting documents`;
- `annual-tuition`: `annual tuition`, `annual tuition fee`, `annual tuition fees`, `tuition per year`, `yearly tuition`;
- `total-tuition`: `total tuition`, `total tuition fee`, `total tuition fees`, `total program tuition`, `program tuition total`;
- `scholarship-availability`: `scholarship available`, `scholarships available`, `scholarship availability`, `funding available`, `scholarship application available`;
- `scholarship-deadline`: `scholarship deadline`, `scholarship application deadline`, `funding deadline`.

Do **not** map ambiguous generic properties such as `tuition`, `international tuition`, `requirement`, `application requirement`, or `published deadline` unless a future explicit registry update adds and tests them.

Each semantic definition owns:

- exact normalized property aliases;
- accepted scalar type;
- accepted unit/currency/value aliases where applicable;
- whether it is time-sensitive;
- whether its cardinality is `singleton` or `collection`;
- the profile field needed for comparison;
- the only allowed comparator;
- whether it can produce definitive `meets` / `does-not-meet`, only `probably-meets`, or manual/display-only output.

All threshold, fee, tuition, availability, and deadline semantics are `singleton` within one resolved applicability context. `required-document` is explicitly `collection`: multiple distinct eligible document values are retained as separate checklist/manual-review items rather than being misclassified as a conflict. Multiple distinct eligible values for a `singleton` semantic fail closed to `unclear-requirement` unless they become disjoint through explicit compatible intake/year metadata. Guide must not infer hidden application rounds or OR/AND relationships from duplicate free-form claims.

Aliases must be unit-tested one by one. An alias change is a product-semantics change, not harmless copy editing.

## 11. Evidence eligibility gate

Before any claim can create a definitive assessment or dated factual task, Guide applies defense-in-depth eligibility checks even though the dossier is already validated.

A claim is eligible for definitive comparison only when:

- it maps through the closed Guide registry;
- its category matches the registry definition;
- its scalar type matches exactly;
- its verification state is one of `verified`, `corroborated`, or `university-reported`;
- at least one referenced dossier source is not `ranking` and not `anecdotal`;
- required unit/currency/period/intake metadata is present and exactly compatible;
- there is no competing eligible claim for the same semantic key with a different normalized factual value;
- its representative/source references still resolve in the dossier.

The following can be displayed but cannot produce a definitive `meets` or `does-not-meet`:

- `conflicting`;
- `outdated`;
- `inferred`;
- `anecdotal`;
- ranking-only evidence;
- unsupported scalar types;
- incompatible units/currencies/periods;
- duplicate inconsistent eligible facts;
- unrecognized properties.

Guide never picks a conflict winner.

## 12. Context applicability gate

### 12.1 Intake and academic year

If the applicant selected intake/academic year:

- a claim carrying explicit intake/year metadata must match exactly after the existing bounded canonical string treatment;
- an explicitly mismatched claim is not applicable to a definitive assessment;
- a time-sensitive claim with no period metadata is not silently assumed current for the selected context; it becomes manual/unclear unless its evidence model independently marks a strict current effective date that the registry explicitly supports;
- retrieval time is never treated as effective time.

If the applicant omitted intake/year:

- Guide may display current eligible claims;
- time-sensitive requirements with ambiguous applicability must carry a manual-confirmation warning;
- Guide must not invent a target cycle.

### 12.2 Date handling

`assessmentDate` is captured exactly once when a Guide submission is accepted. It is the user's **local civil calendar date** (`YYYY-MM-DD`), not a UTC-derived date. Do not derive it with `new Date().toISOString().slice(0, 10)`, because that can shift the user's calendar day near midnight. Use `getFullYear()`, `getMonth()`, and `getDate()` (or an equivalently correct local-civil helper), and inject/fix this value in tests rather than depending on the wall clock.

Machine scheduling accepts only strict ISO calendar dates (`YYYY-MM-DD`) validated as real dates.

- do not parse `January 15`, `15/01/27`, `Fall 2027`, `rolling`, or locale-dependent strings into dates;
- such strings remain visible evidence and manual-confirmation items;
- compare date-only values with date-only calendar arithmetic, not local-midnight `Date` conversions that can shift the day by timezone;
- leap days must validate correctly;
- impossible dates such as `2027-02-29` fail closed;
- a deadline before `assessmentDate` is a high-priority past-deadline risk, not a future checklist due date;
- a deadline exactly equal to `assessmentDate` is due today;
- a future deadline within 30 calendar days inclusive is an urgent deadline risk;
- beyond 30 days it remains a dated timeline item without the urgent flag.

## 13. Requirement assessment states

Every machine-assessed row has exactly one of the six required states:

| State | Meaning | Allowed evidence/logic |
| --- | --- | --- |
| `meets` | Compatible published requirement and applicant value prove the threshold/condition is satisfied | deterministic exact comparison only |
| `probably-meets` | Applicant appears aligned with a deliberately narrow application-owned broad-background rule, but formal equivalency is not proven | broad qualification/subject family only; never GPA/test conversion |
| `does-not-meet` | Compatible published requirement and applicant value prove a threshold/condition is below/not satisfied | deterministic exact comparison only |
| `missing-applicant-information` | A recognized requirement is usable, but the applicant omitted the exact field needed to compare it | no negative assumption |
| `unclear-requirement` | The published requirement itself is conflicting, outdated, operationally incomplete, unknown, duplicated inconsistently, or too ambiguous to use safely | evidence problem, not applicant failure |
| `manual-confirmation-required` | The requirement is understandable, but comparison requires an equivalency/conversion/waiver/conditional judgment outside deterministic Phase 5 rules | explicit handoff to official source/admissions |

No state implies admission outcome. UI copy must say that satisfying listed published thresholds does not establish admission.

### 13.1 State precedence

State selection must follow one deterministic precedence so the same evidence/profile combination cannot be classified differently by separate comparators:

1. **Requirement integrity first.** If a mapped requirement is conflicting, outdated for the applicable context, operationally incomplete, duplicate-inconsistent, unsupported in type/unit/period, or otherwise unsafe to interpret, return `unclear-requirement` even when the applicant also omitted a value. Do not blame missing applicant information when the requirement itself is not trustworthy enough to compare.
2. **Applicant presence second.** If the requirement is eligible and understandable but the exact required applicant field is absent, return `missing-applicant-information`.
3. **Manual comparability third.** If both sides are present but formal equivalency/conversion/waiver/conditional interpretation is required, return `manual-confirmation-required`.
4. **Deterministic negative next.** If the eligible compatible comparator proves the published threshold is not satisfied, return `does-not-meet`.
5. **Conservative positive next.** Qualification-level/subject-family alignment that cannot prove formal equivalency returns `probably-meets`.
6. **Definitive positive last.** Only a fully compatible deterministic threshold/condition explicitly authorized by the registry may return `meets`.

An `unknown` or `incomplete` Research category is represented at category/result level and must not fabricate synthetic per-semantic requirement rows that the dossier does not contain. Unrecognized claims go to the manual-review section rather than being forced into one of the mapped semantic rows.

## 14. Deterministic assessment rules

### 14.1 Qualification level

A closed ordinal is allowed only for canonical requirement values:

```text
secondary < diploma < bachelor < master < doctorate
```

`other` is never automatically ordered.

A recognized explicit **minimum** level uses the ordinal only to detect direction. If the applicant's declared canonical level is below the published minimum, Guide may produce `does-not-meet` for that published level threshold. If it is equal to or above the minimum, Guide produces `probably-meets`, not definitive `meets`, because formal award recognition/equivalency and program-specific subject conditions are not established by a self-declared generic level alone. Qualification titles are never fuzzy-parsed to infer a level; the applicant chooses the level explicitly. Any requirement that is not clearly a minimum-level condition remains manual.

### 14.2 Subject background

Guide owns a small exact subject-family alias map for the current computing MVP, for example:

- Computer Science / Computing / Software Engineering -> `computing`
- Artificial Intelligence / Machine Learning -> `ai`
- Data Science / Data Analytics -> `data`

Only exact normalized checked-in aliases enter a family.

A broad requirement explicitly registered as accepting a computing-related field may produce `probably-meets` when the applicant's exact mapped family is in the registered accepted set. It never produces definitive `meets` because formal curriculum equivalency is not established.

Unknown subject strings, multidisciplinary requirements, required prerequisite-course detail, and country-specific equivalency become `manual-confirmation-required`.

### 14.3 GPA

GPA can be definitive only when:

- the requirement value is a finite number;
- the requirement's unit maps through a closed exact scale alias to a numeric scale;
- the applicant supplied GPA;
- applicant scale equals requirement scale exactly.

Then `value >= minimum` is `meets`; otherwise `does-not-meet`.

A scale mismatch, missing unit, grade/classification text, percentile, letter grade, or country equivalency is `manual-confirmation-required`. No scale conversion is attempted.

### 14.4 English tests

Definitive comparison requires the same named supported test.

- IELTS threshold only compares with IELTS;
- TOEFL iBT only with TOEFL iBT;
- PTE Academic only with PTE Academic;
- no cross-test conversion;
- `other` test is manual-only;
- no test supplied + recognized test requirement -> `missing-applicant-information`;
- a component/band minimum requires all applicant component values; otherwise `missing-applicant-information`;
- overall score meeting a threshold does not imply missing component requirements are met;
- waiver/medium-of-instruction/conditional language is manual unless a future closed deterministic waiver contract is explicitly designed.

### 14.5 Budget and tuition

Budget is a user constraint, not an admission requirement.

The profile may retain any syntactically valid three-letter ASCII currency code for display, but deterministic tuition comparison is restricted to a checked-in Guide comparable-currency allowlist matching the current supported catalog (`USD`, `GBP`, `THB`). Expanding the supported catalog/currency set requires an explicit registry/test update rather than silently accepting every three-letter token as a known currency.

Budget is assessed separately from admission requirement rows and can create a constraint status/risk only when:

- tuition is a finite numeric claim;
- both claim and profile currency resolve to the same allowed Guide currency;
- annual budget compares only with an annual tuition semantic;
- total budget compares only with total tuition;
- the claim passes evidence/applicability gates.

No FX, living-cost estimate, duration multiplication, fee aggregation, or annual/total conversion is allowed.

Unknown/unsupported currency, incompatible currency/scope, or missing compatible period becomes a manual/incomparable budget risk, not `does-not-meet`.

### 14.6 Scholarships

Scholarship need does not change admission status.

If `scholarshipNeed` is true:

- eligible explicit availability `true` may produce an informational positive note, not a funding guarantee;
- explicit availability `false` produces a material scholarship risk;
- missing, unclear, conflicting, outdated, inferred, or incompatible scholarship evidence produces `scholarship-uncertainty`;
- award probability, amount eligibility, and competitiveness are never inferred;
- scholarship deadlines follow the strict date policy.

If scholarship need is false, scholarship evidence can remain available but must not generate unnecessary urgency/risk merely because funding is uncertain.

### 14.7 Citizenship and current country

These fields remain browser-only context.

Phase 5 does not infer nationality-specific admission, visa, fee-status, residency, or immigration eligibility.

Guide creates at most a generic manual action to confirm any citizenship/current-country-specific rules on official sources when the applicant is using international-student guidance. No country name is sent to Research providers.

### 14.8 Required documents

Guide may surface a recognized published document requirement as a checklist item, but:

- it never asks the applicant to upload the document;
- it never claims the applicant already has or lacks the document;
- it defaults to manual confirmation/readiness action unless a future explicit readiness field is designed;
- it links only to validated evidence/official targets;
- multiple distinct eligible `required-document` claims remain separate legitimate collection items, not a conflict;
- Guide does not heuristically split one free-form document string (for example `Transcript, CV and two references`) into multiple machine facts; that exact published value remains one evidence-linked item.

## 15. Unrecognized and duplicate claims

No published admissions evidence should silently disappear merely because it is not machine-assessable.

Guide results include an **Other published admissions evidence** section containing every bounded admissions claim that does not map to a closed Guide semantic, including claims whose verification/source class would exclude them from definitive assessment. The row must preserve its original verification label and exact evidence access so outdated, conflicting, inferred, anecdotal, or ranking-derived unrecognized material remains visibly qualified rather than disappearing.

Rules:

- raw claim/property/value text is rendered only as React text;
- each row retains exact evidence access and original evidence-state meaning;
- no positive/negative applicant status is manufactured from an unrecognized claim; the Guide action is manual review only;
- an unrecognized claim never creates a dated/fee/document factual task unless a later explicit registry semantic makes that derivation eligible;
- if multiple eligible `singleton` mapped claims have exactly equivalent normalized value/metadata, dedupe deterministically while retaining evidence references;
- if eligible `singleton` mapped claims disagree in one resolved applicability context, fail closed to `unclear-requirement` and expose every competing evidence reference;
- mapped `collection` semantics retain distinct eligible values as distinct items;
- duplicate claim IDs remain dossier-local and must not be treated as global across preserved/older results.

## 16. Evidence reference identity

Guide factual rows, risks, and tasks use target-scoped references even though one active Guide result has one target:

```ts
type GuideEvidenceRef = Readonly<{
  targetKey: string; // universityId::programId
  claimId: string;
}>;
```

This prevents a preserved prior dossier and a newer dossier with reused claim IDs from resolving the wrong evidence trigger.

Every evidence trigger resolves against the immutable result dossier identified by the same target key.

## 17. Result contract

Planned result structure:

```ts
type GuideResult = Readonly<{
  submission: GuideSubmission;
  researchRequest: ResearchModeRequest;
  dossier: ResearchDossier;
  status: "complete" | "partial";
  assessments: readonly GuideRequirementAssessment[];
  budgetAssessment?: GuideBudgetAssessment;
  risks: readonly GuideRisk[];
  checklist: readonly GuideChecklistItem[];
  timeline: readonly GuideTimelineItem[];
  unrecognizedAdmissions: readonly GuideManualEvidenceItem[];
}>;
```

`partial` is operational, not probabilistic. It is set exactly when the validated dossier run is `partial` or at least one of the three requested Guide category rows is `incomplete`. A valid `unknown` category does **not** by itself make the Guide result partial; it remains explicit uncertain evidence inside an otherwise complete run. A dossier run marked `failed` never produces a `GuideResult`. This status is not an admission-outcome confidence label.

There is no overall admission score.

### 17.1 Defense-in-depth Guide finalizer

Pure Guide modules must not assume every caller passes a perfect submission/dossier pair. One application-owned finalization boundary revalidates all inputs before producing derived output. A suitable shape is:

```ts
finalizeGuideResult(submissionInput, researchRequestInput, dossierInput, catalog):
  | { ok: true; result: GuideResult }
  | { ok: false; error: GuideAssessmentError }
```

Before assessment/planning it must:

- `safeParse` the Guide submission, public Research request, and `ResearchDossier`;
- prove request target equals submission target;
- prove the request categories are exactly `admissions`, `tuition`, `scholarships` in canonical order;
- prove dossier target IDs equal the immutable submission/request target and the program still belongs to the selected catalog university;
- prove dossier categories equal the Guide request categories;
- reject `dossier.run.status === "failed"`;
- prove the target still resolves in the current checked-in catalog.

A failed invariant returns one sanitized Guide workspace error (for example `guide-assessment-error` / `Guide could not safely assess the researched requirements. Try refreshing the requirements.`). Raw Zod/internal details are never shown. If a previous validated result exists, it remains visible/inspectable. Assessment/planner invariant failures must not crash rendering or expose partially trusted derived output.

## 18. Risk model

Risks are deterministic, deduplicated, stable-ordered objects with optional evidence references.

Planned risk kinds:

- `published-requirement-not-met` — high;
- `deadline-passed` — high;
- `deadline-due-today` — high;
- `deadline-within-30-days` — high;
- `conflicting-requirement` — high;
- `missing-applicant-information` — medium;
- `manual-equivalency-check` — medium;
- `unclear-or-incomplete-requirement` — medium;
- `outdated-fee-or-deadline` — medium;
- `budget-not-comparable` — medium;
- `budget-exceeded` — high when exact compatible tuition/budget proves it;
- `scholarship-unavailable` — high only when scholarship need is true and evidence explicitly says unavailable;
- `scholarship-uncertainty` — medium when scholarship need is true;
- `country-specific-manual-check` — informational/manual.

Risk ordering is application-owned: severity, then semantic order, then stable ID. No AI prioritization.

## 19. Checklist model

Checklist items are derived only from profile gaps, deterministic assessments, validated published evidence, and safe generic handoff actions.

Examples:

- add missing English test information;
- verify GPA/grade equivalency with the official admissions contact when scales differ;
- review a published requirement that Guide cannot safely assess;
- prepare/confirm a published required document;
- submit before an eligible future application deadline;
- review scholarship eligibility/application before an eligible future scholarship deadline;
- confirm the next intake when a published deadline has already passed;
- review an exact budget gap when compatible tuition exceeds budget.

Every factual checklist item referencing a requirement/deadline/fee carries `GuideEvidenceRef[]`.

Checklist items must never invent:

- a document not present in evidence;
- a deadline not present in eligible evidence;
- a fee amount not present in eligible evidence;
- an admissions contact address;
- a visa step as university-specific fact without evidence;
- a completed/readiness state the applicant never supplied.

## 20. Timeline model

Timeline is a deterministic projection of checklist items with strict valid future/due-today ISO dates.

Ordering:

1. dated items ascending by calendar date;
2. stable semantic priority for equal dates;
3. stable ID tie-breaker;
4. undated manual tasks appear in a separate `No published date` group rather than receiving guessed dates.

Past dates become risks/manual next-intake tasks and are not displayed as future due dates.

No relative date such as `two weeks before deadline` is invented unless a future product rule explicitly defines it as application-owned advice and labels it as such. Phase 5 MVP does not do so.

## 21. Official links

Guide has two URL classes with different trust rules:

- official program/university navigation is resolved from the checked-in catalog identity only; a server-returned dossier target URL must not override the catalog-owned official target URL even when the IDs match;
- exact claim evidence links come from the already validated dossier `sources` records.

External links retain `target="_blank"`, `rel="noopener noreferrer"`, and `referrerPolicy="no-referrer"` where opened in a new tab.

Guide never accepts a caller-supplied external URL, never promotes a server-returned hostile canonical target link over the catalog-owned official link, and never generates a university contact URL from string concatenation. Browser acceptance must inject a same-ID dossier with a hostile target canonical URL and prove the rendered official program/university links still use catalog-owned URLs while exact evidence-source links continue to resolve from the dossier.

## 22. Client lifecycle and race ownership

Guide follows the already-proven Research/Compare ownership principles.

### 22.1 Single flight

- one synchronous active-run guard prevents same-tick duplicate submission;
- one active Research request at a time;
- one run-owned `AbortController`;
- all mutable Guide draft controls are disabled while a network run is pending, keeping the visible form aligned with the immutable in-flight submission; Cancel and evidence inspection of a preserved result remain reachable;
- Cancel remains keyboard reachable.

### 22.2 Preserved result

When refreshing/researching over an existing result:

- prior validated result stays visible and evidence-inspectable;
- the active run banner clearly says a refresh is pending;
- cancellation restores/preserves the exact prior result unchanged;
- newer failure owns the visible Retry action;
- no duplicate retry buttons may refer to different immutable submissions without explicit labels.

### 22.3 Stale response protection

- each network run has a monotonically increasing sequence/ownership token;
- an aborted or older response can never overwrite a newer completed run;
- navigation/unmount aborts the active controller;
- releasing a mocked pending route after unmount cannot update old state;
- evidence sheet closes safely before replacing the dossier so focus is never restored to a detached trigger.

### 22.4 Profile-only recompute

When a valid reusable dossier exists and only local profile fields changed:

- no network pending state is created;
- the new immutable submission is assessed synchronously/purely against that dossier;
- old result remains immutable until explicit Assess activation;
- evidence references still bind to the dossier used by the new result.

### 22.5 Refresh failure and reuse ownership

When a force refresh for an otherwise reusable key fails with `network-error` or `invalid-response`, preserve both the previous result and its reusable dossier. The failed refresh owns the visible Retry and the UI must not claim the requirements were refreshed.

If the applicant then changes only local profile fields and explicitly presses Assess, Guide may reuse the preserved dossier with zero network request, produce a new immutable local result, supersede the transient refresh error, and show a concise notice that previously researched requirements were reused. This local reassessment must not be mislabeled as a successful refresh.

If a later Research response for a program target returns `unsupported-target`, clear/invalidate reusable evidence for that program across intake/year contexts and require explicit target correction before another assessment. Context-only edits must not bypass correction. Old evidence may remain visible only as a preserved historical result; it must not be silently reused for a new Guide submission.

## 23. Failure and retry semantics

Transport outcomes reuse existing sanitized Research meanings.

- `cancelled`: not an error; no automatic retry;
- `network-error` / `invalid-response`: safe generic error; prior result preserved if present;
- target-local `unsupported-target`: clear/correct target selection before resubmission; not blind retry;
- `sensitive-input`: should be impossible from the Guide-derived public request because applicant profile is omitted; if returned, render the stable public error without guessing the triggering profile field;
- `forbidden-origin` / invalid request / other shared request failures: fail closed and do not reinterpret as evidence unknown;
- dossier run `partial`: use processed categories, expose incomplete rows/retry/refresh;
- dossier run `failed`: no Guide assessment from that dossier; explicit retry only;
- `guide-assessment-error`: sanitized local invariant/finalization failure; preserve any previous validated result, show no partially derived new Guide result, and allow refresh/reassessment from the immutable submission as appropriate without exposing raw schema/internal details.

No automatic provider retries are added in Guide; provider retry/fallback remains owned by the existing Research pipeline.

## 24. UI architecture

`app/guide/page.tsx` becomes a thin page shell around a new Guide workspace. The static illustrative profile/requirements are removed during implementation.

Planned structure:

```text
GuideWorkspace
  -> GuideProfileForm
       -> supported program selector/search
       -> intake/year public context
       -> qualification/GPA
       -> English test
       -> citizenship/current country
       -> budget/scholarship need
       -> privacy notice
       -> Assess / Cancel / Reset controls
  -> GuideRunBanner
  -> prior/current GuideResults
       -> profile snapshot summary
       -> result/incomplete warning summary
       -> requirement rows + status text
       -> budget constraint row when applicable
       -> risks
       -> checklist
       -> timeline
       -> other published admissions evidence
       -> official links
  -> shared ClaimEvidenceSheet
```

The protected `ui-flow-screenshots/07-guide-page-desktop.png` and `08-guide-page-mobile.png` are visual references only. They are not implementation truth and must not be overwritten/deleted during Phase 5 unless the user separately authorizes it.

## 25. User-facing copy rules

Required concepts:

- profile privacy: `Your profile stays in this tab. Only the selected program and optional intake/year are sent to UniProof Research.`
- result limitation: `This checks published requirements; it does not predict admission.`
- `probably meets` must explain that formal equivalency is unconfirmed;
- `does not meet` must identify the exact compatible published threshold, not use generic rejection language;
- unknown/incomplete/conflict/outdated states must remain visibly distinct;
- manual actions must point to official/evidence links where available;
- no `eligible`, `safe`, `guaranteed`, `likely admitted`, `chance`, or similar admission-outcome wording unless specifically qualified as a published threshold comparison.

Status meaning must never rely on color alone.

## 26. Accessibility requirements

Guide must retain the global skip link and one `main` landmark.

Form:

- native labels and semantic fieldsets/legends for grouped values;
- every error has a stable ID;
- only affected controls receive `aria-invalid`;
- exact error IDs are included in `aria-describedby` along with persistent help/privacy text;
- hidden/conditional English component fields are not tabbable or described when absent;
- no positive `tabindex`;
- practical target size at least the existing 24px acceptance minimum, with normal interactive controls targeting 44px where layout permits.

Runtime:

- exactly one controlled live run/result status region; no per-row announcement spam;
- loading meaning remains textual under reduced motion;
- keyboard can select target, fill every profile group, submit, cancel, retry/refresh, clear result, and open/close evidence;
- evidence sheet retains focus trap, Escape close, and exact trigger focus restoration;
- sticky header never fully obscures focused controls at mobile sizes.

## 27. Responsive/content-stress requirements

Browser acceptance covers:

- 320x740
- 375x812
- 390x844
- 768x1024
- 1024x768
- 1440x900

Stress cases include:

- maximum bounded Unicode qualification/country/test strings;
- long program/university names;
- all six requirement states in one result;
- several risks/checklist/timeline items;
- 12 evidence sources;
- 2,000-character hostile-looking supporting text;
- high valid claim counts inherited from the Research dossier;
- missing profile fields and empty result sections;
- no page-level horizontal overflow;
- no clipped evidence controls or inaccessible sticky-header focus targets.

## 28. Security and privacy requirements

Phase 5 extends the browser privacy boundary because applicant academic/financial context becomes present in active browser memory.

Controls:

- profile stays local-only and ephemeral;
- no applicant profile API endpoint;
- no profile values in Research request;
- no profile logging/telemetry;
- no third-party runtime scripts/analytics;
- existing nonce CSP/security headers remain unchanged unless a browser regression proves a narrow compatibility need;
- no unsafe HTML sinks; applicant and evidence text render through React interpolation;
- no profile persistence in Web Storage/cookies/URL/database;
- no sensitive document collection;
- no profile values in test screenshots/traces unless invented fixtures are intentionally used;
- all fixtures use invented people/academic values;
- tests inspect outbound request bodies and fail on any profile key/value leakage;
- tests inspect browser persistence surfaces and service-worker registrations;
- build/client scans continue to prove provider secrets/internal identifiers are absent.

An already-compromised endpoint/browser extension may read active in-memory UI data; Phase 5 must not claim otherwise.

## 29. Edge-case matrix

### 29.1 Form and profile

Test at minimum:

- no target;
- university-only target attempt;
- stale/unsupported catalog target;
- target filtered out after selection;
- blank required country/citizenship/title/subject;
- whitespace-only text;
- exact max-length and max+1 UTF-16 strings, including astral Unicode;
- unknown object keys;
- GPA blank/blank, value-only, scale-only, negative, zero scale, value > scale, max bounds, NaN/Infinity;
- decimal/comma/exponent input strings;
- IELTS range and non-0.5 increments;
- incomplete IELTS components;
- TOEFL overall/component range and integer enforcement;
- PTE bounds/integer enforcement;
- `other` English test missing name/score;
- budget zero/negative/huge/NaN/Infinity;
- lowercase/mixed-case currency canonicalization;
- intake/year blank omission and max length;
- Enter in unrelated search field must not accidentally submit;
- same-tick double submit dispatches at most one Research request.

### 29.2 Registry/evidence

Test:

- every accepted exact alias;
- punctuation/whitespace normalization limits;
- near-miss/fuzzy property stays unrecognized;
- wrong category;
- wrong scalar type;
- numeric-looking string;
- boolean-looking string;
- incompatible unit/currency;
- unsupported/missing period;
- ranking-only source;
- anecdotal/inferred/outdated/conflicting evidence;
- duplicate equivalent facts;
- duplicate inconsistent facts;
- representative source mismatch cannot be resolved silently;
- unrecognized admissions evidence remains visible/manual.

### 29.3 Qualification/GPA/English

Test:

- explicit minimum qualification with applicant below -> does not meet; equal/above -> probably meets only;
- applicant `other` qualification -> manual;
- exact known computing-family match -> probably meets only;
- unknown subject -> manual;
- GPA exactly threshold, just below, above;
- scale mismatch -> manual, never conversion;
- missing GPA -> missing applicant information;
- same-test English exactly threshold and below;
- cross-test evidence -> manual/not comparable;
- component minimum with no components -> missing info;
- component minimum with one component below -> does not meet;
- overall meets but component fails -> separate truthful states;
- waiver/conditional/unrecognized English language text -> manual.

### 29.4 Dates/timeline

Test:

- valid ISO date;
- impossible leap/date;
- non-ISO/rolling text;
- yesterday/past;
- today;
- 1 day/30 days/31 days future;
- leap-day arithmetic;
- equal-date deterministic ordering;
- local-civil `assessmentDate` capture near UTC day boundaries without `toISOString()` drift;
- profile-only reassessment across a local calendar-day boundary using the same dossier, so a deadline can move future -> today -> past with zero Research request;
- intake/year mismatch;
- no selected intake/year;
- conflicting/outdated deadline;
- past deadline creates no future due item.

### 29.5 Budget/scholarships

Test:

- exact currency/scope under/equal/over budget;
- currency mismatch -> incomparable;
- annual versus total mismatch -> incomparable;
- missing budget -> no negative status;
- tuition outdated/conflicting/inferred -> no definitive budget result;
- scholarship need false suppresses uncertainty risk;
- scholarship need true + true/false/missing/conflict/outdated;
- scholarship deadline strict date behavior.

### 29.6 Lifecycle/races

Test:

- successful first run;
- partial dossier;
- failed dossier;
- cancellation before fetch, during fetch, and while response body is pending;
- unmount/navigation cancellation;
- stale old response released after newer result;
- refresh preserves old evidence and exact trigger behavior;
- refresh error owns the only Retry;
- a failed refresh preserves the prior reusable dossier without claiming refresh success;
- explicit profile-only Assess after that failed refresh reuses the preserved dossier locally, supersedes the transient refresh error, and sends zero Research requests;
- clear result after error;
- correction-required unsupported target;
- `unsupported-target` invalidates reusable evidence for the rejected program across intake/year contexts so neither old reuse nor a context-only edit can bypass correction;
- profile-only reassessment reuses dossier with zero request;
- target/intake/year change forces one request;
- explicit Refresh requirements forces one request;
- editing draft while old result exists does not mutate old snapshot;
- evidence trigger from preserved old result cannot resolve claim from new dossier with reused ID.

### 29.7 Security/privacy

Test:

- invented profile key/value markers absent from every `/api/research` body;
- zero unexpected external HTTP(S) requests from browser UI;
- zero applicant values in URL/history/storage/cookies/IndexedDB/Cache Storage;
- zero service workers;
- hostile profile/evidence strings remain inert text;
- source URLs use safe attributes;
- a schema-valid same-ID dossier carrying a hostile/different target canonical URL cannot replace catalog-owned official program/university navigation URLs;
- CSP violations remain zero through form/result/evidence flows;
- server/provider/internal names remain absent from public UI/response;
- production CSP has no development-only script exceptions.

## 30. Unit/integration test plan

Planned Vitest files:

- `tests/phase5-guide-contracts.test.ts`
- `tests/phase5-guide-registry.test.ts`
- `tests/phase5-guide-assessment.test.ts`
- `tests/phase5-guide-planning.test.ts`
- `tests/phase5-guide-state.test.ts`

Planned deterministic fixtures:

- `tests/fixtures/guide-dossiers.ts`

Fixtures must be invented, bounded, schema-valid, and cover every assessment state plus conflict/outdated/incomplete/unknown/unrecognized evidence without real applicant data.

Testing anti-patterns are prohibited:

- every Research fixture used for Guide assessment must pass `researchDossierSchema.parse()`; do not use partial object mocks that bypass the public trust boundary;
- do not add test-only APIs, production flags, browser globals, hidden state endpoints, or component props that exist only to expose internals to tests;
- do not substitute mocked call counts for observable browser behavior when lifecycle/privacy semantics can be asserted directly;
- Playwright should intercept the existing `/api/research` boundary with complete schema-valid envelopes instead of adding a Guide testing route;
- production CSP/network/privacy guards remain enabled in Guide tests; do not broadly whitelist external traffic or relax security to make fixtures pass.

## 31. Browser acceptance plan

Planned Playwright files:

- `tests/e2e/guide-form.spec.ts`
- `tests/e2e/guide-assessment.spec.ts`
- `tests/e2e/guide-lifecycle.spec.ts`
- `tests/e2e/guide-evidence.spec.ts`
- `tests/e2e/guide-accessibility.spec.ts`
- `tests/e2e/guide-security.spec.ts`
- `tests/e2e/guide-responsive.spec.ts`

Use the existing isolated dev/built Playwright architecture, one worker, zero configured retries, fail-closed external-network guards, and protected screenshot policy.

Critical Guide lifecycle/race tests must be repeated at least five times before Phase 5 closure.

## 32. Planned implementation file map

Create:

- `lib/guide/contracts.ts` — strict profile/submission/result contracts and constants;
- `lib/guide/client-form.ts` — draft parsing/validation and public Research request derivation;
- `lib/guide/requirement-registry.ts` — exact aliases, type/unit/semantic definitions;
- `lib/guide/assessment.ts` — evidence/applicability gates and six-state assessment;
- `lib/guide/planning.ts` — deterministic risks/checklist/timeline;
- `lib/guide/client-state.ts` — immutable result/run/retry/reuse reducer semantics;
- `components/guide/guide-workspace.tsx` — active request ownership and composition;
- `components/guide/guide-profile-form.tsx` — accessible target/profile form;
- `components/guide/guide-run-banner.tsx` — one live run/result status;
- `components/guide/guide-results.tsx` — result shell/profile snapshot/official links;
- `components/guide/guide-requirement-row.tsx` — status/evidence row;
- `components/guide/guide-checklist.tsx` — deterministic tasks;
- `components/guide/guide-timeline.tsx` — dated/undated tasks;
- the Phase 5 test/fixture files listed above.

Modify during implementation:

- `app/guide/page.tsx` — remove illustrative preview and mount `GuideWorkspace`;
- canonical docs only after behavior is observed and verified;
- no API route/provider/database files unless a regression proves a prerequisite defect and the architecture source of truth is updated first.

Do not modify merely for Phase 5:

- `app/api/research/route.ts` contract;
- provider adapters/order/budgets;
- Phase 2 full evidence contracts;
- Supabase auth/persistence;
- `proxy.ts`/CSP unless a failing Guide browser test proves an actual compatibility defect;
- protected `ui-flow-screenshots/`.

## 33. Implementation sequence

1. contracts and form parsing;
2. closed requirement registry;
3. evidence/applicability gates and assessment states;
4. deterministic risk/checklist/timeline planner;
5. client state, dossier reuse, cancellation/retry/race ownership;
6. Guide form/workspace UI;
7. result/evidence/checklist/timeline UI;
8. accessibility/security/responsive browser acceptance;
9. full regression matrix, final defect-first review, documentation synchronization.

Each implementation step should be regression-first where practical. Do not weaken an existing test to make Phase 5 pass.

## 34. Phase 5 completion gates

Phase 5 is locally complete only when all of the following are observed:

- static illustrative Guide values are gone from the runtime page;
- one supported program can be selected and assessed with a strict bounded profile;
- applicant profile values remain local-only and are demonstrably absent from Research/provider-bound requests;
- the existing Research route is the only network data-acquisition boundary;
- all six required assessment states are reachable and correctly distinguished;
- deterministic qualification/GPA/English/budget/deadline/scholarship rules fail closed on incompatible evidence;
- unrecognized published admissions evidence remains visible for manual review;
- conflicts/outdated/incomplete/unknown are never upgraded to positive/negative deterministic outcomes, and conflict + outdated render independently when both apply;
- every new result passes the defense-in-depth finalizer that proves submission/request/dossier/catalog target/category consistency and converts invariant failures into a sanitized workspace error rather than a render crash;
- checklist/timeline facts carry exact target-scoped evidence references and no invented dates/tasks;
- there is no admission probability or guarantee anywhere in DOM/contracts/tests;
- cancellation, stale-response, retry, dossier-reuse, and preserved-result ownership pass repeated browser tests, including failed-refresh reuse recovery and `unsupported-target` cache invalidation;
- local-civil assessment dates and strict date-only deadline arithmetic pass UTC-boundary, leap-day, past/today/30/31-day, and profile-only day-rollover regressions;
- keyboard, focus, live-region, reduced-motion, and required viewport acceptance pass;
- zero browser persistence/profile exfiltration/CSP violation is observed;
- full Phase 2–5 Vitest, dev Playwright, repeated Guide races, TypeScript, ESLint, production build, production dependency audit, built Playwright, workspace verifier, `git diff --check`, UTF-8/control scan, credential-value scan, client-boundary/provider-name/storage/backdoor scans all pass;
- final documentation describes observed behavior, not planned behavior;
- the GLM-5.3 Max main agent performs both final review stages inline with zero subagents/reviewer agents for this Phase 5 execution and records that boundary explicitly; no delegated-review evidence is expected or claimed.

## 35. Completion evidence — 2026-08-19

Observed local verification after the interrupted GLM-5.3 Max run was reviewed and corrected:

- Vitest: 447/447 across 28 files;
- development Playwright: Guide 48/48, Research 66/66, Compare 55/55 = 169/169 across all 21 E2E spec files (executed in mode groups because CodexPro enforces a 10-minute command ceiling);
- Guide lifecycle repeated five times with configured retries remaining zero: 50/50;
- built-production Playwright: Guide 48/48, Research 66/66, Compare 55/55 = 169/169;
- TypeScript, ESLint, Next.js production build, `npm audit --omit=dev`, and `npm ci --dry-run --ignore-scripts`: passed;
- workspace verifier: passed with 20 required files;
- UTF-8/control scan: 225 text files, 0 findings;
- active Guide production boundary scan: 14 Guide files, 0 dangerous HTML/storage/provider/console/test-hook findings;
- active production provider `NEXT_PUBLIC_*` scan: 0 Tavily/Brave/Gemini/Groq/OpenRouter hits;
- configured provider secret-value scan: 5 configured credentials checked across 593 source/build files, 0 value hits;
- built client static scan: 19 files, 0 provider-key/private-marker hits;
- protected UI references: 10 PNGs present and all five previously baselined hashes remained exact;
- disposable Playwright harness cleanup: 32 validated inactive `output/playwright/phase3d-dev-app-*` snapshots removed after process and containment checks, 0 remaining.

Substantive review fixes included blank-English-score defaulting, exact field-error ownership, missing registry aliases, singleton dedupe, multi-dimension context gating, tuition/scholarship/deadline evidence laundering, application-fee provenance, stale-cancel ownership, retry/correction ownership, preserved-result rendering, target-scoped evidence/focus replacement, hostile canonical URL rebinding, mobile native-select intrinsic overflow, redundant flat manual-evidence claim IDs, and target-local `unsupported-target` invalidation.

Host note: CodexPro executes verification from WSL without `node` on PATH, so `npm test` could not reach Vitest through the package-script wrapper; the complete suite was observed through `npx vitest run`. One all-in-one Playwright invocation exceeded CodexPro's hard 10-minute tool limit, so all 21 specs were executed and observed in complete Guide/Research/Compare groups instead. No live providers or deployment were used.

### Independent post-completion audit — 2026-08-19

A fresh Phase 0–5 defect-first review found and corrected additional boundary and provenance defects without changing the Phase 5 architecture:

- property normalization now collapses ASCII whitespace only, so non-ASCII whitespace cannot broaden the reviewed alias registry;
- Guide finalization binds the Research request intake and academic year back to the immutable submission snapshot;
- application-fee conflict and outdated warnings remain independent rather than mutually exclusive;
- singleton equality canonicalizes only through reviewed GPA-scale, qualification, and subject-family aliases, retaining every equivalent evidence reference without fuzzy matching;
- scholarship availability cannot become definitive for a selected intake/year when the claim lacks the required cycle metadata;
- every Guide surface carrying multiple evidence refs exposes every exact target-scoped evidence trigger;
- cancellation ownership is re-checked after the successful post-response evidence/presentation handoff before caching or publishing a result;
- Research official university/program navigation is rebound from the checked-in catalog, so a schema-valid same-ID dossier cannot replace application-owned official links;
- context-incompatible tuition, scholarship, and application-fee evidence remains inspectable in fail-closed incomparable/uncertainty/manual outputs while staying excluded from deterministic conclusions; fee review never presents the rejected amount as current.

Fresh observed verification after those fixes:

- Vitest: **457/457** across 28 files;
- development Playwright: Guide **50/50**, Research **67/67**, Compare **55/55** = **172/172**;
- Guide lifecycle repeated five times with configured retries zero: **55/55**;
- built-production Playwright: Guide **50/50**, Research **67/67**, Compare **55/55** = **172/172**;
- TypeScript, ESLint, Next.js 16.3.1 production build, `npm audit --omit=dev`, `npm ci --dry-run --ignore-scripts`, workspace verification, and CRLF-aware `git diff --check`: passed;
- `npm audit --omit=dev`: **0 vulnerabilities**;
- UTF-8/control scan: **233** text files, **0** findings;
- active Guide production boundary scan: **14** files, **0** dangerous HTML/storage/provider/console/test-hook hits;
- active production provider `NEXT_PUBLIC_*` scan: **122** files, **0** Tavily/Brave/Gemini/Groq/OpenRouter hits;
- configured credential-value scans: an earlier broad source/build pass checked all **5** configured provider credentials across **428** files with **0** value hits; the final post-build active source/build pass checked **315** files with **0** value hits;
- built static scan after the final build: **18** files, **0** provider-key-name hits;
- protected `ui-flow-screenshots/` remains at **10** PNGs and was not targeted by any write/delete operation in this audit;
- **15** exact-root, process-inactive `output/playwright/phase3d-dev-app-*` snapshots created by verification were removed after containment/process checks; **0** remain.

The production E2E harness must be launched through the documented Windows host-shell form (`set UNIPROOF_E2E_PRODUCTION=1&& npx.cmd playwright test ...`) when CodexPro is executing from WSL; a Unix-style environment prefix does not reliably reach the Windows Node process. No live provider request, deployment, commit, push, PR, release, key rotation, persistence, or Phase 6 implementation occurred.

## 36. Phase 6 boundaries retained

The following remain outside Phase 5 unless the user separately changes scope:

- Supabase migrations;
- authentication;
- Row Level Security;
- saved profiles/results/history;
- cross-device state;
- distributed public rate limiting;
- public deployment;
- production domain/TLS/HSTS policy;
- live production-provider smoke;
- GitHub Actions/release automation;
- Devpost/demo submission.

Phase 5 should end as a complete, deterministic, privacy-minimized local Guide Mode that can be hardened/deployed in Phase 6 without redesigning its evidence semantics.
