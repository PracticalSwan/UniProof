# UniProof Security Model

## Primary Trust Boundaries

1. Browser to Next.js server actions/route handlers.
2. Server to Supabase.
3. Server to AI provider.
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
- Resolve and reject loopback, private, link-local, and metadata-service IP destinations.
- Re-check each redirect destination.
- Treat resolution-time validation as a prerequisite, not a complete transport guarantee: Phase 2C must connect through the validated/pinned address or revalidate the transport lookup to close the DNS-rebinding gap.
- Bound redirects, response bytes, request time, and content types.
- Sanitize content before rendering; never render retrieved HTML directly.
- Treat webpage instructions, tool-like text, and embedded prompts as source data only.

## AI and Evidence Controls

- Use schema-validated structured model output.
- Allow factual summaries to reference stored claims only.
- Label AI-derived interpretation separately from source-derived facts.
- Reject invented URLs and source attributions.
- Preserve conflict and unknown states through the UI.
- Keep bounded retries; malformed model output must not become persisted truth.

## Secrets and Privacy

- Secrets belong in local environment variables or approved secret stores, never source files.
- `NEXT_PUBLIC_` variables must contain only values safe for browser exposure.
- Supabase service-role credentials and AI/search provider keys are server-only.
- While UniProof uses the unpaid Gemini API tier, send only public-source research content and minimum non-sensitive research context to Gemini; do not send applicant profiles or sensitive/personal documents.
- Use Gemini Interactions requests statelessly with `store: false`; this reduces Interaction state retention but does not change the unpaid-service data-use terms.
- Avoid logging applicant profile details unless operationally necessary; redact identifiers from errors.
- Do not collect sensitive documents in the MVP.

## Authorization

When persistence/authentication is implemented, enable Supabase Row Level Security before treating saved profile, comparison, or plan data as private. Server-side authorization must derive ownership from the authenticated session, not from a caller-provided user ID.

## Cost and Abuse Controls

- Rate-limit research endpoints.
- Bound query length, source count, model tokens, and retries.
- Cache reusable public research where freshness rules permit it.
- Record provider failures without leaking request secrets or full private profile payloads.

Run a focused `security-auditor` review before public deployment and run `secret-scanning` before any authorized commit/push.
