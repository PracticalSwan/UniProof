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

Phase 2 is complete at the in-memory backend boundary. Phase 2B and 2C provide deterministic source discovery with Tavily -> Brave -> direct/ROR degraded fallback, DNS-pinned bounded retrieval, HTML/plain-text normalization, multi-category source association, and truthful clean-empty versus operationally incomplete category state. Phase 2D provides multi-provider structured claim extraction with deterministic segmentation, exact supporting-text promotion, bounded Gemini quality escalation, Groq/OpenRouter Free fallback, provider-specific plus total request budgets, and per-document category scoping. Phase 2E provides candidate-traceable semantic reconciliation, deterministic authority/independence/scope/period evidence gates, category-level unknown versus operational incompleteness, and evidence-bounded explanation fallback. Phase 2F now joins B–E through `runPhase2Research`, resolves target identity once, propagates cancellation through discovery/retrieval/AI stages, derives a final 86-record provider-history ceiling while keeping discovery capped at 32, filters final claims to processed categories, rebuilds exact EvidenceSummary lifecycle state, and emits one validated/model-or-fallback explanation per processed category. Automated coverage remains offline and deterministic; on 2026-08-16 one explicitly authorized live smoke request succeeded for each configured Tavily, Brave, Gemini, Groq, and OpenRouter connection. Database migrations, Row Level Security, seed data, persistence, and live Research UI wiring remain intentionally deferred to later phases; Phase 3 Research Mode is next.

Open-source repository: <https://github.com/PracticalSwan/UniProof>

Read `AGENTS.md` before project work. `LESSONS.md` is the mandatory first manual project read at the start of every agent session.
