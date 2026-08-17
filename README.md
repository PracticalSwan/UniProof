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

Phase 2 is complete at the validated in-memory research boundary. Phase 3A and 3B are now implemented and independently reviewed: UniProof has a checked-in supported catalog of 10 universities and 14 computing programs across the US, UK, and Thailand; browser-safe Research request/dossier contracts; deterministic catalog search/filtering; a server-only catalog target resolver; a bounded same-origin Node-runtime `POST /api/research`; and a server-only dossier projection that exposes only final claim evidence and claim-referenced public sources. The Research API preserves Phase 2 unknown-versus-incomplete/conflict/outdated semantics, rejects sensitive caller-controlled research text before provider work, calls `runPhase2Research` exactly once with the caller signal, fails closed on selected-target/provenance/lifecycle inconsistencies, and never sends documents, candidates, provider history, raw warnings, or provider/model identity to the browser. Automated verification remains offline and deterministic; the previously authorized 2026-08-16 provider smoke remains the only live provider validation. Phase 3C interactive Research UI is next, followed by Phase 3D browser/accessibility hardening. Database migrations, Row Level Security, persistence, authentication, saved history, Comparison/Guide implementation, public deployment, and durable endpoint rate limiting remain deferred.

Open-source repository: <https://github.com/PracticalSwan/UniProof>

Read `AGENTS.md` before project work. `LESSONS.md` is the mandatory first manual project read at the start of every agent session.
