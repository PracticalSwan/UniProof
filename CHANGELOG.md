# Changelog

All notable project changes are documented here while UniProof remains in pre-release hackathon development.

The project has not published a tagged release yet. Until the first release, completed and planned repository work is recorded under **Unreleased** and the canonical implementation status remains `docs/planning/tasks.md`.

## Unreleased

### Added

- Evidence-first Research Mode with a checked-in supported university/program catalog, structured browser-safe dossiers, exact source inspection, conflict/outdated/unknown/incomplete states, cancellation, retry, responsive browser acceptance, and hardened same-origin Research transport.
- Tavily discovery with Brave fallback, bounded SSRF-resistant retrieval, and structured Gemini -> Groq -> OpenRouter provider fallback with deterministic evidence gates.
- Comparison Mode for 2–4 compatible targets with immutable submissions, closed deterministic metric mappings, user-priority fit/coverage, score suppression for sparse evidence, explicit gaps, deterministic trade-offs, and target-scoped exact evidence references.
- Nonce-based production CSP, restrictive security headers, browser persistence/exfiltration tests, and isolated dev/built Playwright acceptance.
- Phase 5 Guide Mode with a strict browser-memory applicant profile, one supported-program target, public-only Research request derivation, closed exact requirement registry, six deterministic assessment states, evidence-gated GPA/English/budget/scholarship/deadline logic, risks, application-fee/document checklist items, deadline timeline, in-memory dossier reuse, exact retry/correction ownership, target-scoped evidence, catalog-owned official links, accessibility/responsive acceptance, and privacy/security browser coverage.
- Phase 6A optional Supabase passwordless email/PKCE authentication, server-derived private ownership, one RLS-protected immutable/versioned `saved_artifacts` table, strict bounded same-origin private APIs, explicit profile/Research/Comparison/Guide snapshot save/restore, account-bound memory-only restore handoff, and local Auth/Mailpit + pgTAP/browser acceptance.
- Phase 6B production hardening with a truthful 240-second whole-Research deadline under a 300-second host ceiling, Research-only request-cancellation configuration, abort-aware provider retry waits, sanitized raw deployment 429/504 handling, stable Gemini `v1/interactions`, release-configuration verification, least-privilege SHA-pinned GitHub Actions CI, and Vercel/WAF operations traceability for Phase 6C.
- Phase 6C anonymous judge release at `https://uniproof-beta.vercel.app`, with executable SHA `21d645baaf9eca381a167246d22538c23bb29427`, successful exact-SHA GitHub Actions run `32367630411`, Vercel Production deployment `dpl_3BppbKoR2sEshhGqoKStotZ7xyhN`, enforced exact `POST /api/research` 20/60s/IP WAF protection, Tavily -> Brave discovery, Groq -> OpenRouter structured AI, deterministic Production security/privacy/log verification, and explicit hosted Gemini/Supabase omissions. The three-call live Research budget is exhausted without a successful evidence-producing smoke; Devpost remains pending the final demo video.
- Side Phase UCE catalog expansion from the original 10 universities/14 programs across GB/TH/US to **30 universities and 45 computing programs across 11 closed country codes**, with one shared browser-safe country vocabulary, preserved stable IDs/ownership, collision-safe aliases, narrow official-host normalization, source-frozen primary navigation metadata, and regression coverage for new-country Research/Compare/Guide plus saved-artifact rebinding.
- GitHub-facing contribution, conduct, issue, and pull-request documentation.

### Changed

- Replaced Comparison's exact-total-100 numeric priority inputs with keyboard-accessible 0–100 relative sliders, deterministic positive-total normalization, all-zero fail-closed validation, and normalized evidence coverage while preserving version-1 saved snapshots. Also aligned Guide applicant-profile paired fields, title-cased qualification labels without changing canonical lowercase values, and documented the exact bounded 30-university/45-program catalog in README.
- Reclassified the `shadcn` CLI from a production dependency to an exact development dependency because runtime application code does not import it.
- Simplified Comparison result/provenance contracts by removing obsolete flat trade-off claim IDs and an impossible nullable result score state.
- Expanded README, requirements, design, security, threat-model, roadmap, and Phase 5/6 runbooks to reflect the reviewed/browser-verified Phase 0–6B local boundary while keeping Phase 6C deployment/live-service scope explicit.
- Replaced the nonce-bearing `next/script` Zod bootstrap with a nonce-authorized first-party static bootstrap to avoid development hydration/chunk instability without weakening CSP.
- Fixed Compare retry ownership after deployment 429/504 stops so explicit Retry includes both the failed target and immutable targets that were never dispatched after the terminal platform response.
- Made isolated Playwright origins authoritative across the Auth/Saved harness, including Mailpit Magic Link parsing and secondary browser contexts, removing hidden dependence on port 3102 during concurrent verification.

### Security

- Cross-dossier Comparison provenance is scoped by both target identity and dossier-local claim ID.
- Guide profile values remain browser-local by default and are excluded from the Research/provider request boundary, persistent browser storage, public URLs, and logs. Phase 6A adds only an explicit signed-in private Save into user-scoped RLS rows; browser marker tests cover outbound traffic, storage, reload/navigation, XSS-shaped text, and built-client leakage.
- Guide definitive assessments require compatible deterministic evidence/type/unit/currency/period gates; no fuzzy equivalency, GPA/test/currency conversion, conflict winner selection, ambiguous deadline scheduling, or admission probability is permitted. Unsupported-target correction is program-target-local across context edits, and factual Guide provenance is target-scoped only.
- Phase 6A private persistence derives ownership only from current server-validated Auth state, uses authenticated user-scoped Supabase clients plus minimum grants/RLS, exposes no ordinary UPDATE/service-role CRUD path, revalidates untrusted saved rows before restore, keeps restore state out of browser persistence/URLs, and preserves the applicant-to-provider non-transmission boundary.

## Changelog policy

- Add user-visible behavior, architecture/security boundary changes, important fixes, and dependency changes to `Unreleased` as they are verified.
- Do not record an implementation as complete until its acceptance gates have actually run and been observed.
- Move `Unreleased` entries into a versioned section only when the repository owner explicitly creates a release/tag.
- Avoid logging secrets, private applicant data, internal incident details, or unsupported claims in this public-facing file.
