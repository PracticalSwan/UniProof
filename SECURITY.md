# Security Policy

UniProof handles externally retrieved content and may store user-specific academic preferences, so security issues should be treated as product-integrity issues as well as application-security issues.

## Reporting

Do not disclose suspected credentials, private user data, or exploitable details in a public issue. Report them privately to the repository owner once a public repository and contact channel are established.

## Security Invariants

- Never commit real API keys, database credentials, private keys, or `.env` files.
- Keep Gemini, Tavily, Supabase service-role, and other privileged credentials server-side.
- Treat all retrieved webpages and model output as untrusted input.
- Block SSRF to loopback, private, link-local, and metadata-service destinations.
- Validate redirect destinations and bound outbound requests.
- Sanitize external content before rendering and never execute retrieved scripts.
- Validate structured AI output before persistence or display.
- Preserve unknown/conflict states rather than fabricating a result.
- Derive ownership from authenticated server state when user persistence is introduced.
- Do not log sensitive profile fields or secrets unnecessarily.

## Before Public Deployment

Run a focused security review, a dependency audit, a secret scan, and tests for the active retrieval/authentication boundaries. Any unresolved high-severity issue blocks publication until explicitly accepted by the project owner.
