# UniProof — Devpost Draft

> **Draft only. Do not submit until the final demo video is supplied, checked, and explicitly approved.**

## Project title

UniProof

## Tagline

Evidence-first AI for researching universities, comparing fit, and turning published requirements into an actionable application plan.

## Links

- Live app: https://uniproof-beta.vercel.app
- Source: https://github.com/PracticalSwan/UniProof
- License: MIT (`LICENSE` in the repository)
- Demo video: **PENDING — final approximately three-minute public video not yet supplied**

## Inspiration / problem

International applicants often research the same decision across university pages, program pages, scholarship pages, rankings, government sources, and community discussions. Conventional AI answers can flatten those sources into one confident response even when the underlying information is missing, stale, conflicting, or incomparable.

UniProof was built around a different rule: if a claim matters, the user should be able to inspect where it came from, and uncertainty should remain visible instead of being guessed away.

## What it does

UniProof has three connected modes:

- **Research** builds a structured dossier for a supported university or program. Claims retain evidence status, supporting text, source links, freshness/context, conflicts, unknowns, and operationally incomplete states.
- **Compare** researches two to four compatible programs sequentially, then applies deterministic user-controlled priorities. Missing or ineligible evidence lowers coverage instead of becoming a fabricated zero or ranking.
- **Guide** compares one applicant profile with published program requirements and creates deterministic requirement assessments, risks, checklist items, and official next steps. Applicant academic and financial profile data stays out of the Research/AI provider request.

The checked-in MVP catalog contains 30 universities and 45 computing programs across 11 country codes. Coverage is intentionally bounded rather than presented as global.

## How we built it

UniProof is a Next.js 16 / React 19 / TypeScript application with strict Zod contracts at trust boundaries. Public Research uses bounded search discovery, SSRF-resistant DNS-pinned retrieval, normalized public-source documents, structured AI extraction/reconciliation, and deterministic application-owned evidence gates.

The hosted release uses Tavily with Brave Search fallback for discovery and Groq with OpenRouter fallback for structured AI. The Gemini adapter remains implemented and tested but is intentionally not configured in the public release because current Gemini API terms restrict API clients directed toward or likely to be accessed by people under 18, while university applicants can include minors.

Compare and Guide do not ask a model to invent a winner, fit score, or admission probability. They consume the already validated public Research dossier through closed semantic registries and deterministic rules.

Production hardening includes a request-nonce Content Security Policy, private/no-store application responses, strict same-origin mutation boundaries, bounded request/provider budgets, a 240-second application-owned Research deadline beneath the Vercel function limit, sanitized platform 429/504 handling, and a Vercel WAF rule scoped only to `POST /api/research` at 20 requests per 60 seconds per source IP.

Optional Supabase Auth/save support is implemented and locally tested, but it is intentionally not exposed in the public hackathon deployment because production email delivery was not configured. Judges can use the complete anonymous Research/Compare/Guide core without an account.

## AI integration

AI is used where semantic interpretation adds value, not as the final authority. Structured models extract candidate facts from retrieved public material and help reconcile semantic relationships. Application-owned validation then decides whether those candidates have valid identity, provenance, scope, period, authority, and conflict relationships before they become final evidence claims.

This separation is the central technical idea: **AI proposes structured meaning; deterministic evidence policy decides what the product is allowed to assert.**

## Challenges

The hardest engineering work was preserving evidence integrity across failure cases. A source can fail retrieval while another source for the same category succeeds; a provider can time out; two pages can disagree; an apparently numeric fact can have incompatible units or academic periods; and an older request can finish after a newer one.

The release review found and fixed two important source-resilience defects. Supported claims are now preserved when another selected source fails, with an explicit source-gap warning that prevents Compare/Guide from treating the category as definitive. Program-scoped Research also retains the catalog-owned official program page even when web discovery succeeds, rather than using only a generic university homepage or discovered result.

## Accomplishments

- Evidence-level provenance survives from retrieval through the public UI.
- Missing, conflicting, stale, inferred, anecdotal, and operationally incomplete information remain explicit.
- Compare produces deterministic evidence coverage and user-priority fit without turning itself into an institutional ranking.
- Guide keeps applicant profile values out of the public Research/provider chain and does not predict admission probability.
- Public browser policy uses a nonce CSP with no third-party runtime analytics/scripts.
- The expensive Research endpoint has durable deployment-layer rate limiting.
- The final hardened source passed 602/602 Vitest tests, TypeScript, ESLint, production build, release/workspace verification, dependency audit, and deterministic hosted Preview browser acceptance.

## What we learned

AI research products need more than model quality. Identity binding, source ownership, retrieval safety, temporal context, deterministic evidence eligibility, cancellation ownership, and explicit uncertainty are product features in their own right. A system becomes easier to trust when it can say “unknown” or “incomplete” without converting that gap into a confident answer.

## What's next

- Expand supported programs while preserving catalog identity and evidence rules.
- Add production-capable account email delivery before enabling optional hosted saved snapshots.
- Continue improving live-source retrieval resilience and provider observability without exposing provider payloads or private data.
- Add more deterministic semantic aliases only when they can be reviewed safely rather than introducing fuzzy scoring.

## Judging alignment

- **Originality:** evidence-first AI research with deterministic authority and uncertainty boundaries rather than one opaque generated answer.
- **Design:** Research, Compare, and Guide share one consistent evidence language and allow users to inspect the supporting material.
- **Potential Impact:** reduces the risk that international applicants act on unsupported, stale, or context-mismatched university information.
- **Technological Implementation:** bounded multi-provider research, SSRF-resistant retrieval, strict runtime contracts, deterministic evidence/scoring/assessment layers, privacy separation, CSP, WAF, and extensive automated browser/unit verification.

## Final submission hold

Before posting, verify the final public video, duration, links, current Devpost fields/rules, production deployment, and repository state. The Devpost final-submit action is intentionally outside this draft.
