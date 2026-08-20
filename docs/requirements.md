# UniProof MVP Requirements

## Goal

Build a functional evidence-first university decision tool for international students during the Pixel Forge AI Hackathon.

## MVP Scope

- Responsive English-language web application.
- A checked-in supported catalog of 30 universities and 45 computing programs across Belgium, Canada, Denmark, Finland, Germany, Italy, the Netherlands, Sweden, Thailand, the United Kingdom, and the United States; arbitrary/global university ingestion remains out of scope.
- Initial focus on Computer Science, Artificial Intelligence, Data Science, and closely related programs.
- Bachelor’s and taught master’s program research where data is available.
- Three complete modes: Research, Comparison, and Guide.

## Research Mode

The system shall:

- Search or select supported universities and programs.
- Present admissions, tuition, scholarships, program structure, research, outcomes, and student-support information when evidence exists.
- Store and expose source links and evidence metadata for important factual claims.
- Display missing, conflicting, outdated, anecdotal, and inferred information explicitly.
- Provide direct official links for critical application information.
- Use AI for structured claim extraction and semantic reconciliation of differently worded evidence while preserving exact supporting source references.

## Comparison Mode

The system shall:

- Compare exactly two to four unique supported targets in one homogeneous scope: all university-only or all program targets; program comparisons shall use the same degree level.
- Reuse the validated Research Mode dossier boundary for every selected target and shall not accept caller-supplied dossier data through a new comparison API.
- Execute target research sequentially, not through browser fan-out, with one comparison-owned cancellation boundary and immutable request ownership.
- Let users include or exclude the seven canonical Research categories. Rankings and student opinions shall be represented as explicit evidence-display filters because the current evidence model treats them as source/evidence classes rather than canonical categories.
- Let users choose five visible integer relative priority weights from 0–100 for affordability, research opportunities, scholarships, outcomes, and international-student support. Raw slider values do not need to total 100; at least one must be positive, and deterministic scoring shall normalize them as `raw_i / sum(raw_weights)`.
- Use an application-owned closed metric registry over exact normalized claim-property aliases and compatible typed scalar values. The system shall not fuzzy-match properties, parse numeric-looking strings, convert currencies/units, infer effective periods from retrieval time, or choose a conflict winner for scoring.
- Allow only verified, corroborated, or university-reported evidence from at least one non-ranking/non-anecdotal source to contribute to numeric fit. Conflicting, outdated, inferred, anecdotal, and ranking-only evidence shall remain visible when applicable but shall not contribute to Phase 4 fit.
- Keep missing or unscorable evidence separate from poor fit. Missing dimensions shall reduce weighted evidence coverage instead of contributing a zero score.
- Suppress an overall numeric fit when fewer than two positive-weight dimensions are scored or weighted evidence coverage is below 50%.
- Produce a transparent user-priority compatibility score within the selected comparison set rather than an objective university ranking, winner label, prestige score, or admission probability.
- Preserve result-card order by immutable user selection order rather than automatically sorting universities/programs by fit.
- Generate material trade-offs and evidence-gap explanations deterministically from validated comparison facts, with exact target-scoped claim references for factual statements across independent dossiers and no additional AI scoring/explanation call.
- Keep live Comparison working state out of Web Storage, IndexedDB, cookies, and URL state. Phase 6A may persist an explicit signed-in private Comparison snapshot, including the raw relative weights, only through the versioned user-scoped saved-artifact boundary.
- Collect no applicant profile or other private personal information in Compare; optional intake/academic-year fields are public research context only.

Detailed Phase 4 behavior, formulas, edge cases, security controls, and acceptance gates are defined in `docs/planning/phase-4-comparison-mode.md`.

Implementation status (2026-08-18): the Phase 4 requirements above are locally implemented and passed the post-review unit, dev-browser, built-browser, type, lint, build, audit, security/privacy, and artifact-integrity matrix recorded in that specification. Public deployment, durable distributed Research rate limiting, authentication/persistence, and HSTS deployment policy remain Phase 6 work.

## Guide Mode

The system shall:

- Assess exactly one supported program target at a time; Guide shall not assess university-only targets because admissions requirements are program/degree-specific.
- Keep applicant profile values ephemeral by default. Applicant GPA, citizenship/current country, qualification details, English-test results, budget, and scholarship need shall not be sent to `/api/research`, search/AI providers, public URLs, or browser-persistent storage. Phase 6A may persist the validated profile only through an explicit signed-in private-save action behind server-derived ownership and RLS.
- Reuse the hardened Phase 3 Research boundary using only public target identity plus optional intake/academic-year context and the fixed Research categories `admissions`, `tuition`, and `scholarships`; Guide shall not add `/api/guide` or a profile-aware model call.
- Compare applicant-provided qualifications and constraints with the validated browser-safe `ResearchDossier` through application-owned deterministic rules.
- Map free-form Research claim properties into Guide semantics only through a closed exact alias registry with strict scalar/unit/currency/period/evidence eligibility; never fuzzy-match, coerce numeric-looking strings, convert GPA scales/tests/currencies/units, infer effective periods from retrieval time, or choose a conflict winner.
- Classify each machine-assessed requirement as exactly one of meets, probably meets, does not meet, missing applicant information, unclear requirement, or manual confirmation required.
- Reserve definitive meets/does-not-meet outcomes for compatible deterministic comparisons. `Probably meets` is limited to deliberately narrow broad-background rules and shall not claim formal qualification equivalency.
- Preserve conflicting, outdated, inferred, anecdotal, ranking-only, unknown, operationally incomplete, incompatible, duplicate-inconsistent, and unrecognized evidence as explicit unclear/manual states rather than positive or negative applicant outcomes.
- Generate deterministic application risks, checklist items, and a timeline only from the immutable applicant submission, validated published evidence, and clearly labeled generic manual actions. Factual tasks/deadlines/fees shall retain exact evidence references.
- Machine-schedule only strict valid ISO calendar dates. Ambiguous/rolling/non-ISO dates remain manual; past deadlines become risks/next-cycle checks rather than future due dates.
- Compare budget with tuition only when numeric value, currency, and annual/total scope are exactly compatible. Scholarship need may affect funding risks/checklist but never admission status or award probability.
- Preserve immutable submission/request ownership, cancellation, stale-response protection, prior-result preservation, explicit retry/refresh semantics, and one-entry in-memory dossier reuse for profile-only reassessment.
- Generate an application checklist and timeline from published requirements and deadlines without inventing documents, contacts, dates, fees, or readiness states.
- Surface risks such as missed/near deadlines, published unmet thresholds, stale/conflicting requirements or fees, unclear qualification equivalency, incomparable budget, and scholarship uncertainty.
- Provide exact evidence inspection and official program/university links through the existing validated dossier/catalog URL boundary.
- Never guarantee admission, fabricate a numeric admission probability, rank the applicant, or imply that meeting published thresholds establishes admission.

Detailed Phase 5 contracts, edge cases, security boundaries, and acceptance gates are defined in `docs/planning/phase-5-guide-mode.md`.

Implementation status (2026-08-19): Phase 5 Guide Mode is implemented and locally browser-verified against deterministic/schema-valid Research fixtures. Phase 6A now adds optional authenticated private profile/result snapshots without changing Guide's public-provider boundary; durable public rate limiting, hosted Auth/RLS verification, live provider/deployment smoke, HSTS, and release automation remain Phase 6B/6C work.

## Phase 6 — Hardening and Submission Readiness

Phase 6 shall preserve the complete anonymous Research/Comparison/Guide judge flow while adding only optional authenticated private persistence and the production/release controls required to deploy the existing MVP safely.

The system shall:

- Keep account creation/sign-in optional. Authentication shall add private save/history capabilities and shall not gate Research, Comparison, or Guide.
- Use the current supported Supabase SSR cookie/PKCE session model with verified server identity and shall never authorize from a caller-supplied user ID/email or a client-only session object. Normal SSR rendering may use cryptographically verified claims, while private saved-artifact reads/writes/deletes shall require the current Auth-server validation path before exposing or mutating private data. Authentication/session credentials shall not be stored in Web Storage, IndexedDB, Cache Storage, service-worker state, or URL state.
- Compose authentication refresh with the existing nonce/CSP Next.js Proxy so session cookies, request nonce, response CSP, and downstream request state cannot overwrite or desynchronize one another.
- Keep browser CSP connectivity closed: when optional Supabase Auth/save is configured, `connect-src` shall add only the exact validated origin parsed from `NEXT_PUBLIC_SUPABASE_URL` (plus the existing exact development websocket source). The browser shall never receive wildcard Supabase connectivity, generic `https:` connectivity, or Tavily/Brave/Gemini/Groq/OpenRouter origins; malformed/credential-bearing CSP configuration shall fail closed.
- Persist only explicit user-requested, application-owned, versioned private snapshots behind minimum authenticated table grants **and** Supabase RLS: bounded Guide profile snapshots and validated Research/Comparison/Guide result snapshots. Ordinary user CRUD shall use user-scoped authorization/RLS rather than a service-role bypass; anonymous private-table CRUD and ordinary UPDATE shall not exist.
- Treat every saved result as a historical immutable snapshot. Loading saved evidence shall preserve its original retrieval/assessment state and shall never silently make it current, re-score/reassess it under changed logic, seed current-session Guide dossier reuse, or trigger providers. Refresh/re-run/reassess shall be an explicit new operation.
- Move a fetched saved artifact from `/saved` to Research/Comparison/Guide only through one account-bound memory-only single-consume handoff. Private payloads/restore identifiers shall not use query/hash state, Web Storage, IndexedDB, Cache Storage, service workers, or a second cookie persistence channel, and shall be cleared on account change/signout.
- Validate saved snapshot schemas, ownership, internal evidence/result bindings, and current catalog target identity on both write and read. Database ownership/RLS shall not be treated as content integrity: owner-modified malformed/inconsistent rows shall fail closed. Current catalog data owns university/program navigation, while dossier source/evidence URLs and complete target-scoped evidence refs remain provenance-owned. Enforce bounded payload/list/capacity limits and prevent cross-user read/write/delete or existence disclosure.
- Preserve the Phase 5 provider-privacy invariant: applicant academic/financial/profile/account data shall not enter `/api/research`, search/AI provider requests, arbitrary source retrieval, or public URL state. Explicit private Supabase persistence is a separate user-authorized data boundary.
- Bound the whole Research run below the selected hosting platform's hard function duration, stop new retries/fallback work after cancellation/deadline, and retain already validated evidence as truthful partial results where contracts permit.
- Require a durable/deployment-layer distributed abuse control for the expensive public Research endpoint before public release; local process memory, browser single-flight behavior, provider attempt budgets, and hidden local test modes do not satisfy this requirement. Phase 6B's provisional Vercel contract is exact `POST /api/research`, source-IP fixed window, 20 requests/60 seconds, Log-first; actual publication/enforcement remains Phase 6C.
- Bound each accepted Research run with a server-owned 240-second application deadline beneath a 300-second Research-function cap; caller cancellation remains distinct from deadline timeout, no new retry/fallback/stage dispatch may begin after terminal ownership, and completed validated evidence must be preserved as truthful partial output where possible. Actual Vercel request-cancellation delivery remains a deployed verification requirement.
- Treat raw hosting-generated HTTP 429 and 504 failures as sanitized client-local outcomes **before** requiring application JSON/content type, without reflecting platform/WAF bodies or identifiers, automatic retry storms, or loss of recoverable prior results.
- Maintain least-privilege CI that uses deterministic fixtures/local Supabase and no production provider/database/Vercel/deployment secrets or automatic production deployment; workflow token permission is read-only and third-party Actions use immutable full-SHA pins.
- Verify the final production origin's TLS, CSP/security headers, cache/session isolation, secret configuration, provider/privacy assumptions, and actual platform-delivered HSTS before declaring the site release-ready. Do not add a conflicting UniProof HSTS/includeSubDomains/preload policy merely to duplicate Vercel.
- Deploy, mutate hosted Supabase/Vercel/GitHub state, consume an authorized live-provider smoke budget, publish release assets, and submit to Devpost only through the explicit external-action gates in `AGENTS.md` and the Phase 6 release plan.
- Bind the final deployed application, public repository, CI evidence, README/screenshots/demo, and Devpost claims to the exact verified implementation; do not claim deployment/live verification from local tests alone.

Detailed Phase 6 architecture, edge cases, authorization boundaries, and completion gates are defined in `docs/planning/phase-6-hardening-submission-readiness.md` and its Phase 6A/6B/6C execution plans.

Implementation status (2026-08-20): Phase 6A identity/ownership/persistence and Phase 6B production hardening are implemented and locally verified. Phase 6B now includes the 240-second whole-Research execution budget, caller/deadline ownership, abort-aware retry/fallback behavior, Research-only Vercel cancellation configuration, sanitized raw deployment 429/504 handling across Research/Compare/Guide, Gemini stable `v1/interactions`, release-configuration and repository-contract verification, least-privilege SHA-pinned GitHub Actions CI, and the Phase 6C Vercel/WAF operations contract. Hosted Supabase, WAF publication/enforcement, production Auth/email, actual Vercel cancellation/duration/TLS/HSTS behavior, deployment, live-provider smoke, actual GitHub CI execution/release publication, and Devpost submission remain Phase 6C external work.

## Evidence Requirements

Every material claim should be representable with:

- university/program identity;
- claim category and normalized value;
- source URL, title, publisher/type, and supporting evidence;
- retrieval date and effective/academic year when available;
- verification status and extraction method;
- confidence only when its meaning is documented.

Allowed user-facing evidence states are defined in `AGENTS.md`.

## Applicant Profile

Phase 5 uses a strict ephemeral profile containing citizenship/current country, qualification level/title/subject, optional GPA with explicit scale, English-test state/results, optional budget with explicit currency and annual/total scope, and scholarship need. Optional intake and academic year are public Research context rather than private profile values.

The selected supported program supplies target university, degree level, and subject. Preferred destinations are represented by explicit target selection, and Comparison-style priority weights are not separately collected in one-program Guide because they do not change deterministic requirement assessment.

The applicant profile remains browser-memory-only by default and intentionally excludes applicant name, date of birth, email, phone, address, free-form personal notes, account identifiers, and document uploads. Phase 6A adds an explicit signed-in **Save profile** action for this same bounded validated profile; account identity is not copied into the profile, and restore remains private/account-bound. The MVP shall not require passports, national IDs, transcripts, bank statements, visa documents, recommendation letters, or similar sensitive documents.

## Quality and Safety Requirements

- Validate AI outputs against runtime schemas before persistence or display.
- Keep deterministic evidence-policy gates authoritative over AI reconciliation so source class, freshness, conflicts, unknowns, and anecdotal evidence cannot be silently promoted by a model.
- Degrade provider failures to explicit partial results where possible instead of making one search or AI vendor a single point of failure.
- Treat external content as untrusted and prevent retrieved text from controlling agent behavior.
- Prevent server-side retrieval from reaching localhost, private networks, metadata endpoints, or unsupported protocols.
- Keep secrets server-side and exclude local environment files from version control.
- Enforce a strict browser content policy and security-header baseline for application HTML: production script execution shall use a request nonce/strict CSP without `unsafe-inline` or `unsafe-eval`; development-only framework exceptions shall never leak into production policy.
- Load no third-party runtime scripts/analytics in the MVP and render retrieved/model-derived text only through safe React text interpolation, never executable HTML.
- Minimize browser-resident sensitive data. Authentication/session credentials shall never be stored in Web Storage; Phase 4 shall use no durable browser persistence at all.
- Treat secure-development references such as OWASP ASVS 5.0.0, OWASP API Security Top 10 2023, NIST SSDF 1.1, NIST Privacy Framework 1.0, and current Next.js security guidance as verification baselines rather than claims of formal certification.
- Provide loading, empty, partial, conflict, stale-data, error, and retry states for core flows.
- Support keyboard operation and responsive layouts for core tasks.
- Preserve user input when recoverable errors occur.

## MVP Acceptance

The MVP is functionally ready when a judge can:

1. Create or enter an applicant profile.
2. Research a supported university/program and inspect the evidence behind important facts.
3. Observe an unknown, conflict, or freshness state without the system inventing a value.
4. Compare at least three supported options and change priority weights.
5. Generate a Guide-mode gap analysis and application checklist.
6. Follow official source links from the result.
7. Complete the flow on a deployed responsive site without critical console or server errors.

Hackathon publication requirements are tracked separately in `docs/hackathon.md`.
