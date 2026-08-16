# UniProof

UniProof is an evidence-first AI platform for international students researching universities, comparing options, and planning applications.

## Product Modes

- **Research:** structured university/program dossiers with source-level evidence, freshness, conflicts, and unknowns.
- **Comparison:** side-by-side comparison of two to four universities with user-controlled criteria and explainable fit scoring.
- **Guide:** applicant-to-requirement gap analysis, application tasks, deadlines, risks, and official handoff links.

## Planned MVP Stack

- Next.js + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase PostgreSQL + Supabase Auth
- Provider-neutral AI with Gemini free primary (`gemini-3.5-flash-lite`, bounded `gemini-3.6-flash` quality escalation), Groq Free `openai/gpt-oss-120b` fallback, and OpenRouter `openrouter/free` final fallback
- Tavily primary source discovery with Brave Search fallback, then direct/structured-source degraded discovery
- OpenAlex, ROR, College Scorecard, Discover Uni, and official university/government sources
- Zod for runtime contracts
- Vitest for unit/integration tests
- Playwright for browser/E2E verification
- Vercel for hosting

## Current State

Phase 2A is complete and independently hardened: the Next.js application foundation includes Zod-first research contracts, centralized server-owned retrieval bounds, deterministic SSRF/DNS/redirect policy primitives, conservative IPv6 public-address classification reviewed against current IANA allocations, and offline security regression tests. Live source discovery, Brave fallback, retrieval transport, multi-provider AI calls/reconciliation, database migrations, Row Level Security, seed data, and persistence remain intentionally deferred to later phases.

Open-source repository: <https://github.com/PracticalSwan/UniProof>

Read `AGENTS.md` before project work. `LESSONS.md` is the mandatory first manual project read at the start of every agent session.
