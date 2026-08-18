# UniProof Security and Privacy Threat Model

Status: development-stage threat model refreshed for the locally implemented and browser-verified Phase 4 Comparison Mode on 2026-08-18. This document describes runtime/application risks and security controls; it assumes no public deployment and does not restrict the local developing AI agent's authorized repository/tool access.

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

### 2.3 Potential future personal data

Phase 5 may collect academic profile data such as qualification/GPA, English test, country/citizenship, preferences, budget, and scholarship need. That data is **not** part of Phase 4 and must not be introduced early.

The MVP does not require passports, national IDs, transcripts, bank statements, visa documents, recommendation letters, or similar high-sensitivity documents.

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
                 v
[Browser Research/Compare UI]
```

Principal trust boundaries:

1. browser -> Next.js routes;
2. browser client component -> browser-safe public DTO;
3. server -> search/AI providers;
4. server -> arbitrary approved public HTTP(S) retrieval;
5. retrieved public text -> AI extraction/reconciliation;
6. AI output -> deterministic evidence gates;
7. Research dossier -> Phase 4 deterministic score normalization;
8. application -> external official/evidence links;
9. build/development environment -> browser bundle;
10. future authenticated server -> future persistence database.

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
| T-06 | Web Storage/session theft / infostealer value | Medium | High in future auth | Phase 4 stores no dossier/weights/session in Web Storage/IndexedDB/cookies; no auth token exists; future auth requires HttpOnly/Secure/SameSite server sessions | compromised endpoint can read active browser memory/UI |
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
| T-20 | Cross-user data exposure | Low now / High after auth | Critical | no Phase 4 persistence/auth; future session-derived ownership + Supabase RLS required before private persistence | future Phase 5/DB work must be separately threat-modeled |
| T-21 | CSP security misconfiguration or dev exception leaking to production | Medium | High | environment-aware policy builder; production tests assert no unsafe script directives; dev/built Playwright under actual headers | framework/runtime changes; re-test after upgrades |
| T-22 | Denial of service via oversized bodies/responses | Medium | High | actual streamed 16 KiB request and 4 MiB browser/server response bounds; provider/retrieval byte/time ceilings | aggregate concurrent clients still require deployment infrastructure |
| T-23 | Path traversal/destructive test tooling | Low after Phase 3D | High local | validated harness ID and canonical containment before recursive cleanup | future scripts must reuse same safe-delete principle |
| T-24 | Security controls impede local implementation and get disabled wholesale | Medium | Medium | security policies apply to runtime/build/test boundaries; no agent-permission gating; dev CSP has narrowly documented Next-compatible exceptions | accidental over-broad dev exception must not become production policy |

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

## 8. Browser-origin hardening target

### 8.1 Content Security Policy

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

### 8.2 Static response headers

Target:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `X-DNS-Prefetch-Control: off`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin` after compatibility test
- `Cross-Origin-Resource-Policy: same-origin` after compatibility test
- `poweredByHeader: false`

HSTS is deferred until a real HTTPS deployment/domain is authorized and verified.

## 9. Privacy engineering decisions

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

This follows the NIST Privacy Framework principle of managing privacy risk through explicit data-processing choices; it is an engineering baseline, not a claim of formal compliance.

## 10. Infostealer and compromised-endpoint posture

A website cannot reliably detect or block a sufficiently privileged infostealer on the user's device. Avoid security theater.

Phase 4 reduces exposure by:

1. retaining no authentication credential because authentication is not implemented;
2. persisting no dossier/comparison data in Web Storage/IndexedDB/cookies;
3. collecting no private applicant data;
4. loading no third-party script;
5. using strict CSP to reduce origin-level injected-script exfiltration;
6. using no-referrer external links;
7. keeping provider/server secrets entirely outside the client graph.

When authentication arrives, the project must use server-managed sessions and HttpOnly/Secure/SameSite cookies rather than JavaScript-readable bearer tokens in Web Storage. That future boundary requires a fresh threat-model review.

## 11. Development environment versus production runtime

The user explicitly does not want security policy to limit the developing AI agent. Therefore:

- do not add repository permission restrictions, artificial local tool sandboxes, approval prompts, or agent-access gates as Phase 4 security work;
- do not disable local tests, browser automation, repository reads/writes, or required build commands;
- keep secrets protected by existing ignored environment files and output scanning;
- enforce browser/server security in the running application and verification harness;
- allow only narrow development CSP compatibility exceptions required by Next/React;
- never copy a development-only exception into the production policy.

## 12. Deployment blockers that remain outside Phase 4

Even after Phase 4 is locally complete, public deployment remains blocked until Phase 6 verifies:

- durable distributed rate limiting/abuse protection for expensive Research flows;
- actual host function duration and cancellation semantics;
- production domain/TLS behavior;
- HSTS policy and subdomain/preload consequences;
- current AI/search provider terms/privacy/configuration;
- production secret-store/environment configuration;
- explicit live-service smoke authorization;
- deployed CSP/header behavior;
- any persistence/authentication/RLS boundary that has been introduced by then.

## 13. Verification framework alignment

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

## 14. Security acceptance evidence required for Phase 4

The main implementing agent must record observed evidence for:

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
- final inline security review findings and fixes.
