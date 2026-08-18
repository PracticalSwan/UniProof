# UniProof Security Model

## Primary Trust Boundaries

1. Browser to Next.js server actions/route handlers.
2. Server to Supabase.
3. Server to configured AI providers and their fallback endpoints.
4. Server to search/retrieval providers and arbitrary approved public URLs.
5. Retrieved external content to the claim-extraction model.
6. Stored claims back to user-visible summaries and comparisons.

## Research API Boundary

`POST /api/research` is a same-origin Node-runtime route. It accepts only strict UTF-8 JSON of at most 16 KiB by both declared and actual streamed body size, rejects mismatched or malformed `Origin`/cross-site fetch metadata, validates stable supported-catalog IDs and program ownership, and rejects sensitive caller-supplied free-text research fields (`question`, `intake`, and `academicYear`) before provider work. A valid request dispatches `runPhase2Research` exactly once with the caller's exact `AbortSignal` and the catalog-backed target resolver; caller provider configuration is not accepted.

Every response is `Cache-Control: no-store` and validates against the strict public response contract. The server composes only final claims, exact claim-referenced sources, category explanations/lifecycle, catalog official links, and sanitized failures into the browser dossier; documents, candidates, provider attempts, discovery telemetry, raw warnings, and model/provider identity remain server-side. The composer fails closed unless every final claim matches the selected application-owned university/program scope, and the public DTO requires every exposed source to be referenced by a final claim plus terminal run status/timestamps to agree with category lifecycle. A valid envelope larger than 4 MiB fails closed rather than truncating evidence. The browser client independently enforces the actual streamed response-byte ceiling even when `Content-Length` is missing or dishonest, decodes JSON bytes with fatal UTF-8 semantics, revalidates the public envelope and exact submitted target/program/category binding, and makes caller cancellation authoritative while a stream read is pending. Oversize/invalid/cancel cleanup is best-effort and never waits indefinitely on an untrusted reader-cancel promise. This boundary does not provide a durable distributed rate limit; public deployment remains blocked until that deployment-layer control is verified.

## Highest-Risk MVP Threats

- Server-side request forgery through user-controlled or search-discovered URLs.
- Prompt injection embedded in university pages or retrieved documents.
- Unsupported AI claims being presented as sourced facts.
- Cross-user profile/data exposure after authentication is introduced.
- API/service-role secrets leaking into client bundles, logs, Git, screenshots, or error responses.
- Excessive AI/search calls causing denial of service or unbounded cost.
- Stale or conflicting admissions information being presented without warning.

## Retrieval Controls

Server retrieval must use an explicit outbound policy:

- HTTP(S) only, with HTTPS preferred/required where the provider supports it.
- Resolve and reject loopback, private, link-local, reserved/special-purpose, and metadata-service IP destinations.
- For IPv6, fail closed outside the current IANA `2000::/3` global-unicast allocation and apply explicit special-purpose exclusions inside it; IPv4-mapped IPv6 inherits the IPv4 classification.
- Re-check each redirect destination.
- Redact outbound-validation failure targets: do not echo credentials, paths, query strings, fragments, or opaque-scheme payloads in error metadata.
- Treat resolution-time validation as a prerequisite, not a complete transport guarantee: Phase 2C must connect through the validated/pinned address or revalidate the transport lookup to close the DNS-rebinding gap.
- Keep the initial Phase 2C arbitrary-source transport isolated per validated hop: no proxy/environment-proxy routing and no cross-request pooled/keep-alive socket reuse; the actual connected remote address/family must match the selected validated address.
- Bound redirects, response bytes, request time, and content types.
- Sanitize content before rendering; never render retrieved HTML directly.
- Treat webpage instructions, tool-like text, and embedded prompts as source data only.

## AI and Evidence Controls

- Use one strict portable schema-validated structured-output boundary across Gemini, Groq, and OpenRouter; all objects reject unknown fields, and model output never supplies trusted IDs, source authority, or evidence state.
- Segment normalized public documents deterministically before AI use and promote an extracted claim only when its application-supplied segment ID exists and the raw returned supporting text, before trim/case/Unicode normalization, is an exact substring of that segment; never fuzzy-repair or normalize an invented quote into validity.
- Allow factual summaries to reference gated claims only.
- Label AI-derived interpretation separately from source-derived facts.
- Reject invented URLs, source attributions, identifiers, supporting passages, and factual values.
- Preserve conflict and category-level unknown states through the UI; operational provider failure must not be mislabeled as evidence unknown.
- Keep request/response/token/retry budgets bounded; malformed, oversize, invalid-UTF8, schema-invalid, or provenance-invalid model output must not become persisted truth.
- Phase 2D uses one active AI request at a time, a 30-second provider-attempt deadline, a 256 KiB response-body bound, at most one transient retry per provider/task, provider-specific attempt counters, and a separate 24-actual-HTTP-attempt total run budget; the existing 100-call extraction contract ceiling is not the transport budget. Provider-local budget exhaustion remains a bounded fallback condition, while total-run exhaustion stops dispatch. Promoted candidates retain trusted provider/model provenance, while promotion-invalid payloads are recorded as `invalid-response` attempts.
- Treat AI semantic reconciliation as untrusted structured interpretation: deterministic identity/scope/period/source-authority/freshness/evidence gates make the final evidence-state decision. Implemented Phase 2E semantic input excludes authority ranking, URLs, provider/discovery metadata, applicant data, and private-document content; every final factual claim requires mechanically validated candidate provenance, and no semantic output may synthesize a new factual scalar. The deterministic test seam receives only the public semantic task—not the encompassing options object—so provider keys, sources, documents, and authority metadata cannot leak through that callback boundary.
- Phase 2E reuses the bounded Phase 2D AI transport with stage-specific budgets rather than cloning it: extraction remains 24 actual requests/run, reconciliation is capped at 12, explanation at 6, and ambiguous reconciliation is capped at 12 pair questions/request and 144/run. Provider-local exhaustion may fail over; a stage-total ceiling stops new work for that stage. Semantic overflow/exhaustion is operational incompleteness, never category-level `unknown`; explanation exhaustion always falls back deterministically without changing evidence.
- Phase 2F keeps discovery's 32-record attempt-history bound separate from the final whole-run result-history bound. The implemented final ceiling is derived as 86 records (32 discovery + 28 extraction + 16 reconciliation + 10 explanation) after bounding duplicate non-dispatched configuration/provider-budget/total-budget telemetry; actual HTTP attempts are never truncated. Retrieval/normalization failures remain sanitized operational state rather than fabricated provider attempts.
- Phase 2F category completion fails closed: clean bounded evidence absence may become category-level unknown only after the required discovery/retrieval/extraction/reconciliation work completed; degraded direct/ROR salvage, selected-source retrieval/normalization failure, unprocessed category-scoped extraction segments, semantic overflow, provider exhaustion, discovery timeout/budget exhaustion, or cancellation remain operational incompleteness. Caller cancellation is re-checked after asynchronous target resolution, propagates into DNS-pinned retrieval and AI stages, destroys in-flight retrieval transport, and prevents later retries/fallbacks.
- Phase 2F final evidence explanations are part of the validated `ResearchResult`. Explanation claim IDs must resolve to same-category final gated claims; unknown categories require zero-reference deterministic fallback; explanation failure/abort never changes evidence state or lifecycle. Injected extraction/reconciliation/explanation seams receive minimum project-owned inputs and are required to obey the same total/provider attempt budgets as production transport rather than silently accepting impossible synthetic histories.
- Use sequential Gemini -> Groq -> OpenRouter Free failover; never fan out by default, silently relax privacy/capability rules, or deliberately select a paid-only model/route automatically.
- Use fixed server-owned provider endpoints, credentials in headers, `redirect: "error"`, explicit request deadlines, bounded response reads, best-effort non-blocking response-body cancellation on rejected/oversize responses, and no raw provider-error-body logging so credentials/source prompts cannot be replayed or echoed through logs or keep a bounded failure pending indefinitely.

## Phase 4 Browser-Origin and Comparison Security

Phase 4 creates no new public comparison endpoint and no new AI scoring call. It reuses the validated `/api/research` boundary sequentially for two to four targets, keeps validated public dossiers and priority weights in browser memory only, and performs scoring/trade-offs through pure application-owned modules. Server-returned `unsupported-target` is correction-required before a new comparison and is not treated as a blind retry. The detailed controls and adversarial cases are specified in `docs/planning/phase-4-comparison-mode.md`; the repository threat register is `docs/security-threat-model.md`.

Comparison score integrity is treated as a security/product-integrity boundary. Free-form claim properties enter scoring only through a closed exact-alias registry with strict scalar type, evidence status, source class, unit, currency, and period checks. Numeric-looking strings are never parsed; currencies/units are never converted; conflicting/outdated/inferred/anecdotal/ranking-only evidence never contributes; duplicate inconsistent facts fail closed; missing/unscorable evidence lowers weighted coverage instead of becoming zero; and sparse evidence suppresses the overall score rather than presenting false precision. Cross-target trade-off provenance is keyed by `{ targetKey, claimId }` because claim-ID uniqueness is guaranteed only inside each independently validated dossier; a reused claim ID cannot redirect evidence to another target.

Phase 4 implements strict browser-origin hardening: `proxy.ts` creates a fresh per-request nonce, production CSP uses nonce/`strict-dynamic` without script `unsafe-inline`/`unsafe-eval`, `next.config.ts` supplies restrictive static headers and removes framework disclosure, and no third-party runtime scripts or analytics are loaded. `components/security/runtime-style-nonce.tsx` uses the directly declared `get-nonce` channel so Radix runtime style injection carries the request nonce under strict `style-src`. Development carries only the narrow React/Next compatibility exception exercised by the isolated dev browser suite; the built browser suite verifies that development exceptions do not leak into production. HSTS remains deferred until an authorized real HTTPS deployment/domain strategy is verified.

Phase 4 stores no comparison/dossier/weight state in `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, cookies, URL state, or a database and collects no applicant profile/private data. Browser acceptance verifies memory-only behavior, zero unexpected external HTTP(S) requests, and zero CSP violations through Compare and Research evidence flows. These controls reduce the value available to browser-origin compromise or an infostealer, but no web application can guarantee protection against malware, a malicious extension, or an already-compromised operating system that can read active browser memory. Future authentication must therefore use server-managed ownership and HttpOnly/Secure/appropriate-SameSite cookies rather than JavaScript-readable bearer/session tokens in Web Storage.

These runtime/browser controls are not local repository/tool permission gates for the developing AI agent. Development access stays governed by project authorization; application security is enforced at data, browser, server, provider, build, and deployment boundaries.

Security engineering and verification are informed by OWASP ASVS 5.0.0, OWASP API Security Top 10 2023, OWASP CSP/Session/HTML5 guidance, NIST SP 800-218 SSDF 1.1, NIST Privacy Framework 1.0, CISA Secure by Design, and current official Next.js 16 CSP/Proxy/header documentation. These references are baselines, not claims that UniProof is formally certified against them.

## Secrets and Privacy

- Secrets belong in local environment variables or approved secret stores, never source files.
- `NEXT_PUBLIC_` variables must contain only values safe for browser exposure.
- Supabase service-role credentials and all AI/search provider keys are server-only.
- Send only public-source research content and minimum non-sensitive research context through Gemini, Groq, OpenRouter, Tavily, and Brave; do not send applicant profiles or sensitive/personal documents through the Phase 2 free-provider pipeline.
- Use Gemini Interactions requests statelessly with `store: false`, but do not misrepresent that flag as overriding the provider's service-level data-use policy; the public-only input boundary remains mandatory. Use the strongest compatible Groq/OpenRouter data controls, including OpenRouter `data_collection="deny"` and configured ZDR routing when required, and fail closed if an eligible free endpoint cannot satisfy the configured privacy requirement.
- The provider setup command writes secrets only to ignored local environment files, preserves unrelated values/comments/newline style, never echoes/logs keys or secret fingerprints, performs no live connectivity call by default, and does not automatically enable live research mode.
- Avoid logging applicant profile details unless operationally necessary; redact identifiers from errors.
- Do not collect sensitive documents in the MVP.

## Cleanup and Sensitive Residue

- Task-local disposable test residue may be removed under the standing cleanup authorization defined in `AGENTS.md`, but only when it is clearly temporary, inside the project root, safely reproducible, and no longer needed for regression, debugging, acceptance evidence, or future sessions.
- Secret-bearing temporary files, raw tokens, credential copies, unsafe debug dumps, and similar sensitive residue must not be retained for convenience. Remove the exposed copy when authorized, preserve only sanitized evidence needed for incident review, and handle any required credential rotation/revocation as a separate external action.
- Real user/private data is never routine cleanup. Delete it only with explicit authorization for the exact scope or when a higher-priority privacy/security requirement mandates removal.
- Database cleanup must target exact test-only records or bounded predicates. Do not use vague predicates, blanket table deletion, or broad cleanup against persistent or production-like data.
- Raw provider responses, source captures, logs, screenshots, and traces should be deleted after their debugging/test purpose unless a sanitized artifact is intentionally retained as a regression fixture or acceptance record.
- Never retain secrets merely because they appear in logs, fixtures, screenshots, traces, or historical debug artifacts.

## Authorization

When persistence/authentication is implemented, enable Supabase Row Level Security before treating saved profile, comparison, or plan data as private. Server-side authorization must derive ownership from the authenticated session, not from a caller-provided user ID.

## Cost and Abuse Controls

- Rate-limit research endpoints.
- Bound query length, source count, model tokens, and retries.
- Cache reusable public research where freshness rules permit it.
- Record provider failures and fallback reasons without leaking request secrets or full prompt/source payloads; outbound DNS failures expose stable policy codes/messages rather than raw resolver error strings.
- Bound both per-provider and total discovery/AI calls so fallback cannot multiply free-tier usage without limit.

Run a focused `security-auditor` review before public deployment and run `secret-scanning` before any authorized commit/push.
