# UniProof Project Closure

> **Closed as of 2026-09-23.** The source repository and useful engineering conventions are retained. The Vercel project is gone, no UniProof project appears in the connected Supabase account, and the owner will archive GitHub separately.

This record describes the observed closure boundary. It does not authorize re-creating hosted resources or changing provider-dashboard credentials. Source adapters, local database migrations, plans, tests, historical release evidence, and the local CodeGraph index remain available for reference or a future explicitly reactivated project.

## Final verified state

| Area | Observed state |
| --- | --- |
| Vercel | The `uniproof` project was deleted from `practicalswans-projects`. A fresh connected-account project listing had no UniProof match; the former `https://uniproof-beta.vercel.app` alias returned HTTP 404 on 2026-09-23. The prior deletion check also returned `project_not_found`. Deployments, aliases, project settings, and project-scoped environment variables were removed with the project. |
| Supabase | A fresh connected-account project listing had no UniProof match. No Supabase project was deleted. An unrelated inactive project was left untouched. |
| Local credentials and runtime state | The following project-local paths were absent on 2026-09-23: `.env.local`, `.vercel/`, `.next/`, `node_modules/`, `.playwright-cli/`, `test-results/`, `supabase/.temp/`, `supabase/.branches/`, `output/`, and `tsconfig.tsbuildinfo`. The separately named Docker volume `supabase_edge_runtime_uniproof` was also absent. |
| CodeGraph | `.codegraph/` was explicitly retained and remains ignored by Git. `codegraph status` reported an up-to-date index with 247 files, 3,489 nodes, and 12,320 edges. Do not include it in project cleanup unless the owner changes this instruction. |
| Source and protected files | Application source, migrations, `.env.example`, scripts, tests, project guidance, and historical documentation remain. `sithu-win.png` and `ui-flow-screenshots/` remain present and untracked; they were not staged for this closeout. |
| GitHub | `PracticalSwan/UniProof` reported `archived: false` on 2026-09-23. The owner retains the archive action. This closeout may publish its expressly authorized documentation commit, but does not change repository settings, visibility, secrets, branches, or archive state. |
| Devpost | The event deadline has passed. The current Devpost entry/submission state was not checked and is not established by this repository. The draft and recording assets are historical. |

## Credential and tool boundary

- No API keys or credentials were removed from provider websites. No provider-dashboard credential state was changed or freshly audited during this closeout.
- Global Vercel, Supabase, GitHub, Node, and other CLI installations and account sessions were left intact.
- Other Vercel and Supabase account resources were not changed. No Supabase project matched UniProof, so no Supabase deletion was performed.
- Runtime provider adapters remain in the repository. Their presence is source code only and does not mean a hosted project or valid local credential exists.

## Retained implementation and verification boundary

The repository remains a usable source/reference project containing the Research, Compare, and Guide implementation, provider adapters, local Supabase configuration and migrations, test suites, and project-specific instructions. Its last recorded full implementation verification belongs to the 2026-08-23 release history in [`vercel-production.md`](vercel-production.md) and the Phase 6 plans. This documentation/configuration-only closure changed no runtime source and did not reinstall dependencies or rerun application tests/builds; local dependencies and build outputs were intentionally removed.

## Closeout verification (2026-09-23)

- `pwsh -NoProfile -File scripts/verify-workspace.ps1`: **PASS**; 20 required files present and Git initialized.
- `py -3 'C:\Users\LOQ\.codex\skills\documentation-verification\scripts\doc-link-check.py' @paths`, where `$paths` contains the changed Markdown paths: **PASS**; all checked local Markdown links resolved. This checker is supplied by the local `documentation-verification` skill and is not part of the repository.
- `git diff --check`: **PASS**, exit code 0; Git emitted only its informational LF-to-CRLF working-copy notices, with no whitespace errors.
- `codegraph status`: **PASS**; index up to date with 247 files, 3,489 nodes, and 12,320 edges.
- Bounded local secret-pattern scan of added documentation lines: **PASS**, zero matches. `gitleaks`, `trufflehog`, `detect-secrets`, and a secret-scanning MCP were unavailable, so this is not a history-wide credential scan. No secret values were printed.
- A read-only provider project-list check found no UniProof match in Vercel or Supabase. The former Vercel alias returned HTTP 404. GitHub reported `archived: false`.
- Application tests, type checks, lint, and builds were **not rerun** for this documentation/closure update; `node_modules/` and `.next/` were intentionally removed. The last recorded application/release verification is dated 2026-08-23 and remains historical.

## Historical release record

The last recorded production executable was `e2ae1414c6f856a0bdeb2aa8a473dcb32215ab3c`, with GitHub Actions run `32629551286`, on 2026-08-23. The Vercel project was subsequently deleted on 2026-09-23. Historical release details and controls are preserved in [`vercel-production.md`](vercel-production.md), [`phase-6-requirements-traceability.md`](../planning/phase-6-requirements-traceability.md), and [`AGENT_MEMORY.md`](../../AGENT_MEMORY.md).
