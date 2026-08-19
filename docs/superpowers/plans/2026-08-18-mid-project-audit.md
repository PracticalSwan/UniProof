# UniProof Mid-Project Audit Plan

Status: completed locally on reviewed Phase 4 commit `a56ebf80b070c90d7c7f98fd4ee01badc7cbdb57` plus the bounded audit fixes recorded below.

## Goal

Review the implemented Phase 0–4 product end to end before Phase 5, fix verified defects and unnecessary complexity, and preserve the evidence, privacy, provider, and browser-security boundaries already proven by prior phases.

## Scope

- Requirements/design/security consistency against the live implementation.
- Research contracts, provider/retrieval/orchestration, public dossier projection, API, and client transport.
- Research and Comparison state ownership, evidence UX, scoring/trade-offs, accessibility, responsive behavior, and browser security.
- Build/test tooling, dependency usage, dead or duplicated code, stale preview/runtime residue, and maintainability hotspots.
- Full offline verification plus deterministic dev and built-browser acceptance. No live provider call, deployment, publication, commit, push, authentication/persistence, or Phase 5 implementation.

## Review gates

1. Establish Git/config/test/screenshot baselines and preserve user-owned untracked screenshots.
2. Spec-compliance review: trace Phase 0–4 requirements through runtime code and retained tests.
3. Defect/security review: trust boundaries, races, error handling, cancellation, provenance, CSP, storage/exfiltration, and failure states.
4. Over-engineering review: remove or simplify only code proven dead, duplicated without value, or disproportionate to current requirements; preserve complexity that enforces a tested safety/correctness invariant.
5. For each verified defect, add a focused regression first where practical, apply the smallest coherent fix, and rerun the affected gate.
6. Run full Vitest, TypeScript, ESLint, production build, dependency audit, dev Playwright, built Playwright, workspace/diff/security scans, and final rendered/browser review.
7. Perform a final defect-first inline review and the required read-only native-GPT reviewer step if the host exposes an executable reviewer path.
8. Synchronize only canonical documentation and append project memory from observed results.

## Stop / escalation conditions

Escalate only if a fix requires destructive user-data changes, a major provider/evidence-contract redesign, authentication/persistence architecture, deployment/publication, paid services, or another difficult-to-reverse architectural change. Otherwise proceed with bounded reversible corrections automatically.

## Completion record

The audit found no architecture-wide redesign requirement. Three bounded improvements were applied: remove the obsolete cross-dossier `ComparisonTradeoff.claimIds` representation in favor of the already-correct target-scoped `evidenceRefs`; make `ComparisonResult.score` non-null because every producible result already has a deterministic score object; and classify the unused-at-runtime `shadcn` CLI as a development dependency instead of a production dependency. The existing Research/evidence/security/race-control layers were retained because each protects a distinct tested invariant rather than representing removable duplication.

Verification after the fixes: Vitest 346/346; TypeScript pass; ESLint pass; Next.js 16.3.1 production build pass; production dependency audit 0 vulnerabilities; `npm ci --dry-run --ignore-scripts` pass; dev Playwright 121/121; Comparison lifecycle 70/70 across five repetitions; built-application Playwright 121/121; workspace verifier pass; `git diff --check` pass; 211 project text files passed strict UTF-8/control scanning; five configured provider credential values had 0 hits across 300 source/build files; and the protected screenshot directory remained at 10 PNGs with all five audit-baselined hashes unchanged. No live provider request, deployment, authentication/persistence work, Phase 5 implementation, commit, or push occurred.

Remote Desktop Commander was requested, but its connector returned `FORBIDDEN: This conversation is restricted to developer MCPs` during this audit. No RDC evidence is claimed; CodexPro and the canonical Windows Node/npm/browser runtime supplied the executable verification evidence.
