# Security Policy

UniProof handles externally retrieved content and may store user-specific academic preferences, so security issues should be treated as product-integrity issues as well as application-security issues.

## Reporting

Do not disclose suspected credentials, private user data, or exploitable details in a public issue. Report them privately to the repository owner once a public repository and contact channel are established.

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
- Derive ownership from authenticated server state when user persistence is introduced.
- Do not log sensitive profile fields or secrets unnecessarily.
- Remove task-local secret-bearing/debug residue when its purpose is complete; retain only sanitized evidence needed for debugging, regression coverage, or incident review.
- Treat real user/private data, persistent database data, canonical datasets, and external resources as protected deletion targets that require explicit exact-scope authorization.
- Use exact or bounded deletion targets; never use broad wildcard, blanket table, or destructive Git cleanup as routine residue removal.
- Treat Comparison score integrity as a trust boundary: only application-owned exact metric mappings and compatible typed/evidence/period/unit/currency facts may contribute; missing or unsafe evidence remains unscored rather than being guessed, converted, coerced, or assigned zero.
- Scope cross-target Comparison provenance by both target identity and claim ID. Claim IDs are only dossier-local, so a reused ID from a different Research run must never resolve another target's trade-off evidence.
- Keep Phase 4 comparison state in memory only. Do not persist dossiers, weights, or result state in Web Storage, IndexedDB, cookies, URL state, or a database.
- Do not store future authentication/session/JWT/refresh credentials in JavaScript-readable Web Storage; future private sessions must use server-derived ownership and HttpOnly/Secure/appropriate-SameSite cookies or an equivalently reviewed server-managed session design.
- Load no third-party runtime script, analytics/tag-manager code, or browser extension as part of the MVP without an explicit security/privacy review.
- Maintain a strict Content Security Policy for application HTML. Phase 4 uses a fresh request nonce and production `strict-dynamic` script policy without `unsafe-inline` or `unsafe-eval`; the request nonce is also bridged to Radix runtime style injection, and development exceptions remain development-only and browser-verified.
- Maintain defense-in-depth browser headers including `nosniff`, `no-referrer`, anti-framing, disabled DNS prefetch, and a restrictive Permissions Policy; add HSTS only after the actual HTTPS deployment/domain/subdomain policy is verified.
- Do not claim that application controls can make an already-compromised endpoint or privileged infostealer harmless. Minimize browser-resident/private data and third-party execution instead of making an absolute anti-malware guarantee.
- Runtime/browser security controls must not be repurposed as artificial permission restrictions on the authorized local development agent.

The maintained security/privacy threat model is `docs/security-threat-model.md`; detailed Phase 4 controls are in `docs/planning/phase-4-comparison-mode.md`.

## Before Public Deployment

Run a focused security review, a dependency audit, a secret scan, and tests for the active retrieval/authentication boundaries. Any unresolved high-severity issue blocks publication until explicitly accepted by the project owner.
