# Contributing to UniProof

UniProof is under active hackathon development. Contributions should preserve the project's evidence-first behavior, privacy boundaries, deterministic fallbacks, and narrow scope.

## Before you start

Read these sources of truth before changing the project:

1. `LESSONS.md`
2. `AGENT_MEMORY.md`
3. `AGENTS.md`
4. `docs/planning/tasks.md`
5. `docs/requirements.md`
6. `docs/design.md`
7. `docs/security.md`

For phase-specific work, also read the relevant file under `docs/planning/` and its execution runbook under `docs/superpowers/plans/`.

## Development setup

Requirements:

- Node.js `>=20.9.0`
- npm compatible with the repository's declared `packageManager`

Install dependencies:

```bash
npm ci
```

Start the application:

```bash
npm run dev
```

Live Research provider configuration is optional for ordinary deterministic tests. When needed, use:

```bash
npm run setup:providers
```

Never commit `.env.local`, credentials, tokens, or copied provider responses containing private/sensitive data.

## Working principles

- Make the smallest coherent change that satisfies the active requirement.
- Preserve unrelated/user-owned changes in the working tree.
- Read existing contracts/tests before introducing a new abstraction or dependency.
- Do not weaken evidence, privacy, SSRF, CSP, request-bound, cancellation, or provenance controls for convenience.
- Missing/conflicting/stale/incompatible information must remain explicit rather than guessed.
- Do not introduce admission probabilities or guarantees.
- Do not add a provider/model call where deterministic application logic is sufficient.
- Do not introduce persistence/authentication or a new public API without the architecture/security review required by the project docs.
- Keep real applicant/private data out of source, fixtures, screenshots, traces, issues, and pull requests.
- Use UTF-8 without BOM and preserve existing repository formatting/conventions.

## Tests and verification

Run the smallest relevant test first while developing, then the full gates required by the phase plan.

Common checks:

```bash
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
npm audit --omit=dev
```

Browser/race/security-sensitive work may require repeated Playwright suites, built-application acceptance, workspace verification, `git diff --check`, encoding scans, and secret/client-boundary scans. Follow the active phase plan instead of treating the short command list above as exhaustive.

Do not claim a verification level that was not actually run and observed.

## Test data

Use invented values only. Do not use a real person's:

- name/contact information;
- GPA/test scores linked to identity;
- citizenship or financial data linked to identity;
- transcripts/passports/national IDs;
- application documents;
- private emails/messages.

Public university/program/source information may be used when it is appropriate to the test and does not expose credentials/private data.

## Pull requests

Keep pull requests focused. Include:

- what changed and why;
- affected requirements/architecture boundaries;
- tests and verification actually run;
- security/privacy impact;
- screenshots for meaningful UI changes using invented data and non-protected output paths;
- documentation/changelog updates for user-visible or architectural changes;
- known limitations or skipped verification with reasons.

Do not include secrets, private data, generated dependency folders, disposable Playwright harness snapshots, or protected project screenshots unless the task explicitly authorizes them.

Use `.github/pull_request_template.md` as the final checklist.

## Issues

Use the GitHub issue templates for reproducible bugs and scoped feature proposals. Before filing a bug, search existing issues and include enough deterministic reproduction detail to distinguish a product defect from provider/network availability.

Do **not** report vulnerabilities, credentials, private applicant data, or exploit details in a public issue. Follow `SECURITY.md` instead.

## Commit and release scope

Repository automation/agents must not create commits, push branches, open/merge pull requests, deploy, publish, or create releases unless the active task/user authorization explicitly permits those external actions.

Release/version state is recorded in `CHANGELOG.md`; no release should be claimed until its tag/release is actually created and verified.

## Code of Conduct

Participation in this project is governed by `CODE_OF_CONDUCT.md`.
