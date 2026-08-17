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

## Before Public Deployment

Run a focused security review, a dependency audit, a secret scan, and tests for the active retrieval/authentication boundaries. Any unresolved high-severity issue blocks publication until explicitly accepted by the project owner.
