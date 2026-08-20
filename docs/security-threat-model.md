# UniProof Security and Privacy Threat Model

Status: development-stage threat model refreshed through the locally implemented/browser-verified **Phase 6A identity, ownership, and persistence boundary** on 2026-08-19. Phase 6A controls were exercised with local Supabase Auth/Mailpit, RLS/pgTAP, deterministic Research fixtures, and dev/built browser regression; hosted Supabase, production email/session behavior, durable distributed abuse control, live providers, and deployment remain outside this evidence. This document assumes no public deployment and does not restrict the local developing AI agent's authorized repository/tool access.

Baseline commit when this threat model was refreshed: `9d01a57c1df8f4aa471d5313811c70f2177a5415`.

## 1. Security objective and limitation

UniProof targets a high-assurance, defense-in-depth posture appropriate for an internet-facing evidence/research application. The objective is to prevent known application-layer attack classes where practical, fail closed at trust boundaries, minimize collected/retained data, minimize secret exposure, and reduce exploitability and blast radius.

No web application can guarantee that there will be **zero cybersecurity attacks** or that an already-compromised client device, browser, extension, operating system, dependency, hosting account, or upstream provider can never expose data. A local infostealer with sufficient user privileges may read browser memory, files, or active sessions outside the application's control. UniProof therefore minimizes what the browser receives and retains, removes avoidable third-party execution, uses strict origin/content policy, and keeps credentials/private data out of browser-persistent storage.

Security claims must describe observed controls and verification, not absolute invulnerability.

## 2. Current data classification

### 2.1 Public/application-owned data

- supported university/program catalog IDs and names;
- official university/program URLs;
- retrieved public university/government/dataset/independent evidence;
- final browser-safe Research claims and source metadata;
- Research lifecycle/evidence status;
- Phase 4 selected target IDs/categories;
- Phase 4 priority weights and evidence-display filters.

### 2.2 Operator secrets

Server-only:

- `TAVILY_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- future Supabase privileged/service credentials.

These values must never enter browser bundles, client component props, public environment variables, committed files, logs, screenshots, traces, fixtures, generated docs, or error responses.

### 2.3 Applicant profile and private saved snapshots

Guide collects bounded academic/financial context in active browser memory by default: citizenship/current country, qualification level/title/subject, optional GPA with explicit scale, English-test state/results, optional budget with explicit currency and annual/total scope, and scholarship need. Optional intake/academic year are public Research context rather than private profile values.

These profile values must not be transmitted to `/api/research`, search/AI providers, arbitrary retrieval targets, logs, or public URLs. Phase 6A adds an explicit signed-in private-save boundary: the validated profile, validated Research/Comparison/Guide results, and saved-artifact metadata may be stored in the user's RLS-protected Supabase rows only after an explicit Save action. Browser restore state itself remains memory-only and single-consume; account identity is not copied into the applicant profile.

The MVP does not collect applicant name/contact details/free-form personal notes and does not require passports, national IDs, transcripts, bank statements, visa documents, recommendation letters, or similar high-sensitivity documents.

## 3. Current runtime architecture and trust boundaries

```text
[User browser]
      |
      | same-origin navigation / JSON
      v
[Next.js application]
      |
      +--> [public checked-in catalog]
      |
      +--> [Research route /api/research]
                 |
                 +--> [Tavily / Brave discovery]
                 +--> [approved public URLs / structured providers]
                 +--> [Gemini / Groq / OpenRouter structured AI]
                 |
                 v
          [validated ResearchResult]
                 |
                 v
          [strict ResearchDossier]
                 |
                 +--> [Browser Research/Compare UI]
                 |
                 +--> [Guide + bounded applicant profile]
                 |
                 +--> [explicit Phase 6A Save]
                               |
                               v
                    [same-origin private API]
                               |
                               v
                    [Supabase Auth + RLS rows]
                               |
                               +--> account-bound memory-only restore
```

Principal trust boundaries:

1. browser -> Next.js public/auth/private routes;
2. browser client component -> browser-safe public DTO;
3. browser Supabase client -> exact configured Supabase origin for passwordless Auth only;
4. server -> search/AI providers;
5. server -> arbitrary approved public HTTP(S) retrieval;
6. retrieved public text -> AI extraction/reconciliation;
7. AI output -> deterministic evidence gates;
8. Research dossier -> deterministic Research/Compare/Guide consumers;
9. local applicant profile + Research dossier -> deterministic Guide assessment/planning;
10. profile memory -> public Research request derivation, where profile data must not cross the provider boundary;
11. signed-in explicit Save -> same-origin private API -> current Auth-server identity -> user-scoped Supabase/RLS;
12. untrusted saved row -> strict schema/internal-binding/current-catalog revalidation -> account-bound memory-only restore;
13. application -> external official/evidence links;
14. build/development environment -> browser bundle.

## 4. Assumed attacker capabilities

Threat modeling assumes an internet attacker may:

- send arbitrary HTTP requests to exposed routes;
- manipulate request headers, body bytes, Unicode, content types, origin/fetch metadata, IDs, category arrays, lengths, and timing;
- automate expensive Research requests;
- supply or influence malicious public webpages returned by search;
- host redirect/DNS-rebinding targets;
- craft prompt-injection content inside webpages;
- return malformed or malicious responses from an upstream provider;
- exploit race conditions/cancellation/retry behavior;
- attempt XSS through claim/source text and URLs;
- attempt to make Phase 4 score malformed/non-comparable evidence;
- inspect all public browser code/network responses;
- attempt to steal exposed secrets from client bundles/source maps/logs;
- use a malicious browser extension or local malware if the user's endpoint is already compromised.

The attacker is **not** assumed to already control the repository owner account, GitHub/Vercel/Supabase/provider credentials, or the trusted development machine. Compromise of those principals requires separate operational security and incident response.

## 5. High-value assets

1. provider/API credentials;
2. integrity of final evidence states and supporting provenance;
3. integrity of Comparison scores/trade-offs;
4. future applicant/private data;
5. availability and bounded cost of Research providers;
6. source/retrieval network boundary;
7. browser origin integrity;
8. project repository and dependency supply chain;
9. operator trust and hackathon/public demo integrity.

## 6. Threat register

Risk labels are project-relative engineering priorities, not formal CVSS scores.

| ID | Threat | Likelihood | Impact | Current/planned controls | Residual risk |
| --- | --- | --- | --- | --- | --- |
| T-01 | Server-side request forgery through discovered/redirected URLs | Medium | Critical | HTTP(S)-only outbound policy, DNS/IP classification, redirect revalidation, pinned/validated connection address, metadata/private/loopback blocking, bounded hops/time/bytes | DNS/network stack bugs or policy-registry drift; re-review before deployment |
| T-02 | Prompt injection from university/public pages | High | High | retrieved content is data only; bounded extraction prompts explicitly ignore embedded instructions; provider output strict schemas; deterministic evidence gates own authority/status | model may still emit invalid output; fail-closed validation required |
| T-03 | XSS through claims, source titles, supporting text, target names | Medium | Critical | React text rendering, no raw HTML sinks, strict URL schemas, strict nonce CSP, no third-party scripts, browser XSS fixtures | browser/framework CSP defect or future unsafe sink |
| T-04 | External link/referrer/tabnabbing leakage | Medium | Medium | HTTPS catalog URLs where required, HTTP(S) source URL schema, `_blank`, `noopener noreferrer`, `no-referrer`, CSP/frame policy | destination site itself is outside UniProof control |
| T-05 | Browser credential leakage | Low | Critical | no provider keys in client/public env, client-boundary scans, build scans, server-only modules | compromised build/developer/hosting account remains operational risk |
| T-06 | Web Storage/session theft / infostealer value | Medium | High | Phase 6A uses Supabase SSR cookie/PKCE sessions, no auth/private Web Storage/IndexedDB/Cache Storage/URL state, strict nonce CSP/no third-party scripts, server-derived identity, RLS, and supported Secure/appropriate-SameSite production cookie behavior | standard rich-client auth cookies/browser memory remain readable to sufficiently privileged same-origin code or a compromised endpoint; do not falsely claim standard Supabase SSR cookies are HttpOnly |
| T-07 | Unrestricted Research resource consumption / automated abuse | High if public | High | strict request bounds, provider/run budgets, sequential Phase 4 dispatch, single-flight UI; public deployment blocked until durable distributed rate limiting | client controls are bypassable by direct HTTP; deployment gate remains mandatory |
| T-08 | Phase 4 score manipulation by malformed values | High | High | strict public dossier schema, closed metric registry, exact aliases, typed scalar checks, finite/range checks, no numeric-string parsing, no unit/FX conversion | metric registry mistakes; TDD/traceability required |
| T-09 | Comparison manipulation by conflict/outdated/anecdotal/inferred/ranking evidence | Medium | High | those statuses/source classes are excluded from numeric fit; warnings preserved; duplicate inconsistent values fail closed | upstream misclassification remains possible; Phase 4 adds defense-in-depth duplicate/eligibility checks |
| T-10 | Cross-period/currency/unit false comparison | High without controls | High | exact period/currency/unit compatibility, no conversion, explicit unscored reasons | sparse scores are accepted rather than guessed |
| T-11 | Race/stale response relabeling wrong target | Medium | High | immutable submissions, sequence IDs, exact target binding, synchronous active guard, AbortController, stale-action rejection | implementation bugs; repeated race browser tests required |
| T-12 | Malformed/untrusted provider response becomes browser truth | Medium | Critical | provider schema -> ResearchResult schema -> deterministic composer -> public dossier schema -> client revalidation and response byte/UTF-8 bounds | validator defects; keep strict unknown-key rejection and regression fixtures |
| T-13 | Cross-origin request/CSRF-like abuse of Research | Medium | High | same-origin route, Origin and Fetch Metadata checks, no broad CORS, JSON-only bounded body | public unauthenticated endpoint still callable by non-browser clients; rate limiting required at deployment |
| T-14 | Clickjacking | Low | Medium | CSP `frame-ancestors 'none'` plus X-Frame-Options DENY defense-in-depth | browser compatibility edge cases |
| T-15 | Browser capability abuse | Low | Medium | restrictive Permissions-Policy; no camera/mic/geolocation/payment/USB use | future features may require narrow policy changes |
| T-16 | Third-party script/supply-chain browser exfiltration | Low with current design | Critical | no third-party runtime scripts, strict CSP, lockfile, no new Phase 4 dependencies, dependency audit | existing npm/framework dependency compromise remains possible |
| T-17 | Dependency vulnerability | Medium | High | pinned material versions/lockfile, `npm audit --omit=dev`, build/test gates, official packages only, no unnecessary Phase 4 dependency | zero-day before advisory/publication |
| T-18 | Secret copied into Git/log/test artifact | Medium | Critical | ignored env, setup flow does not echo keys, real credential-value scanning, artifact cleanup, pre-publication secret scan | human copy/paste outside scanned boundary |
| T-19 | Sensitive user data accidentally entered into free-provider research fields | Medium | High | Phase 3 sensitive-input guard; Phase 4 removes free-form question and instructs public context only | imperfect detector; avoid collecting the field entirely in Compare |
| T-20 | Cross-user data exposure | Medium | Critical | Phase 6A private APIs derive owner only from current Auth-server identity; authenticated user-scoped Supabase clients plus explicit minimum grants/RLS; cross-user GET/DELETE return the same not-found shape; forged owner insert denied; account-bound restore clears on signout/change; pgTAP/browser cross-user regressions | hosted Supabase/session configuration and future schema changes still require live re-verification |
| T-21 | CSP security misconfiguration or dev exception leaking to production | Medium | High | environment-aware policy builder; production tests assert no unsafe script directives; dev/built Playwright under actual headers | framework/runtime changes; re-test after upgrades |
| T-22 | Denial of service via oversized bodies/responses | Medium | High | actual streamed 16 KiB request and 4 MiB browser/server response bounds; provider/retrieval byte/time ceilings | aggregate concurrent clients still require deployment infrastructure |
| T-23 | Path traversal/destructive test tooling | Low after Phase 3D | High local | validated harness ID and canonical containment before recursive cleanup | future scripts must reuse same safe-delete principle |
| T-24 | Security controls impede local implementation and get disabled wholesale | Medium | Medium | security policies apply to runtime/build/test boundaries; no agent-permission gating; dev CSP has narrowly documented Next-compatible exceptions | accidental over-broad dev exception must not become production policy |
| T-25 | Applicant profile leaks into Research/provider traffic | Medium without controls | Critical privacy | Guide profile stays browser-local for assessment; mechanically derived Research request contains only catalog target, fixed categories, optional intake/year; Phase 6A explicit private save is a separate Supabase boundary; request-capture and marker tests prove profile fields do not enter Research/provider requests | compromised browser/endpoint can still observe active in-memory profile or its explicit private save request |
| T-26 | Applicant profile persists outside the explicit private-save boundary or restores into the wrong account/session | Medium without controls | High privacy | no URL/profile serialization or Web Storage/IndexedDB/Cache/service-worker restore channel; controlled form requests autocomplete off; explicit profile Save requires current signed-in identity; restore is account-bound/single-consume and clears on signout/account change; browser tests inspect storage/history and signout clearing | browser/OS autofill, BFCache, extensions, and sufficiently privileged endpoint compromise remain residual risks |
| T-27 | Guide overstates admission fit through GPA/test/qualification conversion or fuzzy equivalency | High without controls | High product integrity | closed exact registry; exact scalar/scale/test rules; broad subject match is `probably-meets` only; incompatible/unknown cases require manual confirmation; no admission score | source extraction can still be incomplete; unclear/manual state must remain visible |
| T-28 | Stale/conflicting deadline or fee drives a wrong checklist/timeline | Medium | High | conflicting/outdated evidence excluded from definitive scheduling; only strict valid ISO dates machine-schedule; past dates become risks; exact evidence references required | source may publish ambiguous rolling/conditional deadlines that remain manual |
| T-29 | Guide profile/result race binds one applicant snapshot to another dossier | Medium | High privacy/integrity | immutable GuideSubmission, exact Research key, sequence ownership, one active AbortController, preserved-result semantics, stale-response rejection, repeated race tests | implementation bugs; repeat lifecycle suite before closure |
| T-30 | Malformed numeric profile input becomes zero/NaN/Infinity or bypasses UI ranges | High if only HTML validation | Medium/High integrity | strict Zod schema plus explicit ASCII numeric form parser; blank stays absence; finite/range/integer/increment checks; unknown keys rejected | direct client tampering can still submit only locally, but assessment must fail closed |
| T-31 | Dossier-local claim ID collision opens the wrong Guide evidence after refresh | Medium | High integrity | Guide factual outputs use `{ targetKey, claimId }`; preserved/new result evidence resolves both identities; reused-ID regression | trigger lifecycle/focus bugs remain implementation risk |
| T-32 | Deadline date shifts by timezone or ambiguous locale parsing | Medium | High product integrity | strict `YYYY-MM-DD` real-date validation; date-only arithmetic; no locale/date-time coercion; leap/past/today/30/31-day tests | browser/date helper bug; deterministic unit tests required |
| T-33 | Checklist invents documents, contacts, dates, fees, or readiness | Medium | High product integrity | tasks derive only from validated evidence or clearly generic local actions; factual tasks carry evidence refs; no document uploads/readiness fields; source/catalog URLs only | unrecognized requirements remain manual rather than disappearing |
| T-34 | Whole-Research deadline/caller-cancel confusion or post-terminal work | High without one owner | High cost/integrity | Phase 6B one 240s execution budget beneath 300s host cap; distinct internal deadline vs caller-cancel reason; composed AbortSignal; abort-aware retry waits; stage checks before dispatch; fake-timer race tests; Vercel Research-only cancellation opt-in | platform disconnect delivery must still be verified live; upstream work already accepted by a provider may not be revocable instantly |
| T-35 | WAF/platform 429/504 body leaks internals or causes retry amplification | Medium when public | High | client classifies raw 429/504 before application JSON/content-type parsing; body is ignored/cancelled best-effort; sanitized local outcomes; no browser auto-retry; Compare stops the active sequential batch on terminal platform failure | exact Vercel response/header behavior must be rechecked on Preview/Production |
| T-36 | Provider privacy/free-route drift sends private data or violates retention assumptions | Medium | Critical privacy/cost | Phase 6B primary-source provider review + fixture contract tests; applicant/account/private data mechanically excluded; Gemini unpaid-tier public-only input; OpenRouter data_collection deny/optional ZDR; Brave raw-response non-persistence; no paid escalation | provider terms/account settings can change between local review and release; Phase 6C must recheck current state |
| T-37 | CI workflow or third-party Action exfiltrates secrets / gains write authority | Medium if CI added casually | Critical | no pull_request_target; permissions contents:read; no production provider/Vercel/hosted-Supabase secrets; full-SHA action pins; no deploy steps; sanitized/no artifacts by default; local Supabase only | upstream Action compromise at pinned commit or future workflow edits require review |
| T-38 | Fluid Compute cross-request mutable module state leaks one request/user into another | Medium if new module globals are introduced | Critical privacy/integrity | request/user/budget ownership remains invocation-local; server module constants/read-only caches only; final 6B review searches for module-scope mutable request/user state; Auth/RLS revalidates per request | framework/runtime behavior and future caching optimizations must be re-reviewed |
| T-39 | Expanded catalog aliases/official-host matching silently retargets or promotes the wrong institution | Medium without closed identities | High integrity | one closed 11-country schema; global normalized university name/alias collision rejection; stable owner IDs; no fuzzy/model retargeting; ownerless program UI fails closed; official-host normalization strips only one leading `www.` and accepts exact/real subdomains with malicious suffix regressions | institutions using unrelated sibling domains may require an explicit separately reviewed ownership rule rather than broad base-domain trust |

## 7. Phase 4 score-integrity threats

Comparison score integrity is a security/product-integrity boundary because a manipulated score can mislead a student's decision even when no conventional account compromise occurs.

### 7.1 Free-form property confusion

Threat: a claim property such as `tuition scholarship`, `employment requirement`, or maliciously crafted lookalike text is incorrectly treated as a canonical metric.

Control: exact closed alias registry after a small deterministic normalization. No substring/fuzzy/semantic matching.

### 7.2 Type confusion

Threat: numeric-looking strings such as `"007"`, `"95%"`, `"50,000"`, booleans encoded as strings, `NaN`, or Infinity alter score calculations.

Control: metric registry accepts exact scalar types only. No generic string-to-number/boolean coercion. All numeric values are finite and metric-range checked.

### 7.3 Currency/unit conversion attacks

Threat: incompatible fees/units are silently converted or compared.

Control: no FX/unit conversion. Exact compatibility is required; mismatch becomes an explicit gap.

### 7.4 Period confusion

Threat: retrieved timestamps or mixed academic years create a false current comparison.

Control: retrieval time is never effective period. Numeric time-sensitive metrics require compatible explicit period metadata.

### 7.5 Evidence-class laundering

Threat: ranking/anecdotal/inferred/outdated/conflicting evidence enters the score through a different UI path.

Control: scoring eligibility is rechecked independently of display filters and evidence visibility. These classes cannot contribute numeric fit in Phase 4.

### 7.6 Missing-data bias

Threat: unknown/incomplete evidence becomes zero and artificially penalizes a target, or sparse evidence yields a falsely precise high fit.

Control: missing/unscored dimensions reduce weighted coverage. Overall fit is suppressed below 50% weighted coverage or fewer than two scored positive-weight dimensions.

### 7.7 Cross-dossier provenance collision

Threat: independent Research dossiers legally reuse the same claim ID, and a flattened Comparison reference resolves the first matching ID from the wrong target, presenting another university/program's evidence for a trade-off.

Control: every cross-target trade-off evidence reference carries both the immutable comparison `targetKey` and dossier-local `claimId`. UI evidence resolution requires both identities and regression tests deliberately reuse the same claim ID across two target dossiers.

## 8. Phase 5 Guide integrity threats

### 8.1 Profile exfiltration through request derivation

Threat: a developer spreads/serializes the Guide profile into `ResearchModeRequest` or a new API/provider prompt for convenience.

Control: Guide has one mechanically derived public-only request containing target IDs, fixed categories, and optional intake/year. Unit and browser tests seed unique markers into every profile field and fail if any profile key/value enters the request or any persistent/browser-external surface.

### 8.2 Equivalency and conversion overclaiming

Threat: Guide converts GPA scales, English tests, currencies, annual/total amounts, or free-form qualification text and turns a heuristic into a definitive applicant outcome.

Control: a closed exact registry plus strict typed/unit/scale/test/currency/scope comparison. Scale/test/currency/scope mismatches are manual/incomparable. Only a deliberately narrow checked-in subject-family rule may emit `probably-meets`, and it is explicitly not formal equivalency.

### 8.3 Evidence-state laundering

Threat: conflicting, outdated, inferred, anecdotal, ranking-only, unknown, or incomplete evidence creates a positive/negative applicant status through a different Guide code path.

Control: one common Guide evidence/applicability gate precedes all definitive comparators and checklist scheduling. Excluded evidence remains visible but unclear/manual; no conflict winner is selected.

### 8.4 Deadline/fee temporal confusion

Threat: retrieval time, locale parsing, timezone conversion, or ambiguous text becomes a machine deadline/fee context and produces a wrong action.

Control: retrieval time is never effective time. Machine scheduling accepts only real strict ISO calendar dates and uses date-only arithmetic; rolling/non-ISO/conflicting/outdated dates remain manual. Past deadlines become risks rather than future due dates.

### 8.5 Applicant/dossier ownership race

Threat: profile A is displayed against dossier B, a cancelled response overwrites a newer result, or an old evidence trigger opens a reused claim ID from a replacement dossier.

Control: immutable `GuideSubmission`, exact public Research key, one active controller, sequence ownership, preserved-result semantics, target-scoped evidence references, and five-repeat lifecycle browser acceptance.

### 8.6 Invented planning output

Threat: checklist/timeline templates invent a missing document, date, contact, fee, visa step, or readiness state.

Control: factual tasks/risk/timeline entries require exact validated claim references. Generic local actions are allowed only when clearly generic and non-university-specific. No document upload/readiness field exists in Phase 5.

## 9. Browser-origin hardening target

### 9.1 Content Security Policy

Use a strict nonce-based CSP on HTML documents following current Next.js 16 and OWASP guidance:

- unpredictable request nonce;
- production nonce + `strict-dynamic` scripts;
- no production `unsafe-eval`/`unsafe-inline` script permission;
- `script-src-attr 'none'`;
- restrictive style policy with only the narrowest verified UI-library exception;
- `object-src 'none'`;
- `base-uri 'none'`;
- `form-action 'self'`;
- `frame-ancestors 'none'`;
- self-only browser network connections in production;
- no third-party script origins.

Next.js 16 uses `proxy.ts` terminology. Development requires a narrowly scoped `unsafe-eval` exception for React/Next debugging; production must test that this exception is absent.

Nonce-based CSP forces dynamic rendering and can raise runtime cost. The project explicitly accepts this trade-off for the requested high-security posture, while public deployment remains separately gated for performance/cost/rate-limit verification.

### 9.2 Static response headers

Target:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `X-DNS-Prefetch-Control: off`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin` after compatibility test
- `Cross-Origin-Resource-Policy: same-origin` after compatibility test
- `poweredByHeader: false`

HSTS remains a deployment-observation boundary rather than an application header. Current Vercel documentation supplies `Strict-Transport-Security: max-age=63072000` on deployment responses; Phase 6B must not add a conflicting app-owned HSTS/includeSubDomains/preload policy, and Phase 6C verifies the actual final canonical HTTPS response.

## 10. Privacy engineering decisions

Phase 4 follows data minimization:

- no applicant profile;
- no free-form comparison question;
- optional intake/year only as public research context;
- priority weights never leave the browser;
- no comparison persistence;
- no analytics/third-party trackers;
- no client-side durable storage;
- no external browser fetch except user-initiated navigation to validated evidence/official links;
- evidence links send no referrer.

Guide extends this model rather than replacing it:

- applicant data exists in active browser memory by default;
- public Research receives only program target + optional intake/year + fixed categories;
- no applicant profile value is provider-bound;
- no applicant name/contact/free notes/document uploads are collected;
- Phase 6A adds only explicit signed-in private profile/result snapshots behind current Auth-server identity and RLS; no analytics is added;
- unsaved Guide state remains ephemeral, while saved restore uses one account-bound memory-only single-consume handoff;
- browser tests inspect network, URL/history, cookies, local/session storage, IndexedDB, Cache Storage, and service-worker registrations for leakage outside the explicit auth/private-save boundary.

This follows the NIST Privacy Framework principle of managing privacy risk through explicit data-processing choices; it is an engineering baseline, not a claim of formal compliance.

## 11. Infostealer and compromised-endpoint posture

A website cannot reliably detect or block a sufficiently privileged infostealer on the user's device. Avoid security theater.

The current application reduces exposure by:

1. keeping Supabase session material out of Web Storage/IndexedDB/Cache Storage/URL state and using supported cookie/PKCE session handling;
2. persisting private data only after explicit Save into user-scoped RLS rows rather than browser storage;
3. collecting only the bounded Guide academic/financial profile and no name/contact/document payloads;
4. loading no third-party runtime script;
5. using strict CSP to reduce origin-level injected-script exfiltration;
6. using no-referrer external links;
7. keeping provider/server secrets entirely outside the client graph.

Phase 6A accepts that bounded applicant academic/financial context and authenticated session material exist in active browser memory/cookies during use. Applicant data remains excluded from Research/provider traffic unless explicitly saved to the private Supabase boundary, and unsaved state is discarded normally. These controls reduce retention/exfiltration surface but cannot protect active memory or cookies from sufficiently privileged malware/extensions.

The implemented Supabase SSR rich-client architecture uses cookie-based PKCE/session refresh with server-derived identity and RLS; authentication/session material remains prohibited from Web Storage, IndexedDB, Cache Storage, service-worker state, and URL state. Earlier wording that made `HttpOnly` mandatory for any future session is superseded because current Supabase rich-client SSR guidance requires browser access to its session cookies. The standard Supabase SSR cookies therefore must not be represented as `HttpOnly`; strict nonce CSP, no third-party runtime scripts, supported Secure/appropriate-SameSite production cookie behavior, verified server identity, short-lived/refreshing sessions, and RLS are required compensating controls. A custom server-only `HttpOnly` session architecture would be a separate design requiring another threat-model review.

## 12. Development environment versus production runtime

The user explicitly does not want security policy to limit the developing AI agent. Therefore:

- do not add repository permission restrictions, artificial local tool sandboxes, approval prompts, or agent-access gates as Phase 4 security work;
- do not disable local tests, browser automation, repository reads/writes, or required build commands;
- keep secrets protected by existing ignored environment files and output scanning;
- enforce browser/server security in the running application and verification harness;
- allow only narrow development CSP compatibility exceptions required by Next/React;
- never copy a development-only exception into the production policy.

## 13. Deployment blockers that remain after local Phase 6A

Phase 6A closes the local authentication/ownership/persistence design and verification boundary, but public deployment remains blocked until Phase 6B/6C verifies:

- durable distributed rate limiting/abuse protection for expensive Research flows, with the planned exact Vercel WAF rule observed before enforcement;
- actual selected Vercel project/Fluid Compute acceptance of the Phase 6B 300-second Research cap and real request-cancellation delivery;
- production domain/TLS behavior and actual Vercel-delivered HSTS on the canonical origin, without a conflicting UniProof includeSubDomains/preload policy;
- current AI/search provider endpoint/model/free-route/data-use configuration, including Gemini unpaid-tier public-only constraints and Brave raw-result/query-retention constraints;
- production secret-store/environment configuration and release-config verification;
- explicit live-service smoke authorization;
- deployed CSP/header/cache/session behavior;
- hosted persistence/authentication/RLS/email-delivery behavior introduced by Phase 6A.

Phase 6A locally implements the identity/ownership/persistence mitigations below; Phase 6B/6C items remain planned/deployment-gated. Phase 6 threats and required mitigations include:

- **Cross-user snapshot exposure:** every private artifact is RLS-protected and owned from server-derived identity; normal SSR identity may use cryptographically verified claims, but private saved-artifact list/read/write/delete must require current Auth-server validation before exposure/mutation. Forged caller IDs/emails, locally valid-but-server-signed-out sessions, Auth validation failure, cross-user object IDs, stale account-switch responses, and existence-oracle differences must fail closed.
- **Session/CSP Proxy interference:** Supabase refresh and the existing nonce/CSP flow must share one `proxy.ts`; refreshed `Set-Cookie`, downstream request cookies, request nonce, response CSP, and no-store behavior must survive all composition paths.
- **CSP destination widening/injection:** enabling browser Supabase Auth/save must add only the single exact validated origin parsed from `NEXT_PUBLIC_SUPABASE_URL` to `connect-src` plus the existing exact development websocket where applicable. Wildcard Supabase, generic `https:`, Research/search/AI-provider domains, credential-bearing URLs, path/query/fragment text, malformed schemes/hosts, or delimiter/control-character injection must never broaden the browser network policy.
- **Persisted stale evidence laundering:** saved Research/Compare/Guide values are immutable versioned historical snapshots. Restore must not silently make evidence current, recalculate with changed rules, seed Guide's current-session reusable dossier, or trigger provider calls; explicit refresh/re-run/reassess creates new current state through the existing deterministic finalizers.
- **Persisted owner tampering/content-integrity confusion:** RLS establishes ownership, not truthfulness of an owner's JSON. An authenticated owner may be able to call the Supabase Data API directly with their own JWT/publishable key; every DB row is therefore untrusted on application read and must pass strict version/runtime/internal-binding/current-catalog validation. Do not add HMAC/service-role signing merely to stop a user modifying their own private snapshot; reject malformed/inconsistent history and never elevate it into current evidence.
- **Restore confused-deputy/stale overwrite:** saved payloads cross routes only through one account-bound memory-only single-consume handoff. Account change/signout clears it; exact kind/account/operation ownership is rechecked after awaits; a delayed restore cannot overwrite a newer Research/Compare/Guide run. No restore payload/identifier uses URL state, Web Storage, IndexedDB, Cache Storage, service workers, or another cookie channel.
- **Private profile/provider leakage after persistence:** loading or saving a profile/Guide result must not widen `/api/research` or provider inputs. Account email/user ID is not applicant data and must not be auto-copied into Guide contracts.
- **Storage/resource abuse:** save requests require actual streamed-byte bounds, strict runtime schema/version validation, one bounded maximum-20 metadata list (no unnecessary pagination surface), and a database-race-safe per-owner artifact cap without silent user-data eviction.
- **Ambiguous non-idempotent mutation completion:** a transport disconnect after Save/Delete can leave client knowledge uncertain even when the DB mutation committed. Do not blind-auto-retry; keep one logical mutation single-flight, show an outcome-unknown state, and reconcile the bounded list before the user retries or the UI claims definitive success.
- **Service-role/RLS bypass:** ordinary user APIs use authenticated user-scoped clients plus explicit minimum table grants/RLS. A service-role credential is unnecessary for normal CRUD and must remain outside client graphs and ordinary request handling.
- **Hosting hard-timeout work leakage:** Phase 6B owns one 240-second Research execution budget beneath a 300-second route cap, distinguishes deadline `timeout` from caller `cancelled`, opts Research into Vercel cancellation, aborts retry waits/in-flight work where possible, and prevents later retries/fallbacks/provider dispatch while preserving truthful completed evidence. Actual Vercel signal delivery and selected-project duration acceptance remain live gates.
- **Distributed abuse:** deployment must enforce a real shared/deployment-layer limit on only the expensive Research POST. In-process counters, per-tab single flight, provider budgets, and hidden local test modes are not distributed abuse control.
- **Rate-limit usability/DoS:** the provisional 20/source-IP/60s fixed-window threshold must be observed in Log mode against the complete judge flow before enforcement; shared NAT false positives, exact path/method matching, raw 429 handling before JSON parsing, no browser retry storm, rollback, and current Vercel pricing/project limits must be verified.
- **Deployment/configuration drift:** Preview and Production environment scopes, Supabase Auth URLs/email delivery, WAF rule, 300-second Research cap/cancellation opt-in, TLS/platform HSTS/CSP, stable Gemini v1 plus provider privacy/free-route assumptions, and Git integration side effects must be rechecked from current platform state rather than inferred from local config.
- **Supply-chain/CI secret exposure:** CI is least privilege (`contents: read`, no `pull_request_target`), fixture/local-Supabase only, full-SHA-pinned official Actions, no production provider/database/Vercel/deploy secrets, and no artifacts by default unless a bounded sanitized path is deliberately reviewed.
- **Release-integrity mismatch:** the public repository, exact CI commit, deployed candidate, README/screenshots/demo, and Devpost claims must describe the same observed implementation; an uncommitted or superseded deployment is not acceptable release provenance.

Full edge cases and deployment gates are in `docs/planning/phase-6-hardening-submission-readiness.md`; the Phase 6A/6B/6C plans separate local implementation from authorization-gated external release work.

## 14. Verification framework alignment

Security verification is informed by, but does not claim certification against:

- OWASP ASVS 5.0.0 for web application technical security verification;
- OWASP API Security Top 10 2023, particularly unrestricted resource consumption, sensitive business flows, SSRF, security misconfiguration, and unsafe consumption of APIs;
- NIST SP 800-218 SSDF 1.1 for secure development lifecycle practices;
- NIST Privacy Framework 1.0 for privacy risk/data minimization;
- CISA Secure by Design principles;
- current Next.js 16 CSP/Proxy/security-header documentation;
- OWASP CSP, Session Management, and HTML5 security cheat sheets.

Reference URLs:

- `https://owasp.org/www-project-application-security-verification-standard/`
- `https://owasp.org/API-Security/editions/2023/en/0x11-t10/`
- `https://csrc.nist.gov/pubs/sp/800/218/final`
- `https://www.nist.gov/privacy-framework/privacy-framework`
- `https://www.cisa.gov/securebydesign`
- `https://nextjs.org/docs/app/guides/content-security-policy`
- `https://nextjs.org/docs/app/getting-started/proxy`
- `https://nextjs.org/docs/app/api-reference/config/next-config-js/headers`
- `https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html`
- `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`
- `https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html`

## 15. Security acceptance evidence through Phase 6A

Phase 4/5 evidence remains part of the reviewed baseline. Phase 6A identity/ownership/persistence evidence was observed locally on 2026-08-19 using the real local Supabase/Auth/Mailpit stack plus deterministic Research fixtures. Hosted Supabase, production email/session behavior, live providers, durable deployment abuse controls, and public deployment remain deferred.

Required evidence includes:

- strict CSP header in dev and production/built modes;
- production script policy lacks `unsafe-inline` and `unsafe-eval`;
- expected static security headers;
- CSP does not break the Compare/Research UI, Radix evidence dialog, Next navigation, fonts, or build assets;
- XSS-shaped public data remains inert text;
- no unexpected external browser HTTP(S), dialogs, popups, page errors, or application console errors;
- no local/session storage, IndexedDB, Cache Storage, or service worker use by Compare;
- no provider keys/real credential values in client/source/build outputs;
- no server-only Research internals in Compare client bundles;
- no automatic browser request fan-out;
- score-integrity adversarial cases from Section 7;
- `npm audit --omit=dev` result;
- strict UTF-8/control scan;
- `.env.local` remains ignored and outside browser artifacts;
- protected screenshot hashes unchanged;
- final inline security review findings and fixes;
- Guide request-capture tests proving every invented applicant marker/key is absent from `/api/research` and other outbound requests;
- Guide URL/history, cookies, local/session storage, IndexedDB, Cache Storage, and service-worker checks showing no profile persistence;
- Guide closed-registry/evidence-gate tests for every excluded evidence class and incompatible scalar/unit/currency/period case;
- Guide GPA/test/currency/annual-total non-conversion regressions;
- Guide strict ISO date-only leap/past/today/30/31-day tests and no machine scheduling from ambiguous dates;
- Guide target-scoped evidence collision regression using reused dossier-local claim IDs;
- Guide cancellation/unmount/stale/preserved-result/reuse lifecycle suite repeated at least five times with zero configured retries;
- Guide XSS-shaped profile/evidence text remaining inert under actual CSP;
- no admission probability/guarantee language in Guide contracts/templates/rendered DOM;
- local Supabase migration reset, DB lint/advisors, **40/40 pgTAP**, explicit table grants/RLS, forged-owner/cross-user denial, no ordinary UPDATE, owner-delete cascade, byte/capacity/concurrency checks;
- local Magic Link/PKCE through Mailpit, relative same-origin callback completion, local-scope sign-out with another same-account session preserved, and post-signout private API unauthenticated behavior;
- strict same-origin private mutation guard using browser-owned Fetch Metadata with exact Origin fallback when metadata is absent;
- private API body/UTF-8/schema/error/no-store tests, including non-blocking cancellation after the body ceiling and PostgREST timestamp-offset parsing;
- explicit pre-assessment profile save with zero Research requests, account-bound single-consume restore, signout private-state clearing, and no UniProof private state in Local/Session Storage, IndexedDB, Cache Storage, service workers, or URL state;
- Phase 6A dev browser **67 Research + 55 Compare + 50 Guide + 7 Auth/Saved**, Guide lifecycle **55/55** five-repeat, Auth/Saved lifecycle **35/35** five-repeat, and built-production anonymous/core **67/55/50**; authenticated built-mode against local HTTP Supabase is not claimed because production CSP requires HTTPS.
