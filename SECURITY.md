# Security Policy

UniProof handles externally retrieved content and may store user-specific academic preferences, so security issues should be treated as product-integrity issues as well as application-security issues.

## Reporting

Do not disclose suspected credentials, private user data, or exploitable details in a public issue. Review the repository's GitHub Security policy page and use GitHub private vulnerability reporting/security-advisory facilities when they are enabled; otherwise contact the repository owner through an available private channel. If no private channel is available, do not publish the sensitive material publicly while seeking a safe contact route.

## Security Invariants

- Never commit real API keys, database credentials, private keys, or `.env` files.
- Keep Gemini, Groq, OpenRouter, Tavily, Brave, Supabase service-role, and other privileged credentials server-side.
- Treat all retrieved webpages and model output as untrusted input.
- Block SSRF to loopback, private, link-local, reserved/special-purpose, and metadata-service destinations; direct IPv6 retrieval fails closed outside the current IANA `2000::/3` global-unicast allocation.
- Validate redirect destinations and bound outbound requests.
- Sanitize external content before rendering and never execute retrieved scripts.
- Validate structured AI output before persistence or display.
- Validate Research responses again in the browser before display: require JSON, enforce the actual streamed <=4 MiB response bound independently of `Content-Length`, decode UTF-8 fatally, bind the dossier to the submitted target/program/categories, and treat cancellation as authoritative while reading.
- Treat AI semantic reconciliation as untrusted interpretation and enforce source authority, freshness, and final evidence-state policy deterministically.
- Use only public research content in the free AI/search provider chain; do not send applicant profiles or sensitive documents to those providers.
- Preserve unknown/conflict/partial states rather than fabricating a result when the Tavily -> Brave discovery chain or Gemini -> Groq -> OpenRouter Free AI chain is exhausted.
- Derive every private saved-artifact owner from current authenticated server state; never accept caller-supplied user IDs/emails for authorization.
- Do not log sensitive profile fields or secrets unnecessarily.
- Remove task-local secret-bearing/debug residue when its purpose is complete; retain only sanitized evidence needed for debugging, regression coverage, or incident review.
- Treat real user/private data, persistent database data, canonical datasets, and external resources as protected deletion targets that require explicit exact-scope authorization.
- Use exact or bounded deletion targets; never use broad wildcard, blanket table, or destructive Git cleanup as routine residue removal.
- Treat Comparison score integrity as a trust boundary: only application-owned exact metric mappings and compatible typed/evidence/period/unit/currency facts may contribute; missing or unsafe evidence remains unscored rather than being guessed, converted, coerced, or assigned zero.
- Scope cross-target Comparison provenance by both target identity and claim ID. Claim IDs are only dossier-local, so a reused ID from a different Research run must never resolve another target's trade-off evidence.
- Keep Phase 4 comparison state in memory only. Do not persist dossiers, weights, or result state in Web Storage, IndexedDB, cookies, URL state, or a database.
- Guide keeps applicant citizenship/current country, qualification/GPA, English-test results, budget, and scholarship need browser-local by default. The Guide Research request may contain only the supported program target, fixed public categories, and optional intake/academic year; applicant profile keys/values must not enter `/api/research`, search/AI providers, logs, or public URLs. Phase 6A permits only an explicit signed-in private Save into the current user's RLS-protected Supabase rows.
- Treat Guide assessment integrity as a trust boundary: use a closed exact requirement registry and compatible typed/evidence/unit/currency/period checks; never fuzzy-match requirements, convert GPA/test/currency/unit values, select a conflict winner, machine-schedule ambiguous dates, invent checklist facts, or produce admission probabilities/guarantees.
- Guide factual risks/tasks/evidence actions retain target-scoped claim provenance so dossier-local claim ID reuse cannot resolve the wrong evidence after refresh/preserved-result transitions.
- Do not store authentication/session/JWT/refresh credentials in JavaScript-readable Web Storage, IndexedDB, Cache Storage, service-worker state, or URL state. The implemented Supabase SSR rich-client session uses server-derived ownership and provider-supported cookie attributes; do not falsely claim its standard cookies are `HttpOnly`.
- Load no third-party runtime script, analytics/tag-manager code, or browser extension as part of the MVP without an explicit security/privacy review.
- Maintain a strict Content Security Policy for application HTML. Phase 4 uses a fresh request nonce and production `strict-dynamic` script policy without `unsafe-inline` or `unsafe-eval`; the request nonce is also bridged to Radix runtime style injection, and development exceptions remain development-only and browser-verified.
- Maintain defense-in-depth browser headers including `nosniff`, `no-referrer`, anti-framing, disabled DNS prefetch, and a restrictive Permissions Policy; add HSTS only after the actual HTTPS deployment/domain/subdomain policy is verified.
- Do not claim that application controls can make an already-compromised endpoint or privileged infostealer harmless. Minimize browser-resident/private data and third-party execution instead of making an absolute anti-malware guarantee.
- Runtime/browser security controls must not be repurposed as artificial permission restrictions on the authorized local development agent.

The maintained security/privacy threat model is `docs/security-threat-model.md`; detailed Phase 4 controls are in `docs/planning/phase-4-comparison-mode.md`, and Phase 6 identity/persistence controls are in `docs/planning/phase-6-hardening-submission-readiness.md`.

## Before Public Deployment

Run a focused security review, a dependency audit, a secret scan, and tests for the active retrieval/authentication boundaries. Any unresolved high-severity issue blocks publication until explicitly accepted by the project owner.
