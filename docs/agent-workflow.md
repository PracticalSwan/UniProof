# UniProof Agentic Development Workflow

## Controller Model

The main agent is the command center. It owns task classification, scope, architecture, security decisions, integration, verification, and final reporting.

Use specialists when domain isolation materially improves the result. Do not recursively delegate. Prefer one primary implementer for one coherent change; use up to three specialists only when work is genuinely independent.

Every specialist must receive:

- exact task boundary;
- files or subsystem in scope;
- explicit non-goals/protected areas;
- relevant requirements and acceptance criteria;
- expected return artifact or evidence;
- read-only vs write permissions appropriate to the role.

The controller must verify specialist conclusions against live files, tests, rendered behavior, or primary sources before integration.

## Standard Stage Gates

### 1. Orient

- Read `LESSONS.md` first.
- Read `AGENT_MEMORY.md` and verify changing facts.
- Read the nearest requirement/design/plan files.
- Inspect the real target and Git state when relevant.

### 2. Plan

- Use `development-workflow` for multi-stage features.
- Resolve API/data/security boundaries before implementation.
- Write measurable acceptance criteria and verification steps.

### 3. Implement

Route by ownership:

| Work | Primary agent | Core skills |
| --- | --- | --- |
| UI/product workspace | `ui-designer` | `frontend-design`, `react-development`, `nextjs-development` |
| API contract | `api-designer` | `development-workflow`, current official docs |
| Server/API code | `backend-developer` | `nextjs-development`, `javascript-development`, `codebase-design` as needed |
| Source ingestion/normalization | `data-engineer` | `research`, data-contract skills relevant to the actual implementation |
| Complex TypeScript types/contracts | `typescript-pro` | TypeScript/compiler evidence |
| Tests | `test-automator` | `web-testing`, `playwright`, `agentic-eval` when appropriate |

Implementation agents may write only inside the assigned boundary. Research, review, and security roles stay read-only unless remediation is separately assigned.

### 4. Verify

Run the narrowest checks that prove the changed behavior:

- type/schema/compile checks;
- unit or integration tests;
- real browser flow for user-facing changes;
- source/evidence assertions for AI research behavior;
- failure-path checks for external providers;
- security checks when a trust boundary changes.

Do not substitute an import/build success for a real behavior check when the application can be exercised.

### 5. Review

Use `code-reviewer` after the implementation is stable for substantive changes. Use `security-auditor` when auth, retrieval, secrets, user data, external URLs, or public deployment are affected. Use `requirements-traceability` before release or after a large feature batch.

### 6. Close

- Re-run affected verification after confirmed review fixes.
- Update behavior/docs only when their source of truth changed.
- Append the meaningful session outcome to `AGENT_MEMORY.md`.
- Add a `LESSONS.md` entry only when there is a reusable process correction.
- Report changed files, commands/tests run, evidence level, skipped checks, and residual risk.

## Research Workflow

For university/provider research:

1. Define the exact claim or field being investigated.
2. Prefer primary/official sources and current provider documentation.
3. Use bounded search to discover candidate sources.
4. Open/check the underlying source instead of trusting a search snippet.
5. Extract claim-level evidence and date context.
6. Detect conflicts and missing evidence before generating a summary.
7. Store or return source metadata with the claim.

Use `docs-researcher` for versioned APIs/provider documentation and the `research`/`tavily-search` skills for bounded source work.

## Platform CLI Workflow

The host already provides the Windows Supabase, Vercel, and GitHub CLIs documented in `AGENTS.md`; agents should use those existing tools rather than adding duplicate project dependencies. Under CodexPro's WSL-mounted shell, invoke them through the Windows `cmd.exe` bridge when the direct Windows executable/toolchain is not resolvable; Supabase/Vercel use the Windows Node toolchain while `gh` is a native Windows CLI.

Treat these CLIs as operator interfaces, not blanket permission. Start with read-only discovery that proves the exact account/project/repository and current configuration. Local disposable Supabase development/testing is allowed when the active implementation task authorizes it, but hosted project linking/migration/Auth changes, Vercel project/env/domain/firewall/deployment changes, GitHub remote mutations, live provider/quota use, and publication still require the explicit authorization defined in `AGENTS.md`. Never use the CLIs for credential extraction, destructive remote cleanup, unauthorized access, security/rate-limit bypass, malicious traffic, or any action outside the UniProof task. Do not print or persist secret-bearing CLI output.

For Phase 6 specifically, use this progression: local Supabase migrations/Auth/RLS tests in 6A -> local production hardening/configuration/CI in 6B -> read-only remote target discovery, dry-run, separately authorized hosted changes, Preview, Production, and publication in 6C. A successful CLI command is execution evidence only for the exact action observed; it does not prove higher-level deployment/security acceptance by itself.

## Public Release Workflow

Publication is a distinct phase and always requires explicit user authorization. Before a release, re-verify Devpost requirements, repository visibility, license, deployed URL, demo video, secrets scan, core E2E flow, responsive UI, and the exact commit/artifact being submitted.
