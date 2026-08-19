# Phase 5 Guide Mode Implementation Plan

> **For Codex GLM-5.3 Max:** execute every task inline in the main agent with **zero subagents**, including planning, implementation, debugging, testing, security/privacy review, accessibility review, documentation, requirements traceability, and the final defect-first review. Do not invoke a reviewer/child agent. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the illustrative `/guide` preview with a complete privacy-minimized Guide Mode that compares one applicant profile against one supported program's validated published evidence and produces deterministic requirement states, risks, a checklist, a timeline, and exact evidence/official links without predicting admission.

**Architecture:** Keep applicant profile data in browser memory only. Derive a public-only fixed-category `ResearchModeRequest`, reuse the existing hardened `executeResearchRequest()` / `POST /api/research` / `ResearchDossier` boundary, then run pure Guide modules client-side. Use a closed exact requirement registry and deterministic evidence/applicability gates. Add no `/api/guide`, provider call, auth, persistence, database migration, third-party script, or new dependency.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Zod 4.4.3, Tailwind/shadcn UI primitives already installed, Vitest 4.1.10, Playwright 1.62.1.

**Spec:** `docs/planning/phase-5-guide-mode.md`

**Completion status (2026-08-19):** Phase 5 is implemented and locally/browser-verified on top of the current Phase 0–4 working tree. The post-Phase-4 audit fixes remain intact: `ComparisonResult.score` is required; cross-dossier factual provenance is target-scoped only (`{ targetKey, claimId }`); conflict and outdated warnings render independently; catalog identity owns official navigation URLs; `output/playwright` is excluded from root TypeScript; and `shadcn` is a pinned development-only dependency.

## Global constraints

- Work from the real Git root `D:\Side Projects\UniProof` and read `LESSONS.md`, `AGENT_MEMORY.md`, `AGENTS.md`, this plan, the Phase 5 spec, `docs/requirements.md`, `docs/design.md`, and `docs/security.md` before implementation.
- Preserve any user-owned/unrelated working-tree changes. The protected `ui-flow-screenshots/` files are read-only reference material unless the user separately authorizes changing them.
- Do not add dependencies. The current stack is sufficient.
- Do not create `/api/guide`.
- Do not send applicant profile fields or values to `/api/research`, providers, logs, URLs, storage, cookies, or databases.
- Do not add authentication, Supabase persistence/RLS, public deployment, HSTS, distributed rate limiting, GitHub Actions, or live-provider calls in Phase 5.
- Do not change provider order/budgets or Phase 2 evidence-state semantics.
- Do not refactor Phase 4 Comparison merely to share helpers with Guide. Small bounded duplication (for example catalog official-link rebinding) is preferable to unrelated Phase 4 churn in this batch.
- Preserve target-scoped provenance as the one canonical factual reference representation; do not add a second flat claim-ID list to Guide results/trade-offs/tasks.
- Preserve independent conflict and outdated presentation when both evidence conditions apply.
- Use invented applicant values in tests and screenshots.
- Treat all dossier/profile strings as untrusted display data; render through React text interpolation only.
- Every machine-derived factual assessment/task/risk must resolve to exact target-scoped evidence when it depends on a published fact.
- Never produce admission probability, acceptance likelihood, winner/rank, or guarantee language.
- Implement regression-first/TDD where practical: RED -> minimal implementation -> GREEN -> refactor only while green.
- Do not weaken/delete existing tests to make Guide pass.
- Git commits remain separately permissioned by `AGENTS.md`. At each task checkpoint, use `show_changes`; commit only if the execution session has explicit user authorization for commits.
- After runtime implementation, perform the complete two-stage final review inline in the GLM-5.3 Max main agent. Zero reviewer/subagent calls are permitted for this Phase 5 execution. Never fabricate reviewer/subagent evidence.

---

## Task 0: Establish implementation baseline and protected boundaries

**Files:**
- Read: `LESSONS.md`
- Read: `AGENT_MEMORY.md`
- Read: `AGENTS.md`
- Read: `docs/planning/phase-5-guide-mode.md`
- Read: `lib/research/mode/public-contracts.ts`
- Read: `lib/research/mode/client-transport.ts`
- Read: `app/guide/page.tsx`
- Read: `components/research/claim-evidence-sheet.tsx`
- Read: `playwright.config.ts`
- Read: `ui-flow-screenshots/07-guide-page-desktop.png`
- Read: `ui-flow-screenshots/08-guide-page-mobile.png`

- [x] **Step 0.1: Inspect Git/workspace state before touching code**

Use CodexPro `git_status`/`show_changes`. Record which changes pre-exist the Phase 5 execution. Never reset, overwrite, stage, or clean them implicitly.

- [x] **Step 0.2: Record protected screenshot integrity**

Read/hash the two Guide reference screenshots and all ten protected PNG filenames. Do not copy them into test output and do not overwrite them.

- [x] **Step 0.3: Run a bounded baseline**

Run:

```text
npm test -- --run
npx tsc --noEmit
npm run lint
```

If an existing baseline fails, diagnose whether the failure is pre-existing before starting Guide. Do not bury a baseline defect inside Phase 5.

- [x] **Step 0.4: Confirm forbidden architecture is absent**

Search for existing `/api/guide`, Guide persistence, Guide provider calls, or saved applicant profile code. If any exists unexpectedly, reconcile it with the Phase 5 spec before implementation.

- [x] **Step 0.5: Review checkpoint**

Use `show_changes`. No source change should exist from Task 0 except deliberate plan status bookkeeping if authorized.

---

## Task 1: Implement strict Guide contracts and form parsing

**Files:**
- Create: `lib/guide/contracts.ts`
- Create: `lib/guide/client-form.ts`
- Create: `tests/phase5-guide-contracts.test.ts`
- Reference: `lib/research/mode/public-contracts.ts`
- Reference: `lib/research/catalog/schema.ts`

### Contract design

`lib/guide/contracts.ts` must own the strict application types/constants. Use Zod output types rather than parallel hand-maintained interfaces when possible.

Required top-level schemas/types:

```ts
export const guideQualificationLevelSchema = z.enum([
  "secondary",
  "diploma",
  "bachelor",
  "master",
  "doctorate",
  "other",
]);

export const guideApplicantProfileSchema = z.object({
  citizenship: boundedText(80),
  currentCountry: boundedText(80),
  qualification: guideQualificationSchema,
  englishTest: guideEnglishTestSchema,
  budget: guideBudgetSchema.optional(),
  scholarshipNeed: z.boolean(),
}).strict();

export const guidePublicContextSchema = z.object({
  intake: z.string().trim().min(1).max(40).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
}).strict();

export const guideSubmissionSchema = z.object({
  target: z.object({
    universityId: boundedId,
    programId: boundedId,
  }).strict(),
  publicContext: guidePublicContextSchema,
  profile: guideApplicantProfileSchema,
  assessmentDate: z.iso.date(),
}).strict();
```

Do not accept `programId` as optional.

- [x] **Step 1.1: Write RED schema tests for strict object shapes**

Cover:

- valid minimal profile;
- unknown keys at every nested object;
- no program target;
- university-only target shape rejected;
- required text blank/whitespace;
- exact max/max+1 UTF-16 lengths;
- astral Unicode boundary;
- intake/year bounds;
- assessment date strict ISO validity.

Run:

```text
npm test -- --run tests/phase5-guide-contracts.test.ts
```

Expected: RED because Guide modules do not exist.

- [x] **Step 1.2: Add GPA numeric contract tests**

Cases:

- absent GPA valid;
- both value/scale valid;
- value-only/scale-only impossible by object contract;
- negative value;
- zero/negative scale;
- value greater than scale;
- scale above 100;
- `NaN`, `Infinity`, `-Infinity` rejected;
- decimal values permitted only within bounds.

- [x] **Step 1.3: Add English-test discriminated-union tests**

IELTS:

- overall 0, 9 valid;
- 6.5 valid;
- 6.3 invalid;
- below/above range invalid;
- components all present valid;
- partial component object rejected.

TOEFL iBT:

- overall integer 0–120;
- decimals invalid;
- components integers 0–30;
- partial component object rejected.

PTE:

- integer 10–90 only.

Other:

- bounded nonblank name/score only;
- no numeric comparison semantics attached here.

- [x] **Step 1.4: Add budget tests**

Cover finite positive bound, exactly three ASCII currency letters, uppercase transform, scope enum, blank input behavior through form parsing, and no comma/exponent coercion.

- [x] **Step 1.5: Implement schemas minimally**

Keep every bound exported when tests/UI need the same source of truth.

Do not add person name/email/phone/address/free-note/document fields.

- [x] **Step 1.6: Implement `client-form.ts` parsing without browser-trust shortcuts**

Planned exports:

```ts
export type GuideDraft = Readonly<{
  universityId: string;
  programId: string;
  citizenship: string;
  currentCountry: string;
  qualificationLevel: string;
  qualificationTitle: string;
  qualificationSubject: string;
  gpaValue: string;
  gpaScale: string;
  englishKind: string;
  englishOverall: string;
  englishListening: string;
  englishReading: string;
  englishWriting: string;
  englishSpeaking: string;
  otherEnglishName: string;
  otherEnglishScore: string;
  budgetAmount: string;
  budgetCurrency: string;
  budgetScope: string;
  scholarshipNeed: boolean;
  intake: string;
  academicYear: string;
}>;

export function validateGuideDraft(
  draft: GuideDraft,
  catalog: ResearchCatalog,
  assessmentDate: string,
): GuideDraftValidationResult;

export function buildGuideResearchRequest(
  submission: GuideSubmission,
): ResearchModeRequest;

export function guideResearchKey(request: ResearchModeRequest): string;
```

Parsing rules:

- blank optional numeric strings remain absent;
- use a strict ASCII decimal parser, not `Number()` on arbitrary user text;
- reject commas, exponent notation, trailing junk, `Infinity`, and whitespace-inside-number forms;
- program must resolve to its catalog university;
- never silently rewrite a mismatched university/program pair;
- fixed Research categories exactly `admissions`, `tuition`, `scholarships` in canonical order;
- omit `question` always;
- omit blank intake/year instead of sending empty strings;
- capture `assessmentDate` once at accepted submission time using the user's local civil year/month/day; never use `new Date().toISOString().slice(0, 10)` for this field;
- make `guideResearchKey()` collision-safe, preferably `JSON.stringify([universityId, programId, canonicalIntake ?? "", canonicalAcademicYear ?? "", fixedCategories])` rather than delimiter concatenation.

- [x] **Step 1.7: Add request-leak regression**

Construct a profile containing unique invented markers in every field, build the `ResearchModeRequest`, serialize it, and assert none of the profile keys or values are present. Assert only target IDs, categories, intake, and year remain.

- [x] **Step 1.8: Run GREEN contract suite and adjacent catalog/request tests**

```text
npm test -- --run tests/phase5-guide-contracts.test.ts tests/phase3a-research-catalog.test.ts tests/phase3c-research-transport.test.ts
npx tsc --noEmit
```

- [x] **Step 1.9: Review checkpoint**

Inspect only Task 1 files. Verify no provider/API/server change.

---

## Task 2: Implement the closed requirement registry

**Files:**
- Create: `lib/guide/requirement-registry.ts`
- Create: `tests/phase5-guide-registry.test.ts`
- Reference: `lib/comparison/metric-registry.ts`
- Reference: `lib/research/mode/public-contracts.ts`

### Required design

Keep registry semantics separate from assessment logic.

Planned shape:

```ts
export type GuideRequirementSemantic =
  | "minimum-qualification-level"
  | "required-subject-background"
  | "minimum-gpa"
  | "ielts-overall-minimum"
  | "ielts-component-minimum"
  | "toefl-ibt-overall-minimum"
  | "toefl-ibt-component-minimum"
  | "pte-academic-overall-minimum"
  | "application-deadline"
  | "application-fee"
  | "required-document"
  | "annual-tuition"
  | "total-tuition"
  | "scholarship-availability"
  | "scholarship-deadline";

export type GuideRequirementDefinition = Readonly<{
  semantic: GuideRequirementSemantic;
  category: ResearchModeCategory;
  aliases: readonly string[];
  scalarType: "number" | "string" | "boolean";
  cardinality: "singleton" | "collection";
  assessmentPolicy:
    | "qualification-minimum"
    | "subject-probable"
    | "definitive-threshold"
    | "manual-only"
    | "timeline"
    | "constraint";
}>;
```

### Initial exact property aliases

Implement these aliases exactly and table-test every entry. Do not invent additional aliases during implementation merely because a fixture resembles one.

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

Generic properties such as `tuition`, `international tuition`, `requirement`, `application requirement`, and `published deadline` remain unrecognized/manual unless a later explicit registry change adds them with tests.

- [x] **Step 2.1: Write RED normalization tests**

Assert allowed normalization only: trim, English lowercase, NFC, ASCII whitespace collapse, `: - _` separator replacement.

Assert near misses do not map:

- `minimum GPAs` versus `minimum gpa`;
- `estimated IELTS requirement` versus exact aliases;
- homoglyph/lookalike strings;
- substring superstrings;
- unrelated `scholarship tuition` text.

- [x] **Step 2.2: Write exact alias tests for every semantic**

Use a table-driven test so every checked-in alias maps to exactly one semantic/category and there are no duplicates after normalization. Assert every semantic declares cardinality. All thresholds/fees/tuition/availability/deadlines are `singleton`; `required-document` is `collection` so multiple distinct required documents remain separate legitimate items instead of being treated as a conflict.

- [x] **Step 2.3: Add closed value/unit maps**

Separate exact application-owned maps:

```ts
export const guideQualificationValueAliases: ReadonlyMap<string, GuideQualificationLevel>;
export const guideSubjectFamilyAliases: ReadonlyMap<string, GuideSubjectFamily>;
export const guideGpaScaleUnitAliases: ReadonlyMap<string, number>;
```

The GPA map should contain only deliberately reviewed exact unit labels for supported scales. Do not parse arbitrary numbers from units.

- [x] **Step 2.4: Implement registry and collision assertion**

Module initialization/test helper must fail if two semantics claim the same normalized property alias.

No fuzzy fallback function is permitted.

- [x] **Step 2.5: Add tests for unsupported aliases/value types**

Unrecognized property returns `undefined`, not a best guess.

Numeric-looking strings stay strings and are not converted.

- [x] **Step 2.6: Run GREEN**

```text
npm test -- --run tests/phase5-guide-registry.test.ts tests/phase4-comparison-scoring.test.ts
npx tsc --noEmit
```

The Phase 4 registry suite is included to catch accidental shared-normalization regressions if utilities are reused.

- [x] **Step 2.7: Review checkpoint**

Confirm the Guide registry imports no model/provider modules and contains no arbitrary regex/substring classifier.

---

## Task 3: Implement evidence/applicability gates and six-state assessment

**Files:**
- Create: `lib/guide/assessment.ts`
- Create: `tests/phase5-guide-assessment.test.ts`
- Create: `tests/fixtures/guide-dossiers.ts`
- Reference: `lib/research/mode/public-contracts.ts`
- Reference: `components/research/claim-evidence-sheet.tsx`

### Required exports

```ts
export type GuideAssessmentState =
  | "meets"
  | "probably-meets"
  | "does-not-meet"
  | "missing-applicant-information"
  | "unclear-requirement"
  | "manual-confirmation-required";

export type GuideEvidenceRef = Readonly<{
  targetKey: string;
  claimId: string;
}>;

export function assessGuideRequirements(
  submission: GuideSubmission,
  dossier: ResearchDossier,
): GuideAssessmentOutput;
```

The function must be pure and deterministic.

- [x] **Step 3.1: Build strict invented dossier fixtures**

Use `researchDossierSchema.parse()` for every fixture. Provide helpers that can produce:

- ready admissions with canonical requirement claims;
- unknown admissions;
- incomplete admissions;
- conflict/outdated/inferred/anecdotal/ranking-only claims;
- 12 sources;
- reused claim IDs across two different target dossiers;
- duplicate equivalent and duplicate inconsistent semantics;
- strict ISO/non-ISO deadlines;
- tuition/scholarship cases.

Never bypass the public dossier schema in tests.

- [x] **Step 3.2: Write RED evidence-eligibility tests**

Definitive assessment allowed only for verified/corroborated/university-reported evidence with at least one eligible non-ranking/non-anecdotal source.

Assert each excluded state/source fails closed to unclear/manual display and never definitive positive/negative.

- [x] **Step 3.3: Write RED duplicate/conflict tests**

- exact equivalent `singleton` mapped values dedupe but combine evidence refs;
- distinct eligible `singleton` values in the same resolved context -> `unclear-requirement` with all exact refs;
- multiple distinct `required-document` collection values remain separate evidence-linked document tasks/manual rows rather than becoming a conflict;
- one composite free-form document value such as `Transcript, CV and two references` remains one exact evidence-linked item; never split it heuristically into multiple machine facts;
- distinct values separated by explicit incompatible intake/year context are filtered by applicability before singleton-conflict evaluation;
- no hidden application-round or OR/AND relationship is inferred from duplicate free-form claims;
- no winner selection by evidence status/source ordering;
- every unrecognized admissions claim remains in manual-review output with its original verification/source meaning, including outdated/conflicting/inferred/anecdotal/ranking-derived claims;
- unrecognized claims never create dated/fee/document factual tasks merely because their raw text resembles one.

- [x] **Step 3.4: Write RED state-precedence tests**

Prove one shared precedence across semantics: unsafe/unclear requirement wins over missing applicant data; eligible requirement + absent profile value -> missing applicant information; present but non-comparable/equivalency-required -> manual confirmation; compatible deterministic negative -> does not meet; conservative qualification/subject positive -> probably meets; only explicitly authorized fully compatible conditions -> meets. Unknown/incomplete categories must not synthesize requirement rows that do not exist.

- [x] **Step 3.5: Write qualification-level tests**

Use the ordinal only for an explicit registered minimum-level requirement. Applicant level below the minimum -> `does-not-meet`; equal or above -> `probably-meets`, never definitive `meets`, because formal recognition/equivalency is not proven by the generic self-declared level. Applicant `other`, unrecognized requirement value, or a requirement that is not clearly a minimum-level condition -> manual.

- [x] **Step 3.6: Write subject-family tests**

Only exact checked-in subject aliases may map. A recognized broad accepted family may produce `probably-meets`, never definitive meets.

Unknown applicant subject, prerequisite-course sentence, or specific curricular equivalency -> manual.

- [x] **Step 3.7: Write GPA tests**

Cases:

- equal threshold -> meets;
- above -> meets;
- below -> does not meet;
- missing applicant GPA -> missing applicant information;
- missing requirement unit -> manual;
- scale mismatch -> manual;
- numeric-looking string -> unclear/manual, never parsed;
- duplicate conflicting thresholds -> unclear.

- [x] **Step 3.8: Write English tests**

Test same-test overall thresholds and component minima separately.

No cross-test conversion.

Overall success must not mask a failing component requirement.

Unknown waiver/conditional requirement remains manual.

- [x] **Step 3.9: Write context/intake/year applicability tests**

Explicit mismatches are not definitive.

Retrieval date never substitutes for effective/intake/year applicability.

Omitted user context does not invent a cycle.

- [x] **Step 3.10: Implement assessment minimally**

Keep helper layers explicit:

```ts
resolveGuideSemanticClaims(...)
checkGuideEvidenceEligibility(...)
checkGuideContextApplicability(...)
assessQualification(...)
assessSubject(...)
assessGpa(...)
assessEnglish(...)
collectUnrecognizedAdmissions(...)
```

Do not combine all semantics into one large coercive switch with hidden parsing.

- [x] **Step 3.11: Add target-scoped reference regression**

Two separate dossiers reuse `claim-1`. Prove each `GuideEvidenceRef` includes its own `universityId::programId` key and cannot resolve the other target's claim in a helper intended for preserved/new results.

- [x] **Step 3.12: Run GREEN**

```text
npm test -- --run tests/phase5-guide-assessment.test.ts tests/phase5-guide-registry.test.ts tests/phase3c-research-format.test.ts
npx tsc --noEmit
```

- [x] **Step 3.13: Review checkpoint**

Search `lib/guide` for `parseFloat`, permissive `Number(` use on claim values, fuzzy/substring matching, model/provider imports, and admission-probability language. Any hit must be justified or removed.

---

## Task 4: Implement deterministic risks, checklist, and timeline

**Files:**
- Create: `lib/guide/planning.ts`
- Create: `tests/phase5-guide-planning.test.ts`
- Reference: `lib/guide/assessment.ts`

### Required design

```ts
export type GuideRiskSeverity = "high" | "medium" | "info";

export function buildGuidePlan(
  submission: GuideSubmission,
  dossier: ResearchDossier,
  assessment: GuideAssessmentOutput,
): Readonly<{
  budgetAssessment?: GuideBudgetAssessment;
  risks: readonly GuideRisk[];
  checklist: readonly GuideChecklistItem[];
  timeline: readonly GuideTimelineItem[];
}>;
```

- [x] **Step 4.1: Write RED strict date parser/calendar tests**

Use a dedicated date-only helper. Test:

- valid leap day;
- invalid leap day;
- invalid month/day;
- non-ISO strings;
- past/today/+1/+30/+31;
- equal date ordering;
- local-civil `assessmentDate` capture near a UTC date boundary without `toISOString()` drift;
- profile-only reassessment with the same dossier across a calendar-day boundary so one deadline can move future -> today -> past with zero Research request;
- timezone independence by never relying on local-midnight parsing. Validate civil dates first, then UTC day ordinals are acceptable for date-only arithmetic.

- [x] **Step 4.2: Write deadline risk tests**

Past -> `deadline-passed`, no future timeline due date.

Today -> `deadline-due-today`.

1–30 inclusive -> urgent risk.

31+ -> dated item, no urgent risk.

Conflicting/outdated/non-ISO -> unclear/manual, no invented date.

- [x] **Step 4.3: Write budget tests**

Only exact numeric/currency/scope evidence may compare. Keep a closed comparable-currency set for the current supported catalog (`USD`, `GBP`, `THB`). The profile may preserve another syntactically valid three-letter code for display, but an unsupported code is never treated as known/comparable merely because strings match.

- exact allowed currency + compatible scope, budget equal/above tuition -> within constraint;
- exact allowed currency + compatible scope, budget below tuition -> high budget gap;
- known currency mismatch -> medium incomparable risk;
- same unsupported/fake three-letter currency on both sides -> still incomparable;
- annual/total mismatch -> incomparable;
- missing budget -> no negative result;
- outdated/conflict/inferred tuition -> no definitive budget claim.

- [x] **Step 4.4: Write scholarship tests**

Scholarship need false: no uncertainty risk from absent scholarship evidence.

Scholarship need true:

- explicit eligible true -> informational only;
- explicit eligible false -> high material risk;
- missing/conflict/outdated/inferred -> uncertainty;
- dated deadline uses strict date policy.

- [x] **Step 4.5: Write checklist derivation tests**

Map states deterministically:

- missing applicant info -> `complete-profile` task;
- manual -> official/manual confirmation task;
- does-not-meet -> review/remediation risk task without implying rejection;
- required-document claim -> prepare/confirm task with evidence;
- future deadline -> submit/review dated task;
- past deadline -> confirm next cycle task;
- no evidence -> no fabricated document/deadline/contact.

- [x] **Step 4.6: Write deterministic dedupe/order tests**

Same semantic/evidence must not create duplicate risks/tasks.

Ordering must not depend on object insertion timing or source array order.

- [x] **Step 4.7: Implement planner**

All factual tasks/risks carry exact `GuideEvidenceRef[]`.

Generic profile/country manual actions may have zero refs but must not contain university-specific factual claims.

- [x] **Step 4.8: Run GREEN**

```text
npm test -- --run tests/phase5-guide-planning.test.ts tests/phase5-guide-assessment.test.ts
npx tsc --noEmit
```

- [x] **Step 4.9: Review checkpoint**

Search generated task templates for fabricated contact details, relative guessed dates, visa/legal claims, and guarantee/probability language.

---

## Task 5: Implement Guide client state, dossier reuse, cancellation, and retry ownership

**Files:**
- Create: `lib/guide/client-state.ts`
- Create: `tests/phase5-guide-state.test.ts`
- Reference: `lib/research/mode/client-transport.ts`
- Reference: `lib/comparison/client-state.ts`
- Reference: `components/compare/compare-workspace.tsx`

### State principles

Keep pure reducer/state transitions separate from `AbortController` refs/network effects.

Planned result state:

```ts
export type GuideResult = Readonly<{
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

No nullable fake result score/state.

- [x] **Step 5.1: Write RED reducer invariant tests**

Cover:

- initial state;
- start network run while no prior result;
- start refresh preserving prior result;
- successful result replaces preserved result;
- cancellation preserves prior result or returns idle when none;
- error preserves prior result;
- clear result removes result/error and preserves draft separately;
- stale sequence actions ignored;
- unsupported target marks correction required and invalidates reusable evidence for that rejected program target regardless of intake/year context;
- failed dossier never becomes reusable result evidence;
- sanitized local `guide-assessment-error` preserves any prior validated result and exposes no partially derived new result;
- refresh `network-error`/`invalid-response` preserves the prior reusable dossier while the failed refresh owns Retry;
- explicit profile-only reassessment after that failed refresh may reuse the preserved dossier and supersede the transient error without claiming the refresh succeeded.

- [x] **Step 5.2: Write dossier-reuse tests**

`canReuseGuideDossier(previous, newSubmission)` is true only when the collision-safe exact public Research key matches and the dossier is succeeded/partial. The key should be based on a structured tuple/`JSON.stringify`, not ambiguous delimiter concatenation.

Assert profile-only changes reuse; target/intake/year changes do not; explicit force-refresh bypasses reuse; a later `unsupported-target` invalidates the reusable entry for that target/key; and a failed refresh may preserve the prior reusable entry while owning the retry error.

- [x] **Step 5.3: Implement pure defense-in-depth finalizer**

```ts
export function finalizeGuideResult(
  submissionInput: unknown,
  requestInput: unknown,
  dossierInput: unknown,
  catalog: ResearchCatalog,
):
  | { ok: true; result: GuideResult }
  | { ok: false; error: GuideAssessmentError };
```

The finalizer calls only pure validation/assessment/planning modules. Before deriving anything it must `safeParse` the Guide submission, Research request, and public dossier; prove request target/categories equal the immutable submission; prove dossier target/categories equal the request/submission; prove the dossier program still belongs to the selected current catalog university; reject a failed dossier; and prove the target still resolves in the catalog.

Return a stable sanitized `guide-assessment-error` on any invariant failure. Never surface raw Zod/internal details and never return partially derived output. Preserve any prior validated UI result through reducer ownership rather than throwing from render.

Determine `status` mechanically: `partial` iff `dossier.run.status === "partial"` or any of the three requested Guide category rows is `incomplete`; otherwise `complete`. A valid `unknown` row does not by itself make the result partial. Do not create confidence percentages.

- [x] **Step 5.4: Implement reducer and ownership helpers**

Use immutable snapshots. Do not store React nodes, DOM elements, controllers, or functions in serializable reducer state.

- [x] **Step 5.5: Run GREEN**

```text
npm test -- --run tests/phase5-guide-state.test.ts tests/phase5-guide-planning.test.ts
npx tsc --noEmit
```

- [x] **Step 5.6: Review checkpoint**

Confirm every stale/cancel/error path has an explicit state transition and no auto-retry loop.

---

## Task 6: Replace the static Guide preview with the real form/workspace

**Files:**
- Create: `components/guide/guide-workspace.tsx`
- Create: `components/guide/guide-profile-form.tsx`
- Create: `components/guide/guide-run-banner.tsx`
- Modify: `app/guide/page.tsx`
- Reference: `components/research/research-workspace.tsx`
- Reference: `components/compare/compare-workspace.tsx`
- Reference: `components/compare/compare-form.tsx`
- Create: `tests/e2e/guide-form.spec.ts`
- Create/update helper: `tests/e2e/helpers/guide-browser.ts`

- [x] **Step 6.1: Write RED browser test proving illustrative preview is gone**

Assert the runtime page does not contain the static demo values:

- `Malaysia`
- `3.40 / 4.00`
- `THB 1.2M total`
- `Illustrative UI preview`

Assert a real supported-program form is visible instead.

- [x] **Step 6.2: Write RED target-selection tests**

- program selection required;
- no university-only Assess path;
- search by program/university aliases using existing catalog search semantics where reusable;
- selection remains visible when filters change;
- no silent retarget;
- server unsupported target forces explicit correction.

- [x] **Step 6.3: Write RED field validation tests**

Cover visible errors/`aria-invalid`/described-by for every group and numeric boundary. Check stale errors clear after correction.

- [x] **Step 6.4: Write RED request-shape/privacy test**

Intercept `/api/research`. Fill each profile field with a unique marker. Submit.

Assert JSON body equals exactly the public target/categories/context shape and contains none of the profile markers/keys.

- [x] **Step 6.5: Implement `GuideProfileForm`**

Reuse existing UI primitives and catalog data. Keep controlled draft strings so blank numeric fields do not become zero.

Set `autoComplete="off"` on the Guide form and profile controls where supported to request no browser form-history/autofill retention. Treat this as defense in depth, not as protection from privileged browser extensions/OS tooling.

Include persistent privacy text near submission controls.

Use explicit `type="button"` for non-submit controls. Search Enter must not submit accidentally.

- [x] **Step 6.6: Implement `GuideWorkspace` request ownership**

Use:

```ts
executeResearchRequest(researchRequest, controller.signal)
```

Requirements:

- synchronous active-run ref prevents same-tick duplicates;
- one AbortController;
- mounted/sequence ownership guard;
- exact immutable submission snapshot;
- all mutable Guide draft controls disabled during a network run so the form cannot visually drift from the in-flight snapshot; Cancel and preserved-result evidence remain reachable;
- reusable dossier path performs no fetch and still passes through `finalizeGuideResult()` before replacing UI state;
- network path preserves prior result;
- every returned dossier/result path passes through the pure defense-in-depth finalizer before derived Guide output is committed;
- a finalizer/invariant failure becomes the sanitized `guide-assessment-error` state instead of a render crash;
- `unsupported-target` invalidates reusable evidence for the rejected program target across intake/year contexts before correction-required UI is shown;
- unmount abort;
- no applicant profile logging.

- [x] **Step 6.7: Implement `GuideRunBanner`**

One controlled live status only. Text must distinguish:

- researching published requirements;
- local profile reassessment (if announcement is needed, it should be immediate/non-loading);
- cancelled;
- partial result;
- error;
- completion.

Do not expose fake progress percentages.

- [x] **Step 6.8: Reduce `app/guide/page.tsx` to page shell**

Preserve `ModeShell`, semantic main, and design direction. Remove all static demo arrays.

- [x] **Step 6.9: Run focused Guide form browser suite**

```text
npx playwright test tests/e2e/guide-form.spec.ts
npm test -- --run tests/phase5-guide-contracts.test.ts tests/phase5-guide-state.test.ts
npx tsc --noEmit
```

- [x] **Step 6.10: Render/visually inspect desktop and mobile**

Use fresh test screenshots/output paths, not `ui-flow-screenshots/`.

Confirm the protected screenshots remain unchanged.

- [x] **Step 6.11: Review checkpoint**

Inspect request bodies and code imports. No `/api/guide`, provider module, persistence API, or profile network leakage.

---

## Task 7: Implement Guide result, exact evidence, risks, checklist, and timeline UI

**Files:**
- Create: `components/guide/guide-results.tsx`
- Create: `components/guide/guide-requirement-row.tsx`
- Create: `components/guide/guide-checklist.tsx`
- Create: `components/guide/guide-timeline.tsx`
- Modify: `components/guide/guide-workspace.tsx`
- Reuse: `components/research/claim-evidence-sheet.tsx`
- Create: `tests/e2e/guide-assessment.spec.ts`
- Create: `tests/e2e/guide-evidence.spec.ts`

- [x] **Step 7.1: Write RED browser test for all six states**

Use deterministic mocked `ResearchDossier` responses so one result renders:

- Meets
- Probably meets
- Does not meet
- Missing applicant information
- Unclear requirement
- Manual confirmation required

Assert text labels, not colors/classes only.

- [x] **Step 7.2: Add no-admission-probability browser assertion**

Search rendered DOM for forbidden language patterns such as `% chance`, `admission probability`, `likely admitted`, `guaranteed admission`, `acceptance chance`, and winner/rank language.

Keep the explicit limitation copy visible.

- [x] **Step 7.3: Write RED conflict/outdated/incomplete tests**

Prove they remain warnings/manual/unclear and never turn into positive/negative deterministic status. Include one ready category/result carrying both conflict and outdated conditions and assert both are visibly rendered independently rather than one masking the other.

Also prove two legitimate `required-document` collection claims render as separate evidence-linked items and one composite free-form document string remains one item rather than being heuristically split.

A partial dossier must still show usable admissions rows while exposing incomplete categories.

- [x] **Step 7.4: Write RED evidence trigger tests**

Each factual row opens the exact claim in the shared `ClaimEvidenceSheet`.

Test:

- representative source first;
- 12 sources;
- hostile-looking supporting text inert;
- exact source links;
- Escape closes;
- focus returns to exact trigger;
- reused claim ID across preserved/new target dossiers cannot resolve the wrong evidence.

- [x] **Step 7.5: Implement requirement rows/results shell**

Use target/server names from result dossier and profile values from immutable submission snapshot.

Current draft changes must not relabel old results.

- [x] **Step 7.6: Implement risks**

Display severity text plus description. Do not use color as sole encoding.

Each evidence-backed risk gets exact evidence actions.

- [x] **Step 7.7: Implement checklist**

No checkbox persistence. If visual checkboxes are used, they remain current-render state only and are not required for acceptance; simplest MVP is an ordered task list with factual evidence links.

Avoid adding a second state machine just for task completion unless the requirement explicitly needs it. YAGNI preference: display checklist tasks, do not build persistent completion tracking.

- [x] **Step 7.8: Implement timeline**

Separate dated tasks from `No published date`. Render ISO date in a human-readable deterministic format using date-only components without timezone shifts.

Past deadline risks must not appear as future due items.

- [x] **Step 7.9: Implement official links**

Resolve official program/university navigation from the checked-in catalog only. Use validated dossier `sources` only for exact evidence-source links. Add a browser regression with matching target IDs but hostile server-returned target canonical URLs and prove those URLs cannot replace catalog-owned official links. Keep safe external-link attributes and accept no caller-generated URLs.

- [x] **Step 7.10: Run focused browser/unit suites**

```text
npx playwright test tests/e2e/guide-assessment.spec.ts tests/e2e/guide-evidence.spec.ts
npm test -- --run tests/phase5-guide-assessment.test.ts tests/phase5-guide-planning.test.ts
npx tsc --noEmit
```

- [x] **Step 7.11: Review checkpoint**

Inspect evidence mapping and visible copy for target/profile snapshot ownership and overclaiming.

---

## Task 8: Prove lifecycle races, local dossier reuse, and recoverable errors

**Files:**
- Create: `tests/e2e/guide-lifecycle.spec.ts`
- Modify if defect found: `components/guide/guide-workspace.tsx`
- Modify if defect found: `lib/guide/client-state.ts`

- [x] **Step 8.1: First successful run**

Exactly one Research request; exact public request shape; deterministic result.

- [x] **Step 8.2: Same-tick duplicate submission**

Trigger rapid duplicate form submission. Assert one request.

- [x] **Step 8.3: Cancellation**

Hold request pending, cancel, prove exactly one abort/zero auto-retry, editable draft preserved.

- [x] **Step 8.4: Preserved result refresh**

Complete result A, start forced refresh, assert A stays visible/evidence-usable, cancel, assert A unchanged.

- [x] **Step 8.5: Newer refresh error ownership**

Prior result remains; only one Retry for the exact failed immutable submission; edits to current draft do not alter Retry body. A `network-error`/`invalid-response` refresh failure preserves the prior reusable dossier but does not claim refresh success.

Then change only local profile fields and explicitly Assess: assert the preserved dossier is reused with zero network request, a new immutable local result is produced, the transient refresh error is superseded, and the UI says previously researched requirements were reused rather than refreshed.

- [x] **Step 8.6: Profile-only dossier reuse**

Complete one research run. Change only GPA/English/budget/profile fields. Assess again.

Assert zero new `/api/research` request and updated deterministic statuses against the same dossier. Also inject a new local `assessmentDate` on a later civil day while the public Research key is unchanged and prove deadline status can truthfully move future -> today -> past with zero Research request.

- [x] **Step 8.7: Public research key changes**

Change target/intake/year separately and prove each requires exactly one new Research request.

- [x] **Step 8.8: Force refresh**

Same key + `Refresh requirements` must issue exactly one request.

- [x] **Step 8.9: Stale old response**

Run A pending, cancel/restart B, complete B, release A last. Assert A cannot overwrite B.

- [x] **Step 8.10: Unmount/navigation**

Navigate to Research/Compare while Guide request pending. Assert abort; releasing request later cannot update old page. Returning to Guide starts fresh because profile is memory-only.

- [x] **Step 8.11: Evidence replacement focus safety**

Open evidence on preserved result while a refresh is pending. On successful replacement, close safely before detached trigger removal; no console error/focus exception.

- [x] **Step 8.12: Partial and failed dossiers**

Partial usable result retains incomplete category warnings and refresh/retry. Failed dossier produces no Guide assessment.

- [x] **Step 8.13: Unsupported target correction**

Server `unsupported-target` requires explicit reselection. Retry must not blindly resubmit it. Invalidate any reusable dossier for that rejected program target across intake/year contexts before correction-required state is exposed, and add regressions proving neither old reuse nor a context-only edit can bypass the later server rejection.

- [x] **Step 8.14: Repeat lifecycle suite five times**

First run once:

```text
npx playwright test tests/e2e/guide-lifecycle.spec.ts
```

Then:

```text
npx playwright test tests/e2e/guide-lifecycle.spec.ts --repeat-each=5
```

Retries remain zero.

- [x] **Step 8.15: Fix any observed race regression-first and rerun**

Do not dismiss intermittent failures without root-cause evidence.

---

## Task 9: Accessibility, responsive, security, and privacy acceptance

**Files:**
- Create: `tests/e2e/guide-accessibility.spec.ts`
- Create: `tests/e2e/guide-responsive.spec.ts`
- Create: `tests/e2e/guide-security.spec.ts`
- Modify Guide components only when a failing browser regression proves a defect
- Reference: existing Research/Compare accessibility/security suites

### Test integrity rules

- Route-intercept only the existing `/api/research` boundary with complete schema-valid Research envelopes; every dossier fixture must pass `researchDossierSchema.parse()`.
- Do not add test-only APIs, production feature flags, browser globals, hidden state endpoints, or props whose only purpose is exposing internals to Playwright.
- Prefer observable lifecycle/privacy assertions over mocked implementation call counts.
- Do not weaken CSP, external-network guards, storage checks, or production validation to make Guide fixtures pass.

### Accessibility

- [x] **Step 9.1: Skip link/main landmark/heading structure**

First-tab skip link remains reachable and focuses Guide `main`. Exactly one main landmark. Coherent visible headings.

- [x] **Step 9.2: Form semantics**

Native labels, fieldsets/legends, exact described-by error IDs, only affected `aria-invalid`, conditional English fields not ghost-described/tabbable.

- [x] **Step 9.3: Keyboard complete flow**

Keyboard reaches target search/selection, every profile group, Assess, Cancel, Retry/Refresh, Clear result, evidence actions, official links.

- [x] **Step 9.4: Focus visibility and target sizes**

No positive tabindex. Focus treatment visible. Relevant controls meet established practical size checks.

- [x] **Step 9.5: One controlled live status**

No skeleton/status announcement spam. Reduced-motion still conveys loading/completion text.

- [x] **Step 9.6: Sticky header occlusion checks**

At 320/375/390 widths, focused controls are not fully hidden by sticky header.

### Responsive/content stress

- [x] **Step 9.7: Six required viewports**

Run full valid result with all sections at 320x740, 375x812, 390x844, 768x1024, 1024x768, 1440x900.

Assert `scrollWidth <= clientWidth` at page level.

- [x] **Step 9.8: Long/Unicode/high-evidence stress**

Use maximum bounded invented profile text, long program name, all states, multiple risks/tasks, 12 sources, 2,000-character supporting text, and high valid claim count. No clipping/runtime error.

### Security/privacy

- [x] **Step 9.9: Profile network-leak test**

Use unique marker strings/numbers in every profile field. Capture every browser request. Assert profile keys/values absent outside the DOM/memory and absent from Research body.

- [x] **Step 9.10: Persistence/storage test**

After complete Guide flow, assert:

- `localStorage.length === 0` for Guide-created state;
- `sessionStorage.length === 0`;
- no Guide cookies;
- no IndexedDB databases created by Guide;
- no Cache Storage entries;
- zero service-worker registrations;
- URL contains no profile query/hash/history serialization;
- Guide form/profile controls request `autocomplete="off"` where supported;
- a full page reload returns to a fresh empty Guide state;
- navigate away through the app and return to Guide: no profile/result is restored by application state;
- exercise browser Back/Forward around the Guide route and prove the application does not deliberately serialize/restore profile state; if the browser itself preserves a BFCache/form-history snapshot, document that browser behavior explicitly rather than misreporting it as app persistence.

Account for any framework-owned state only by exact documented allowlist; do not use broad exemptions.

- [x] **Step 9.11: CSP/security headers**

Record zero CSP violations through Guide form/result/evidence flows. Verify every public HTML route still carries expected headers and fresh nonce behavior.

- [x] **Step 9.12: XSS-shaped profile/evidence**

Insert script/HTML/URL-shaped strings into allowed profile text fields and mocked evidence. Assert inert text, no executable DOM, no navigation side effect.

- [x] **Step 9.13: Provider/internal exposure**

Assert provider names/key names/raw internals do not appear in rendered Guide DOM or public response beyond project-approved explanatory docs that are not runtime data.

- [x] **Step 9.14: Run security/accessibility/responsive suites**

```text
npx playwright test tests/e2e/guide-accessibility.spec.ts tests/e2e/guide-responsive.spec.ts tests/e2e/guide-security.spec.ts
```

- [x] **Step 9.15: Review checkpoint**

No CSP relaxation, storage addition, or third-party script is acceptable as a convenience fix.

---

## Task 10: Full regression, built-browser acceptance, cleanup, and final review

**Files:**
- All Phase 5 changed files
- `docs/planning/phase-5-guide-mode.md`
- `docs/requirements.md`
- `docs/design.md`
- `docs/security.md`
- `docs/security-threat-model.md`
- `SECURITY.md`
- `docs/planning/tasks.md`
- `README.md`
- `CHANGELOG.md`
- `AGENT_MEMORY.md`
- `LESSONS.md` only if an actual reusable correction was discovered

- [x] **Step 10.1: Full Vitest**

```text
npm test -- --run
```

Do not report “all tests passed” unless the complete relevant set actually ran and was observed.

- [x] **Step 10.2: Type/lint/build**

```text
npx tsc --noEmit
npm run lint
npm run build
```

If root TypeScript points into `output/playwright`, verify canonical source first and follow the existing generated-snapshot lesson rather than editing good source to satisfy stale copies.

- [x] **Step 10.3: Production dependency audit**

```text
npm audit --omit=dev
npm ci --dry-run --ignore-scripts
```

No dependency addition is expected in Phase 5.

- [x] **Step 10.4: Full dev Playwright**

```text
npm run test:e2e
```

One worker, zero retries, no external-network leaks.

- [x] **Step 10.5: Repeat Guide lifecycle**

```text
npx playwright test tests/e2e/guide-lifecycle.spec.ts --repeat-each=5
```

- [x] **Step 10.6: Built-application Playwright**

Use the existing `UNIPROOF_E2E_PRODUCTION=1` path exactly as documented by `playwright.config.ts` for the host shell.

Run the complete E2E suite against the built app.

- [x] **Step 10.7: Workspace/diff/encoding/secret/privacy scans**

Run/perform:

- `scripts/verify-workspace.ps1`;
- `git diff --check` through approved Git tooling/host command;
- strict UTF-8/control-character scan excluding generated/binary/protected areas appropriately;
- real configured credential-value scan without printing secrets;
- provider `NEXT_PUBLIC_*` exposure scan;
- application source scan for dangerous HTML sinks, storage/persistence additions, profile logging, provider imports in `lib/guide`, test backdoors;
- final `.next/static` scan for provider key values/internal profile markers.

- [x] **Step 10.8: Inspect/clean disposable Playwright snapshots safely**

Only remove task-created inactive reproducible snapshots inside validated `output/playwright/` targets under the standing cleanup authorization. Dry-run/containment/process checks first. Never touch `ui-flow-screenshots/`.

- [x] **Step 10.9: Verify protected screenshot integrity**

Rehash all protected Guide/reference PNGs and compare with the Task 0 baseline. Any unexpected change blocks completion until explained/restored with user authorization.

- [x] **Step 10.10: Two-stage defect-first inline review**

Stage A: Phase 5 spec compliance.

Trace every requirement/status/privacy/date/race/evidence rule from `docs/planning/phase-5-guide-mode.md` to code + tests.

Stage B: code/security/privacy quality.

Look for impossible states, duplicate provenance representations, stale ownership bugs, over-collection, unsafe coercion, misleading copy, dead branches, unnecessary abstractions/dependencies, and profile leakage.

Fix findings regression-first and rerun affected/full gates.

- [x] **Step 10.11: Record zero-subagent review boundary**

This Phase 5 batch is executed by GLM-5.3 Max under the explicit zero-subagent policy. Do not invoke a native-GPT or other reviewer. Record that both final review stages were performed inline by the main GLM-5.3 Max agent and that no child reviewer evidence exists or is claimed.

- [x] **Step 10.12: Synchronize canonical docs from observed implementation**

Update only observed facts:

- `docs/requirements.md` implementation status;
- `docs/design.md` Phase 5 from planned to implemented;
- `docs/security.md` / threat model controls actually implemented/verified;
- `SECURITY.md` current invariants;
- `docs/planning/tasks.md` Phase 5 checkboxes;
- README current state;
- CHANGELOG `Unreleased`;
- append `AGENT_MEMORY.md` with actual verification counts/findings.

Add `LESSONS.md` only for an actual reusable mistake/root cause discovered during implementation.

- [x] **Step 10.13: Final workspace review**

Use `show_changes` and inspect exact intended files. Preserve unrelated prior changes and protected untracked screenshots. No deployment, commit, push, PR, or release unless separately authorized.

---

## Required acceptance traceability

The implementation is not complete until these requirements each have at least one deterministic test:

| Requirement | Primary unit/browser evidence |
| --- | --- |
| one supported program only | contracts + Guide form |
| strict bounded profile | contracts + form |
| profile stays browser-memory-only | Guide security |
| no profile in Research/provider request | contract leak test + browser request capture |
| existing Research boundary only | form/lifecycle + source review |
| exact closed property registry | registry unit tests |
| verified/corroborated/university-reported definitive eligibility | assessment tests |
| conflict/outdated/inferred/anecdotal/ranking excluded from definitive status | assessment + browser |
| six Guide states | assessment + browser |
| no GPA/test/FX/unit/period guessing | assessment/planning |
| strict ISO date-only scheduling | planning tests |
| past/today/30/31-day deadline semantics | planning tests |
| budget exact currency/scope only | planning tests |
| scholarship need semantics | planning tests |
| unrecognized admissions evidence remains visible | assessment + browser |
| exact target-scoped evidence | assessment + evidence browser |
| conflict and outdated render independently when combined | assessment + browser |
| catalog-owned official target links resist hostile dossier canonical URLs | evidence browser |
| defense-in-depth finalizer rejects submission/request/dossier/catalog mismatches | state/finalizer tests |
| sanitized local assessment failure preserves prior validated result | state + lifecycle |
| deterministic risks/checklist/timeline | planning + browser |
| local-civil assessment date avoids UTC rollover | contracts/planning + lifecycle |
| no admission probability/guarantee | source/DOM tests |
| immutable submission | state + lifecycle |
| same-tick single flight | lifecycle |
| cancellation/unmount/stale protection | lifecycle repeated |
| preserved-result/retry ownership | state + lifecycle |
| failed refresh preserves reusable prior dossier but owns Retry | state + lifecycle |
| profile-only dossier reuse | state + lifecycle |
| profile-only reassessment can advance assessmentDate with zero Research call | planning + lifecycle |
| unsupported-target invalidates reusable evidence | state + lifecycle |
| explicit refresh | lifecycle |
| keyboard/focus/live region/reduced motion | accessibility browser |
| six responsive viewports + stress | responsive browser |
| zero Guide storage/cookie/service worker | security browser |
| CSP/XSS/external-link safety | security + evidence browser |
| full Phase 2–5 regression | final matrix |

## Completion record — 2026-08-19

Phase 5 was completed after reviewing and correcting the interrupted GLM-5.3 Max implementation. Final observed evidence: Vitest 447/447 across 28 files; development Playwright Guide 48/48 + Research 66/66 + Compare 55/55 = 169/169; Guide lifecycle repeat 50/50 with configured retries zero; built-production Playwright 169/169; TypeScript, ESLint, production build, production dependency audit, install dry-run, workspace verifier, CRLF-aware Git whitespace check, UTF-8/control scan, credential-value scan, provider-public-exposure scan, Guide production-boundary scan, built-client scan, and protected screenshot integrity all passed.

The all-in-one Playwright invocation exceeded CodexPro's 10-minute tool ceiling, so all 21 E2E spec files were executed in complete Guide/Research/Compare groups in both development and built-production modes. CodexPro's WSL shell has no `node` on PATH, so the complete Vitest suite was executed via the working Windows-Node bridge `npx vitest run` rather than the nonfunctional `npm test` wrapper. No live provider calls, deployment, commit, push, PR, release, or subagent/reviewer were used.

Review fixes included evidence-gate reuse in tuition/scholarship/deadline planning, exact retry and preserved-result ownership, target-scoped evidence/focus replacement, target-local `unsupported-target` invalidation across context edits, mobile native-select intrinsic-width containment, sanitized finalization errors, and removal of redundant flat manual-evidence claim IDs.

## Stop/escalation conditions during implementation

Stop and elevate to the user before proceeding if completion would require any of the following:

- sending applicant profile/private values to the server or an external provider;
- adding authentication/persistence/RLS earlier than Phase 6;
- changing Phase 2 evidence status semantics;
- adding a new model/provider call for Guide assessment;
- introducing an applicant-data API endpoint;
- adding a paid service/dependency;
- collecting sensitive documents or identity/contact data;
- converting grading systems/currencies/test scores with an external service or heuristic;
- destructive cleanup of user-owned/protected files;
- public deployment/publication or GitHub release actions.

For ordinary implementation defects, test failures, layout corrections, or bounded contract refinements that stay inside this architecture, fix automatically and continue through the complete Phase 5 scope.
