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
      +--> structured AI extraction/reconciliation
           hosted release: Groq -> OpenRouter
           Gemini adapter retained/tested but not configured publicly
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
- arbitrary general-web sources remain `inferred` and cannot manufacture `corroborated` status; corroboration is reserved for application-owned reliable source classes with distinct owners and origins;
- the browser validates the public Research response again before display;
- Comparison and Guide working state remain memory-first and never become provider/model inputs;
- Guide applicant profile values are not sent through the Research/provider chain; optional private persistence is explicit, signed-in, user-scoped, and RLS-protected;
- saved profile/Research/Comparison/Guide results are historical snapshots restored through one account-bound memory-only handoff, never URL/Web Storage state;
- saved Comparison/Guide derivations are recomputed with the version-1 deterministic algorithms on write/read, and restored private state is cleared when its account signs out or changes;
- conflicting/missing/incompatible evidence fails closed rather than becoming a guessed fact or zero score;
- production browser policy uses nonce-based CSP and restrictive security headers without third-party runtime analytics/scripts.

See [`docs/design.md`](docs/design.md), [`docs/security.md`](docs/security.md), and [`docs/security-threat-model.md`](docs/security-threat-model.md) for the maintained architecture and threat model.

## Supported catalog

The checked-in MVP catalog contains **30 universities and 45 computing programs across 11 country codes** (`BE`, `CA`, `DE`, `DK`, `FI`, `GB`, `IT`, `NL`, `SE`, `TH`, `US`). Research and downstream modes operate on supported catalog identity rather than arbitrary user-supplied university URLs. Coverage is deliberately bounded; UniProof does **not** claim global university coverage.

| Country | University | Supported program(s) |
| --- | --- | --- |
| BE | KU Leuven | Master of Artificial Intelligence |
| CA | McGill University | B.Sc. Major in Computer Science; M.Sc. Computer Science (Non-Thesis) |
| CA | University of Alberta | Master of Science (Course-Based) in Computing Science, Multimedia |
| CA | University of British Columbia | Computer Science Major (BSc); MSc Computer Science |
| CA | University of Toronto | Computer Science Admission Category (St. George); Applied Computing MScAC — Artificial Intelligence Concentration |
| CA | University of Waterloo | Bachelor of Computer Science; Master of Mathematics (Computer Science) |
| DE | RWTH Aachen University | Data Science M.Sc.; Human-Centered Intelligent Systems M.Sc. |
| DE | Technical University of Munich | Informatics M.Sc. |
| DK | Technical University of Denmark | Master of Science in Engineering (Computer Science and Engineering) |
| FI | Aalto University | Machine Learning, Data Science and Artificial Intelligence, Master of Science (Technology) |
| GB | Imperial College London | Computing BEng |
| GB | The University of Edinburgh | Artificial Intelligence BSc (Hons); Artificial Intelligence MSc |
| GB | University College London | Computer Science BSc |
| IT | Politecnico di Milano | Computer Science and Engineering |
| NL | Delft University of Technology | MSc Computer Science |
| NL | University of Amsterdam | MSc Artificial Intelligence |
| SE | KTH Royal Institute of Technology | MSc Computer Science |
| TH | Chulalongkorn University | Bachelor of Engineering: Computer Engineering (CP); Master of Science Program in Computer Science and Information Technology |
| TH | King Mongkut's University of Technology Thonburi | Bachelor of Science in Computer Science (English Program); Master of Science in Computer Science |
| TH | Mahidol University | Master of Science in Computer Science |
| US | Carnegie Mellon University | Bachelor of Science in Artificial Intelligence; Bachelor of Science in Computer Science |
| US | Cornell University | Computer Science, B.S. (Engineering); Computer Science, M.Eng. |
| US | Georgia Institute of Technology | Bachelor of Science in Computer Science |
| US | Massachusetts Institute of Technology | Bachelor of Science in Artificial Intelligence and Decision Making (Course 6-4); Bachelor of Science in Computer Science and Engineering (Course 6-3) |
| US | Stanford University | Computer Science Bachelor's Program |
| US | University of California, Berkeley | Computer Science |
| US | University of California San Diego | B.S. Artificial Intelligence; B.S. Computer Science; M.S. Computer Science |
| US | University of Illinois Urbana-Champaign | B.S. in Computer Science; Master of Computer Science in Urbana-Champaign |
| US | University of Michigan–Ann Arbor | Computer Science Major (Engineering); Master's in Computer Science and Engineering |
| US | University of Washington, Seattle | B.S. Computer Science (Seattle) |

`lib/research/catalog/data.ts` is the canonical catalog source; this table should be updated with it whenever catalog coverage changes.

## Tech stack

- Next.js 16.3.1 + React 19.2.8 + TypeScript
- Tailwind CSS + shadcn/ui/Radix primitives
- Zod runtime validation
- Supabase SSR/Auth + PostgreSQL/RLS for optional private saved snapshots
- Tavily primary discovery with Brave Search fallback
- ROR and approved structured/public sources
- Provider-neutral structured AI adapters for Gemini, Groq, and OpenRouter; the hosted hackathon release uses Groq -> OpenRouter and intentionally leaves Gemini unconfigured because current Gemini API terms are incompatible with an API client likely to be accessed by under-18 applicants
- Vitest unit/integration testing
- Playwright browser/E2E testing

## Local development

### Prerequisites

- Node.js `22.x` (the package/lockfile release contract is pinned to Node 22)
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

Configure only the local public browser values `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the local Supabase stack in your ignored local environment, then start Next.js normally. Local Magic Links are delivered to the Supabase Mailpit development inbox and must be opened in the same browser that requested them; a short-lived intent cookie rejects cross-browser account swapping. **Do not put a service-role key in browser variables or ordinary saved-artifact routes.** The public hackathon deployment intentionally leaves hosted Supabase browser/Auth variables absent because production email delivery is not configured; anonymous Research/Compare/Guide remains the judge-facing release.

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

## Release status

The anonymous Phase 0-6C application is live at **https://uniproof-beta.vercel.app**. The verified executable revision is Git SHA `f797e0a692f113a29b3f4aa3491a216ead292b2a`; GitHub Actions run `32545347640` succeeded on that exact SHA, and Vercel Production deployment `dpl_8pYdBJEyvcohHuMm2e2cXt7cAYm7` is metadata-bound to it and serves the canonical alias. The expensive public Research route is protected by one Vercel WAF rule scoped exactly to `POST /api/research`, fixed-window **20 requests / 60 seconds / source IP**, returning 429 on excess. Production browser policy uses request nonces, `connect-src 'self'`, private/no-store caching, and Vercel-delivered HSTS. Hosted discovery is Tavily -> Brave; hosted structured AI is Groq -> OpenRouter. Gemini and hosted Supabase Auth/save are intentionally absent from the public environment for the release reasons documented above.

The 2026-08-22 reliability pass removed request amplification without raising global time or attempt budgets: long provider `Retry-After` windows now fail over instead of being clamped into immediate retries, persistent provider unavailability is remembered for the remainder of one Research run, discovery uses the same bounded persistent-failure circuit, broad documents are routed/scheduled by category intent, and Compare defaults request only categories that can affect positive default weights. Source-gap claims remain visible in Research but are non-definitive in Compare and Guide.

The historical Phase 6C smoke budget remains **3/3 accepted live Research executions**. The separate final-testing allowance used **1/5 accepted execution**: Edinburgh Artificial Intelligence MSc, Research only, returned HTTP 200 in about **18.6 seconds** with one source, zero claims, and a sanitized `provider-error` source gap. This is not claimed as successful evidence production; it verifies that the formerly ~161-second live failure path now terminates quickly and fail-closed under current provider pressure. One preceding malformed public request returned HTTP 400 before Research execution and is not counted. Accounting is therefore **3 historical + 1 final-testing = 4 accepted executions total**.

The verified executable tree passed **625/625 Vitest tests**, TypeScript, ESLint, production build, release/workspace verification, and `npm audit --omit=dev` with zero vulnerabilities. Browser verification passed Compare **63/63**, Guide **55/55**, Research **70/70**, and local Supabase Auth/Saved **12/12**. Production mobile/desktop route smoke loaded all four core routes in 8/8 checks with zero console/page errors; the deployed `/research` bundle remained same-origin and free of configured-secret matches/provider-key markers/source-map markers. Release screenshots under `docs/assets/screenshots/phase-6/` remain deterministic presentation evidence, not live-provider outputs.

Devpost remains deliberately **not submitted** until the final approximately three-minute public demo video is supplied and reviewed. Draft submission text, recording script, and the final checklist are under `docs/submission/`.

## License

This project is licensed under the terms in [`LICENSE`](LICENSE).
