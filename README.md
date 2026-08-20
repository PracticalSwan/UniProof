# UniProof

UniProof is an evidence-first AI platform for international students researching universities, comparing supported options, and turning published application requirements into an actionable plan.

The project is being developed for the Pixel Forge AI Hackathon 2026. Its core product rule is simple: important claims should remain traceable to evidence, and missing, stale, conflicting, or incomparable information should stay explicit instead of being guessed.

## Product modes

| Mode | Purpose | Status |
| --- | --- | --- |
| **Research** | Build structured university/program dossiers with source-level evidence, freshness, conflicts, unknowns, and partial-result handling | Implemented and browser-verified |
| **Compare** | Compare 2–4 compatible supported targets with deterministic user-priority fit, coverage, gaps, and exact evidence references | Implemented and browser-verified |
| **Guide** | Compare one applicant profile with one supported program's published requirements and derive risks, checklist items, deadlines, and official next steps | Implemented and browser-verified |

Detailed roadmap: [`docs/planning/tasks.md`](docs/planning/tasks.md)

Phase 5 architecture: [`docs/planning/phase-5-guide-mode.md`](docs/planning/phase-5-guide-mode.md)

## Why UniProof

University research is difficult because information is spread across official program pages, admissions pages, scholarship pages, government sources, datasets, rankings, and community material. UniProof is designed to preserve provenance rather than flatten those sources into one unsupported answer.

The current evidence model distinguishes verified, corroborated, university-reported, conflicting, anecdotal, inferred, outdated, unknown, and operationally incomplete information. Comparison and Guide add deterministic application-owned gates on top of that evidence instead of asking an AI model to invent a score or admission probability.

## Current architecture

```text
Supported catalog
      |
      v
POST /api/research
      |
      +--> Tavily -> Brave -> direct/structured degraded discovery
      +--> bounded DNS-pinned public retrieval
      +--> Gemini -> Groq -> OpenRouter structured extraction/reconciliation
      |
      v
validated ResearchDossier
      |
      +--> Research UI + exact evidence inspection
      |
      +--> deterministic Compare registry/scoring/trade-offs
      |
      +--> deterministic Guide profile assessment/checklist/timeline
      |
      +--> optional signed-in private snapshot save/restore through Supabase RLS
```

Important boundaries:

- provider credentials stay server-side;
- retrieved pages and model output are untrusted input;
- the browser validates the public Research response again before display;
- Comparison and Guide working state remain memory-first and never become provider/model inputs;
- Guide applicant profile values are not sent through the Research/provider chain; optional private persistence is explicit, signed-in, user-scoped, and RLS-protected;
- saved profile/Research/Comparison/Guide results are historical snapshots restored through one account-bound memory-only handoff, never URL/Web Storage state;
- conflicting/missing/incompatible evidence fails closed rather than becoming a guessed fact or zero score;
- production browser policy uses nonce-based CSP and restrictive security headers without third-party runtime analytics/scripts.

See [`docs/design.md`](docs/design.md), [`docs/security.md`](docs/security.md), and [`docs/security-threat-model.md`](docs/security-threat-model.md) for the maintained architecture and threat model.

## Supported catalog

The checked-in MVP catalog contains 30 universities and 45 computing programs across Belgium, Canada, Denmark, Finland, Germany, Italy, the Netherlands, Sweden, Thailand, the United Kingdom, and the United States. Research and downstream modes operate on supported catalog identity rather than arbitrary user-supplied university URLs.

Coverage remains deliberately bounded to this checked-in catalog; arbitrary/global university ingestion is outside the current MVP.

## Tech stack

- Next.js 16.3.1 + React 19.2.8 + TypeScript
- Tailwind CSS + shadcn/ui/Radix primitives
- Zod runtime validation
- Supabase SSR/Auth + PostgreSQL/RLS for optional private saved snapshots
- Tavily primary discovery with Brave Search fallback
- ROR and approved structured/public sources
- Gemini free primary structured AI, Groq Free fallback, OpenRouter Free final fallback
- Vitest unit/integration testing
- Playwright browser/E2E testing

## Local development

### Prerequisites

- Node.js `>=20.9.0`
- npm `10.9.3` or compatible npm from the declared package manager

### Install

```bash
npm ci
```

### Start the development server

```bash
npm run dev
```

Then open the local URL printed by Next.js.

### Provider configuration

Automated unit/browser tests are designed to remain deterministic and offline. Live Research requires provider credentials.

Run:

```bash
npm run setup:providers
```

The repository-owned setup flow manages the supported environment-key names without committing or echoing secrets. Keep `.env.local` private and untracked.

### Optional local Auth and Saved snapshots

Phase 6A supports local Supabase passwordless email Auth and private saved snapshots without making accounts mandatory. With the Supabase CLI installed:

```bash
supabase start
supabase db reset
supabase test db
```

Configure only the local public browser values `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the local Supabase stack in your ignored local environment, then start Next.js normally. Local Magic Links are delivered to the Supabase Mailpit development inbox. **Do not put a service-role key in browser variables or ordinary saved-artifact routes.** Hosted Supabase configuration is intentionally deferred to Phase 6C.

### Verification commands

```bash
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
npm audit --omit=dev
```

The full project workflow contains additional built-browser, race-repeat, encoding, secret-boundary, and workspace-integrity checks documented in the phase plans.

## Repository structure

```text
app/                 Next.js routes and page shells
components/          Research, Compare, shared evidence, layout, and UI components
lib/research/        Catalog, discovery, retrieval, extraction, reconciliation, Research API/client contracts
lib/comparison/      Deterministic Comparison contracts, metric registry, scoring, trade-offs, client state
lib/guide/           Deterministic Guide contracts, assessment, planning, registry, client state
lib/auth/            Server-derived session assurance and sanitized Auth contracts
lib/persistence/     Versioned saved-artifact schemas, bounded bodies, private API/client logic
supabase/             Local config, migration, Mailpit template, seed policy, pgTAP database tests
docs/planning/       Canonical implementation architecture/specifications
docs/superpowers/    Detailed task-by-task execution runbooks
tests/               Vitest suites and deterministic fixtures
tests/e2e/           Playwright browser acceptance
scripts/             Provider setup and workspace verification
```

Phase 5 Guide is implemented under `lib/guide/` and `components/guide/`. Phase 6A layers optional Auth/Saved behavior around the existing Research/Compare/Guide semantics without introducing provider-aware applicant processing.

## Documentation

- [Requirements](docs/requirements.md)
- [Design and architecture](docs/design.md)
- [Security model](docs/security.md)
- [Security/privacy threat model](docs/security-threat-model.md)
- [Data sources](docs/data-sources.md)
- [Implementation roadmap](docs/planning/tasks.md)
- [Phase 5 Guide specification](docs/planning/phase-5-guide-mode.md)
- [Phase 5 execution plan](docs/superpowers/plans/2026-08-18-phase-5-guide-mode.md)
- [Phase 6 hardening/submission specification](docs/planning/phase-6-hardening-submission-readiness.md)
- [Phase 6A identity/persistence execution plan](docs/superpowers/plans/2026-08-19-phase-6a-identity-persistence.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

`AGENTS.md`, `AGENT_MEMORY.md`, and `LESSONS.md` define the repository's AI-development workflow and accumulated project constraints. Contributors using coding agents should read those files before modifying the project.

## Security and privacy

Do not commit API keys, database credentials, `.env` files, private applicant data, or sensitive documents. Do not put suspected credentials, private data, or exploitable details in a public GitHub issue.

Research sends only public research context through the configured search/AI providers. Guide sends only the supported program plus optional intake/year through the existing Research boundary. Applicant academic/financial profile values stay browser-local unless the signed-in user explicitly chooses **Save profile**, in which case the validated profile is stored only in that user's RLS-protected Supabase rows and is still excluded from Research/provider traffic.

See [`SECURITY.md`](SECURITY.md) before reporting a vulnerability or changing a trust boundary.

## Contributing

Contributions are welcome while the project remains under active hackathon development. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull requests should include focused scope, appropriate regression coverage, security/privacy impact, and documentation/changelog updates when public behavior changes.

Never use a real person's academic/private information in fixtures, bug reports, screenshots, or traces.

## Development status

Phase 0–6B are implemented through the local reviewed/browser-verified boundary. Optional Supabase passwordless Auth, user-scoped RLS persistence, explicit saved profile/Research/Comparison/Guide snapshots, the 240-second Research execution budget, Research-only host-cancellation configuration, sanitized deployment 429/504 handling, Gemini stable-v1 transport, release-configuration verification, and least-privilege GitHub Actions CI are implemented locally. Durable Vercel WAF enforcement, hosted Supabase/Auth verification, actual GitHub Actions execution, public deployment, production TLS/HSTS/domain verification, live-provider smoke, and Devpost submission remain Phase 6C work.

No README statement should be treated as proof of a live public deployment or currently available service endpoint.

## License

This project is licensed under the terms in [`LICENSE`](LICENSE).
