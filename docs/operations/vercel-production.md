# Vercel Production Operations

This runbook describes the Phase 6C operator checks for a future Vercel deployment. Phase 6B does not execute any of these hosted mutations.

## Before deployment

1. Run the complete local Phase 6B verification matrix on the exact commit intended for release.
2. Run `node scripts/verify-release-config.mjs --profile=production` in an environment that contains the intended production variable **names and values**. The verifier reports only variable names and sanitized requirements; do not paste its environment into tickets, logs, or chat.
3. Confirm `NEXT_PUBLIC_APP_URL` is the exact canonical non-loopback HTTPS origin and `UNIPROOF_RESEARCH_MODE=live`.
4. Configure at least one discovery provider (`TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`) and at least one structured-AI provider (`GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENROUTER_API_KEY`). Missing fallback providers reduce resilience but do not invalidate the release.
5. Configure Supabase Auth only as a complete pair: `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The project does not require a service-role credential for normal application persistence.
6. Verify the selected Vercel project accepts the 300-second Research function duration and that the app remains on the expected Node runtime.

## Request cancellation contract

`vercel.json` opts `app/api/research/route.ts` into Vercel request cancellation. No other route is opted in. The application itself owns a 240-second terminal Research deadline, leaving headroom under the 300-second host ceiling.

During Phase 6C, verify with a real preview deployment that disconnecting an in-flight Research request propagates cancellation to the Node handler and that provider work stops without additional retries or fallbacks. Do not infer this from local `AbortController` tests alone.

## WAF rate-limit contract

Do not implement a second application-level limiter merely to imitate platform protection. If the selected Vercel plan supports the required WAF rule, configure and verify this exact contract in Phase 6C:

- route: `POST /api/research`
- key: source IP
- window: fixed 60 seconds
- threshold: 20 requests
- initial action: **Log**

Observe legitimate traffic first. Only after verifying match behavior, pricing, and false-positive risk should an operator separately authorize a blocking/enforcement action. Application clients do not automatically retry raw deployment HTTP 429 or 504 responses.

## Hosted Supabase checks

Before production persistence is declared verified:

- apply the committed migrations through the authorized hosted workflow;
- verify RLS and grants with two distinct authenticated test accounts;
- verify anonymous users cannot read/write saved artifacts;
- verify cross-user artifact identifiers do not disclose another user's row;
- verify sign-out invalidates private API access;
- confirm no service-role credential is exposed to browser or ordinary runtime paths.

Local Supabase evidence is not hosted-service evidence.

## Post-deployment verification

Verify the exact deployed commit and record the evidence level separately for:

- canonical HTTPS host and redirect behavior;
- production security headers, CSP, and HSTS behavior supplied by the actual edge path;
- Research success, cancellation, application deadline, raw platform 429/504 handling, and no blind retry;
- Compare batch stop after platform throttling/timeout;
- Guide and Saved/Auth lifecycle;
- live provider fallback behavior without logging provider payloads or credentials;
- WAF log behavior if the rule was authorized;
- the exact GitHub Actions run for the deployed commit.

## Rollback

If a deployment introduces a material regression, stop publication/submission work, preserve evidence, and use the platform's reversible rollback/promote mechanism for a previously verified deployment. Do not rewrite Git history or delete hosted data as a rollback shortcut. Re-run the affected production checks after rollback before calling the service recovered.
