# UniProof Security Model

## Primary Trust Boundaries

1. Browser to Next.js server actions/route handlers.
2. Server to Supabase.
3. Server to configured AI providers and their fallback endpoints.
4. Server to search/retrieval providers and arbitrary approved public URLs.
5. Retrieved external content to the claim-extraction model.
6. Stored claims back to user-visible summaries and comparisons.

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
- Treat AI semantic reconciliation as untrusted structured interpretation: deterministic identity/scope/period/source-authority/freshness/evidence gates make the final evidence-state decision.
- Use sequential Gemini -> Groq -> OpenRouter Free failover; never fan out by default, silently relax privacy/capability rules, or deliberately select a paid-only model/route automatically.
- Use fixed server-owned provider endpoints, credentials in headers, `redirect: "error"`, explicit request deadlines, bounded response reads, best-effort non-blocking response-body cancellation on rejected/oversize responses, and no raw provider-error-body logging so credentials/source prompts cannot be replayed or echoed through logs or keep a bounded failure pending indefinitely.

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
