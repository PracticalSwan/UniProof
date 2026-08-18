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

Phase 2, Phase 3 Research Mode, and Phase 4 Comparison Mode are complete at the validated in-memory boundary. UniProof has a checked-in supported catalog of 10 universities and 14 computing programs across the US, UK, and Thailand; browser-safe Research request/dossier contracts; a bounded same-origin Node-runtime `POST /api/research`; an interactive evidence-aware Research workspace; and exact claim/source evidence inspection. Comparison now supports exactly two to four compatible supported targets, sequentially reuses the hardened Research boundary, keeps dossiers/weights/results in browser memory only, scores through a closed application-owned metric registry, separates missing/unscorable evidence from poor fit, suppresses sparse overall fit, and generates deterministic trade-offs with target-scoped exact claim evidence references without a new AI scoring call. Browser hardening includes a fresh request nonce, strict production CSP without script `unsafe-inline`/`unsafe-eval`, restrictive security headers, no third-party runtime scripts, and no Compare persistence in Web Storage, cookies, URL state, service workers, or a database. Dev and built Playwright acceptance use exact `@playwright/test@1.62.1`, zero configured retries, fail-closed external-network guards, six required responsive viewports, long/Unicode/12-source/high-claim stress, and real CSP checks. Automated verification remains offline and deterministic; the previously authorized 2026-08-16 provider smoke remains the only live provider validation. Database migrations, Row Level Security, persistence, authentication, saved history, Guide implementation, public deployment, durable endpoint rate limiting, HSTS deployment policy, and any new live-provider smoke remain deferred.

Open-source repository: <https://github.com/PracticalSwan/UniProof>

Read `AGENTS.md` before project work. `LESSONS.md` is the mandatory first manual project read at the start of every agent session.
