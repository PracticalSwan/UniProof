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
- Provider-neutral AI with Gemini free primary (`gemini-3.5-flash-lite`, bounded free-tier `gemini-3.5-flash` quality escalation), Groq Free `openai/gpt-oss-120b` fallback, and OpenRouter `openrouter/free` final fallback
- Tavily primary source discovery with Brave Search fallback, then direct/structured-source degraded discovery
- ROR, College Scorecard, Discover Uni, and official university/government sources
- Zod for runtime contracts
- Vitest for unit/integration tests
- Playwright for browser/E2E verification
- Vercel for hosting

## Current State

Phase 2 and Phase 3 Research Mode are complete at the validated in-memory boundary. UniProof now has a checked-in supported catalog of 10 universities and 14 computing programs across the US, UK, and Thailand; browser-safe Research request/dossier contracts; deterministic search/filter/select; a bounded same-origin Node-runtime `POST /api/research`; an interactive evidence-aware Research workspace; exact claim/source evidence sheets; explicit unknown/conflict/outdated/partial/failed states; cancellation and immutable retry ownership; and deterministic browser acceptance across narrow/mobile/tablet/desktop layouts. The Research API and client preserve Phase 2 evidence semantics, reject sensitive caller-controlled research text before provider work, keep provider/internal result data server-side, and fail closed on malformed, mismatched, oversized, or invalid-UTF-8 responses before rendering. Phase 3D browser acceptance uses exact `@playwright/test@1.62.1`, zero configured retries, fail-closed external-network guards, dev and built-application runs, and 500-claim/long-content stress coverage. Automated verification remains offline and deterministic; the previously authorized 2026-08-16 provider smoke remains the only live provider validation. Database migrations, Row Level Security, persistence, authentication, saved history, Comparison/Guide implementation, public deployment, durable endpoint rate limiting, and any new live-provider smoke remain deferred.

Open-source repository: <https://github.com/PracticalSwan/UniProof>

Read `AGENTS.md` before project work. `LESSONS.md` is the mandatory first manual project read at the start of every agent session.
